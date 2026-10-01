import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createConnection} from 'node:net';
const run = promisify(execFile);

export async function portOccupied(url) {
  return new Promise(resolve => {
    const socket = createConnection({host:url.hostname, port:Number(url.port || 80)});
    const finish = value => {socket.destroy(); resolve(value);};
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(800, () => finish(false));
  });
}

export async function assertListenerOwned(port, job, timeout = 10000) {
  if (process.platform !== 'win32') throw new Error('Listener ownership verification is currently implemented for Windows only');
  const script = `$ErrorActionPreference='Stop'; $portOwners=@(Get-NetTCPConnection -State Listen -LocalPort ${Number(port)} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique); @{owners=$portOwners}|ConvertTo-Json -Compress`;
  const {stdout} = await run('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:Math.max(1, Math.min(10000, timeout)),maxBuffer:1024*1024});
  const data = JSON.parse(stdout);
  if (!data.owners.length || data.owners.some(pid => !job.owns(pid))) throw new Error('The listening port does not belong exclusively to the process started by this command');
}
