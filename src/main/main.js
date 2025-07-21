const { app, BrowserWindow, ipcMain } = require('electron');
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

// Global instances of our managers
let songCache;
let midiManager;
let pythonServer;

// Initialize Express server for MCP API
function initMcpApi() {
  const mcpServer = express();
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
  
  // Start the server
  const PORT = 3000;
  mcpServer.listen(PORT, () => {
    console.log(`MCP API server running on port ${PORT}`);
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
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
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
}

// App lifecycle events
app.on('ready', () => {
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