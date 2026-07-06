import { execSync } from 'child_process';

const port = process.argv[2] || '3001';

function freePortWindows(targetPort) {
  try {
    const output = execSync(`netstat -ano | findstr :${targetPort}`, { encoding: 'utf8' });
    const pids = new Set();

    for (const line of output.split('\n')) {
      if (!line.includes('LISTENING')) continue;
      const pid = line.trim().split(/\s+/).pop();
      if (pid && pid !== '0') pids.add(pid);
    }

    for (const pid of pids) {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
      console.log(`Freed port ${targetPort} (stopped PID ${pid})`);
    }
  } catch {
    // Port is already free
  }
}

function freePortUnix(targetPort) {
  try {
    execSync(`lsof -ti:${targetPort} | xargs kill -9 2>/dev/null || true`, { shell: true, stdio: 'ignore' });
  } catch {
    // Port is already free
  }
}

if (process.platform === 'win32') {
  freePortWindows(port);
} else {
  freePortUnix(port);
}
