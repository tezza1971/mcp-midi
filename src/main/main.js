const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const express = require('express');
const fs = require('fs');

// Import our custom modules
const MidiManager = require('../common/midi-manager');
const SongCache = require('../common/song-cache');
const { startPythonServer } = require('../common/python-server');

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;

// Path to the song cache directory
const SONG_CACHE_DIR = path.join(app.getPath('userData'), 'song_cache');

// Path to the config file
const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');

// Default configuration
let config = {
  mcpPort: 3000,
  pythonPort: 5000,
  lastUsedSong: null
};

// Global instances of our managers
let songCache;
let midiManager;
let pythonServer;
let mcpServer;

// Load configuration
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      const loadedConfig = JSON.parse(data);
      config = { ...config, ...loadedConfig };
      console.log('Loaded configuration:', config);
    } else {
      saveConfig();
    }
  } catch (error) {
    console.error('Error loading configuration:', error);
  }
}

// Save configuration
function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log('Saved configuration:', config);
  } catch (error) {
    console.error('Error saving configuration:', error);
  }
}

// Initialize Express server for MCP API
function initMcpApi() {
  mcpServer = express();
  mcpServer.use(express.json({ limit: '10mb' }));
  
  // Endpoint to receive NoteSequence JSON from LLMs
  mcpServer.post('/api/song', (req, res) => {
    try {
      const noteSequence = req.body;
      
      // Save to cache
      const result = songCache.saveSong(noteSequence);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      // Update last used song in config
      config.lastUsedSong = result.filename;
      saveConfig();
      
      // Notify the renderer process about the new song
      if (mainWindow) {
        mainWindow.webContents.send('song-updated', result);
      }
      
      res.status(200).json({ success: true, timestamp: result.timestamp });
    } catch (error) {
      console.error('Error processing song:', error);
      res.status(500).json({ error: 'Failed to process song' });
    }
  });
  
  // Get current song
  mcpServer.get('/api/song', (req, res) => {
    try {
      const latestSong = songCache.getLatestSong();
      
      if (!latestSong) {
        return res.status(404).json({ error: 'No songs found' });
      }
      
      res.status(200).json(latestSong);
    } catch (error) {
      console.error('Error retrieving song:', error);
      res.status(500).json({ error: 'Failed to retrieve song' });
    }
  });
  
  // Get MIDI instrument information
  mcpServer.get('/api/instruments', (req, res) => {
    try {
      const instruments = midiManager.getGeneralMidiInstruments();
      res.status(200).json(instruments);
    } catch (error) {
      console.error('Error retrieving instruments:', error);
      res.status(500).json({ error: 'Failed to retrieve instruments' });
    }
  });
  
  // Get MIDI drum kit information
  mcpServer.get('/api/drums', (req, res) => {
    try {
      const drums = midiManager.getGeneralMidiDrumKits();
      res.status(200).json(drums);
    } catch (error) {
      console.error('Error retrieving drum kits:', error);
      res.status(500).json({ error: 'Failed to retrieve drum kits' });
    }
  });
  
  // Start the server
  const PORT = config.mcpPort;
  mcpServer.listen(PORT, () => {
    console.log(`MCP API server running on port ${PORT}`);
    if (mainWindow) {
      mainWindow.webContents.send('mcp-server-status', { running: true, port: PORT });
    }
  });
}

// Create the main application window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  
  // Load the index.html file
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  
  // Open DevTools in development mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
  
  // Create application menu
  createAppMenu();
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create application menu
function createAppMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Settings',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('open-settings');
            }
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'MIDI',
      submenu: [
        {
          label: 'Stop All Notes',
          click: () => {
            if (midiManager) {
              midiManager.stopPlayback();
            }
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('show-about');
            }
          }
        },
        {
          label: 'Documentation',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://github.com/yourusername/mcp-midi');
          }
        }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Setup IPC handlers for renderer communication
function setupIpcHandlers() {
  // Get the current song
  ipcMain.handle('get-current-song', () => {
    return songCache.getLatestSong();
  });
  
  // Get the list of songs
  ipcMain.handle('get-song-list', () => {
    return songCache.getSongList();
  });
  
  // Play MIDI notes
  ipcMain.handle('play-midi', async (event, noteSequence) => {
    return await midiManager.playNoteSequence(noteSequence, (progress) => {
      // Send progress updates to the renderer
      if (mainWindow) {
        mainWindow.webContents.send('playback-progress', progress);
      }
    });
  });
  
  // Get available MIDI outputs
  ipcMain.handle('get-midi-outputs', () => {
    return midiManager.getOutputs();
  });
  
  // Get General MIDI instruments
  ipcMain.handle('get-midi-instruments', () => {
    return midiManager.getGeneralMidiInstruments();
  });
  
  // Get General MIDI drum kits
  ipcMain.handle('get-midi-drums', () => {
    return midiManager.getGeneralMidiDrumKits();
  });
  
  // Import MIDI file
  ipcMain.handle('import-midi-file', async (event, filePath) => {
    try {
      // This would use the Python backend to convert MIDI to NoteSequence
      // For now, we'll return a simple error
      return { success: false, error: 'MIDI import not implemented yet' };
    } catch (error) {
      console.error('Error importing MIDI file:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Export MIDI file
  ipcMain.handle('export-midi-file', async (event, noteSequence, filePath) => {
    try {
      // This would use the Python backend to convert NoteSequence to MIDI
      // For now, we'll return a simple error
      return { success: false, error: 'MIDI export not implemented yet' };
    } catch (error) {
      console.error('Error exporting MIDI file:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Get application configuration
  ipcMain.handle('get-config', () => {
    return config;
  });
  
  // Update application configuration
  ipcMain.handle('update-config', async (event, newConfig) => {
    try {
      // Update config
      const oldMcpPort = config.mcpPort;
      config = { ...config, ...newConfig };
      saveConfig();
      
      // Check if MCP port changed
      if (oldMcpPort !== config.mcpPort && mcpServer) {
        // Close the current server
        mcpServer.close(() => {
          console.log(`Closed MCP server on port ${oldMcpPort}`);
          // Restart the server with the new port
          initMcpApi();
        });
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error updating configuration:', error);
      return { success: false, error: error.message };
    }
  });
}

// App lifecycle events
app.on('ready', () => {
  // Load configuration
  loadConfig();
  
  // Initialize our managers
  songCache = new SongCache(SONG_CACHE_DIR);
  midiManager = new MidiManager();
  
  // Start the Python server if needed
  // Commented out for now as we're not using it in the MVP
  // pythonServer = startPythonServer(!app.isPackaged);
  
  // Create the window and set up handlers
  createWindow();
  setupIpcHandlers();
  initMcpApi();
});

app.on('window-all-closed', () => {
  // Clean up resources
  if (midiManager) {
    midiManager.cleanup();
  }
  
  // Quit the app on all platforms except macOS
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, recreate the window when the dock icon is clicked
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('quit', () => {
  // Final cleanup
  if (midiManager) {
    midiManager.cleanup();
  }
  
  // Kill the Python server if it's running
  if (pythonServer && pythonServer.process) {
    pythonServer.process.kill();
  }
});