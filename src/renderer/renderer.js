// DOM Elements
const apiStatus = document.getElementById('api-status');
const midiStatus = document.getElementById('midi-status');
const midiOutputName = document.getElementById('midi-output-name');
const songInfo = document.getElementById('song-info');
const noteSequenceDisplay = document.getElementById('note-sequence-display');
const playButton = document.getElementById('play-button');
const exportButton = document.getElementById('export-button');
const playbackProgress = document.getElementById('playback-progress');
const playbackProgressFill = document.getElementById('playback-progress-fill');
const dropZone = document.getElementById('drop-zone');
const browseButton = document.getElementById('browse-button');
const fileInput = document.getElementById('file-input');

// State
let currentSong = null;

// Initialize the application
async function init() {
  // Check MIDI outputs
  try {
    const outputs = await window.api.getMidiOutputs();
    if (outputs.includes('MCP MIDI Bridge')) {
      midiStatus.classList.add('status-active');
      midiStatus.classList.remove('status-inactive');
    } else {
      midiStatus.classList.add('status-inactive');
      midiStatus.classList.remove('status-active');
      midiOutputName.textContent = 'Not available';
    }
  } catch (error) {
    console.error('Failed to get MIDI outputs:', error);
    midiStatus.classList.add('status-inactive');
    midiStatus.classList.remove('status-active');
    midiOutputName.textContent = 'Error';
  }
  
  // Try to load the current song
  try {
    currentSong = await window.api.getCurrentSong();
    if (currentSong) {
      updateSongDisplay(currentSong);
    }
  } catch (error) {
    console.error('Failed to load current song:', error);
  }
  
  // Set up event listeners
  setupEventListeners();
}

// Update the song display with the current song data
function updateSongDisplay(song) {
  if (!song) {
    songInfo.innerHTML = '<p>No song loaded</p>';
    noteSequenceDisplay.textContent = '';
    playButton.disabled = true;
    exportButton.disabled = true;
    return;
  }
  
  // Enable buttons
  playButton.disabled = false;
  exportButton.disabled = false;
  
  // Update song info
  const noteCount = song.notes ? song.notes.length : 0;
  const totalTime = song.totalTime || 0;
  
  songInfo.innerHTML = `
    <p><strong>Notes:</strong> ${noteCount}</p>
    <p><strong>Duration:</strong> ${totalTime.toFixed(2)} seconds</p>
    <p><strong>Last Updated:</strong> ${new Date().toLocaleString()}</p>
  `;
  
  // Display the note sequence in a readable format
  if (song.notes && song.notes.length > 0) {
    const notesText = song.notes.slice(0, 20).map(note => {
      return `Note: ${note.pitch} (${midiNoteToName(note.pitch)}), Start: ${note.startTime}s, End: ${note.endTime}s, Velocity: ${note.velocity || 80}`;
    }).join('\n');
    
    noteSequenceDisplay.textContent = notesText;
    if (song.notes.length > 20) {
      noteSequenceDisplay.textContent += '\n\n... and ' + (song.notes.length - 20) + ' more notes';
    }
  } else {
    noteSequenceDisplay.textContent = 'No notes in sequence';
  }
}

// Convert MIDI note number to note name
function midiNoteToName(midiNote) {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midiNote / 12) - 1;
  const noteName = noteNames[midiNote % 12];
  return `${noteName}${octave}`;
}

// Set up event listeners
function setupEventListeners() {
  // Play button
  playButton.addEventListener('click', async () => {
    if (!currentSong) return;
    
    playButton.disabled = true;
    playButton.textContent = 'Playing...';
    
    try {
      const result = await window.api.playMidi(currentSong);
      if (!result.success) {
        console.error('Failed to play MIDI:', result.error);
      }
    } catch (error) {
      console.error('Error playing MIDI:', error);
    } finally {
      playButton.disabled = false;
      playButton.textContent = 'Play to DAW';
    }
  });
  
  // Export button
  exportButton.addEventListener('click', async () => {
    if (!currentSong) return;
    
    // This would typically open a save dialog
    // For now, we'll just log that it would export
    console.log('Would export MIDI file for:', currentSong);
    alert('Export functionality will be implemented in a future version.');
  });
  
  // File drag and drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('active');
  });
  
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('active');
  });
  
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('active');
    
    if (e.dataTransfer.files.length) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.mid') || file.name.endsWith('.midi')) {
        handleMidiFile(file.path);
      } else {
        alert('Please drop a MIDI file (.mid or .midi)');
      }
    }
  });
  
  // Browse button
  browseButton.addEventListener('click', () => {
    fileInput.click();
  });
  
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
      const file = e.target.files[0];
      handleMidiFile(file.path);
    }
  });
  
  // Listen for song updates from the main process
  window.api.onSongUpdated((data) => {
    console.log('Song updated:', data);
    // Reload the current song
    window.api.getCurrentSong().then(song => {
      currentSong = song;
      updateSongDisplay(song);
    });
  });
  
  // Listen for playback progress updates
  window.api.onPlaybackProgress((data) => {
    const { current, total } = data;
    const percentage = (current / total) * 100;
    playbackProgressFill.style.width = `${percentage}%`;
  });
}

// Handle importing a MIDI file
async function handleMidiFile(filePath) {
  try {
    const result = await window.api.importMidiFile(filePath);
    if (result.success) {
      currentSong = result.noteSequence;
      updateSongDisplay(currentSong);
    } else {
      alert(`Failed to import MIDI file: ${result.error}`);
    }
  } catch (error) {
    console.error('Error importing MIDI file:', error);
    alert('An error occurred while importing the MIDI file.');
  }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);