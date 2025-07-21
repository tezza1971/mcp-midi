const fs = require('fs');
const path = require('path');
const http = require('http');

// Load the test NoteSequence
const testFilePath = path.join(__dirname, '..', 'song_cache', 'test_c_major_scale.json');
const noteSequence = JSON.parse(fs.readFileSync(testFilePath, 'utf8'));

// Send the NoteSequence to the MCP API
const data = JSON.stringify(noteSequence);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/song',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  let responseData = '';
  
  res.on('data', (chunk) => {
    responseData += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', responseData);
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(data);
req.end();

console.log('Sent test NoteSequence to MCP API');
console.log('Press Ctrl+C to exit');