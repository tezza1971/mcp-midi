import React, { useState, useEffect } from 'react';
import StatusBar from './components/StatusBar';
import SongDisplay from './components/SongDisplay';
import MidiImport from './components/MidiImport';
import SettingsModal from './components/SettingsModal';
import AboutModal from './components/AboutModal';
import { NoteSequence, AppConfig, SongInfo } from './types';

function App() {
  const [currentSong, setCurrentSong] = useState<NoteSequence | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [config, setConfig] = useState<AppConfig>({
    mcpPort: 8002,
    pythonPort: 5000,
    lastUsedSong: null
  });
  const [songList, setSongList] = useState<SongInfo[]>([]);

  useEffect(() => {
    // Load initial data when component mounts
    loadSongList();
    loadLatestSong();
  }, []);

  const loadSongList = async () => {
    try {
      const songs = await window.electronAPI.getSongList();
      setSongList(songs);
    } catch (error) {
      console.error('Failed to load song list:', error);
    }
  };

  const loadLatestSong = async () => {
    try {
      const song = await window.electronAPI.getLatestSong();
      if (song) {
        setCurrentSong(song);
      }
    } catch (error) {
      console.error('Failed to load latest song:', error);
    }
  };

  const handlePlaySong = async () => {
    if (!currentSong) return;
    
    setIsPlaying(true);
    try {
      await window.electronAPI.playMidi(currentSong);
    } catch (error) {
      console.error('Failed to play song:', error);
    } finally {
      setIsPlaying(false);
    }
  };

  const handleStopSong = async () => {
    setIsPlaying(false);
    try {
      await window.electronAPI.stopMidi();
    } catch (error) {
      console.error('Failed to stop song:', error);
    }
  };

  const handleImportMidi = async (filePath: string) => {
    try {
      const result = await window.electronAPI.importMidiFile(filePath);
      if (result.success && result.noteSequence) {
        setCurrentSong(result.noteSequence);
        loadSongList(); // Refresh the song list
      } else {
        alert(`Failed to import MIDI file: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to import MIDI file:', error);
      alert('Failed to import MIDI file');
    }
  };

  const handleConfigChange = async (newConfig: Partial<AppConfig>) => {
    try {
      const updatedConfig = { ...config, ...newConfig };
      const result = await window.electronAPI.updateConfig(updatedConfig);
      if (result.success) {
        setConfig(updatedConfig);
        setShowSettings(false);
      } else {
        alert(`Failed to save configuration: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to save configuration:', error);
      alert('Failed to save configuration');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-6">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">MCP MIDI Bridge</h1>
          <p className="text-gray-600">Bridge between LLM music generation and your DAW</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <SongDisplay
            currentSong={currentSong}
            isPlaying={isPlaying}
            onPlay={handlePlaySong}
            onStop={handleStopSong}
            songList={songList}
            onSongSelect={(song) => setCurrentSong(song)}
            onExport={() => {
              // TODO: Implement export functionality
              console.log('Exporting song...');
            }}
            playbackProgress={0}
            midiInstruments={{}}
            midiDrums={{}}
          />
          </div>
          
          <div>
            <MidiImport onImport={handleImportMidi} />
            
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
              >
                Settings
              </button>
              <button
                type="button"
                onClick={() => setShowAbout(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
              >
                About
              </button>
            </div>
          </div>
        </div>
      </div>

      <StatusBar
        apiStatus={{
          running: true, // This would be dynamic in a real app
          port: config.mcpPort,
        }}
        midiOutputs={[]}
      />

      {showSettings && (
        <SettingsModal
          config={config}
          onSave={handleSaveConfig}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showAbout && (
        <AboutModal onClose={() => setShowAbout(false)} />
      )}
    </div>
  );
}

export default App;