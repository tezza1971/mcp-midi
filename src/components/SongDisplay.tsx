import { NoteSequence } from '../types';

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
      <div className="bg-white p-6 rounded-md shadow-md mb-5">
        <h2 className="text-xl font-semibold border-b pb-2 mb-4">Current Song</h2>
        <p>No song loaded</p>
      </div>
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
  const midiNoteToName = (midiNote: number) => {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midiNote / 12) - 1;
    const noteName = noteNames[midiNote % 12];
    return `${noteName}${octave}`;
  };

  const noteCount = currentSong.notes ? currentSong.notes.length : 0;
  const totalTime = currentSong.totalTime || 0;

  return (
    <div className="bg-white p-6 rounded-md shadow-md mb-5">
      <h2 className="text-xl font-semibold border-b pb-2 mb-4">Current Song</h2>
      
      <div className="mb-4">
        <p><strong>Notes:</strong> {noteCount}</p>
        <p><strong>Duration:</strong> {totalTime.toFixed(2)} seconds</p>
        <p><strong>Last Updated:</strong> {new Date().toLocaleString()}</p>
      </div>
      
      <div className="bg-gray-50 p-3 rounded border mb-4 font-mono text-sm h-48 overflow-y-auto">
        {currentSong.notes.slice(0, 20).map((note, index) => (
          <div key={index}>
            Note: {note.pitch} ({midiNoteToName(note.pitch)}), 
            Start: {note.startTime}s, 
            End: {note.endTime}s, 
            Velocity: {note.velocity || 80}, 
            Channel: {note.instrument || 0}
          </div>
        ))}
        {currentSong.notes.length > 20 && (
          <div className="mt-2">... and {currentSong.notes.length - 20} more notes</div>
        )}
      </div>
      
      <h3 className="text-lg font-semibold border-b pb-2 mb-2">Channel Information</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
        {Array.from(channels.keys()).sort((a, b) => a - b).map(channel => {
          const info = channels.get(channel);
          if (!info) return null;
          
          let instrumentName = 'Unknown';
          
          if (channel === 9) { // Channel 10 (0-indexed as 9)
            instrumentName = 'Drum Kit';
          } else if (midiInstruments[info.program]) {
            instrumentName = midiInstruments[info.program].name;
          }
          
          const isDrumChannel = channel === 9;
          
          return (
            <div 
              key={channel}
              className={`p-3 rounded border ${isDrumChannel ? 'bg-red-50 border-red-200' : 'bg-gray-50'}`}
            >
              <div className="font-bold text-gray-800">Ch {channel + 1}</div>
              <div>{instrumentName}</div>
              <div className="text-sm text-gray-600">Program: {info.program}</div>
              <div className="text-sm text-gray-600">Notes: {info.noteCount}</div>
            </div>
          );
        })}
      </div>
      
      <div className="flex gap-3 mb-2">
        <button 
          type="button"
          onClick={onPlay}
          disabled={isPlaying}
          className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
        >
          {isPlaying ? 'Playing...' : 'Play to DAW'}
        </button>
        <button 
          type="button"
          onClick={onExport}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Export MIDI
        </button>
      </div>
      
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-teal-500 transition-all duration-300"
          style={{ width: `${playbackProgress}%` }}
        />
      </div>
    </div>
  );
}