const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // Song management
  getSongList: () => ipcRenderer.invoke('get-song-list'),
  getCurrentSong: () => ipcRenderer.invoke('get-current-song'),
  importMidiFile: (filePath) => ipcRenderer.invoke('import-midi-file', filePath),
  exportMidiFile: (noteSequence, filePath) => ipcRenderer.invoke('export-midi-file', noteSequence, filePath),
  
  // MIDI functionality
  playMidi: (noteSequence) => ipcRenderer.invoke('play-midi', noteSequence),
  getMidiOutputs: () => ipcRenderer.invoke('get-midi-outputs'),
  
  // Event listeners
  onSongUpdated: (callback) => {
    ipcRenderer.on('song-updated', (_, data) => callback(data));
  },
  onPlaybackProgress: (callback) => {
    ipcRenderer.on('playback-progress', (_, data) => callback(data));
  }
});