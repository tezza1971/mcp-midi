export interface Note {
  pitch: number;
  startTime: number;
  endTime: number;
  velocity?: number;
  instrument?: number;
  program?: number;
  isDrum?: boolean;
}

export interface Tempo {
  time: number;
  qpm: number;
}

export interface TimeSignature {
  time: number;
  numerator: number;
  denominator: number;
}

export interface NoteSequence {
  notes: Note[];
  tempos?: Tempo[];
  timeSignatures?: TimeSignature[];
  totalTime?: number;
}

export interface SaveSongResult {
  success: boolean;
  filepath?: string;
  timestamp?: number;
  filename?: string;
  error?: string;
}

export interface PlaybackProgress {
  current: number;
  total: number;
  progress: number;
}

export interface MidiInstrument {
  name: string;
  family: string;
}

export interface MidiDrum {
  name: string;
}

export interface AppConfig {
  mcpPort: number;
  pythonPort: number;
  lastUsedSong: string | null;
  apiToken?: string | null;
}

export interface SongInfo {
  filename: string;
  filepath: string;
  timestamp: number;
  created: Date;
  size: number;
}

export interface PlayMidiResult {
  success: boolean;
  error?: string;
}

export interface MidiFileResult {
  success: boolean;
  noteSequence?: NoteSequence;
  error?: string;
}

export interface ConfigUpdateResult {
  success: boolean;
  error?: string;
}

export interface McpServerStatus {
  running: boolean;
  port: number;
}