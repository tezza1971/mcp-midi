import easymidi from 'easymidi';
import { NoteSequence, PlayMidiResult, PlaybackProgress, MidiInstrument, MidiDrum } from '../types';

/**
 * MIDI Manager for handling virtual MIDI devices and multi-channel support
 */
import { EventEmitter } from 'events';

export class MidiManager extends EventEmitter {
  private virtualOutput: easymidi.Output | null = null;
  private isPlaying: boolean = false;
  private activeChannels: Set<number> = new Set();
  private currentPlaybackTimeout: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.initialize();
  }

  /**
   * Initialize the MIDI manager
   */
  private initialize(): void {
    try {
      // List available MIDI outputs
      const outputs = easymidi.getOutputs();
      console.log('Available MIDI outputs:', outputs);

      // Create a virtual MIDI output if needed
      if (!outputs.includes('MCP MIDI Bridge')) {
        this.virtualOutput = new easymidi.Output('MCP MIDI Bridge', true);
        console.log('Created virtual MIDI output: MCP MIDI Bridge');
      } else {
        this.virtualOutput = new easymidi.Output('MCP MIDI Bridge');
        console.log('Connected to existing virtual MIDI output: MCP MIDI Bridge');
      }

      // Notify listeners about connection
      this.emit('midi-connection-status', { connected: true, deviceName: 'MCP MIDI Bridge' });
    } catch (error) {
      console.error('Failed to initialize MIDI:', error);
      this.emit('midi-connection-status', { connected: false, error });
    }
  }

  /**
   * Get available MIDI outputs
   * @returns {string[]} - Array of MIDI output names
   */
  getOutputs(): string[] {
    return easymidi.getOutputs();
  }

  /**
   * Send a program change to set the instrument for a channel
   * @param {number} channel - MIDI channel (0-15)
   * @param {number} program - Program number (0-127)
   */
  setProgramForChannel(channel: number, program: number): void {
    if (!this.virtualOutput) return;

    this.virtualOutput.send('program', {
      channel: channel,
      number: program
    });

    console.log(`Set channel ${channel} to program ${program}`);
  }

  /**
   * Stop current playback
   */
  stopPlayback(): void {
    this.isPlaying = false;
    if (this.currentPlaybackTimeout) {
      clearTimeout(this.currentPlaybackTimeout);
      this.currentPlaybackTimeout = null;
    }
    
    // Send all notes off for all channels
    if (this.virtualOutput) {
      for (let channel = 0; channel < 16; channel++) {
        for (let note = 0; note < 128; note++) {
          this.virtualOutput.send('noteoff', {
            note: note,
            velocity: 0,
            channel: channel
          });
        }
      }
    }
  }

  /**
   * Play a NoteSequence through the virtual MIDI output
   * @param {NoteSequence} noteSequence - The NoteSequence to play
   * @param {Function} progressCallback - Callback for playback progress updates
   * @returns {Promise<PlayMidiResult>} - Result of the playback
   */
  async playNoteSequence(
    noteSequence: NoteSequence,
    progressCallback: ((progress: PlaybackProgress) => void) | null = null
  ): Promise<PlayMidiResult> {
    if (!this.virtualOutput) {
      return { success: false, error: 'MIDI output not available' };
    }

    if (this.isPlaying) {
      return { success: false, error: 'Already playing' };
    }

    if (!noteSequence || !noteSequence.notes || noteSequence.notes.length === 0) {
      return { success: false, error: 'Invalid or empty note sequence' };
    }

    try {
      this.isPlaying = true;
      this.activeChannels.clear();

      // Sort notes by start time
      const sortedNotes = [...noteSequence.notes].sort((a, b) => a.startTime - b.startTime);

      // Get the total duration
      const totalDuration = noteSequence.totalTime ||
        Math.max(...sortedNotes.map(note => note.endTime)) || 0;

      // Track active notes to ensure we send noteoff events
      const activeNotes = new Map<number, Set<number>>();

      // Set up instruments for each channel used in the sequence
      const channelsUsed = new Set(sortedNotes.map(note => note.instrument || 0));

      // Send program changes for each channel
      for (const channel of channelsUsed) {
        // Find the first note for this channel to determine the program
        const firstNoteForChannel = sortedNotes.find(note => (note.instrument || 0) === channel);
        if (firstNoteForChannel) {
          const program = firstNoteForChannel.program || 0;
          this.setProgramForChannel(channel, program);
          this.activeChannels.add(channel);
        }
      }

      // Start time for calculating relative timing
      const startTime = Date.now();

      // Process all notes and schedule them
      for (let i = 0; i < sortedNotes.length && this.isPlaying; i++) {
        const note = sortedNotes[i];
        const channel = note.instrument || 0;
        const pitch = note.pitch;
        const velocity = note.velocity || 80;

        // Calculate the time to wait before playing this note
        const noteStartTime = note.startTime * 1000; // convert to ms
        const noteEndTime = note.endTime * 1000; // convert to ms

        // Wait until it's time to play this note
        await new Promise<void>(resolve => {
          const timeToWait = Math.max(0, startTime + noteStartTime - Date.now());
          this.currentPlaybackTimeout = setTimeout(resolve, timeToWait);
        });

        if (!this.isPlaying) break; // Check if playback was stopped

        // Send note on message
        this.virtualOutput.send('noteon', {
          note: pitch,
          velocity: velocity,
          channel: channel
        });

        // Add to active notes
        if (!activeNotes.has(channel)) {
          activeNotes.set(channel, new Set());
        }
        activeNotes.get(channel)?.add(pitch);

        // Schedule note off
        this.currentPlaybackTimeout = setTimeout(() => {
          if (this.virtualOutput) {
            this.virtualOutput.send('noteoff', {
              note: pitch,
              velocity: 0,
              channel: channel
            });
          }

          // Remove from active notes
          if (activeNotes.has(channel)) {
            activeNotes.get(channel)?.delete(pitch);
          }
        }, Math.max(0, startTime + noteEndTime - Date.now()));

        // Send progress updates
        if (progressCallback && totalDuration > 0) {
          const progress = note.startTime / totalDuration;
          progressCallback({
            current: note.startTime,
            total: totalDuration,
            progress: progress
          });
        }
      }

      // Wait for the entire sequence to finish
      if (this.isPlaying) {
        await new Promise<void>(resolve => {
          const timeToWait = Math.max(0, startTime + totalDuration * 1000 - Date.now()) + 100; // Add a small buffer
          this.currentPlaybackTimeout = setTimeout(resolve, timeToWait);
        });
      }

      // Ensure all notes are turned off
      for (const [channel, notes] of activeNotes.entries()) {
        for (const pitch of notes) {
          if (this.virtualOutput) {
            this.virtualOutput.send('noteoff', {
              note: pitch,
              velocity: 0,
              channel: channel
            });
          }
        }
      }

      // Send final progress update
      if (progressCallback) {
        progressCallback({
          current: totalDuration,
          total: totalDuration,
          progress: 1.0
        });
      }

      this.isPlaying = false;
      return { success: true };

    } catch (error) {
      this.isPlaying = false;
      console.error('Error playing note sequence:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Send a control change message
   * @param {number} channel - MIDI channel (0-15)
   * @param {number} controller - Controller number (0-127)
   * @param {number} value - Controller value (0-127)
   */
  sendControlChange(channel: number, controller: number, value: number): void {
    if (!this.virtualOutput) return;

    this.virtualOutput.send('cc', {
      controller: controller,
      value: value,
      channel: channel
    });
  }

  /**
   * Send all notes off for a specific channel
   * @param {number} channel - MIDI channel (0-15)
   */
  allNotesOff(channel: number): void {
    if (!this.virtualOutput) return;

    // Send All Notes Off (CC 123)
    this.sendControlChange(channel, 123, 0);
  }

  /**
   * Send all sound off for a specific channel
   * @param {number} channel - MIDI channel (0-15)
   */
  allSoundOff(channel: number): void {
    if (!this.virtualOutput) return;

    // Send All Sound Off (CC 120)
    this.sendControlChange(channel, 120, 0);
  }

  /**
   * Reset all controllers for a specific channel
   * @param {number} channel - MIDI channel (0-15)
   */
  resetAllControllers(channel: number): void {
    if (!this.virtualOutput) return;

    // Send Reset All Controllers (CC 121)
    this.sendControlChange(channel, 121, 0);
  }

  /**
   * Get General MIDI instrument names
   * @returns {MidiInstrument[]} - Array of instrument information
   */
  getGeneralMidiInstruments(): MidiInstrument[] {
    return [
      // Piano
      { name: 'Acoustic Grand Piano', family: 'Piano' },
      { name: 'Bright Acoustic Piano', family: 'Piano' },
      { name: 'Electric Grand Piano', family: 'Piano' },
      { name: 'Honky-tonk Piano', family: 'Piano' },
      { name: 'Electric Piano 1', family: 'Piano' },
      { name: 'Electric Piano 2', family: 'Piano' },
      { name: 'Harpsichord', family: 'Piano' },
      { name: 'Clavi', family: 'Piano' },

      // Chromatic Percussion
      { name: 'Celesta', family: 'Chromatic Percussion' },
      { name: 'Glockenspiel', family: 'Chromatic Percussion' },
      { name: 'Music Box', family: 'Chromatic Percussion' },
      { name: 'Vibraphone', family: 'Chromatic Percussion' },
      { name: 'Marimba', family: 'Chromatic Percussion' },
      { name: 'Xylophone', family: 'Chromatic Percussion' },
      { name: 'Tubular Bells', family: 'Chromatic Percussion' },
      { name: 'Dulcimer', family: 'Chromatic Percussion' },

      // Organ
      { name: 'Drawbar Organ', family: 'Organ' },
      { name: 'Percussive Organ', family: 'Organ' },
      { name: 'Rock Organ', family: 'Organ' },
      { name: 'Church Organ', family: 'Organ' },
      { name: 'Reed Organ', family: 'Organ' },
      { name: 'Accordion', family: 'Organ' },
      { name: 'Harmonica', family: 'Organ' },
      { name: 'Tango Accordion', family: 'Organ' },

      // Guitar
      { name: 'Acoustic Guitar (nylon)', family: 'Guitar' },
      { name: 'Acoustic Guitar (steel)', family: 'Guitar' },
      { name: 'Electric Guitar (jazz)', family: 'Guitar' },
      { name: 'Electric Guitar (clean)', family: 'Guitar' },
      { name: 'Electric Guitar (muted)', family: 'Guitar' },
      { name: 'Overdriven Guitar', family: 'Guitar' },
      { name: 'Distortion Guitar', family: 'Guitar' },
      { name: 'Guitar harmonics', family: 'Guitar' },

      // Bass
      { name: 'Acoustic Bass', family: 'Bass' },
      { name: 'Electric Bass (finger)', family: 'Bass' },
      { name: 'Electric Bass (pick)', family: 'Bass' },
      { name: 'Fretless Bass', family: 'Bass' },
      { name: 'Slap Bass 1', family: 'Bass' },
      { name: 'Slap Bass 2', family: 'Bass' },
      { name: 'Synth Bass 1', family: 'Bass' },
      { name: 'Synth Bass 2', family: 'Bass' },

      // Strings
      { name: 'Violin', family: 'Strings' },
      { name: 'Viola', family: 'Strings' },
      { name: 'Cello', family: 'Strings' },
      { name: 'Contrabass', family: 'Strings' },
      { name: 'Tremolo Strings', family: 'Strings' },
      { name: 'Pizzicato Strings', family: 'Strings' },
      { name: 'Orchestral Harp', family: 'Strings' },
      { name: 'Timpani', family: 'Strings' },

      // Ensemble
      { name: 'String Ensemble 1', family: 'Ensemble' },
      { name: 'String Ensemble 2', family: 'Ensemble' },
      { name: 'SynthStrings 1', family: 'Ensemble' },
      { name: 'SynthStrings 2', family: 'Ensemble' },
      { name: 'Choir Aahs', family: 'Ensemble' },
      { name: 'Voice Oohs', family: 'Ensemble' },
      { name: 'Synth Voice', family: 'Ensemble' },
      { name: 'Orchestra Hit', family: 'Ensemble' },

      // Brass
      { name: 'Trumpet', family: 'Brass' },
      { name: 'Trombone', family: 'Brass' },
      { name: 'Tuba', family: 'Brass' },
      { name: 'Muted Trumpet', family: 'Brass' },
      { name: 'French Horn', family: 'Brass' },
      { name: 'Brass Section', family: 'Brass' },
      { name: 'SynthBrass 1', family: 'Brass' },
      { name: 'SynthBrass 2', family: 'Brass' },

      // Reed
      { name: 'Soprano Sax', family: 'Reed' },
      { name: 'Alto Sax', family: 'Reed' },
      { name: 'Tenor Sax', family: 'Reed' },
      { name: 'Baritone Sax', family: 'Reed' },
      { name: 'Oboe', family: 'Reed' },
      { name: 'English Horn', family: 'Reed' },
      { name: 'Bassoon', family: 'Reed' },
      { name: 'Clarinet', family: 'Reed' },

      // Pipe
      { name: 'Piccolo', family: 'Pipe' },
      { name: 'Flute', family: 'Pipe' },
      { name: 'Recorder', family: 'Pipe' },
      { name: 'Pan Flute', family: 'Pipe' },
      { name: 'Blown Bottle', family: 'Pipe' },
      { name: 'Shakuhachi', family: 'Pipe' },
      { name: 'Whistle', family: 'Pipe' },
      { name: 'Ocarina', family: 'Pipe' },

      // Synth Lead
      { name: 'Lead 1 (square)', family: 'Synth Lead' },
      { name: 'Lead 2 (sawtooth)', family: 'Synth Lead' },
      { name: 'Lead 3 (calliope)', family: 'Synth Lead' },
      { name: 'Lead 4 (chiff)', family: 'Synth Lead' },
      { name: 'Lead 5 (charang)', family: 'Synth Lead' },
      { name: 'Lead 6 (voice)', family: 'Synth Lead' },
      { name: 'Lead 7 (fifths)', family: 'Synth Lead' },
      { name: 'Lead 8 (bass + lead)', family: 'Synth Lead' },

      // Synth Pad
      { name: 'Pad 1 (new age)', family: 'Synth Pad' },
      { name: 'Pad 2 (warm)', family: 'Synth Pad' },
      { name: 'Pad 3 (polysynth)', family: 'Synth Pad' },
      { name: 'Pad 4 (choir)', family: 'Synth Pad' },
      { name: 'Pad 5 (bowed)', family: 'Synth Pad' },
      { name: 'Pad 6 (metallic)', family: 'Synth Pad' },
      { name: 'Pad 7 (halo)', family: 'Synth Pad' },
      { name: 'Pad 8 (sweep)', family: 'Synth Pad' },

      // Synth Effects
      { name: 'FX 1 (rain)', family: 'Synth Effects' },
      { name: 'FX 2 (soundtrack)', family: 'Synth Effects' },
      { name: 'FX 3 (crystal)', family: 'Synth Effects' },
      { name: 'FX 4 (atmosphere)', family: 'Synth Effects' },
      { name: 'FX 5 (brightness)', family: 'Synth Effects' },
      { name: 'FX 6 (goblins)', family: 'Synth Effects' },
      { name: 'FX 7 (echoes)', family: 'Synth Effects' },
      { name: 'FX 8 (sci-fi)', family: 'Synth Effects' },

      // Ethnic
      { name: 'Sitar', family: 'Ethnic' },
      { name: 'Banjo', family: 'Ethnic' },
      { name: 'Shamisen', family: 'Ethnic' },
      { name: 'Koto', family: 'Ethnic' },
      { name: 'Kalimba', family: 'Ethnic' },
      { name: 'Bag pipe', family: 'Ethnic' },
      { name: 'Fiddle', family: 'Ethnic' },
      { name: 'Shanai', family: 'Ethnic' },

      // Percussive
      { name: 'Tinkle Bell', family: 'Percussive' },
      { name: 'Agogo', family: 'Percussive' },
      { name: 'Steel Drums', family: 'Percussive' },
      { name: 'Woodblock', family: 'Percussive' },
      { name: 'Taiko Drum', family: 'Percussive' },
      { name: 'Melodic Tom', family: 'Percussive' },
      { name: 'Synth Drum', family: 'Percussive' },
      { name: 'Reverse Cymbal', family: 'Percussive' },

      // Sound Effects
      { name: 'Guitar Fret Noise', family: 'Sound Effects' },
      { name: 'Breath Noise', family: 'Sound Effects' },
      { name: 'Seashore', family: 'Sound Effects' },
      { name: 'Bird Tweet', family: 'Sound Effects' },
      { name: 'Telephone Ring', family: 'Sound Effects' },
      { name: 'Helicopter', family: 'Sound Effects' },
      { name: 'Applause', family: 'Sound Effects' },
      { name: 'Gunshot', family: 'Sound Effects' }
    ];
  }

  /**
   * Get General MIDI drum names (Channel 10)
   * @returns {MidiDrum[]} - Array of drum information
   */
  getGeneralMidiDrums(): MidiDrum[] {
    return [
      { name: 'Acoustic Bass Drum' },    // 35
      { name: 'Bass Drum 1' },           // 36
      { name: 'Side Stick' },            // 37
      { name: 'Acoustic Snare' },        // 38
      { name: 'Hand Clap' },             // 39
      { name: 'Electric Snare' },        // 40
      { name: 'Low Floor Tom' },         // 41
      { name: 'Closed Hi Hat' },         // 42
      { name: 'High Floor Tom' },        // 43
      { name: 'Pedal Hi-Hat' },          // 44
      { name: 'Low Tom' },               // 45
      { name: 'Open Hi-Hat' },           // 46
      { name: 'Low-Mid Tom' },           // 47
      { name: 'Hi Mid Tom' },            // 48
      { name: 'Crash Cymbal 1' },        // 49
      { name: 'High Tom' },              // 50
      { name: 'Ride Cymbal 1' },         // 51
      { name: 'Chinese Cymbal' },        // 52
      { name: 'Ride Bell' },             // 53
      { name: 'Tambourine' },            // 54
      { name: 'Splash Cymbal' },         // 55
      { name: 'Cowbell' },               // 56
      { name: 'Crash Cymbal 2' },        // 57
      { name: 'Vibraslap' },             // 58
      { name: 'Ride Cymbal 2' },         // 59
      { name: 'Hi Bongo' },              // 60
      { name: 'Low Bongo' },             // 61
      { name: 'Mute Hi Conga' },         // 62
      { name: 'Open Hi Conga' },         // 63
      { name: 'Low Conga' },             // 64
      { name: 'High Timbale' },          // 65
      { name: 'Low Timbale' },           // 66
      { name: 'High Agogo' },            // 67
      { name: 'Low Agogo' },             // 68
      { name: 'Cabasa' },                // 69
      { name: 'Maracas' },               // 70
      { name: 'Short Whistle' },         // 71
      { name: 'Long Whistle' },          // 72
      { name: 'Short Guiro' },           // 73
      { name: 'Long Guiro' },            // 74
      { name: 'Claves' },                // 75
      { name: 'Hi Wood Block' },         // 76
      { name: 'Low Wood Block' },        // 77
      { name: 'Mute Cuica' },            // 78
      { name: 'Open Cuica' },            // 79
      { name: 'Mute Triangle' },         // 80
      { name: 'Open Triangle' }          // 81
    ];
  }

  /**
   * Close the MIDI output
   */
  close(): void {
    if (this.virtualOutput) {
      this.virtualOutput.close();
      this.virtualOutput = null;
    }
  }
}