/**
 * MCP MIDI Bridge Client Example
 * 
 * This script demonstrates how to use the MCP MIDI Bridge client
 * to send different types of musical sequences to the MCP server.
 */

const McpMidiClient = require('./mcp-client');

/**
 * Create a chord progression with multiple instruments
 * @returns {Object} - A NoteSequence with a chord progression
 */
function createChordProgression() {
  // C - Am - F - G progression
  const chords = [
    { root: 60, chord: 'major', startTime: 0.0, endTime: 1.0 },   // C
    { root: 57, chord: 'minor', startTime: 1.0, endTime: 2.0 },   // Am
    { root: 65, chord: 'major', startTime: 2.0, endTime: 3.0 },   // F
    { root: 67, chord: 'major', startTime: 3.0, endTime: 4.0 }    // G
  ];
  
  const notes = [];
  
  // Add piano chords (Channel 1)
  chords.forEach(chord => {
    // Add root note
    notes.push({
      pitch: chord.root,
      startTime: chord.startTime,
      endTime: chord.endTime,
      velocity: 80,
      instrument: 0,
      program: 0 // Acoustic Grand Piano
    });
    
    // Add third (major or minor)
    notes.push({
      pitch: chord.root + (chord.chord === 'major' ? 4 : 3),
      startTime: chord.startTime,
      endTime: chord.endTime,
      velocity: 80,
      instrument: 0,
      program: 0
    });
    
    // Add fifth
    notes.push({
      pitch: chord.root + 7,
      startTime: chord.startTime,
      endTime: chord.endTime,
      velocity: 80,
      instrument: 0,
      program: 0
    });
  });
  
  // Add bass line (Channel 2)
  chords.forEach(chord => {
    notes.push({
      pitch: chord.root - 24, // Two octaves down
      startTime: chord.startTime,
      endTime: chord.endTime,
      velocity: 100,
      instrument: 1,
      program: 33 // Electric Bass (finger)
    });
  });
  
  // Add drum pattern (Channel 10)
  for (let i = 0; i < 4; i++) {
    // Bass drum on beats 1 and 3
    notes.push({
      pitch: 36, // Bass Drum
      startTime: i * 1.0,
      endTime: i * 1.0 + 0.1,
      velocity: 100,
      instrument: 9, // Channel 10 (zero-indexed as 9)
      program: 0,
      isDrum: true
    });
    
    // Snare on beats 2 and 4
    notes.push({
      pitch: 38, // Snare
      startTime: i * 1.0 + 0.5,
      endTime: i * 1.0 + 0.6,
      velocity: 90,
      instrument: 9,
      program: 0,
      isDrum: true
    });
    
    // Hi-hat on every eighth note
    for (let j = 0; j < 2; j++) {
      notes.push({
        pitch: 42, // Closed Hi-hat
        startTime: i * 1.0 + j * 0.5,
        endTime: i * 1.0 + j * 0.5 + 0.1,
        velocity: 80,
        instrument: 9,
        program: 0,
        isDrum: true
      });
    }
  }
  
  // Add a string pad (Channel 3)
  notes.push({
    pitch: 60, // C4
    startTime: 0.0,
    endTime: 4.0,
    velocity: 60,
    instrument: 2,
    program: 48 // String Ensemble 1
  });
  notes.push({
    pitch: 64, // E4
    startTime: 0.0,
    endTime: 4.0,
    velocity: 60,
    instrument: 2,
    program: 48
  });
  
  return {
    notes: notes,
    tempos: [{ time: 0, qpm: 120 }],
    timeSignatures: [{ time: 0, numerator: 4, denominator: 4 }],
    totalTime: 4.0
  };
}

/**
 * Create a melody with accompaniment
 * @returns {Object} - A NoteSequence with melody and accompaniment
 */
function createMelodyWithAccompaniment() {
  const notes = [];
  
  // Melody (Channel 4 - Flute)
  const melodyNotes = [72, 74, 76, 77, 79, 81, 83, 84, 83, 81, 79, 77, 76, 74, 72];
  const melodyRhythm = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1.0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1.0];
  
  let currentTime = 0;
  melodyNotes.forEach((pitch, index) => {
    notes.push({
      pitch: pitch,
      startTime: currentTime,
      endTime: currentTime + melodyRhythm[index],
      velocity: 90,
      instrument: 3,
      program: 73 // Flute
    });
    currentTime += melodyRhythm[index];
  });
  
  // Accompaniment - Arpeggiated chords (Channel 5 - Harp)
  const chordRoots = [60, 57, 65, 67]; // C, Am, F, G
  const chordTypes = ['major', 'minor', 'major', 'major'];
  const arpeggioPatterns = [
    [0, 4, 7, 12], // Major chord
    [0, 3, 7, 12]  // Minor chord
  ];
  
  for (let i = 0; i < 4; i++) {
    const chordRoot = chordRoots[i];
    const pattern = chordTypes[i] === 'major' ? arpeggioPatterns[0] : arpeggioPatterns[1];
    
    for (let j = 0; j < 4; j++) {
      for (let k = 0; k < pattern.length; k++) {
        notes.push({
          pitch: chordRoot + pattern[k],
          startTime: i * 2.0 + j * 0.5 + k * 0.125,
          endTime: i * 2.0 + j * 0.5 + (k + 1) * 0.125,
          velocity: 70,
          instrument: 4,
          program: 46 // Orchestral Harp
        });
      }
    }
  }
  
  // Bass (Channel 2)
  for (let i = 0; i < 4; i++) {
    notes.push({
      pitch: chordRoots[i] - 24, // Two octaves down
      startTime: i * 2.0,
      endTime: i * 2.0 + 1.0,
      velocity: 100,
      instrument: 1,
      program: 33 // Electric Bass
    });
    notes.push({
      pitch: chordRoots[i] - 24 + 7, // Fifth
      startTime: i * 2.0 + 1.0,
      endTime: i * 2.0 + 2.0,
      velocity: 100,
      instrument: 1,
      program: 33
    });
  }
  
  // Drums (Channel 10)
  for (let i = 0; i < 8; i++) {
    // Bass drum on beats 1 and 3
    if (i % 2 === 0) {
      notes.push({
        pitch: 36, // Bass Drum
        startTime: i * 1.0,
        endTime: i * 1.0 + 0.1,
        velocity: 100,
        instrument: 9,
        program: 0,
        isDrum: true
      });
    }
    
    // Snare on beats 2 and 4
    if (i % 2 === 1) {
      notes.push({
        pitch: 38, // Snare
        startTime: i * 1.0,
        endTime: i * 1.0 + 0.1,
        velocity: 90,
        instrument: 9,
        program: 0,
        isDrum: true
      });
    }
    
    // Hi-hat on every quarter note
    notes.push({
      pitch: 42, // Closed Hi-hat
      startTime: i * 1.0,
      endTime: i * 1.0 + 0.1,
      velocity: 80,
      instrument: 9,
      program: 0,
      isDrum: true
    });
    
    // Hi-hat on every eighth note
    notes.push({
      pitch: 42, // Closed Hi-hat
      startTime: i * 1.0 + 0.5,
      endTime: i * 1.0 + 0.6,
      velocity: 60,
      instrument: 9,
      program: 0,
      isDrum: true
    });
  }
  
  return {
    notes: notes,
    tempos: [{ time: 0, qpm: 120 }],
    timeSignatures: [{ time: 0, numerator: 4, denominator: 4 }],
    totalTime: 8.0
  };
}

/**
 * Main function to demonstrate the MCP client
 */
async function main() {
  try {
    // Create a client
    const client = new McpMidiClient({ port: 3000 });
    
    // Get current song
    console.log('Fetching current song...');
    const currentSong = await client.getCurrentSong();
    if (currentSong) {
      console.log(`Current song has ${currentSong.notes.length} notes and duration of ${currentSong.totalTime} seconds`);
    } else {
      console.log('No current song found');
    }
    
    // Get available instruments
    console.log('\nFetching instrument information...');
    const instruments = await client.getInstruments();
    console.log(`Retrieved information for ${Object.keys(instruments).length} instruments`);
    
    // Ask user which example to run
    console.log('\nChoose an example to send to the MCP server:');
    console.log('1. Simple C major scale');
    console.log('2. Multi-channel sequence with piano, bass, drums, and strings');
    console.log('3. Chord progression with multiple instruments');
    console.log('4. Melody with arpeggiated accompaniment');
    
    // For this example, we'll just choose option 3
    const choice = 3;
    console.log(`\nSelected option ${choice}`);
    
    let sequence;
    switch (choice) {
      case 1:
        sequence = client.createCMajorScale();
        break;
      case 2:
        sequence = client.createMultiChannelSequence();
        break;
      case 3:
        sequence = createChordProgression();
        break;
      case 4:
        sequence = createMelodyWithAccompaniment();
        break;
      default:
        sequence = client.createCMajorScale();
    }
    
    console.log(`Sending sequence with ${sequence.notes.length} notes...`);
    const response = await client.sendNoteSequence(sequence);
    console.log('Response:', response);
    
    console.log('\nDone! The sequence should now be available in the MCP MIDI Bridge app.');
    console.log('Press the "Play to DAW" button in the app to hear it.');
    
    // Print information about the channels used
    const channelsUsed = new Set(sequence.notes.map(note => note.instrument || 0));
    console.log('\nChannels used in this sequence:');
    for (const channel of channelsUsed) {
      // Find the first note for this channel to determine the program
      const firstNote = sequence.notes.find(note => (note.instrument || 0) === channel);
      const program = firstNote ? firstNote.program || 0 : 0;
      
      if (channel === 9) {
        console.log(`- Channel 10: Drums`);
      } else if (instruments[program]) {
        console.log(`- Channel ${channel + 1}: ${instruments[program].name} (program ${program})`);
      } else {
        console.log(`- Channel ${channel + 1}: Unknown instrument (program ${program})`);
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
    console.log('\nMake sure the MCP MIDI Bridge app is running on port 3000.');
  }
}

// Run the example
main();