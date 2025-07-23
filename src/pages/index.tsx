import { useEffect, useState } from 'react';
import Head from 'next/head';
import { AppConfig, McpServerStatus, NoteSequence, PlaybackProgress, SaveSongResult } from '../types';
import SongDisplay from '../components/SongDisplay';
import MidiImport from '../components/MidiImport';
import StatusBar from '../components/StatusBar';
import SettingsModal from '../components/SettingsModal';
import AboutModal from '../components/AboutModal';

export default function Home() {
  // State
  const [currentSong, setCurrentSong] = useState<NoteSequence | null>(null);
  const [midiInstruments, setMidiInstruments] = useState<Record<number, { name: string, family: string }>>({});
  const [midiDrums, setMidiDrums] = useState<Record<number, { name: string }>>({});
  const [appConfig, setAppConfig] = useState<AppConfig>({ mcpPort: 3000, pythonPort: 5000, lastUsedSong: null });
  const [midiOutputs, setMidiOutputs] = useState<string[]>([]);
  const [apiStatus, setApiStatus] = useState<McpServerStatus>({ running: false, port: 3000 });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Initialize the application
  useEffect(() => {
    const init = async () => {
      try {
        // Load configuration
        const config = await window.api.getConfig();
        setAppConfig(config);

        // Load MIDI instrument data
        const instruments = await window.api.getMidiInstruments();
        setMidiInstruments(instruments);

        const drums = await window.api.getMidiDrums();
        setMidiDrums(drums);

        // Check MIDI outputs
        const outputs = await window.api.getMidiOutputs();
        setMidiOutputs(outputs);

        // Try to load the current song
        const song = await window.api.getCurrentSong();
        if (song) {
          setCurrentSong(song);
        }
      } catch (error) {
        console.error('Failed to initialize:', error);
      }
    };

    init();
  }, []);

  // Set up event listeners
  useEffect(() => {
    // Song updated event
    window.api.onSongUpdated((data: SaveSongResult) => {
      console.log('Song updated:', data);
      // Reload the current song
      window.api.getCurrentSong().then(song => {
        setCurrentSong(song);
      });
    });

    // Playback progress event
    window.api.onPlaybackProgress((data: PlaybackProgress) => {
      const { current, total } = data;
      const percentage = (current / total) * 100;
      setPlaybackProgress(percentage);
    });

    // MCP server status event
    window.api.onMcpServerStatus((data: McpServerStatus) => {
      setApiStatus(data);
    });

    // Open settings event
    window.api.onOpenSettings(() => {
      setIsSettingsOpen(true);
    });

    // Show about event
    window.api.onShowAbout(() => {
      setIsAboutOpen(true);
    });
  }, []);

  // Handle playing MIDI
  const handlePlayMidi = async () => {
    if (!currentSong) return;

    setIsPlaying(true);
    setPlaybackProgress(0);

    try {
      const result = await window.api.playMidi(currentSong);
      if (!result.success) {
        console.error('Failed to play MIDI:', result.error);
      }
    } catch (error) {
      console.error('Error playing MIDI:', error);
    } finally {
      setIsPlaying(false);
    }
  };

  // Handle exporting MIDI
  const handleExportMidi = async () => {
    if (!currentSong) return;

    // This would typically open a save dialog
    // For now, we'll just log that it would export
    console.log('Would export MIDI file for:', currentSong);
    alert('Export functionality will be implemented in a future version.');
  };

  // Handle importing MIDI
  const handleMidiFile = async (filePath: string) => {
    try {
      const result = await window.api.importMidiFile(filePath);
      if (result.success && result.noteSequence) {
        setCurrentSong(result.noteSequence);
      } else {
        alert(`Failed to import MIDI file: ${result.error}`);
      }
    } catch (error) {
      console.error('Error importing MIDI file:', error);
      alert('An error occurred while importing the MIDI file.');
    }
  };

  // Handle updating configuration
  const handleUpdateConfig = async (newConfig: Partial<AppConfig>) => {
    try {
      const result = await window.api.updateConfig(newConfig);
      if (result.success) {
        setAppConfig(prev => ({ ...prev, ...newConfig }));
        setIsSettingsOpen(false);
      } else {
        alert(`Failed to update settings: ${result.error}`);
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      alert('An error occurred while updating settings.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Head>
        <title>MCP MIDI Bridge</title>
        <meta name="description" content="MCP MIDI Bridge - Connect LLMs to your DAW" />
        <link rel="icon" href="/icon.ico" />
      </Head>

      <header className="bg-gray-800 text-white p-4 border-b-4 border-teal-500">
        <h1 className="text-2xl font-bold">MCP MIDI Bridge</h1>
      </header>

      <main className="container mx-auto p-4">
        <StatusBar 
          apiStatus={apiStatus} 
          midiOutputs={midiOutputs} 
        />

        <SongDisplay 
          currentSong={currentSong}
          midiInstruments={midiInstruments}
          midiDrums={midiDrums}
          onPlay={handlePlayMidi}
          onExport={handleExportMidi}
          isPlaying={isPlaying}
          playbackProgress={playbackProgress}
        />

        <MidiImport onImport={handleMidiFile} />
      </main>

      {isSettingsOpen && (
        <SettingsModal 
          config={appConfig} 
          onClose={() => setIsSettingsOpen(false)} 
          onSave={handleUpdateConfig} 
        />
      )}

      {isAboutOpen && (
        <AboutModal onClose={() => setIsAboutOpen(false)} />
      )}
    </div>
  );
}