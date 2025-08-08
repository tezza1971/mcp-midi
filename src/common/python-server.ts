import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import logger from '../lib/logger';

interface PythonServer {
  process: ChildProcess;
  url: string;
}

/**
 * Start the Python Magenta server
 * @param {boolean} isDev - Whether the app is running in development mode
 * @returns {Object} - The Python process and server URL
 */
export function startPythonServer(isDev = false): PythonServer {
  // Determine the path to the Python executable and script
  let pythonPath: string | null = null;
  let scriptPath: string;
  
  if (isDev) {
    // In development, try local venv first then fallback to system python
    const venvPath = path.join(__dirname, '..', 'python', 'venv', 'Scripts', 'python.exe');
    const scriptCandidate = path.join(__dirname, '..', 'python', 'magenta_wrapper.py');
    if (fs.existsSync(scriptCandidate)) {
      scriptPath = scriptCandidate;
    } else {
      throw new Error(`Python script not found at: ${scriptCandidate}`);
    }

    if (fs.existsSync(venvPath)) {
      pythonPath = venvPath;
    } else {
      // Fallback to 'python' on PATH
      pythonPath = 'python';
    }
  } else {
    // In production, use the bundled Python files if present, otherwise fallback to system python
    const bundledScript = path.join(process.resourcesPath || '', 'python', 'magenta_wrapper.py');
    const bundledPython = path.join(process.resourcesPath || '', 'python', 'venv', 'Scripts', 'python.exe');

    if (fs.existsSync(bundledScript)) {
      scriptPath = bundledScript;
    } else {
      throw new Error(`Python script not found at: ${bundledScript}`);
    }

    if (fs.existsSync(bundledPython)) {
      pythonPath = bundledPython;
    } else {
      pythonPath = 'python';
    }
  }
  
  if (!pythonPath) {
    throw new Error('Python executable not found');
  }
  
  logger.info({ pythonPath, scriptPath }, 'Starting Python server');

  // Start the Python server
  const pythonProcess = spawn(pythonPath, [scriptPath, 'server', '--port', String(5000)]);

  // Log Python output
  pythonProcess.stdout?.on('data', (data) => {
    logger.info({ data: data.toString() }, 'Python server stdout');
  });
  
  pythonProcess.stderr?.on('data', (data) => {
    logger.error({ data: data.toString() }, 'Python server stderr');
  });
  
  pythonProcess.on('error', (err) => {
    logger.error({ err }, 'Python process failed to start');
  });
  
  pythonProcess.on('close', (code) => {
    logger.info({ code }, 'Python server exited');
  });
  
  return {
    process: pythonProcess,
    url: 'http://localhost:5000'
  };
}
