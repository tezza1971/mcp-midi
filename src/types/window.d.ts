import { AppConfig, ConfigUpdateResult, McpServerStatus, MidiFileResult, NoteSequence, PlayMidiResult, PlaybackProgress, SaveSongResult, SongInfo } from './index';

declare global {
  interface Window {
    api: {
      // Song management
      getSongList: () => Promise<SongInfo[]>;
      getCurrentSong: () => Promise<NoteSequence | null>;
      importMidiFile: (filePath: string) => Promise<MidiFileResult>;
      exportMidiFile: (noteSequence: NoteSequence, filePath: string) => Promise<MidiFileResult>;
      
      // MIDI functionality
      playMidi: (noteSequence: NoteSequence) => Promise<PlayMidiResult>;
      getMidiOutputs: () => Promise<string[]>;
      getMidiInstruments: () => Promise<Record<number, { name: string, family: string }>>;
      getMidiDrums: () => Promise<Record<number, { name: string }>>;
      
      // Configuration
      getConfig: () => Promise<AppConfig>;
      updateConfig: (newConfig: Partial<AppConfig>) => Promise<ConfigUpdateResult>;
      
      // Event listeners
      onSongUpdated: (callback: (data: SaveSongResult) => void) => void;
      onPlaybackProgress: (callback: (data: PlaybackProgress) => void) => void;
      onMcpServerStatus: (callback: (data: McpServerStatus) => void) => void;
      onOpenSettings: (callback: () => void) => void;
      onShowAbout: (callback: () => void) => void;
    };
  }
}