import { app, BrowserWindow, ipcMain, Menu, MenuItemConstructorOptions } from 'electron';
import path from 'path';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import logger from '../lib/logger';
import noteSequenceSchema from '../schemas/note-sequence.schema.json';
import { ChildProcess } from 'child_process';

import { MidiManager } from '../common/midi-manager';
import { SongCache } from '../common/song-cache';
import { startPythonServer } from '../common/python-server';
import {
  NoteSequence,
  AppConfig,
  SongInfo,
  MidiFileResult,
  ConfigUpdateResult,
  McpServerStatus,
  PlayMidiResult,
  SaveSongResult
} from '../types';

// Global variables
let mainWindow: BrowserWindow | null = null;
let midiManager: MidiManager;
let songCache: SongCache;
let mcpServer: express.Application;
let mcpServerInstance: any = null;
let pythonServer: { process: ChildProcess; url: string } | null = null;

// Configuration
let config: AppConfig = {
  mcpPort: 8002,
  pythonPort: 5000,
  lastUsedSong: null,
  apiToken: null
};

const isDev = process.env.NODE_ENV === 'development';

// Cleanup function to properly close all servers and resources
function cleanup(): void {
  logger.info('Performing cleanup...');

  // Close MCP server
  if (mcpServerInstance) {
    logger.info('Closing MCP server...');
    try {
      mcpServerInstance.close(() => {
        logger.info('MCP server closed');
      });
    } catch (err) {
      logger.warn({ err }, 'Error closing MCP server instance');
    }
    mcpServerInstance = null;
  }

  // Close Python server
  if (pythonServer?.process) {
    logger.info('Terminating Python server...');
    try {
      pythonServer.process.kill('SIGTERM');
    } catch (err) {
      logger.warn({ err }, 'Failed to terminate Python server process');
    }
    pythonServer = null;
  }

  // Close MIDI manager
  if (midiManager) {
    logger.info('Closing MIDI manager...');
    try {
      midiManager.close();
    } catch (err) {
      logger.warn({ err }, 'Error closing MIDI manager');
    }
  }

  // Close main window
  if (mainWindow && !mainWindow.isDestroyed()) {
    logger.info('Closing main window...');
    try {
      mainWindow.close();
      mainWindow = null;
    } catch (err) {
      logger.warn({ err }, 'Error closing main window');
    }
  }
}

// Handle app termination
app.on('before-quit', (event) => {
  logger.info('App is about to quit');
  cleanup();
});

// Handle all windows closed
app.on('window-all-closed', () => {
  logger.info('All windows closed');
  cleanup();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle app termination signals
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM');
  cleanup();
  app.quit();
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT');
  cleanup();
  app.quit();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error({ err: error }, 'Uncaught Exception');
  cleanup();
  app.quit();
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ err: reason, promise }, 'Unhandled Rejection');
  cleanup();
  app.quit();
});

function createWindow(): void {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Initialize core components
function initializeComponents(): void {
  try {
    // Initialize MIDI manager
    midiManager = new MidiManager();
    logger.info('MIDI Manager initialized');

    // Listen for MIDI connection status events
    midiManager.on('midi-connection-status', (status) => {
      if (mainWindow) {
        mainWindow.webContents.send('midi-connection-status', status);
      }
    });

    // Initialize song cache
    const cacheDir = path.join(app.getPath('userData'), 'song_cache');
    songCache = new SongCache(cacheDir);
    logger.info('Song Cache initialized');

    // Start Python server (disabled by default, enable if needed)
    if (isDev) {
      // Commented out to avoid error if script missing
      // try {
      //   pythonServer = startPythonServer(true);
      //   console.log('Python server started');
      // } catch (error) {
      //   console.error('Failed to start Python server:', error);
      // }
    }

    // Initialize MCP server
    initializeMcpServer();
  } catch (error) {
    logger.error({ err: error }, 'Failed to initialize components');
  }
}

// Initialize MCP API server
function initializeMcpServer(): void {
  mcpServer = express();
  mcpServer.use(cors());
  mcpServer.use(express.json({ limit: '10mb' }));

  // Rate limiter for write endpoints
  const writeLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // limit each IP to 60 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false
  });

  // AJV validator
  const ajv = new Ajv({ allErrors: true });
  addFormats(ajv);
  const validateNoteSequence = ajv.compile(noteSequenceSchema as object);

  // Auth middleware: if apiToken configured, require Bearer token
  const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const configPath = path.join(app.getPath('userData'), 'config.json');
      let localConfig: AppConfig = config;
      if (fs.existsSync(configPath)) {
        try {
          const data = fs.readFileSync(configPath, 'utf8');
          localConfig = { ...localConfig, ...JSON.parse(data) };
        } catch (e) {
          logger.warn('Failed to read config for auth middleware, falling back to in-memory config');
        }
      }

      if (localConfig.apiToken) {
        const authHeader = req.header('Authorization') || '';
        if (!authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ error: 'Missing Authorization header' });
        }
        const token = authHeader.replace('Bearer ', '').trim();
        if (token !== localConfig.apiToken) {
          return res.status(403).json({ error: 'Invalid API token' });
        }
      }
      next();
    } catch (error) {
      logger.error({ err: error }, 'Error in auth middleware');
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  // Health check endpoint
  mcpServer.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Receive NoteSequence from LLM
  mcpServer.post('/song', writeLimiter, authMiddleware, (req, res) => {
    try {
      const noteSequence = req.body;

      // Validate payload against schema
      const valid = validateNoteSequence(noteSequence);
      if (!valid) {
        logger.warn({ errors: validateNoteSequence.errors }, 'Invalid NoteSequence received');
        return res.status(400).json({ error: 'Invalid NoteSequence format', details: validateNoteSequence.errors });
      }

      // Save to cache
      const saveResult = songCache.saveSong(noteSequence as NoteSequence);

      if (saveResult.success) {
        // Notify the renderer process
        if (mainWindow) {
          mainWindow.webContents.send('song-updated', noteSequence);
        }

        res.json({
          success: true,
          message: 'Song received and cached',
          filename: saveResult.filename,
          timestamp: saveResult.timestamp
        });
      } else {
        logger.error({ err: saveResult.error }, 'Failed to save song');
        res.status(500).json({ error: saveResult.error });
      }
    } catch (error) {
      logger.error({ err: error }, 'Error processing song');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get current song
  mcpServer.get('/song', (req, res) => {
    try {
      const latestSong = songCache.getLatestSong();
      if (latestSong) {
        res.json(latestSong);
      } else {
        res.status(404).json({ error: 'No songs found' });
      }
    } catch (error) {
      logger.error({ err: error }, 'Error getting song');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get song list
  mcpServer.get('/songs', (req, res) => {
    try {
      const songs = songCache.getSongList();
      res.json(songs);
    } catch (error) {
      logger.error({ err: error }, 'Error getting song list');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Play song endpoint
  mcpServer.post('/play', writeLimiter, authMiddleware, async (req, res) => {
    try {
      const noteSequence = req.body;

      // Validate
      const valid = validateNoteSequence(noteSequence);
      if (!valid) {
        logger.warn({ errors: validateNoteSequence.errors }, 'Invalid NoteSequence received for play');
        return res.status(400).json({ error: 'Invalid NoteSequence format', details: validateNoteSequence.errors });
      }

      const result = await midiManager.playNoteSequence(noteSequence as NoteSequence);
      res.json(result);
    } catch (error) {
      logger.error({ err: error }, 'Error playing song');
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Start the server
  try {
    mcpServerInstance = mcpServer.listen(config.mcpPort, () => {
      console.log(`MCP API server running on port ${config.mcpPort}`);
    });

    mcpServerInstance.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${config.mcpPort} is already in use. Trying alternative port...`);
        // Try alternative port
        const altPort = config.mcpPort + 1;
        mcpServerInstance = mcpServer.listen(altPort, () => {
          config.mcpPort = altPort;
          console.log(`MCP API server running on alternative port ${altPort}`);
          // Save the new port to config
          saveConfig();
        });
      } else {
        console.error('Failed to start MCP server:', error);
      }
    });
  } catch (error) {
    console.error('Failed to start MCP server:', error);
  }
}

// Create application menu
function createMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Import MIDI',
          click: () => {
            // TODO: Implement MIDI import dialog
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
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About MCP MIDI Bridge',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('show-about');
            }
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC handlers
function setupIpcHandlers(): void {
  // Get latest song
  ipcMain.handle('get-latest-song', async (): Promise<NoteSequence | null> => {
    try {
      return songCache.getLatestSong();
    } catch (error) {
      console.error('Error getting latest song:', error);
      return null;
    }
  });

  // Get song list
  ipcMain.handle('get-song-list', async (): Promise<SongInfo[]> => {
    try {
      return songCache.getSongList();
    } catch (error) {
      console.error('Error getting song list:', error);
      return [];
    }
  });

  // Play MIDI
  ipcMain.handle('play-midi', async (event, noteSequence: NoteSequence): Promise<PlayMidiResult> => {
    try {
      return await midiManager.playNoteSequence(noteSequence, (progress) => {
        if (mainWindow) {
          mainWindow.webContents.send('playback-progress', progress);
        }
      });
    } catch (error) {
      console.error('Error playing MIDI:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Stop MIDI
  ipcMain.handle('stop-midi', async (): Promise<void> => {
    try {
      midiManager.stopPlayback();
    } catch (error) {
      console.error('Error stopping MIDI:', error);
    }
  });

  // Import MIDI file
  ipcMain.handle('import-midi-file', async (event, filePath: string): Promise<MidiFileResult> => {
    try {
      // TODO: Implement MIDI file import using a library like midi-file
      return { success: false, error: 'MIDI import not yet implemented' };
    } catch (error) {
      console.error('Error importing MIDI file:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Update configuration
  ipcMain.handle('update-config', async (event, newConfig: Partial<AppConfig>): Promise<ConfigUpdateResult> => {
    try {
      config = { ...config, ...newConfig } as AppConfig;

      // Save config to file
      const configPath = path.join(app.getPath('userData'), 'config.json');
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      // Restart MCP server if port changed
      if (mcpServerInstance && typeof newConfig.mcpPort === 'number' && newConfig.mcpPort !== config.mcpPort) {
        mcpServerInstance.close();
        config.mcpPort = newConfig.mcpPort as number;
        initializeMcpServer();
      }

      // If apiToken changed, log it (do not log token value)
      if (newConfig && Object.prototype.hasOwnProperty.call(newConfig, 'apiToken')) {
        logger.info('API token configuration updated');
      }

      return { success: true };
    } catch (error) {
      logger.error({ err: error }, 'Error updating config');
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Get MCP server status
  ipcMain.handle('get-mcp-status', async (): Promise<McpServerStatus> => {
    return {
      running: mcpServerInstance !== null,
      port: config.mcpPort
    };
  });

  // Get current song (alias for get-latest-song)
  ipcMain.handle('get-current-song', async (): Promise<NoteSequence | null> => {
    try {
      return songCache.getLatestSong();
    } catch (error) {
      console.error('Error getting current song:', error);
      return null;
    }
  });

  // Get configuration
  ipcMain.handle('get-config', async (): Promise<AppConfig> => {
    return config;
  });

  // Get MIDI outputs
  ipcMain.handle('get-midi-outputs', async (): Promise<string[]> => {
    try {
      return midiManager.getOutputs();
    } catch (error) {
      console.error('Error getting MIDI outputs:', error);
      return [];
    }
  });

  // Get MIDI instruments
  ipcMain.handle('get-midi-instruments', async (): Promise<Record<number, { name: string, family: string }>> => {
    try {
      const instruments = midiManager.getGeneralMidiInstruments();
      const result: Record<number, { name: string, family: string }> = {};
      instruments.forEach((instrument, index) => {
        result[index] = { name: instrument.name, family: 'General MIDI' };
      });
      return result;
    } catch (error) {
      console.error('Error getting MIDI instruments:', error);
      return {};
    }
  });

  // Get MIDI drums
  ipcMain.handle('get-midi-drums', async (): Promise<Record<number, { name: string }>> => {
    try {
      const drums = midiManager.getGeneralMidiDrums();
      const result: Record<number, { name: string }> = {};
      drums.forEach((drum, index) => {
        result[index + 35] = { name: drum.name }; // GM drums start at note 35
      });
      return result;
    } catch (error) {
      console.error('Error getting MIDI drums:', error);
      return {};
    }
  });
}

// Load configuration
function loadConfig(): void {
  try {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      config = { ...config, ...JSON.parse(configData) };
    }
  } catch (error) {
    console.error('Error loading config:', error);
  }
}

// Save configuration
function saveConfig(): void {
  try {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('Configuration saved');
  } catch (error) {
    console.error('Error saving config:', error);
  }
}

// App event handlers
app.whenReady().then(() => {
  loadConfig();
  initializeComponents();
  createWindow();
  createMenu();
  setupIpcHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Clean up
  if (mcpServerInstance) {
    mcpServerInstance.close();
  }

  if (pythonServer && pythonServer.process) {
    try {
      pythonServer.process.kill();
    } catch (error) {
      console.warn('Failed to kill Python server process:', error);
    }
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Clean up resources
  if (mcpServerInstance) {
    mcpServerInstance.close();
  }

  if (pythonServer && pythonServer.process) {
    try {
      pythonServer.process.kill();
    } catch (error) {
      console.warn('Failed to kill Python server process:', error);
    }
  }
});