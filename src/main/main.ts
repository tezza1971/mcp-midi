import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import path from 'path';
import express, { Request, Response } from 'express';
import fs from 'fs';
import isDev from 'electron-is-dev';

// Import our custom modules
import MidiManager from '../common/midi-manager';
import SongCache from '../common/song-cache';
import { startPythonServer } from '../common/python-server';
import { AppConfig, ConfigUpdateResult, McpServerStatus, NoteSequence, PlayMidiResult, PlaybackProgress, SaveSongResult } from '../types';

// Keep a global reference of the window object to prevent garbage collection
let mainWindow: BrowserWindow | null = null;

// Path to the song cache directory
const SONG_CACHE_DIR = path.join(app.getPath('userData'), 'song_cache');

// Path to the config file
const CONFIG_FILE = path.join(app.getPath('userData'), 'config.json');

// Default configuration
let config: AppConfig = {
  mcpPort: 3000,
  pythonPort: 5000,
  lastUsedSong: null
};

// Global instances of our managers
let songCache: SongCache;
let midiManager: MidiManager;
let pythonServer: ReturnType<typeof startPythonServer> | null = null;
let mcpServer: express.Application;
let mcpServerInstance: ReturnType<typeof mcpServer.listen> | null = null;

// Load configuration
function loadConfig(): void {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      const loadedConfig = JSON.parse(data) as Partial<AppConfig>;
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
function saveConfig(): void {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log('Saved configuration:', config);
  } catch (error) {
    console.error('Error saving configuration:', error);
  }
}

// Initialize Express server for MCP API
function initMcpApi(): void {
  mcpServer = express();
  mcpServer.use(express.json({ limit: '10mb' }));
  
  // Endpoint to receive NoteSequence JSON from LLMs
  mcpServer.post('/api/song', (req: Request, res: Response) => {
    try {
      const noteSequence = req.body as NoteSequence;
      
      // Save to cache
      const result = songCache.saveSong(noteSequence);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      // Update last used song in config
      config.lastUsedSong = result.filename || null;
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
  mcpServer.get('/api/song', (_req: Request, res: Response) => {
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
  mcpServer.get('/api/instruments', (_req: Request, res: Response) => {
    try {
      const instruments = midiManager.getGeneralMidiInstruments();
      res.status(200).json(instruments);
    } catch (error) {
      console.error('Error retrieving instruments:', error);
      res.status(500).json({ error: 'Failed to retrieve instruments' });
    }
  });
  
  // Get MIDI drum kit information
  mcpServer.get('/api/drums', (_req: Request, res: Response) => {
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
  mcpServerInstance = mcpServer.listen(PORT, () => {
    console.log(`MCP API server running on port ${PORT}`);
    if (mainWindow) {
      const status: McpServerStatus = { running: true, port: PORT };
      mainWindow.webContents.send('mcp-server-status', status);
    }
  });
}

// Create the main application window
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  
  // Load the Next.js app
  const url = isDev
    ? 'http://localhost:3000' // Dev server URL
    : `file://${path.join(__dirname, '../../.next/index.html')}`; // Production build path
  
  mainWindow.loadURL(url);
  
  // Open DevTools in development mode
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
  
  // Create application menu
  createAppMenu();
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create application menu
function createAppMenu(): void {
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
        { role: 'quit' as const }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        { role: 'toggleDevTools' as const },
        { type: 'separator' },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' },
        { role: 'togglefullscreen' as const }
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
function setupIpcHandlers(): void {
  // Get the current song
  ipcMain.handle('get-current-song', () => {
    return songCache.getLatestSong();
  });
  
  // Get the list of songs
  ipcMain.handle('get-song-list', () => {
    return songCache.getSongList();
  });
  
  // Play MIDI notes
  ipcMain.handle('play-midi', async (_event, noteSequence: NoteSequence) => {
    return await midiManager.playNoteSequence(noteSequence, (progress: PlaybackProgress) => {
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
  ipcMain.handle('import-midi-file', async (_event, _filePath: string) => {
    try {
      // This would use the Python backend to convert MIDI to NoteSequence
      // For now, we'll return a simple error
      return { success: false, error: 'MIDI import not implemented yet' };
    } catch (error) {
      console.error('Error importing MIDI file:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
  
  // Export MIDI file
  ipcMain.handle('export-midi-file', async (_event, _noteSequence: NoteSequence, _filePath: string) => {
    try {
      // This would use the Python backend to convert NoteSequence to MIDI
      // For now, we'll return a simple error
      return { success: false, error: 'MIDI export not implemented yet' };
    } catch (error) {
      console.error('Error exporting MIDI file:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
  
  // Get application configuration
  ipcMain.handle('get-config', () => {
    return config;
  });
  
  // Update application configuration
  ipcMain.handle('update-config', async (_event, newConfig: Partial<AppConfig>): Promise<ConfigUpdateResult> => {
    try {
      // Update config
      const oldMcpPort = config.mcpPort;
      config = { ...config, ...newConfig };
      saveConfig();
      
      // Check if MCP port changed
      if (oldMcpPort !== config.mcpPort && mcpServerInstance) {
        // Close the current server
        mcpServerInstance.close(() => {
          console.log(`Closed MCP server on port ${oldMcpPort}`);
          // Restart the server with the new port
          initMcpApi();
        });
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error updating configuration:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
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
  // pythonServer = startPythonServer(isDev);
  
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