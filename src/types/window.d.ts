import { AppConfig, ConfigUpdateResult, McpServerStatus, MidiFileResult, NoteSequence, PlayMidiResult, PlaybackProgress, SaveSongResult, SongInfo } from './index';

declare global {
  interface Window {
    electronAPI: {
      getSongList: () => Promise<SongInfo[]>;
      getLatestSong: () => Promise<NoteSequence | null>;
      getCurrentSong: () => Promise<NoteSequence | null>;
      playMidi: (noteSequence: NoteSequence) => Promise<PlayMidiResult>;
      stopMidi: () => Promise<void>;
      importMidiFile: (filePath: string) => Promise<MidiFileResult>;
      updateConfig: (newConfig: Partial<AppConfig>) => Promise<ConfigUpdateResult>;
      getConfig: () => Promise<AppConfig>;
      getMcpStatus: () => Promise<McpServerStatus>;
      getMidiOutputs: () => Promise<string[]>;
      getMidiInstruments: () => Promise<Record<number, { name: string, family: string }>>;
      getMidiDrums: () => Promise<Record<number, { name: string }>>;
      onSongUpdated: (callback: (data: SaveSongResult) => void) => void;
      onPlaybackProgress: (callback: (data: PlaybackProgress) => void) => void;
      onMcpServerStatus: (callback: (data: McpServerStatus) => void) => void;
      onOpenSettings: (callback: () => void) => void;
      onShowAbout: (callback: () => void) => void;
      onMidiConnectionStatus: (callback: (status: { connected: boolean; deviceName?: string; error?: any }) => void) => void;
      removeMidiConnectionStatusListener: (callback: (status: { connected: boolean; deviceName?: string; error?: any }) => void) => void;
    };
  }
}