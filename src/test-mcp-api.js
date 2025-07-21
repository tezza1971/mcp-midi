const fs = require('fs');
const path = require('path');
const http = require('http');

// Load the test NoteSequence
const testFilePath = path.join(__dirname, '..', 'song_cache', 'test_multi_channel.json');
const noteSequence = JSON.parse(fs.readFileSync(testFilePath, 'utf8'));

// Get the port from command line arguments or use default
const args = process.argv.slice(2);
let port = 3000;

if (args.length > 0 && args[0].startsWith('--port=')) {
  const portArg = args[0].split('=')[1];
  const parsedPort = parseInt(portArg, 10);
  if (!isNaN(parsedPort) && parsedPort > 0) {
    port = parsedPort;
  }
}

// Send the NoteSequence to the MCP API
const data = JSON.stringify(noteSequence);

const options = {
  hostname: 'localhost',
  port: port,
  path: '/api/song',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log(`Sending test NoteSequence to MCP API on port ${port}...`);

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', responseData);
    console.log('\nTest completed successfully!');
    console.log('The multi-channel test sequence includes:');
    console.log('- Channel 1: Piano (program 0)');
    console.log('- Channel 2: Acoustic Bass (program 32)');
    console.log('- Channel 3: String Ensemble (program 48)');
    console.log('- Channel 10: Drums');
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
  console.log(`\nMake sure the MCP MIDI Bridge app is running on port ${port}.`);
});

req.write(data);
req.end();

console.log('Press Ctrl+C to exit');