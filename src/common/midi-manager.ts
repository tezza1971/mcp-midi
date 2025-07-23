import easymidi from 'easymidi';
import { NoteSequence, PlayMidiResult, PlaybackProgress, MidiInstrument, MidiDrum } from '../types';

/**
 * MIDI Manager for handling virtual MIDI devices and multi-channel support
 */
class MidiManager {
  private virtualOutput: easymidi.Output | null = null;
  private isPlaying: boolean = false;
  private activeChannels: Set<number> = new Set();

  constructor() {
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
    } catch (error) {
      console.error('Failed to initialize MIDI:', error);
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
      for (let i = 0; i < sortedNotes.length; i++) {
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
          setTimeout(resolve, timeToWait);
        });
        
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
        setTimeout(() => {
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
      await new Promise<void>(resolve => {
        const timeToWait = Math.max(0, startTime + totalDuration * 1000 - Date.now()) + 100; // Add a small buffer
        setTimeout(resolve, timeToWait);
      });
      
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
      console.error('Error playing MIDI:', error);
      this.isPlaying = false;
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
  
  /**
   * Get information about General MIDI instruments
   * @returns {Record<number, MidiInstrument>} - Object containing GM instrument information
   */
  getGeneralMidiInstruments(): Record<number, MidiInstrument> {
    return {
      // Piano Family (0-7)
      0: { name: 'Acoustic Grand Piano', family: 'Piano' },
      1: { name: 'Bright Acoustic Piano', family: 'Piano' },
      2: { name: 'Electric Grand Piano', family: 'Piano' },
      3: { name: 'Honky-tonk Piano', family: 'Piano' },
      4: { name: 'Electric Piano 1', family: 'Piano' },
      5: { name: 'Electric Piano 2', family: 'Piano' },
      6: { name: 'Harpsichord', family: 'Piano' },
      7: { name: 'Clavinet', family: 'Piano' },
      
      // Chromatic Percussion Family (8-15)
      8: { name: 'Celesta', family: 'Chromatic Percussion' },
      9: { name: 'Glockenspiel', family: 'Chromatic Percussion' },
      10: { name: 'Music Box', family: 'Chromatic Percussion' },
      11: { name: 'Vibraphone', family: 'Chromatic Percussion' },
      12: { name: 'Marimba', family: 'Chromatic Percussion' },
      13: { name: 'Xylophone', family: 'Chromatic Percussion' },
      14: { name: 'Tubular Bells', family: 'Chromatic Percussion' },
      15: { name: 'Dulcimer', family: 'Chromatic Percussion' },
      
      // Organ Family (16-23)
      16: { name: 'Drawbar Organ', family: 'Organ' },
      17: { name: 'Percussive Organ', family: 'Organ' },
      18: { name: 'Rock Organ', family: 'Organ' },
      19: { name: 'Church Organ', family: 'Organ' },
      20: { name: 'Reed Organ', family: 'Organ' },
      21: { name: 'Accordion', family: 'Organ' },
      22: { name: 'Harmonica', family: 'Organ' },
      23: { name: 'Tango Accordion', family: 'Organ' },
      
      // Guitar Family (24-31)
      24: { name: 'Acoustic Guitar (nylon)', family: 'Guitar' },
      25: { name: 'Acoustic Guitar (steel)', family: 'Guitar' },
      26: { name: 'Electric Guitar (jazz)', family: 'Guitar' },
      27: { name: 'Electric Guitar (clean)', family: 'Guitar' },
      28: { name: 'Electric Guitar (muted)', family: 'Guitar' },
      29: { name: 'Overdriven Guitar', family: 'Guitar' },
      30: { name: 'Distortion Guitar', family: 'Guitar' },
      31: { name: 'Guitar Harmonics', family: 'Guitar' },
      
      // Bass Family (32-39)
      32: { name: 'Acoustic Bass', family: 'Bass' },
      33: { name: 'Electric Bass (finger)', family: 'Bass' },
      34: { name: 'Electric Bass (pick)', family: 'Bass' },
      35: { name: 'Fretless Bass', family: 'Bass' },
      36: { name: 'Slap Bass 1', family: 'Bass' },
      37: { name: 'Slap Bass 2', family: 'Bass' },
      38: { name: 'Synth Bass 1', family: 'Bass' },
      39: { name: 'Synth Bass 2', family: 'Bass' },
      
      // Strings Family (40-47)
      40: { name: 'Violin', family: 'Strings' },
      41: { name: 'Viola', family: 'Strings' },
      42: { name: 'Cello', family: 'Strings' },
      43: { name: 'Contrabass', family: 'Strings' },
      44: { name: 'Tremolo Strings', family: 'Strings' },
      45: { name: 'Pizzicato Strings', family: 'Strings' },
      46: { name: 'Orchestral Harp', family: 'Strings' },
      47: { name: 'Timpani', family: 'Strings' },
      
      // Ensemble Family (48-55)
      48: { name: 'String Ensemble 1', family: 'Ensemble' },
      49: { name: 'String Ensemble 2', family: 'Ensemble' },
      50: { name: 'Synth Strings 1', family: 'Ensemble' },
      51: { name: 'Synth Strings 2', family: 'Ensemble' },
      52: { name: 'Choir Aahs', family: 'Ensemble' },
      53: { name: 'Voice Oohs', family: 'Ensemble' },
      54: { name: 'Synth Choir', family: 'Ensemble' },
      55: { name: 'Orchestra Hit', family: 'Ensemble' },
      
      // Brass Family (56-63)
      56: { name: 'Trumpet', family: 'Brass' },
      57: { name: 'Trombone', family: 'Brass' },
      58: { name: 'Tuba', family: 'Brass' },
      59: { name: 'Muted Trumpet', family: 'Brass' },
      60: { name: 'French Horn', family: 'Brass' },
      61: { name: 'Brass Section', family: 'Brass' },
      62: { name: 'Synth Brass 1', family: 'Brass' },
      63: { name: 'Synth Brass 2', family: 'Brass' },
      
      // Reed Family (64-71)
      64: { name: 'Soprano Sax', family: 'Reed' },
      65: { name: 'Alto Sax', family: 'Reed' },
      66: { name: 'Tenor Sax', family: 'Reed' },
      67: { name: 'Baritone Sax', family: 'Reed' },
      68: { name: 'Oboe', family: 'Reed' },
      69: { name: 'English Horn', family: 'Reed' },
      70: { name: 'Bassoon', family: 'Reed' },
      71: { name: 'Clarinet', family: 'Reed' },
      
      // Pipe Family (72-79)
      72: { name: 'Piccolo', family: 'Pipe' },
      73: { name: 'Flute', family: 'Pipe' },
      74: { name: 'Recorder', family: 'Pipe' },
      75: { name: 'Pan Flute', family: 'Pipe' },
      76: { name: 'Blown Bottle', family: 'Pipe' },
      77: { name: 'Shakuhachi', family: 'Pipe' },
      78: { name: 'Whistle', family: 'Pipe' },
      79: { name: 'Ocarina', family: 'Pipe' },
      
      // Synth Lead Family (80-87)
      80: { name: 'Lead 1 (square)', family: 'Synth Lead' },
      81: { name: 'Lead 2 (sawtooth)', family: 'Synth Lead' },
      82: { name: 'Lead 3 (calliope)', family: 'Synth Lead' },
      83: { name: 'Lead 4 (chiff)', family: 'Synth Lead' },
      84: { name: 'Lead 5 (charang)', family: 'Synth Lead' },
      85: { name: 'Lead 6 (voice)', family: 'Synth Lead' },
      86: { name: 'Lead 7 (fifths)', family: 'Synth Lead' },
      87: { name: 'Lead 8 (bass + lead)', family: 'Synth Lead' },
      
      // Synth Pad Family (88-95)
      88: { name: 'Pad 1 (new age)', family: 'Synth Pad' },
      89: { name: 'Pad 2 (warm)', family: 'Synth Pad' },
      90: { name: 'Pad 3 (polysynth)', family: 'Synth Pad' },
      91: { name: 'Pad 4 (choir)', family: 'Synth Pad' },
      92: { name: 'Pad 5 (bowed)', family: 'Synth Pad' },
      93: { name: 'Pad 6 (metallic)', family: 'Synth Pad' },
      94: { name: 'Pad 7 (halo)', family: 'Synth Pad' },
      95: { name: 'Pad 8 (sweep)', family: 'Synth Pad' },
      
      // Synth Effects Family (96-103)
      96: { name: 'FX 1 (rain)', family: 'Synth Effects' },
      97: { name: 'FX 2 (soundtrack)', family: 'Synth Effects' },
      98: { name: 'FX 3 (crystal)', family: 'Synth Effects' },
      99: { name: 'FX 4 (atmosphere)', family: 'Synth Effects' },
      100: { name: 'FX 5 (brightness)', family: 'Synth Effects' },
      101: { name: 'FX 6 (goblins)', family: 'Synth Effects' },
      102: { name: 'FX 7 (echoes)', family: 'Synth Effects' },
      103: { name: 'FX 8 (sci-fi)', family: 'Synth Effects' },
      
      // Ethnic Family (104-111)
      104: { name: 'Sitar', family: 'Ethnic' },
      105: { name: 'Banjo', family: 'Ethnic' },
      106: { name: 'Shamisen', family: 'Ethnic' },
      107: { name: 'Koto', family: 'Ethnic' },
      108: { name: 'Kalimba', family: 'Ethnic' },
      109: { name: 'Bagpipe', family: 'Ethnic' },
      110: { name: 'Fiddle', family: 'Ethnic' },
      111: { name: 'Shanai', family: 'Ethnic' },
      
      // Percussive Family (112-119)
      112: { name: 'Tinkle Bell', family: 'Percussive' },
      113: { name: 'Agogo', family: 'Percussive' },
      114: { name: 'Steel Drums', family: 'Percussive' },
      115: { name: 'Woodblock', family: 'Percussive' },
      116: { name: 'Taiko Drum', family: 'Percussive' },
      117: { name: 'Melodic Tom', family: 'Percussive' },
      118: { name: 'Synth Drum', family: 'Percussive' },
      119: { name: 'Reverse Cymbal', family: 'Percussive' },
      
      // Sound Effects Family (120-127)
      120: { name: 'Guitar Fret Noise', family: 'Sound Effects' },
      121: { name: 'Breath Noise', family: 'Sound Effects' },
      122: { name: 'Seashore', family: 'Sound Effects' },
      123: { name: 'Bird Tweet', family: 'Sound Effects' },
      124: { name: 'Telephone Ring', family: 'Sound Effects' },
      125: { name: 'Helicopter', family: 'Sound Effects' },
      126: { name: 'Applause', family: 'Sound Effects' },
      127: { name: 'Gunshot', family: 'Sound Effects' }
    };
  }
  
  /**
   * Get information about General MIDI drum kits (Channel 10)
   * @returns {Record<number, MidiDrum>} - Object containing GM drum kit information
   */
  getGeneralMidiDrumKits(): Record<number, MidiDrum> {
    return {
      // Standard drum kit notes (35-81)
      35: { name: 'Acoustic Bass Drum' },
      36: { name: 'Bass Drum 1' },
      37: { name: 'Side Stick' },
      38: { name: 'Acoustic Snare' },
      39: { name: 'Hand Clap' },
      40: { name: 'Electric Snare' },
      41: { name: 'Low Floor Tom' },
      42: { name: 'Closed Hi Hat' },
      43: { name: 'High Floor Tom' },
      44: { name: 'Pedal Hi-Hat' },
      45: { name: 'Low Tom' },
      46: { name: 'Open Hi-Hat' },
      47: { name: 'Low-Mid Tom' },
      48: { name: 'Hi-Mid Tom' },
      49: { name: 'Crash Cymbal 1' },
      50: { name: 'High Tom' },
      51: { name: 'Ride Cymbal 1' },
      52: { name: 'Chinese Cymbal' },
      53: { name: 'Ride Bell' },
      54: { name: 'Tambourine' },
      55: { name: 'Splash Cymbal' },
      56: { name: 'Cowbell' },
      57: { name: 'Crash Cymbal 2' },
      58: { name: 'Vibraslap' },
      59: { name: 'Ride Cymbal 2' },
      60: { name: 'Hi Bongo' },
      61: { name: 'Low Bongo' },
      62: { name: 'Mute Hi Conga' },
      63: { name: 'Open Hi Conga' },
      64: { name: 'Low Conga' },
      65: { name: 'High Timbale' },
      66: { name: 'Low Timbale' },
      67: { name: 'High Agogo' },
      68: { name: 'Low Agogo' },
      69: { name: 'Cabasa' },
      70: { name: 'Maracas' },
      71: { name: 'Short Whistle' },
      72: { name: 'Long Whistle' },
      73: { name: 'Short Guiro' },
      74: { name: 'Long Guiro' },
      75: { name: 'Claves' },
      76: { name: 'Hi Wood Block' },
      77: { name: 'Low Wood Block' },
      78: { name: 'Mute Cuica' },
      79: { name: 'Open Cuica' },
      80: { name: 'Mute Triangle' },
      81: { name: 'Open Triangle' }
    };
  }
  
  /**
   * Stop any currently playing notes
   */
  stopPlayback(): void {
    if (!this.virtualOutput) return;
    
    // Send all notes off on all channels
    for (let channel = 0; channel < 16; channel++) {
      this.virtualOutput.send('cc', {
        controller: 123, // All notes off
        value: 0,
        channel: channel
      });
    }
    
    this.isPlaying = false;
  }
  
  /**
   * Clean up resources
   */
  cleanup(): void {
    this.stopPlayback();
    
    if (this.virtualOutput) {
      this.virtualOutput.close();
      this.virtualOutput = null;
    }
  }
}

export default MidiManager;