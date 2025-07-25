import { NoteSequence } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Play, Download, Music } from 'lucide-react';

interface SongDisplayProps {
  currentSong: NoteSequence | null;
  midiInstruments: Record<number, { name: string, family: string }>;
  midiDrums: Record<number, { name: string }>;
  onPlay: () => void;
  onExport: () => void;
  isPlaying: boolean;
  playbackProgress: number;
}

export default function SongDisplay({ 
  currentSong, 
  midiInstruments, 
  midiDrums, 
  onPlay, 
  onExport, 
  isPlaying, 
  playbackProgress 
}: SongDisplayProps) {
  if (!currentSong) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" />
            Current Song
          </CardTitle>
          <CardDescription>No song loaded</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Load a NoteSequence from the JSON Input tab or import a MIDI file to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Get unique channels and their programs
  const channels = new Map<number, { program: number, noteCount: number }>();
  
  for (const note of currentSong.notes) {
    const channel = note.instrument || 0;
    const program = note.program || 0;
    
    if (!channels.has(channel)) {
      channels.set(channel, {
        program,
        noteCount: 1
      });
    } else {
      const info = channels.get(channel);
      if (info) {
        info.noteCount++;
      }
    }
  }

  // Convert MIDI note number to note name
  const noteNumberToName = (noteNumber: number): string => {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(noteNumber / 12) - 1;
    const noteName = noteNames[noteNumber % 12];
    return `${noteName}${octave}`;
  };

  // Get instrument name from program number
  const getInstrumentName = (program: number): string => {
    return midiInstruments[program]?.name || `Program ${program}`;
  };

  // Calculate note range
  const pitches = currentSong.notes.map(note => note.pitch);
  const minPitch = Math.min(...pitches);
  const maxPitch = Math.max(...pitches);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Music className="h-5 w-5" />
          Current Song
        </CardTitle>
        <CardDescription>
          {currentSong.notes.length} notes • {currentSong.totalTime?.toFixed(2) || 0}s duration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Song Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold">{currentSong.notes.length}</div>
            <div className="text-sm text-muted-foreground">Notes</div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold">{channels.size}</div>
            <div className="text-sm text-muted-foreground">Channels</div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold">{noteNumberToName(minPitch)} - {noteNumberToName(maxPitch)}</div>
            <div className="text-sm text-muted-foreground">Range</div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold">{currentSong.totalTime?.toFixed(1) || 0}s</div>
            <div className="text-sm text-muted-foreground">Duration</div>
          </div>
        </div>

        {/* Channel Information */}
        {channels.size > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3">Channel Information</h3>
            <div className="space-y-2">
              {Array.from(channels.entries()).map(([channel, info]) => (
                <div key={channel} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                      {channel}
                    </div>
                    <div>
                      <div className="font-medium">
                        {channel === 9 ? 'Drums' : getInstrumentName(info.program)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Channel {channel} • {info.noteCount} notes
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Program {info.program}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Playback Progress */}
        {isPlaying && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Playing...</span>
              <span className="text-sm text-muted-foreground">{Math.round(playbackProgress)}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300" 
                style={{ width: `${playbackProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button onClick={onPlay} disabled={isPlaying} className="flex items-center gap-2">
            <Play className="h-4 w-4" />
            {isPlaying ? 'Playing...' : 'Play'}
          </Button>
          <Button variant="outline" onClick={onExport} className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}