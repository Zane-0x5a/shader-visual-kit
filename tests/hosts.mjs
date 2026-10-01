import assert from 'node:assert/strict';
import {cp,copyFile,mkdtemp,mkdir,readFile,writeFile,stat,rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {createRequire} from 'node:module';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import spawn from 'cross-spawn';
import {chromium} from 'playwright';

const root=await mkdtemp(join(tmpdir(),'shader-hosts-'));
const template=resolve('tests/fixtures/host');
const output=resolve('.test-output/hosts');
await mkdir(output,{recursive:true});
await rm(join(output,'results.json'),{force:true});
console.log(`Independent host projects: ${root}`);
const children=[];
const results=[];
let browser;
const json=(file,data)=>writeFile(file,JSON.stringify(data,null,2));
async function run(command,args,cwd){
  const child=spawn(command,args,{cwd,windowsHide:true,env:{...process.env,npm_config_cache:join(tmpdir(),'shader-npm-cache')},stdio:['ignore','pipe','pipe']});
  let log='';child.stdout.on('data',s=>log+=s);child.stderr.on('data',s=>log+=s);
  const [code]=await once(child,'exit');
  if(code!==0)throw new Error(`${command} ${args.join(' ')} failed in ${cwd}:\n${log}`);
}
async function freePort(){const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
async function start(cwd){
  const port=await freePort(),url=`http://127.0.0.1:${port}/`;
  const child=spawn(process.execPath,[resolve('cli/index.mjs'),'preview','--project',cwd,'--url',url,'--json','--','npm','run','start','--',String(port)],{windowsHide:true});
  children.push(child);let log='';
  child.stdout.on('data',s=>log+=s);child.stderr.on('data',s=>log+=s);
  for(let n=0;n<400;n++){
    if(log.includes('address-responsive'))return {url,child};
    if(child.exitCode!==null)throw new Error(log);
    await new Promise(r=>setTimeout(r,100));
  }
  throw new Error(`Host startup timed out: ${log}`);
}
const deps=version=>({'@paper-design/shaders':version,react:'19.3.0','react-dom':'19.3.0',remotion:'4.0.526','@remotion/player':'4.0.526','@remotion/bundler':'4.0.526','@remotion/renderer':'4.0.526',vite:'8.3.0'});
async function installHost(name,version,workspace){
  const folder=join(root,name),app=workspace?join(folder,'apps/web'):folder,visual=workspace?join(folder,'packages/visual'):join(folder,'visual');
  await mkdir(app,{recursive:true});await mkdir(visual,{recursive:true});
  await cp(template,app,{recursive:true});
  await json(join(visual,'package.json'),{name:'@host/visual',version:'1.0.0',private:true,type:'module',exports:'./Artwork.tsx'});
  // Establish and build the existing host before migrating the effect into it.
  await writeFile(join(visual,'Artwork.tsx'),"import React from 'react'; export function Artwork(){return <div>Existing visual slot</div>;}\n");
  const scripts={start:'node server.mjs',build:'vite build', 'build:ssr':'vite build --ssr entry-server.tsx --outDir dist/server',render:'node render.mjs'};
  await json(join(folder,'package.json'),{name,private:true,type:'module',...(workspace?{workspaces:['apps/*','packages/*']}:{scripts}),dependencies:{...deps(version),...(workspace?{}:{'@host/visual':'file:./visual'})}});
  if(workspace)await json(join(app,'package.json'),{name:'host-web',private:true,type:'module',scripts,dependencies:{'@host/visual':'1.0.0'}});
  console.log(`${name}: installing its own locked dependencies`);
  await run('npm',['install','--package-lock-only','--no-audit','--no-fund'],folder);
  await run('npm',['ci','--no-audit','--no-fund'],folder);
  await run('npm',['run','build'],app);await run('npm',['run','build:ssr'],app);
  const baseline=await start(app);
  assert.match(await(await fetch(baseline.url)).text(),/Texture Motion Study/);
  baseline.child.kill();await once(baseline.child,'exit');
  const lock=await readFile(join(folder,'package-lock.json'),'utf8');
  await copyFile(resolve('plugin/skills/shader-visual-kit/assets/PaperFrame.tsx'),join(visual,'PaperFrame.tsx'));
  await copyFile(join(template,'Artwork.tsx'),join(visual,'Artwork.tsx'));
  await mkdir(join(app,'public/assets'),{recursive:true});
  await copyFile(resolve('tests/fixtures/player/public/texture.svg'),join(app,'public/assets/texture.svg'));
  await run('npm',['run','build'],app);await run('npm',['run','build:ssr'],app);
  assert.equal(await readFile(join(folder,'package-lock.json'),'utf8'),lock);
  const require=createRequire(join(app,'package.json'));
  const paperPath=require.resolve('@paper-design/shaders');
  assert.ok(paperPath.startsWith(folder));
  assert.equal(JSON.parse(await readFile(join(folder,'node_modules/@paper-design/shaders/package.json'),'utf8')).version,version);
  console.log(`${name}: original SSR entry builds after migration; Paper ${version} resolves locally`);
  return {folder,app,visual,version,paperPath,lock};
}
try {
  const experiment=await installHost('experiment','0.0.81',false);
  const workspace=await installHost('workspace','0.0.80',true);
  const sessions=[];
  for(const host of [experiment,workspace])sessions.push({...host,...await start(host.app)});
  browser=await chromium.launch({executablePath:process.env.REMOTION_BROWSER_EXECUTABLE});
  for(const host of sessions){
    const page=await browser.newPage({viewport:{width:1000,height:800},deviceScaleFactor:1});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const ready=()=>page.waitForFunction(()=>document.querySelector('[data-paper-time-ms] canvas'));
    const hash=async()=>createHash('sha256').update(await page.locator('[data-paper-time-ms] canvas').evaluate(c=>c.toDataURL())).digest('hex');
    const html=await(await fetch(host.url)).text();assert.match(html,/<h1>Texture Motion Study<\/h1>/);assert.doesNotMatch(html,/<canvas/);
    await page.goto(host.url);await ready();const first=await hash();
    await page.getByText('Toggle texture failure',{exact:true}).click();await page.getByRole('alert').waitFor();
    await page.getByText('Toggle texture failure',{exact:true}).click();await ready();assert.equal(await hash(),first);
    await page.getByText('Mount / unmount',{exact:true}).click();assert.equal(await page.locator('canvas').count(),0);
    await page.getByText('Mount / unmount',{exact:true}).click();await ready();assert.equal(await hash(),first);
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(output,`paper-${host.version}-mobile.png`)});
    assert.deepEqual(errors,[]);
    await run('npm',['run','render'],host.app);
    assert.ok((await stat(join(host.app,'study.mp4'))).size>1000);
    assert.equal(await readFile(join(host.folder,'package-lock.json'),'utf8'),host.lock);
    results.push({version:host.version,app:host.app,paperPath:host.paperPath,checks:['independent npm ci','pre-migration host build','workspace or local package resolution','SSR HTML and hydration','local texture','404 recovery','unmount/remount','mobile screenshot','host-owned PNG and H.264 export','lockfile unchanged']});
    await page.close();
  }
  await writeFile(join(output,'results.json'),JSON.stringify({root,results},null,2));
  console.log(JSON.stringify({passed:results},null,2));
} finally {
  await browser?.close();
  for(const child of children)if(child.exitCode===null && child.signalCode===null){child.kill();await once(child,'exit');}
}
