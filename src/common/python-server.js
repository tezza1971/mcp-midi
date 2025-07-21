const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Start the Python Magenta server
 * @param {boolean} isDev - Whether the app is running in development mode
 * @returns {Object} - The Python process and server URL
 */
function startPythonServer(isDev = false) {
  // Determine the path to the Python executable and script
  let pythonPath;
  let scriptPath;
  
  if (isDev) {
    // In development, use the local Python environment
    pythonPath = path.join(__dirname, '..', 'python', 'venv', 'Scripts', 'python.exe');
    scriptPath = path.join(__dirname, '..', 'python', 'magenta_wrapper.py');
  } else {
    // In production, use the bundled Python files
    pythonPath = path.join(process.resourcesPath, 'python', 'venv', 'Scripts', 'python.exe');
    scriptPath = path.join(process.resourcesPath, 'python', 'magenta_wrapper.py');
  }
  
  // Check if the Python script exists
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Python script not found at: ${scriptPath}`);
  }
  
  // Start the Python server
  const pythonProcess = spawn(pythonPath, [scriptPath, 'server', '--port', '5000']);
  
  // Log Python output
  pythonProcess.stdout.on('data', (data) => {
    console.log(`Python server: ${data}`);
  });
  
  pythonProcess.stderr.on('data', (data) => {
    console.error(`Python server error: ${data}`);
  });
  
  pythonProcess.on('close', (code) => {
    console.log(`Python server exited with code ${code}`);
  });
  
  return {
    process: pythonProcess,
    url: 'http://localhost:5000'
  };
}

module.exports = { startPythonServer };