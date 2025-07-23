"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const easymidi = require("easymidi");
const child_process = require("child_process");
class MidiManager {
  constructor() {
    this.virtualOutput = null;
    this.isPlaying = false;
    this.activeChannels = /* @__PURE__ */ new Set();
    this.currentPlaybackTimeout = null;
    this.initialize();
  }
  /**
   * Initialize the MIDI manager
   */
  initialize() {
    try {
      const outputs = easymidi.getOutputs();
      console.log("Available MIDI outputs:", outputs);
      if (!outputs.includes("MCP MIDI Bridge")) {
        this.virtualOutput = new easymidi.Output("MCP MIDI Bridge", true);
        console.log("Created virtual MIDI output: MCP MIDI Bridge");
      } else {
        this.virtualOutput = new easymidi.Output("MCP MIDI Bridge");
        console.log("Connected to existing virtual MIDI output: MCP MIDI Bridge");
      }
    } catch (error) {
      console.error("Failed to initialize MIDI:", error);
    }
  }
  /**
   * Get available MIDI outputs
   * @returns {string[]} - Array of MIDI output names
   */
  getOutputs() {
    return easymidi.getOutputs();
  }
  /**
   * Send a program change to set the instrument for a channel
   * @param {number} channel - MIDI channel (0-15)
   * @param {number} program - Program number (0-127)
   */
  setProgramForChannel(channel, program) {
    if (!this.virtualOutput) return;
    this.virtualOutput.send("program", {
      channel,
      number: program
    });
    console.log(`Set channel ${channel} to program ${program}`);
  }
  /**
   * Stop current playback
   */
  stopPlayback() {
    this.isPlaying = false;
    if (this.currentPlaybackTimeout) {
      clearTimeout(this.currentPlaybackTimeout);
      this.currentPlaybackTimeout = null;
    }
    if (this.virtualOutput) {
      for (let channel = 0; channel < 16; channel++) {
        for (let note = 0; note < 128; note++) {
          this.virtualOutput.send("noteoff", {
            note,
            velocity: 0,
            channel
          });
        }
      }
    }
  }
  /**
   * Play a NoteSequence through the virtual MIDI output
   * @param {NoteSequence} noteSequence - The NoteSequence to play
   * @param {Function} progressCallback - Callback for playback progress updates
   * @returns {Promise<PlayMidiResult>} - Result of the playback
   */
  async playNoteSequence(noteSequence, progressCallback = null) {
    var _a;
    if (!this.virtualOutput) {
      return { success: false, error: "MIDI output not available" };
    }
    if (this.isPlaying) {
      return { success: false, error: "Already playing" };
    }
    if (!noteSequence || !noteSequence.notes || noteSequence.notes.length === 0) {
      return { success: false, error: "Invalid or empty note sequence" };
    }
    try {
      this.isPlaying = true;
      this.activeChannels.clear();
      const sortedNotes = [...noteSequence.notes].sort((a, b) => a.startTime - b.startTime);
      const totalDuration = noteSequence.totalTime || Math.max(...sortedNotes.map((note) => note.endTime)) || 0;
      const activeNotes = /* @__PURE__ */ new Map();
      const channelsUsed = new Set(sortedNotes.map((note) => note.instrument || 0));
      for (const channel of channelsUsed) {
        const firstNoteForChannel = sortedNotes.find((note) => (note.instrument || 0) === channel);
        if (firstNoteForChannel) {
          const program = firstNoteForChannel.program || 0;
          this.setProgramForChannel(channel, program);
          this.activeChannels.add(channel);
        }
      }
      const startTime = Date.now();
      for (let i = 0; i < sortedNotes.length && this.isPlaying; i++) {
        const note = sortedNotes[i];
        const channel = note.instrument || 0;
        const pitch = note.pitch;
        const velocity = note.velocity || 80;
        const noteStartTime = note.startTime * 1e3;
        const noteEndTime = note.endTime * 1e3;
        await new Promise((resolve) => {
          const timeToWait = Math.max(0, startTime + noteStartTime - Date.now());
          this.currentPlaybackTimeout = setTimeout(resolve, timeToWait);
        });
        if (!this.isPlaying) break;
        this.virtualOutput.send("noteon", {
          note: pitch,
          velocity,
          channel
        });
        if (!activeNotes.has(channel)) {
          activeNotes.set(channel, /* @__PURE__ */ new Set());
        }
        (_a = activeNotes.get(channel)) == null ? void 0 : _a.add(pitch);
        this.currentPlaybackTimeout = setTimeout(() => {
          var _a2;
          if (this.virtualOutput) {
            this.virtualOutput.send("noteoff", {
              note: pitch,
              velocity: 0,
              channel
            });
          }
          if (activeNotes.has(channel)) {
            (_a2 = activeNotes.get(channel)) == null ? void 0 : _a2.delete(pitch);
          }
        }, Math.max(0, startTime + noteEndTime - Date.now()));
        if (progressCallback && totalDuration > 0) {
          const progress = note.startTime / totalDuration;
          progressCallback({
            current: note.startTime,
            total: totalDuration,
            progress
          });
        }
      }
      if (this.isPlaying) {
        await new Promise((resolve) => {
          const timeToWait = Math.max(0, startTime + totalDuration * 1e3 - Date.now()) + 100;
          this.currentPlaybackTimeout = setTimeout(resolve, timeToWait);
        });
      }
      for (const [channel, notes] of activeNotes.entries()) {
        for (const pitch of notes) {
          if (this.virtualOutput) {
            this.virtualOutput.send("noteoff", {
              note: pitch,
              velocity: 0,
              channel
            });
          }
        }
      }
      if (progressCallback) {
        progressCallback({
          current: totalDuration,
          total: totalDuration,
          progress: 1
        });
      }
      this.isPlaying = false;
      return { success: true };
    } catch (error) {
      this.isPlaying = false;
      console.error("Error playing note sequence:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
  /**
   * Send a control change message
   * @param {number} channel - MIDI channel (0-15)
   * @param {number} controller - Controller number (0-127)
   * @param {number} value - Controller value (0-127)
   */
  sendControlChange(channel, controller, value) {
    if (!this.virtualOutput) return;
    this.virtualOutput.send("cc", {
      controller,
      value,
      channel
    });
  }
  /**
   * Send all notes off for a specific channel
   * @param {number} channel - MIDI channel (0-15)
   */
  allNotesOff(channel) {
    if (!this.virtualOutput) return;
    this.sendControlChange(channel, 123, 0);
  }
  /**
   * Send all sound off for a specific channel
   * @param {number} channel - MIDI channel (0-15)
   */
  allSoundOff(channel) {
    if (!this.virtualOutput) return;
    this.sendControlChange(channel, 120, 0);
  }
  /**
   * Reset all controllers for a specific channel
   * @param {number} channel - MIDI channel (0-15)
   */
  resetAllControllers(channel) {
    if (!this.virtualOutput) return;
    this.sendControlChange(channel, 121, 0);
  }
  /**
   * Get General MIDI instrument names
   * @returns {MidiInstrument[]} - Array of instrument information
   */
  getGeneralMidiInstruments() {
    return [
      // Piano
      { name: "Acoustic Grand Piano", family: "Piano" },
      { name: "Bright Acoustic Piano", family: "Piano" },
      { name: "Electric Grand Piano", family: "Piano" },
      { name: "Honky-tonk Piano", family: "Piano" },
      { name: "Electric Piano 1", family: "Piano" },
      { name: "Electric Piano 2", family: "Piano" },
      { name: "Harpsichord", family: "Piano" },
      { name: "Clavi", family: "Piano" },
      // Chromatic Percussion
      { name: "Celesta", family: "Chromatic Percussion" },
      { name: "Glockenspiel", family: "Chromatic Percussion" },
      { name: "Music Box", family: "Chromatic Percussion" },
      { name: "Vibraphone", family: "Chromatic Percussion" },
      { name: "Marimba", family: "Chromatic Percussion" },
      { name: "Xylophone", family: "Chromatic Percussion" },
      { name: "Tubular Bells", family: "Chromatic Percussion" },
      { name: "Dulcimer", family: "Chromatic Percussion" },
      // Organ
      { name: "Drawbar Organ", family: "Organ" },
      { name: "Percussive Organ", family: "Organ" },
      { name: "Rock Organ", family: "Organ" },
      { name: "Church Organ", family: "Organ" },
      { name: "Reed Organ", family: "Organ" },
      { name: "Accordion", family: "Organ" },
      { name: "Harmonica", family: "Organ" },
      { name: "Tango Accordion", family: "Organ" },
      // Guitar
      { name: "Acoustic Guitar (nylon)", family: "Guitar" },
      { name: "Acoustic Guitar (steel)", family: "Guitar" },
      { name: "Electric Guitar (jazz)", family: "Guitar" },
      { name: "Electric Guitar (clean)", family: "Guitar" },
      { name: "Electric Guitar (muted)", family: "Guitar" },
      { name: "Overdriven Guitar", family: "Guitar" },
      { name: "Distortion Guitar", family: "Guitar" },
      { name: "Guitar harmonics", family: "Guitar" },
      // Bass
      { name: "Acoustic Bass", family: "Bass" },
      { name: "Electric Bass (finger)", family: "Bass" },
      { name: "Electric Bass (pick)", family: "Bass" },
      { name: "Fretless Bass", family: "Bass" },
      { name: "Slap Bass 1", family: "Bass" },
      { name: "Slap Bass 2", family: "Bass" },
      { name: "Synth Bass 1", family: "Bass" },
      { name: "Synth Bass 2", family: "Bass" },
      // Strings
      { name: "Violin", family: "Strings" },
      { name: "Viola", family: "Strings" },
      { name: "Cello", family: "Strings" },
      { name: "Contrabass", family: "Strings" },
      { name: "Tremolo Strings", family: "Strings" },
      { name: "Pizzicato Strings", family: "Strings" },
      { name: "Orchestral Harp", family: "Strings" },
      { name: "Timpani", family: "Strings" },
      // Ensemble
      { name: "String Ensemble 1", family: "Ensemble" },
      { name: "String Ensemble 2", family: "Ensemble" },
      { name: "SynthStrings 1", family: "Ensemble" },
      { name: "SynthStrings 2", family: "Ensemble" },
      { name: "Choir Aahs", family: "Ensemble" },
      { name: "Voice Oohs", family: "Ensemble" },
      { name: "Synth Voice", family: "Ensemble" },
      { name: "Orchestra Hit", family: "Ensemble" },
      // Brass
      { name: "Trumpet", family: "Brass" },
      { name: "Trombone", family: "Brass" },
      { name: "Tuba", family: "Brass" },
      { name: "Muted Trumpet", family: "Brass" },
      { name: "French Horn", family: "Brass" },
      { name: "Brass Section", family: "Brass" },
      { name: "SynthBrass 1", family: "Brass" },
      { name: "SynthBrass 2", family: "Brass" },
      // Reed
      { name: "Soprano Sax", family: "Reed" },
      { name: "Alto Sax", family: "Reed" },
      { name: "Tenor Sax", family: "Reed" },
      { name: "Baritone Sax", family: "Reed" },
      { name: "Oboe", family: "Reed" },
      { name: "English Horn", family: "Reed" },
      { name: "Bassoon", family: "Reed" },
      { name: "Clarinet", family: "Reed" },
      // Pipe
      { name: "Piccolo", family: "Pipe" },
      { name: "Flute", family: "Pipe" },
      { name: "Recorder", family: "Pipe" },
      { name: "Pan Flute", family: "Pipe" },
      { name: "Blown Bottle", family: "Pipe" },
      { name: "Shakuhachi", family: "Pipe" },
      { name: "Whistle", family: "Pipe" },
      { name: "Ocarina", family: "Pipe" },
      // Synth Lead
      { name: "Lead 1 (square)", family: "Synth Lead" },
      { name: "Lead 2 (sawtooth)", family: "Synth Lead" },
      { name: "Lead 3 (calliope)", family: "Synth Lead" },
      { name: "Lead 4 (chiff)", family: "Synth Lead" },
      { name: "Lead 5 (charang)", family: "Synth Lead" },
      { name: "Lead 6 (voice)", family: "Synth Lead" },
      { name: "Lead 7 (fifths)", family: "Synth Lead" },
      { name: "Lead 8 (bass + lead)", family: "Synth Lead" },
      // Synth Pad
      { name: "Pad 1 (new age)", family: "Synth Pad" },
      { name: "Pad 2 (warm)", family: "Synth Pad" },
      { name: "Pad 3 (polysynth)", family: "Synth Pad" },
      { name: "Pad 4 (choir)", family: "Synth Pad" },
      { name: "Pad 5 (bowed)", family: "Synth Pad" },
      { name: "Pad 6 (metallic)", family: "Synth Pad" },
      { name: "Pad 7 (halo)", family: "Synth Pad" },
      { name: "Pad 8 (sweep)", family: "Synth Pad" },
      // Synth Effects
      { name: "FX 1 (rain)", family: "Synth Effects" },
      { name: "FX 2 (soundtrack)", family: "Synth Effects" },
      { name: "FX 3 (crystal)", family: "Synth Effects" },
      { name: "FX 4 (atmosphere)", family: "Synth Effects" },
      { name: "FX 5 (brightness)", family: "Synth Effects" },
      { name: "FX 6 (goblins)", family: "Synth Effects" },
      { name: "FX 7 (echoes)", family: "Synth Effects" },
      { name: "FX 8 (sci-fi)", family: "Synth Effects" },
      // Ethnic
      { name: "Sitar", family: "Ethnic" },
      { name: "Banjo", family: "Ethnic" },
      { name: "Shamisen", family: "Ethnic" },
      { name: "Koto", family: "Ethnic" },
      { name: "Kalimba", family: "Ethnic" },
      { name: "Bag pipe", family: "Ethnic" },
      { name: "Fiddle", family: "Ethnic" },
      { name: "Shanai", family: "Ethnic" },
      // Percussive
      { name: "Tinkle Bell", family: "Percussive" },
      { name: "Agogo", family: "Percussive" },
      { name: "Steel Drums", family: "Percussive" },
      { name: "Woodblock", family: "Percussive" },
      { name: "Taiko Drum", family: "Percussive" },
      { name: "Melodic Tom", family: "Percussive" },
      { name: "Synth Drum", family: "Percussive" },
      { name: "Reverse Cymbal", family: "Percussive" },
      // Sound Effects
      { name: "Guitar Fret Noise", family: "Sound Effects" },
      { name: "Breath Noise", family: "Sound Effects" },
      { name: "Seashore", family: "Sound Effects" },
      { name: "Bird Tweet", family: "Sound Effects" },
      { name: "Telephone Ring", family: "Sound Effects" },
      { name: "Helicopter", family: "Sound Effects" },
      { name: "Applause", family: "Sound Effects" },
      { name: "Gunshot", family: "Sound Effects" }
    ];
  }
  /**
   * Get General MIDI drum names (Channel 10)
   * @returns {MidiDrum[]} - Array of drum information
   */
  getGeneralMidiDrums() {
    return [
      { name: "Acoustic Bass Drum" },
      // 35
      { name: "Bass Drum 1" },
      // 36
      { name: "Side Stick" },
      // 37
      { name: "Acoustic Snare" },
      // 38
      { name: "Hand Clap" },
      // 39
      { name: "Electric Snare" },
      // 40
      { name: "Low Floor Tom" },
      // 41
      { name: "Closed Hi Hat" },
      // 42
      { name: "High Floor Tom" },
      // 43
      { name: "Pedal Hi-Hat" },
      // 44
      { name: "Low Tom" },
      // 45
      { name: "Open Hi-Hat" },
      // 46
      { name: "Low-Mid Tom" },
      // 47
      { name: "Hi Mid Tom" },
      // 48
      { name: "Crash Cymbal 1" },
      // 49
      { name: "High Tom" },
      // 50
      { name: "Ride Cymbal 1" },
      // 51
      { name: "Chinese Cymbal" },
      // 52
      { name: "Ride Bell" },
      // 53
      { name: "Tambourine" },
      // 54
      { name: "Splash Cymbal" },
      // 55
      { name: "Cowbell" },
      // 56
      { name: "Crash Cymbal 2" },
      // 57
      { name: "Vibraslap" },
      // 58
      { name: "Ride Cymbal 2" },
      // 59
      { name: "Hi Bongo" },
      // 60
      { name: "Low Bongo" },
      // 61
      { name: "Mute Hi Conga" },
      // 62
      { name: "Open Hi Conga" },
      // 63
      { name: "Low Conga" },
      // 64
      { name: "High Timbale" },
      // 65
      { name: "Low Timbale" },
      // 66
      { name: "High Agogo" },
      // 67
      { name: "Low Agogo" },
      // 68
      { name: "Cabasa" },
      // 69
      { name: "Maracas" },
      // 70
      { name: "Short Whistle" },
      // 71
      { name: "Long Whistle" },
      // 72
      { name: "Short Guiro" },
      // 73
      { name: "Long Guiro" },
      // 74
      { name: "Claves" },
      // 75
      { name: "Hi Wood Block" },
      // 76
      { name: "Low Wood Block" },
      // 77
      { name: "Mute Cuica" },
      // 78
      { name: "Open Cuica" },
      // 79
      { name: "Mute Triangle" },
      // 80
      { name: "Open Triangle" }
      // 81
    ];
  }
  /**
   * Close the MIDI output
   */
  close() {
    if (this.virtualOutput) {
      this.virtualOutput.close();
      this.virtualOutput = null;
    }
  }
}
class SongCache {
  /**
   * Create a new SongCache
   * @param {string} cacheDir - Directory to store song cache files
   */
  constructor(cacheDir) {
    this.cacheDir = cacheDir;
    this.ensureCacheDirectory();
  }
  /**
   * Ensure the cache directory exists
   */
  ensureCacheDirectory() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }
  /**
   * Save a NoteSequence to the cache
   * @param {NoteSequence} noteSequence - The NoteSequence to save
   * @returns {SaveSongResult} - Information about the saved file
   */
  saveSong(noteSequence) {
    try {
      if (!noteSequence || !noteSequence.notes) {
        throw new Error("Invalid NoteSequence format");
      }
      const timestamp = Date.now();
      const filename = `song_${timestamp}.json`;
      const filepath = path.join(this.cacheDir, filename);
      fs.writeFileSync(filepath, JSON.stringify(noteSequence, null, 2));
      return {
        success: true,
        filepath,
        timestamp,
        filename
      };
    } catch (error) {
      console.error("Error saving song:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }
  /**
   * Get the most recent song from the cache
   * @returns {NoteSequence|null} - The most recent NoteSequence or null if none found
   */
  getLatestSong() {
    try {
      const files = fs.readdirSync(this.cacheDir).filter((file) => file.startsWith("song_") && file.endsWith(".json")).sort().reverse();
      if (files.length === 0) {
        return null;
      }
      const latestFile = files[0];
      const filepath = path.join(this.cacheDir, latestFile);
      const content = fs.readFileSync(filepath, "utf8");
      return JSON.parse(content);
    } catch (error) {
      console.error("Error getting latest song:", error);
      return null;
    }
  }
  /**
   * Get a list of all songs in the cache
   * @returns {SongInfo[]} - Array of song information objects
   */
  getSongList() {
    try {
      const files = fs.readdirSync(this.cacheDir).filter((file) => file.startsWith("song_") && file.endsWith(".json")).sort().reverse();
      return files.map((file) => {
        const filepath = path.join(this.cacheDir, file);
        const stats = fs.statSync(filepath);
        const timestamp = parseInt(file.replace("song_", "").replace(".json", ""), 10);
        return {
          filename: file,
          filepath,
          timestamp,
          created: stats.birthtime,
          size: stats.size
        };
      });
    } catch (error) {
      console.error("Error getting song list:", error);
      return [];
    }
  }
  /**
   * Get a specific song by filename
   * @param {string} filename - The filename of the song to retrieve
   * @returns {NoteSequence|null} - The NoteSequence or null if not found
   */
  getSong(filename) {
    try {
      const filepath = path.join(this.cacheDir, filename);
      if (!fs.existsSync(filepath)) {
        return null;
      }
      const content = fs.readFileSync(filepath, "utf8");
      return JSON.parse(content);
    } catch (error) {
      console.error(`Error getting song ${filename}:`, error);
      return null;
    }
  }
  /**
   * Delete a song from the cache
   * @param {string} filename - The filename of the song to delete
   * @returns {boolean} - Whether the deletion was successful
   */
  deleteSong(filename) {
    try {
      const filepath = path.join(this.cacheDir, filename);
      if (!fs.existsSync(filepath)) {
        return false;
      }
      fs.unlinkSync(filepath);
      return true;
    } catch (error) {
      console.error(`Error deleting song ${filename}:`, error);
      return false;
    }
  }
}
function startPythonServer(isDev2 = false) {
  var _a, _b;
  let pythonPath;
  let scriptPath;
  if (isDev2) {
    pythonPath = path.join(__dirname, "..", "python", "venv", "Scripts", "python.exe");
    scriptPath = path.join(__dirname, "..", "python", "magenta_wrapper.py");
  } else {
    pythonPath = path.join(process.resourcesPath, "python", "venv", "Scripts", "python.exe");
    scriptPath = path.join(process.resourcesPath, "python", "magenta_wrapper.py");
  }
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Python script not found at: ${scriptPath}`);
  }
  const pythonProcess = child_process.spawn(pythonPath, [scriptPath, "server", "--port", "5000"]);
  (_a = pythonProcess.stdout) == null ? void 0 : _a.on("data", (data) => {
    console.log(`Python server: ${data}`);
  });
  (_b = pythonProcess.stderr) == null ? void 0 : _b.on("data", (data) => {
    console.error(`Python server error: ${data}`);
  });
  pythonProcess.on("close", (code) => {
    console.log(`Python server exited with code ${code}`);
  });
  return {
    process: pythonProcess,
    url: "http://localhost:5000"
  };
}
let mainWindow = null;
let midiManager;
let songCache;
let mcpServer;
let mcpServerInstance = null;
let pythonServer = null;
let config = {
  mcpPort: 8002,
  pythonPort: 5e3,
  lastUsedSong: null
};
const isDev = process.env.NODE_ENV === "development";
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js")
    }
  });
  if (isDev) {
    mainWindow.loadURL("http://localhost:8080");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
function initializeComponents() {
  try {
    midiManager = new MidiManager();
    console.log("MIDI Manager initialized");
    const cacheDir = path.join(electron.app.getPath("userData"), "song_cache");
    songCache = new SongCache(cacheDir);
    console.log("Song Cache initialized");
    if (isDev) {
      try {
        pythonServer = startPythonServer(true);
        console.log("Python server started");
      } catch (error) {
        console.error("Failed to start Python server:", error);
      }
    }
    initializeMcpServer();
  } catch (error) {
    console.error("Failed to initialize components:", error);
  }
}
function initializeMcpServer() {
  mcpServer = express();
  mcpServer.use(cors());
  mcpServer.use(express.json({ limit: "10mb" }));
  mcpServer.get("/health", (req, res) => {
    res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  mcpServer.post("/song", (req, res) => {
    try {
      const noteSequence = req.body;
      if (!noteSequence || !noteSequence.notes) {
        return res.status(400).json({ error: "Invalid NoteSequence format" });
      }
      const saveResult = songCache.saveSong(noteSequence);
      if (saveResult.success) {
        if (mainWindow) {
          mainWindow.webContents.send("song-updated", noteSequence);
        }
        res.json({
          success: true,
          message: "Song received and cached",
          filename: saveResult.filename,
          timestamp: saveResult.timestamp
        });
      } else {
        res.status(500).json({ error: saveResult.error });
      }
    } catch (error) {
      console.error("Error processing song:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  mcpServer.get("/song", (req, res) => {
    try {
      const latestSong = songCache.getLatestSong();
      if (latestSong) {
        res.json(latestSong);
      } else {
        res.status(404).json({ error: "No songs found" });
      }
    } catch (error) {
      console.error("Error getting song:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  mcpServer.get("/songs", (req, res) => {
    try {
      const songs = songCache.getSongList();
      res.json(songs);
    } catch (error) {
      console.error("Error getting song list:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  mcpServer.post("/play", async (req, res) => {
    try {
      const noteSequence = req.body;
      if (!noteSequence || !noteSequence.notes) {
        return res.status(400).json({ error: "Invalid NoteSequence format" });
      }
      const result = await midiManager.playNoteSequence(noteSequence);
      res.json(result);
    } catch (error) {
      console.error("Error playing song:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  try {
    mcpServerInstance = mcpServer.listen(config.mcpPort, () => {
      console.log(`MCP API server running on port ${config.mcpPort}`);
    });
  } catch (error) {
    console.error("Failed to start MCP server:", error);
  }
}
function createMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Import MIDI",
          click: () => {
          }
        },
        { type: "separator" },
        { role: "quit" }
      ]
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" }
      ]
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" }
      ]
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "close" }
      ]
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About MCP MIDI Bridge",
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send("show-about");
            }
          }
        }
      ]
    }
  ];
  const menu = electron.Menu.buildFromTemplate(template);
  electron.Menu.setApplicationMenu(menu);
}
function setupIpcHandlers() {
  electron.ipcMain.handle("get-latest-song", async () => {
    try {
      return songCache.getLatestSong();
    } catch (error) {
      console.error("Error getting latest song:", error);
      return null;
    }
  });
  electron.ipcMain.handle("get-song-list", async () => {
    try {
      return songCache.getSongList();
    } catch (error) {
      console.error("Error getting song list:", error);
      return [];
    }
  });
  electron.ipcMain.handle("play-midi", async (event, noteSequence) => {
    try {
      return await midiManager.playNoteSequence(noteSequence, (progress) => {
        if (mainWindow) {
          mainWindow.webContents.send("playback-progress", progress);
        }
      });
    } catch (error) {
      console.error("Error playing MIDI:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  });
  electron.ipcMain.handle("stop-midi", async () => {
    try {
      midiManager.stopPlayback();
    } catch (error) {
      console.error("Error stopping MIDI:", error);
    }
  });
  electron.ipcMain.handle("import-midi-file", async (event, filePath) => {
    try {
      return { success: false, error: "MIDI import not yet implemented" };
    } catch (error) {
      console.error("Error importing MIDI file:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  });
  electron.ipcMain.handle("update-config", async (event, newConfig) => {
    try {
      config = { ...config, ...newConfig };
      const configPath = path.join(electron.app.getPath("userData"), "config.json");
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      if (mcpServerInstance && newConfig.mcpPort !== config.mcpPort) {
        mcpServerInstance.close();
        config.mcpPort = newConfig.mcpPort;
        initializeMcpServer();
      }
      return { success: true };
    } catch (error) {
      console.error("Error updating config:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  });
  electron.ipcMain.handle("get-mcp-status", async () => {
    return {
      running: mcpServerInstance !== null,
      port: config.mcpPort
    };
  });
}
function loadConfig() {
  try {
    const configPath = path.join(electron.app.getPath("userData"), "config.json");
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, "utf8");
      config = { ...config, ...JSON.parse(configData) };
    }
  } catch (error) {
    console.error("Error loading config:", error);
  }
}
electron.app.whenReady().then(() => {
  loadConfig();
  initializeComponents();
  createWindow();
  createMenu();
  setupIpcHandlers();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (mcpServerInstance) {
    mcpServerInstance.close();
  }
  if (pythonServer == null ? void 0 : pythonServer.process) {
    pythonServer.process.kill();
  }
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.app.on("before-quit", () => {
  if (mcpServerInstance) {
    mcpServerInstance.close();
  }
  if (pythonServer == null ? void 0 : pythonServer.process) {
    pythonServer.process.kill();
  }
});
//# sourceMappingURL=main.js.map
