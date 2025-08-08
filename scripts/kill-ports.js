#!/usr/bin/env node
const { execSync } = require('child_process');
const readline = require('readline');

const argv = process.argv.slice(2);
const portsArg = argv.filter(a => !a.startsWith('--'));
const force = argv.includes('--force') || process.env.KILL_PORTS_FORCE === '1' || argv.includes('--yes');

const ports = portsArg.map(p => parseInt(p, 10)).filter(Boolean);
if (ports.length === 0) {
  ports.push(5173, 8002, 5000);
}

const isWin = process.platform === 'win32';

function killPid(pid) {
  try {
    if (isWin) {
      execSync(`taskkill /PID ${pid} /F`);
    } else {
      process.kill(pid, 'SIGKILL');
    }
    console.log(`Killed PID ${pid}`);
  } catch (e) {
    console.warn(`Failed to kill PID ${pid}: ${e.message}`);
  }
}

function askYesNo(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(/^y(es)?$/i.test(answer));
    });
  });
}

(async () => {
  for (const port of ports) {
    try {
      if (isWin) {
        // Run netstat once and parse output in Node to avoid shell-pipe issues
        const out = execSync('netstat -ano', { encoding: 'utf8' });
        const lines = out.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        const pids = new Set();
        const portPattern = `:${port}`;
        for (const line of lines) {
          if (line.indexOf(portPattern) !== -1) {
            const parts = line.split(/\s+/);
            const pid = parts[parts.length - 1];
            if (/^\d+$/.test(pid)) pids.add(pid);
          }
        }
        if (pids.size === 0) {
          console.log(`Port ${port} appears free (no processes found).`);
        } else {
          console.log(`Port ${port} in use by PID(s): ${[...pids].join(', ')}.`);
          if (force) {
            console.log('--force provided: killing without prompt');
            pids.forEach(pid => killPid(pid));
          } else {
            const ok = await askYesNo(`Kill these PID(s) using port ${port}? (y/N): `);
            if (ok) {
              pids.forEach(pid => killPid(pid));
            } else {
              console.log(`Skipping killing PIDs for port ${port}`);
            }
          }
        }
      } else {
        // lsof -i :port -t returns PIDs
        const out = execSync(`lsof -i :${port} -t || true`, { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
        const pids = out.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        if (pids.length === 0) {
          console.log(`Port ${port} appears free (no processes found).`);
        } else {
          console.log(`Port ${port} in use by PID(s): ${pids.join(', ')}.`);
          if (force) {
            console.log('--force provided: killing without prompt');
            pids.forEach(pid => killPid(pid));
          } else {
            const ok = await askYesNo(`Kill these PID(s) using port ${port}? (y/N): `);
            if (ok) {
              pids.forEach(pid => killPid(pid));
            } else {
              console.log(`Skipping killing PIDs for port ${port}`);
            }
          }
        }
      }
    } catch (err) {
      console.warn(`Could not check/kill processes for port ${port}: ${err.message}`);
    }
  }

  console.log('Done attempting to free ports.');
})();
