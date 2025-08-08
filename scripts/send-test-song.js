#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const http = require('http');

const PORT = process.env.MCP_PORT || 8002;
const TOKEN = process.env.MCP_API_TOKEN || null;
const FILE = path.join(__dirname, '..', 'tests', 'fixtures', 'sample-note-sequence.json');

const data = fs.readFileSync(FILE, 'utf8');

const options = {
  hostname: 'localhost',
  port: PORT,
  path: '/song',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

if (TOKEN) {
  options.headers['Authorization'] = `Bearer ${TOKEN}`;
}

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Response:', body);
  });
});

req.on('error', (err) => {
  console.error('Error:', err);
});

req.write(data);
req.end();
