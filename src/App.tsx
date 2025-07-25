import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/Tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/Card';
import { Button } from './components/ui/Button';
import StatusBar from './components/StatusBar';
import SongDisplay from './components/SongDisplay';
import MidiImport from './components/MidiImport';
import JsonInput from './components/JsonInput';
import SettingsModal from './components/SettingsModal';
import AboutModal from './components/AboutModal';
import { NoteSequence, AppConfig, SongInfo } from './types';
import { Play, Square, Settings, Info, Music, Upload, FileText, List } from 'lucide-react';

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
  const [isServerRunning, setIsServerRunning] = useState(false);

  useEffect(() => {
    // Load initial data when component mounts
    loadSongList();
    loadLatestSong();
    checkServerStatus();
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

  const checkServerStatus = async () => {
    try {
      const status = await window.electronAPI.getMcpStatus();
      setIsServerRunning(status.running);
    } catch (error) {
      console.error('Failed to check server status:', error);
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
    try {
      await window.electronAPI.stopMidi();
      setIsPlaying(false);
    } catch (error) {
      console.error('Failed to stop song:', error);
    }
  };

  const handleSongSelection = (song: SongInfo) => {
    // Load the selected song
    console.log('Loading song:', song);
  };

  const handleNoteSequenceLoad = (noteSequence: NoteSequence) => {
    setCurrentSong(noteSequence);
  };

  const handleConfigChange = async (newConfig: Partial<AppConfig>) => {
    try {
      await window.electronAPI.updateConfig(newConfig);
      setConfig(prev => ({ ...prev, ...newConfig }));
    } catch (error) {
      console.error('Failed to update config:', error);
    }
  };

  const handleMidiImport = (filePath: string) => {
    console.log('Importing MIDI file:', filePath);
    // TODO: Implement MIDI file import
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">MCP MIDI Bridge</h1>
            <p className="text-muted-foreground">
              Bridge between LLM music generation and DAWs via virtual MIDI
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setShowSettings(true)}>
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setShowAbout(true)}>
              <Info className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Status Bar */}
        <StatusBar
          apiStatus={{
            running: isServerRunning,
            port: config.mcpPort,
          }}
          midiOutputs={[]}
        />

        {/* Main Content */}
        <Tabs defaultValue="player" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="player" className="flex items-center gap-2">
              <Music className="h-4 w-4" />
              Player
            </TabsTrigger>
            <TabsTrigger value="json-input" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              JSON Input
            </TabsTrigger>
            <TabsTrigger value="midi-import" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              MIDI Import
            </TabsTrigger>
            <TabsTrigger value="song-list" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              Song List
            </TabsTrigger>
          </TabsList>

          <TabsContent value="player" className="space-y-6">
            {/* Current Song Display */}
            <SongDisplay
              currentSong={currentSong}
              isPlaying={isPlaying}
              onPlay={handlePlaySong}
              onExport={() => {
                console.log('Exporting song...');
              }}
              playbackProgress={0}
              midiInstruments={{}}
              midiDrums={{}}
            />

            {/* Playback Controls */}
            <Card>
              <CardHeader>
                <CardTitle>Playback Controls</CardTitle>
                <CardDescription>
                  Control MIDI playback and manage the current song
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Button
                    onClick={handlePlaySong}
                    disabled={!currentSong || isPlaying}
                    className="flex items-center gap-2"
                  >
                    <Play className="h-4 w-4" />
                    Play
                  </Button>
                  <Button
                    onClick={handleStopSong}
                    disabled={!isPlaying}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Square className="h-4 w-4" />
                    Stop
                  </Button>
                  {currentSong && (
                    <div className="text-sm text-muted-foreground">
                      {currentSong.notes?.length || 0} notes • {currentSong.totalTime?.toFixed(2) || 0}s
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="json-input">
            <JsonInput onNoteSequenceLoad={handleNoteSequenceLoad} />
          </TabsContent>

          <TabsContent value="midi-import">
            <MidiImport onImport={handleMidiImport} />
          </TabsContent>

          <TabsContent value="song-list" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Saved Songs</CardTitle>
                <CardDescription>
                  Browse and manage your saved NoteSequence files
                </CardDescription>
              </CardHeader>
              <CardContent>
                {songList.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No songs saved yet. Load a NoteSequence to get started.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {songList.map((song, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer"
                        onClick={() => handleSongSelection(song)}
                      >
                        <div>
                          <div className="font-medium">{song.filename}</div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(song.created).toLocaleString()}
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          Load
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modals */}
        {showSettings && (
          <SettingsModal
            config={config}
            onClose={() => setShowSettings(false)}
            onSave={handleConfigChange}
          />
        )}

        {showAbout && (
          <AboutModal
            onClose={() => setShowAbout(false)}
          />
        )}
      </div>
    </div>
  );
}

export default App;