import { contextBridge, ipcRenderer } from 'electron';
import { AppConfig, ConfigUpdateResult, McpServerStatus, MidiFileResult, NoteSequence, PlayMidiResult, PlaybackProgress, SaveSongResult, SongInfo } from '../types';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Song management
  getSongList: (): Promise<SongInfo[]> => ipcRenderer.invoke('get-song-list'),
  getLatestSong: (): Promise<NoteSequence | null> => ipcRenderer.invoke('get-latest-song'),
  getCurrentSong: (): Promise<NoteSequence | null> => ipcRenderer.invoke('get-current-song'),
  importMidiFile: (filePath: string): Promise<MidiFileResult> => ipcRenderer.invoke('import-midi-file', filePath),
  exportMidiFile: (noteSequence: NoteSequence, filePath: string): Promise<MidiFileResult> =>
    ipcRenderer.invoke('export-midi-file', noteSequence, filePath),

  // MIDI functionality
  playMidi: (noteSequence: NoteSequence): Promise<PlayMidiResult> => ipcRenderer.invoke('play-midi', noteSequence),
  stopMidi: (): Promise<void> => ipcRenderer.invoke('stop-midi'),
  getMidiOutputs: (): Promise<string[]> => ipcRenderer.invoke('get-midi-outputs'),
  getMidiInstruments: (): Promise<Record<number, { name: string, family: string }>> =>
    ipcRenderer.invoke('get-midi-instruments'),
  getMidiDrums: (): Promise<Record<number, { name: string }>> => ipcRenderer.invoke('get-midi-drums'),

  // Configuration
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke('get-config'),
  updateConfig: (newConfig: Partial<AppConfig>): Promise<ConfigUpdateResult> =>
    ipcRenderer.invoke('update-config', newConfig),

  // MCP Status
  getMcpStatus: (): Promise<McpServerStatus> => ipcRenderer.invoke('get-mcp-status'),

  // Event listeners
  onSongUpdated: (callback: (data: SaveSongResult) => void) => {
    ipcRenderer.on('song-updated', (_, data: SaveSongResult) => callback(data));
  },
  onPlaybackProgress: (callback: (data: PlaybackProgress) => void) => {
    ipcRenderer.on('playback-progress', (_, data: PlaybackProgress) => callback(data));
  },
  onMcpServerStatus: (callback: (data: McpServerStatus) => void) => {
    ipcRenderer.on('mcp-server-status', (_, data: McpServerStatus) => callback(data));
  },
  onOpenSettings: (callback: () => void) => {
    ipcRenderer.on('open-settings', () => callback());
  },
  onShowAbout: (callback: () => void) => {
    ipcRenderer.on('show-about', () => callback());
  }
});