import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdtemp, writeFile, readFile} from 'node:fs/promises';
import {setTimeout as sleep} from 'node:timers/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

const cli=resolve('cli/index.mjs');
const project=await mkdtemp(join(tmpdir(),'shader fixture 中文 '));
await writeFile(join(project,'server.mjs'),`import {createServer} from 'node:http';const s=createServer((q,r)=>{r.writeHead(Number(process.argv[3]||200));r.end('fixture')});s.listen(Number(process.argv[2]),'127.0.0.1');setTimeout(()=>s.close(()=>process.exit(0)),Number(process.argv[4]||15000));`);
const free=async()=>{const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;};
function run(args){return new Promise((resolve,reject)=>{const c=spawn(process.execPath,[cli,...args],{windowsHide:true});let stdout='',stderr='';c.stdout.on('data',v=>stdout+=v);c.stderr.on('data',v=>stderr+=v);c.on('error',reject);c.on('exit',code=>resolve({code,stdout,stderr}));});}
const args=(port,...command)=>['preview','--project',project,'--url',`http://127.0.0.1:${port}/`,'--json','--',...command];
test('help works without project or installed Paper',async()=>{const r=await run(['--help']);assert.equal(r.code,0);assert.match(r.stdout,/preview/);});
test('bad project and remote URL fail without starting command',async()=>{
 const r=await run(['preview','--project',project,'--url','https://example.com','--',process.execPath,'-e','process.exit(90)']);assert.equal(r.code,1);assert.match(r.stdout,/loopback/);
 const missing=await run(['preview','--project',join(project,'missing'),'--url','http://127.0.0.1:5678','--','node']);assert.equal(missing.code,1);
 const unknown=await run(['preview','--project',project,'--url','http://127.0.0.1:5678','--port','5678','--json','--','node']);assert.equal(unknown.code,1);
 assert.equal(JSON.parse(unknown.stdout).type,'error');assert.match(unknown.stdout,/go after --/);
});
test('existing port remains alive and is not adopted',async()=>{const s=createServer((q,r)=>r.end('existing'));await new Promise(r=>s.listen(0,'127.0.0.1',r));try{const port=s.address().port;const r=await run(args(port,process.execPath,'-e','process.exit(90)'));assert.equal(r.code,1);assert.match(r.stdout,/occupied/);assert.equal(await(await fetch(`http://127.0.0.1:${port}`)).text(),'existing');}finally{s.closeAllConnections();await new Promise(r=>s.close(r));}});
test('missing executable and early exit fail',async()=>{const port=await free();for(const command of [['shader-no-such-executable'],[process.execPath,'-e','process.exit(7)']]){const r=await run(args(port,...command));assert.equal(r.code,1);assert.doesNotMatch(r.stdout,/address-responsive/);}});
test('redirects fail, and the owned server is stopped',async()=>{const port=await free();const r=await run(args(port,process.execPath,'server.mjs',String(port),'302'));assert.equal(r.code,1);assert.match(r.stdout,/redirects/);await assert.rejects(fetch(`http://127.0.0.1:${port}`));});
test('timeout stops the process instead of claiming ready',async()=>{const port=await free();const options=args(port,process.execPath,'server.mjs',String(port),'500');options.splice(options.indexOf('--'),0,'--timeout','500');const r=await run(options);assert.equal(r.code,1);assert.match(r.stdout,/within 500ms/);await assert.rejects(fetch(`http://127.0.0.1:${port}`));});
test('Chinese and spaced project path starts native process and reports owned listener',async()=>{const port=await free();const r=await run(args(port,process.execPath,'server.mjs',String(port),'200','7000'));assert.equal(r.code,0,r.stdout+r.stderr);const events=r.stdout.trim().split('\n').map(JSON.parse);assert.ok(events.some(e=>e.type==='address-responsive'));assert.equal(events.at(-1).type,'stopped');});

const awaitClosed = async port => {
  for(let i=0;i<30;i++) {
    try {await fetch(`http://127.0.0.1:${port}`,{signal:AbortSignal.timeout(200)});}
    catch {return;}
    await sleep(100);
  }
  assert.fail('Owned server remained alive after CLI termination');
};

test('forced CLI termination kills the owned job and grandchildren',async()=>{
  const port=await free();
  const child=spawn(process.execPath,[cli,...args(port,process.execPath,'server.mjs',String(port))],{windowsHide:true});
  let stdout='',stderr='';
  child.stdout.on('data',v=>stdout+=v);child.stderr.on('data',v=>stderr+=v);
  try {
    for(let i=0;i<150 && !stdout.includes('address-responsive') && child.exitCode===null;i++)await sleep(100);
    assert.match(stdout,/address-responsive/,stderr);
    child.kill();
    await awaitClosed(port);
  } finally {child.kill();}
});

test('caller exit through an intermediate launcher stops the owned job and says why',async()=>{
  const port=await free();
  // Mirrors a node or cmd launcher between the caller and the CLI; only the launcher is terminated.
  // Detached, because libuv would otherwise kill the CLI through its own job instead of the watcher.
  const launcher=spawn(process.execPath,['-e',`require('child_process').spawn(process.execPath,${JSON.stringify([cli,...args(port,process.execPath,'server.mjs',String(port))])},{stdio:'inherit',windowsHide:true,detached:true});setInterval(()=>{},1e6);`],{windowsHide:true});
  let stdout='',stderr='';
  launcher.stdout.on('data',v=>stdout+=v);launcher.stderr.on('data',v=>stderr+=v);
  try {
    for(let i=0;i<150 && !stdout.includes('address-responsive');i++)await sleep(100);
    assert.match(stdout,/address-responsive/,stderr);
    launcher.kill();
    await awaitClosed(port);
    for(let i=0;i<30 && !stdout.includes('"stopped"');i++)await sleep(100);
    assert.match(stdout,/Launcher node\.exe \(pid \d+\) exited/,stderr);
    assert.match(stdout,/"stopped"/,stderr);
  } finally {launcher.kill();}
});

test('launcher exit closes a server that outlives its immediate parent',async()=>{
  const port=await free();
  await writeFile(join(project,'launcher.mjs'),`import {spawn} from 'node:child_process';spawn(process.execPath,['server.mjs',process.argv[2]],{stdio:'ignore',detached:true});setTimeout(()=>process.exit(0),4000);`);
  const r=await run(args(port,process.execPath,'launcher.mjs',String(port)));
  assert.equal(r.code,0,r.stdout+r.stderr);
  assert.match(r.stdout,/address-responsive/);
  await awaitClosed(port);
});

test('native and cmd shim preserve Unicode, metacharacters and child --help',async()=>{
  const expected=['a b','中文','a&b','a|b','a>b','a<b','a^b','a"b','50%','x!y','--help'];
  await writeFile(join(project,'arguments.mjs'),`import {writeFileSync} from 'node:fs';writeFileSync('received.json',JSON.stringify(process.argv.slice(2)));process.exit(7);`);
  await writeFile(join(project,'arguments.cmd'),`@echo off\r\n"${process.execPath}" "%~dp0arguments.mjs" %*\r\n`);
  for(const command of [[process.execPath,'arguments.mjs'],[join(project,'arguments.cmd')]]){
    const r=await run(args(await free(),...command,...expected));
    assert.equal(r.code,1,r.stdout+r.stderr);
    assert.deepEqual(JSON.parse(await readFile(join(project,'received.json'),'utf8')),expected);
  }
});

test('foreign listener winning the startup race is rejected and preserved',async()=>{
  const port=await free();
  const server=createServer((q,r)=>r.end('foreign'));
  const child=spawn(process.execPath,[cli,...args(port,process.execPath,'-e','setTimeout(()=>{},15000)')],{windowsHide:true});
  let stdout='',stderr='';
  child.stdout.on('data',v=>stdout+=v);child.stderr.on('data',v=>stderr+=v);
  try {
    for(let i=0;i<50 && !stdout.includes('starting');i++)await sleep(50);
    assert.match(stdout,/starting/,stderr);
    await new Promise(r=>server.listen(port,'127.0.0.1',r));
    for(let i=0;i<150 && child.exitCode===null;i++)await sleep(100);
    assert.equal(child.exitCode,1,stdout+stderr);
    assert.match(stdout,/does not belong/);
    assert.equal(await(await fetch(`http://127.0.0.1:${port}`)).text(),'foreign');
  } finally {child.kill();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
