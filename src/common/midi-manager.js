const easymidi = require('easymidi');

/**
 * MIDI Manager for handling virtual MIDI devices
 */
class MidiManager {
  constructor() {
    this.virtualOutput = null;
    this.isPlaying = false;
    this.initialize();
  }
  
  /**
   * Initialize the MIDI manager
   */
  initialize() {
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
  getOutputs() {
    return easymidi.getOutputs();
  }
  
  /**
   * Play a NoteSequence through the virtual MIDI output
   * @param {Object} noteSequence - The NoteSequence to play
   * @param {Function} progressCallback - Callback for playback progress updates
   * @returns {Promise<Object>} - Result of the playback
   */
  async playNoteSequence(noteSequence, progressCallback = null) {
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
      
      // Sort notes by start time
      const sortedNotes = [...noteSequence.notes].sort((a, b) => a.startTime - b.startTime);
      
      // Get the total duration
      const totalDuration = noteSequence.totalTime || 
        Math.max(...sortedNotes.map(note => note.endTime)) || 0;
      
      // Track active notes to ensure we send noteoff events
      const activeNotes = new Map();
      
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
        await new Promise(resolve => {
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
        activeNotes.get(channel).add(pitch);
        
        // Schedule note off
        setTimeout(() => {
          this.virtualOutput.send('noteoff', {
            note: pitch,
            velocity: 0,
            channel: channel
          });
          
          // Remove from active notes
          if (activeNotes.has(channel)) {
            activeNotes.get(channel).delete(pitch);
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
      await new Promise(resolve => {
        const timeToWait = Math.max(0, startTime + totalDuration * 1000 - Date.now()) + 100; // Add a small buffer
        setTimeout(resolve, timeToWait);
      });
      
      // Ensure all notes are turned off
      for (const [channel, notes] of activeNotes.entries()) {
        for (const pitch of notes) {
          this.virtualOutput.send('noteoff', {
            note: pitch,
            velocity: 0,
            channel: channel
          });
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
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Stop any currently playing notes
   */
  stopPlayback() {
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
  cleanup() {
    this.stopPlayback();
    
    if (this.virtualOutput) {
      this.virtualOutput.close();
      this.virtualOutput = null;
    }
  }
}

module.exports = MidiManager;