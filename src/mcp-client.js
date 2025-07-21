/**
 * MCP MIDI Bridge Client
 * 
 * This script provides a simple client to interact with the MCP MIDI Bridge server
 * running on port 3000. It allows sending NoteSequence JSON to the server and
 * retrieving the current song.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

class McpMidiClient {
  /**
   * Create a new MCP MIDI Bridge client
   * @param {Object} options - Client options
   * @param {string} options.host - Host address (default: 'localhost')
   * @param {number} options.port - Port number (default: 3000)
   */
  constructor(options = {}) {
    this.host = options.host || 'localhost';
    this.port = options.port || 3000;
    console.log(`MCP MIDI Bridge client initialized for ${this.host}:${this.port}`);
  }

  /**
   * Send a NoteSequence to the MCP server
   * @param {Object} noteSequence - The NoteSequence JSON object
   * @returns {Promise<Object>} - Response from the server
   */
  async sendNoteSequence(noteSequence) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(noteSequence);
      
      const options = {
        hostname: this.host,
        port: this.port,
        path: '/api/song',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      };
      
      const req = http.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsedData = JSON.parse(responseData);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsedData);
            } else {
              reject(new Error(`Server responded with status ${res.statusCode}: ${parsedData.error || 'Unknown error'}`));
            }
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });
      
      req.write(data);
      req.end();
    });
  }
  
  /**
   * Get the current song from the MCP server
   * @returns {Promise<Object>} - The current NoteSequence
   */
  async getCurrentSong() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.host,
        port: this.port,
        path: '/api/song',
        method: 'GET'
      };
      
      const req = http.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            if (res.statusCode === 404) {
              resolve(null); // No songs found
              return;
            }
            
            const parsedData = JSON.parse(responseData);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsedData);
            } else {
              reject(new Error(`Server responded with status ${res.statusCode}: ${parsedData.error || 'Unknown error'}`));
            }
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });
      
      req.end();
    });
  }
  
  /**
   * Get information about General MIDI instruments
   * @returns {Promise<Object>} - General MIDI instrument information
   */
  async getInstruments() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.host,
        port: this.port,
        path: '/api/instruments',
        method: 'GET'
      };
      
      const req = http.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsedData = JSON.parse(responseData);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsedData);
            } else {
              reject(new Error(`Server responded with status ${res.statusCode}: ${parsedData.error || 'Unknown error'}`));
            }
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });
      
      req.end();
    });
  }
  
  /**
   * Get information about General MIDI drum kits
   * @returns {Promise<Object>} - General MIDI drum kit information
   */
  async getDrums() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.host,
        port: this.port,
        path: '/api/drums',
        method: 'GET'
      };
      
      const req = http.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsedData = JSON.parse(responseData);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsedData);
            } else {
              reject(new Error(`Server responded with status ${res.statusCode}: ${parsedData.error || 'Unknown error'}`));
            }
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        });
      });
      
      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });
      
      req.end();
    });
  }
  
  /**
   * Send a NoteSequence from a file to the MCP server
   * @param {string} filePath - Path to the NoteSequence JSON file
   * @returns {Promise<Object>} - Response from the server
   */
  async sendNoteSequenceFromFile(filePath) {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      const noteSequence = JSON.parse(data);
      return await this.sendNoteSequence(noteSequence);
    } catch (error) {
      throw new Error(`Failed to send NoteSequence from file: ${error.message}`);
    }
  }
  
  /**
   * Create a simple C major scale NoteSequence
   * @returns {Object} - A C major scale NoteSequence
   */
  createCMajorScale() {
    return {
      notes: [
        { pitch: 60, startTime: 0.0, endTime: 0.5, velocity: 80, instrument: 0, program: 0 },
        { pitch: 62, startTime: 0.5, endTime: 1.0, velocity: 80, instrument: 0, program: 0 },
        { pitch: 64, startTime: 1.0, endTime: 1.5, velocity: 80, instrument: 0, program: 0 },
        { pitch: 65, startTime: 1.5, endTime: 2.0, velocity: 80, instrument: 0, program: 0 },
        { pitch: 67, startTime: 2.0, endTime: 2.5, velocity: 80, instrument: 0, program: 0 },
        { pitch: 69, startTime: 2.5, endTime: 3.0, velocity: 80, instrument: 0, program: 0 },
        { pitch: 71, startTime: 3.0, endTime: 3.5, velocity: 80, instrument: 0, program: 0 },
        { pitch: 72, startTime: 3.5, endTime: 4.0, velocity: 80, instrument: 0, program: 0 }
      ],
      tempos: [{ time: 0, qpm: 120 }],
      timeSignatures: [{ time: 0, numerator: 4, denominator: 4 }],
      totalTime: 4.0
    };
  }
  
  /**
   * Create a multi-channel NoteSequence with piano, bass, and drums
   * @returns {Object} - A multi-channel NoteSequence
   */
  createMultiChannelSequence() {
    return {
      notes: [
        // Piano (Channel 1)
        { pitch: 60, startTime: 0.0, endTime: 0.5, velocity: 80, instrument: 0, program: 0 },
        { pitch: 64, startTime: 0.0, endTime: 0.5, velocity: 80, instrument: 0, program: 0 },
        { pitch: 67, startTime: 0.0, endTime: 0.5, velocity: 80, instrument: 0, program: 0 },
        
        { pitch: 62, startTime: 0.5, endTime: 1.0, velocity: 80, instrument: 0, program: 0 },
        { pitch: 65, startTime: 0.5, endTime: 1.0, velocity: 80, instrument: 0, program: 0 },
        { pitch: 69, startTime: 0.5, endTime: 1.0, velocity: 80, instrument: 0, program: 0 },
        
        { pitch: 60, startTime: 1.0, endTime: 2.0, velocity: 80, instrument: 0, program: 0 },
        { pitch: 64, startTime: 1.0, endTime: 2.0, velocity: 80, instrument: 0, program: 0 },
        { pitch: 67, startTime: 1.0, endTime: 2.0, velocity: 80, instrument: 0, program: 0 },
        
        // Bass (Channel 2)
        { pitch: 36, startTime: 0.0, endTime: 1.0, velocity: 100, instrument: 1, program: 33 },
        { pitch: 38, startTime: 1.0, endTime: 2.0, velocity: 100, instrument: 1, program: 33 },
        
        // Drums (Channel 10)
        { pitch: 36, startTime: 0.0, endTime: 0.1, velocity: 100, instrument: 9, program: 0, isDrum: true },
        { pitch: 42, startTime: 0.5, endTime: 0.6, velocity: 80, instrument: 9, program: 0, isDrum: true },
        { pitch: 38, startTime: 1.0, endTime: 1.1, velocity: 100, instrument: 9, program: 0, isDrum: true },
        { pitch: 42, startTime: 1.5, endTime: 1.6, velocity: 80, instrument: 9, program: 0, isDrum: true },
        
        // Strings (Channel 3)
        { pitch: 72, startTime: 0.0, endTime: 2.0, velocity: 60, instrument: 2, program: 48 }
      ],
      tempos: [{ time: 0, qpm: 120 }],
      timeSignatures: [{ time: 0, numerator: 4, denominator: 4 }],
      totalTime: 2.0
    };
  }
}

// Example usage
async function main() {
  try {
    // Create a client
    const client = new McpMidiClient({ port: 3000 });
    
    // Get current song
    console.log('Fetching current song...');
    const currentSong = await client.getCurrentSong();
    if (currentSong) {
      console.log(`Current song has ${currentSong.notes.length} notes`);
    } else {
      console.log('No current song found');
    }
    
    // Send a multi-channel sequence
    console.log('\nSending multi-channel sequence...');
    const multiChannelSequence = client.createMultiChannelSequence();
    const response = await client.sendNoteSequence(multiChannelSequence);
    console.log('Response:', response);
    
    console.log('\nDone! The sequence should now be playing in your DAW.');
    console.log('The sequence contains:');
    console.log('- Piano chords (Channel 1)');
    console.log('- Electric bass (Channel 2)');
    console.log('- String ensemble (Channel 3)');
    console.log('- Drums (Channel 10)');
  } catch (error) {
    console.error('Error:', error.message);
    console.log('\nMake sure the MCP MIDI Bridge app is running on port 3000.');
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = McpMidiClient;