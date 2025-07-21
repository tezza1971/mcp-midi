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
const mcpPortDisplay = document.getElementById('mcp-port');
const settingsModal = document.getElementById('settings-modal');
const settingsForm = document.getElementById('settings-form');
const closeSettingsButton = document.getElementById('close-settings');
const aboutModal = document.getElementById('about-modal');
const closeAboutButton = document.getElementById('close-about');
const channelInfoContainer = document.getElementById('channel-info');

// State
let currentSong = null;
let midiInstruments = {};
let midiDrums = {};
let appConfig = {};

// Initialize the application
async function init() {
  // Load configuration
  try {
    appConfig = await window.api.getConfig();
    updatePortDisplay();
  } catch (error) {
    console.error('Failed to load configuration:', error);
  }
  
  // Load MIDI instrument data
  try {
    midiInstruments = await window.api.getMidiInstruments();
    midiDrums = await window.api.getMidiDrums();
  } catch (error) {
    console.error('Failed to load MIDI instrument data:', error);
  }
  
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

// Update the port display
function updatePortDisplay() {
  if (mcpPortDisplay) {
    mcpPortDisplay.textContent = appConfig.mcpPort || 3000;
  }
}

// Update the song display with the current song data
function updateSongDisplay(song) {
  if (!song) {
    songInfo.innerHTML = '<p>No song loaded</p>';
    noteSequenceDisplay.textContent = '';
    playButton.disabled = true;
    exportButton.disabled = true;
    channelInfoContainer.innerHTML = '';
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
      return `Note: ${note.pitch} (${midiNoteToName(note.pitch)}), Start: ${note.startTime}s, End: ${note.endTime}s, Velocity: ${note.velocity || 80}, Channel: ${note.instrument || 0}`;
    }).join('\n');
    
    noteSequenceDisplay.textContent = notesText;
    if (song.notes.length > 20) {
      noteSequenceDisplay.textContent += '\n\n... and ' + (song.notes.length - 20) + ' more notes';
    }
    
    // Display channel information
    updateChannelInfo(song);
  } else {
    noteSequenceDisplay.textContent = 'No notes in sequence';
    channelInfoContainer.innerHTML = '';
  }
}

// Update channel information display
function updateChannelInfo(song) {
  if (!song || !song.notes || song.notes.length === 0) {
    channelInfoContainer.innerHTML = '';
    return;
  }
  
  // Get unique channels and their programs
  const channels = new Map();
  
  for (const note of song.notes) {
    const channel = note.instrument || 0;
    const program = note.program || 0;
    
    if (!channels.has(channel)) {
      channels.set(channel, {
        program,
        noteCount: 1
      });
    } else {
      channels.get(channel).noteCount++;
    }
  }
  
  // Create channel info display
  let html = '<h3>Channel Information</h3><div class="channel-grid">';
  
  // Sort channels by number
  const sortedChannels = Array.from(channels.keys()).sort((a, b) => a - b);
  
  for (const channel of sortedChannels) {
    const info = channels.get(channel);
    let instrumentName = 'Unknown';
    
    if (channel === 9) { // Channel 10 (0-indexed as 9)
      instrumentName = 'Drum Kit';
    } else if (midiInstruments[info.program]) {
      instrumentName = midiInstruments[info.program].name;
    }
    
    const isDrumChannel = channel === 9;
    const channelClass = isDrumChannel ? 'drum-channel' : '';
    
    html += `
      <div class="channel-item ${channelClass}">
        <div class="channel-number">Ch ${channel + 1}</div>
        <div class="channel-instrument">${instrumentName}</div>
        <div class="channel-program">Program: ${info.program}</div>
        <div class="channel-notes">Notes: ${info.noteCount}</div>
      </div>
    `;
  }
  
  html += '</div>';
  channelInfoContainer.innerHTML = html;
}

// Convert MIDI note number to note name
function midiNoteToName(midiNote) {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midiNote / 12) - 1;
  const noteName = noteNames[midiNote % 12];
  return `${noteName}${octave}`;
}

// Show settings modal
function showSettingsModal() {
  // Populate form with current settings
  document.getElementById('mcp-port-input').value = appConfig.mcpPort || 3000;
  
  // Show the modal
  settingsModal.style.display = 'block';
}

// Hide settings modal
function hideSettingsModal() {
  settingsModal.style.display = 'none';
}

// Show about modal
function showAboutModal() {
  aboutModal.style.display = 'block';
}

// Hide about modal
function hideAboutModal() {
  aboutModal.style.display = 'none';
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
  
  // Settings form
  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const mcpPort = parseInt(document.getElementById('mcp-port-input').value, 10);
    
    if (isNaN(mcpPort) || mcpPort < 1024 || mcpPort > 65535) {
      alert('Please enter a valid port number (1024-65535)');
      return;
    }
    
    try {
      const result = await window.api.updateConfig({ mcpPort });
      if (result.success) {
        appConfig.mcpPort = mcpPort;
        updatePortDisplay();
        hideSettingsModal();
      } else {
        alert(`Failed to update settings: ${result.error}`);
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      alert('An error occurred while updating settings.');
    }
  });
  
  // Close settings button
  closeSettingsButton.addEventListener('click', () => {
    hideSettingsModal();
  });
  
  // Close about button
  closeAboutButton.addEventListener('click', () => {
    hideAboutModal();
  });
  
  // Close modals when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      hideSettingsModal();
    } else if (e.target === aboutModal) {
      hideAboutModal();
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
  
  // Listen for MCP server status updates
  window.api.onMcpServerStatus((data) => {
    if (data.running) {
      apiStatus.classList.add('status-active');
      apiStatus.classList.remove('status-inactive');
      mcpPortDisplay.textContent = data.port;
    } else {
      apiStatus.classList.add('status-inactive');
      apiStatus.classList.remove('status-active');
    }
  });
  
  // Listen for open settings event
  window.api.onOpenSettings(() => {
    showSettingsModal();
  });
  
  // Listen for show about event
  window.api.onShowAbout(() => {
    showAboutModal();
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