#!/usr/bin/env node
import {stat, realpath} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';
import {portOccupied, assertListenerOwned} from './processes.mjs';

const help = `shader-visual-kit preview --project <directory> --url <http://127.0.0.1:port/path> [--timeout <milliseconds, default 120000>] [--json] -- <command> <args...>

Runs an existing project command without changing dependencies or opening a browser.
The process remains in the foreground. Ctrl+C stops its process tree, and so does
the exit of any process that launched it, including wrappers such as npx.
"address-responsive" confirms HTTP and listener ownership, not visual correctness.
Windows is the currently validated platform. Existing servers should be opened directly.
`;

export async function main(argv = process.argv.slice(2)) {
  if(argv.length === 0 || argv.slice(0, argv.includes('--') ? argv.indexOf('--') : argv.length).includes('--help')) {process.stdout.write(help);return 0;}
  let child;
  let job;
  let caller;
  let watch;
  let stopping = false;
  let signalCode = 0;
  let emit = event => process.stderr.write(JSON.stringify(event)+'\n');
  const abort = new AbortController();
  const cancel = signal => {signalCode={SIGINT:130,SIGTERM:143,SIGHUP:129}[signal];stopping=true;abort.abort();};
  const interrupt=()=>cancel('SIGINT');
  const terminate=()=>cancel('SIGTERM');
  try {
    const split = argv.indexOf('--');
    if(argv[0]!=='preview' || split<0 || !argv[split+1])throw new Error('Expected preview options followed by -- and a project command');
    const {values} = parseArgs({args:argv.slice(1,split),options:{project:{type:'string'},url:{type:'string'},timeout:{type:'string',default:'120000'},json:{type:'boolean'}}});
    emit = event => process.stdout.write(values.json ? JSON.stringify(event)+'\n' : `[${event.type}] ${event.message || event.url || ''}\n`);
    if(!values.project || !values.url)throw new Error('--project and --url are required');
    const project = await realpath(values.project);
    if(!(await stat(project)).isDirectory())throw new Error('--project must be a directory');
    const url = new URL(values.url);
    if(url.protocol!=='http:' || !['127.0.0.1','localhost'].includes(url.hostname) || url.username || url.password)throw new Error('Use an HTTP loopback URL without credentials');
    const timeout = Number(values.timeout);
    if(!Number.isFinite(timeout) || timeout<=0)throw new Error('--timeout must be a positive number');
    if(process.platform!=='win32')throw new Error('This preview command currently supports Windows; use the host project command directly on other systems');
    if(await portOccupied(url))throw new Error('Port is already occupied. Reuse the known server directly or select a free port');
    process.on('SIGINT',interrupt);process.on('SIGTERM',terminate);
    const {createJob} = await import('./windows-job.mjs');
    const {watchAncestors} = await import('./windows-ancestors.mjs');
    caller = watchAncestors();
    watch = setInterval(()=>{if(!stopping && caller.exited())cancel('SIGHUP');},200);
    job = createJob();
    child=fork(fileURLToPath(new URL('./runner.mjs',import.meta.url)),[],{cwd:project,stdio:['ignore','pipe','pipe','ipc'],windowsHide:true});
    child.stdout.pipe(process.stderr);child.stderr.pipe(process.stderr);
    let spawnError;
    child.once('error',error=>{spawnError=error;});
    job.assign(child.pid);
    child.send({command:argv[split+1],args:argv.slice(split+2),project});
    emit({type:'starting',project,url:url.href,pid:child.pid,command:argv.slice(split+1)});
    const deadline=Date.now()+timeout;
    // A cold first compile (e.g. Next.js webpack) can outlast the wait; say how to recover.
    const notReady=()=>new Error(`Preview did not respond successfully within ${timeout}ms. If the log shows the server still compiling or starting, retry with a larger --timeout`);
    let ready=false;
    while(!stopping && Date.now()<deadline) {
      if(spawnError)throw spawnError;
      if(child.exitCode!==null || child.signalCode!==null)throw new Error(`Project command exited before ready (${child.exitCode ?? child.signalCode})`);
      try {
        const response=await fetch(url,{redirect:'manual',signal:AbortSignal.any([abort.signal,AbortSignal.timeout(1000)])});
        await response.body?.cancel();
        if(response.status>=300 && response.status<400)throw new Error(`Preview redirects (HTTP ${response.status}); use its explicit final URL`);
        if(response.status>=200 && response.status<300) {
          await assertListenerOwned(url.port || 80,job,deadline-Date.now());
          if(stopping)break;
          if(Date.now()>=deadline)throw notReady();
          if(child.exitCode!==null)throw new Error('Project command exited during readiness verification');
          ready=true;emit({type:'address-responsive',url:url.href,pid:child.pid,status:response.status});break;
        }
      } catch(error) {
        if(!['TypeError','TimeoutError','AbortError'].includes(error.name))throw error;
      }
      await sleep(100);
    }
    if(!ready && !stopping)throw notReady();
    while(!stopping && child.exitCode===null && child.signalCode===null && !spawnError)await sleep(100);
    if(spawnError)throw spawnError;
    return signalCode || child.exitCode || (child.signalCode?1:0);
  } catch(error) {emit({type:'error',message:error.message});return signalCode || 1;}
  finally {
    abort.abort();
    clearInterval(watch);
    caller?.close();
    let cleaned=true;
    try {job?.close();}catch(error){emit({type:'cleanup-error',message:error.message});cleaned=false;}
    if(child?.connected)child.disconnect();
    process.off('SIGINT',interrupt);process.off('SIGTERM',terminate);
    if(child && cleaned)emit({type:'stopped',pid:child.pid});
    if(!cleaned)return 1;
  }
}
process.exitCode=await main();
