import {bundle} from '@remotion/bundler';
import {renderStill, renderFrames, renderMedia, selectComposition, ensureBrowser} from '@remotion/renderer';
import {createServer} from 'node:http';
import {mkdir, readFile, readdir, writeFile, rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {PNG} from 'pngjs';
import {createHash} from 'node:crypto';

const output = resolve('.test-output/render');
await mkdir(output, {recursive:true});
await rm(resolve(output,'results.json'),{force:true});
const texture = color => {const p=new PNG({width:64,height:64});for(let i=0;i<p.data.length;i+=4){p.data[i]=color[0];p.data[i+1]=color[1];p.data[i+2]=color[2];p.data[i+3]=255;}return PNG.sync.write(p);};
const server=createServer((req,res)=>{
  if(req.url!=='/no-cors')res.setHeader('Access-Control-Allow-Origin','*');
  if(req.url==='/missing'){res.writeHead(404).end();return;}
  if(req.url==='/oversized'){
    res.setHeader('Content-Type','image/svg+xml');
    res.end('<svg xmlns="http://www.w3.org/2000/svg" width="131072" height="1"><rect width="131072" height="1" fill="red"/></svg>');
    return;
  }
  if(req.url==='/checker'){
    const p=new PNG({width:1024,height:1024});
    for(let y=0;y<1024;y++)for(let x=0;x<1024;x++){
      const i=(y*1024+x)*4, color=((x+y)%2)*255;
      p.data[i]=p.data[i+1]=p.data[i+2]=color;p.data[i+3]=255;
    }
    res.setHeader('Content-Type','image/png');res.end(PNG.sync.write(p));return;
  }
  const send=()=>{res.setHeader('Content-Type','image/png');res.end(texture(req.url==='/blue'?[0,40,255]:[255,40,0]));};
  if(req.url==='/slow')setTimeout(send,500);else send();
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const chromiumOptions={gl:'angle'};
const results=[];
try {
  const browserExecutable=process.env.REMOTION_BROWSER_EXECUTABLE || (await ensureBrowser()).path;
  const serveUrl=await bundle({entryPoint:resolve('tests/fixtures/remotion/index.tsx')});
  const composition=await selectComposition({serveUrl,id:'PaperFixture',browserExecutable,chromiumOptions});
  const still=async(name,props={},frame=0,config=composition)=>{
    const outputLocation=resolve(output,`${name}.png`);
    await rm(outputLocation,{force:true});
    await renderStill({serveUrl,composition:{...config,props},inputProps:props,frame,output:outputLocation,browserExecutable,chromiumOptions,timeoutInMilliseconds:10000,logLevel:'error'});
    return createHash('sha256').update(PNG.sync.read(await readFile(outputLocation)).data).digest('hex');
  };
  await assert.rejects(still('oversized',{kind:'image',imageUrl:base+'/oversized'}),/Paper.*(WebGL|texture)/i);
  await assert.rejects(readFile(resolve(output,'oversized.png')),{code:'ENOENT'});
  await assert.rejects(still('invalid-pixel-budget',{maxPixelCount:0}),/positive finite/i);
  results.push('Oversized decoded texture: GPU upload failure cancels output');
  const badSwitch={kind:'image',imageUrl:base+'/red',otherImageUrl:base+'/oversized'};
  await assert.rejects(renderFrames({serveUrl,composition:{...composition,props:badSwitch},inputProps:badSwitch,
    outputDir:resolve(output,'failed-switch'),imageFormat:'png',frameRange:[8,12],concurrency:1,
    browserExecutable,chromiumOptions,logLevel:'error'}),/Paper.*(WebGL|texture)/i);
  results.push('Reused page: mid-composition GPU upload failure cancels rendering');
  const water=await selectComposition({serveUrl,id:'WaterFixture',browserExecutable,chromiumOptions});
  const waterProps={imageUrl:base+'/checker'};
  const waterHash=await still('water',waterProps,0,water);
  assert.equal(waterHash,await still('water-native',{...waterProps,native:true},0,water));
  const noMipmaps=await still('water-no-mipmaps',{...waterProps,noMipmaps:true},0,water);
  assert.notEqual(waterHash,noMipmaps,'Reference image must expose missing mipmaps');
  const mipSwitch={...waterProps,switchMipmaps:true};
  await renderFrames({serveUrl,composition:{...water,props:mipSwitch},inputProps:mipSwitch,
    outputDir:resolve(output,'mipmap-switch'),imageFormat:'png',frameRange:[9,10],concurrency:1,
    browserExecutable,chromiumOptions,logLevel:'error'});
  const mipFrames=(await readdir(resolve(output,'mipmap-switch'))).filter(f=>f.endsWith('.png')).sort();
  assert.equal(mipFrames.length,2);
  for(let i=0;i<2;i++)assert.equal(createHash('sha256').update(PNG.sync.read(await readFile(resolve(output,'mipmap-switch',mipFrames[i]))).data).digest('hex'),i===0?noMipmaps:waterHash);
  results.push('Water: native mipmap pixels match; sampling changes apply at frame 10');
  const a=await still('mesh-30',{},30);
  const zero=await still('mesh-0',{},0);
  assert.notDeepEqual(a,zero);
  assert.deepEqual(a,await still('mesh-repeat',{},30));
  assert.deepEqual(a,await still('mesh-offset',{rate:0,initialMs:1000},0));
  assert.equal(a,await still('mesh-reverse',{rate:-1,initialMs:2000},30));
  assert.equal(a,await still('mesh-24fps',{},24,{...composition,fps:24}));
  const sequence=await selectComposition({serveUrl,id:'SequenceFixture',browserExecutable,chromiumOptions});
  assert.equal(a,await still('sequence-local-time',{},40,sequence));
  results.push('Mesh: nonblank animated state, out-of-order/repeated frames, millisecond mapping');
  const red=await still('image-slow',{kind:'image',imageUrl:base+'/slow'});
  assert.deepEqual(red,await still('image-fast',{kind:'image',imageUrl:base+'/red'}));
  const blue=await still('image-switched',{kind:'image',imageUrl:base+'/red',otherImageUrl:base+'/blue'},20);
  assert.notDeepEqual(red,blue);
  results.push('Image: delayed decode matches fast load; changed source renders different pixels');
  for(const [name,props] of [['missing',{kind:'image',imageUrl:base+'/missing'}],['no-cors',{kind:'image',imageUrl:base+'/no-cors'}],['invalid',{kind:'invalid'}],['zero-size',{zeroSize:true}]]){
    await assert.rejects(still(name,props),/Paper|shader|HTTP|dimensions|fetch/i);results.push(name+': rejected');
  }
  for(const concurrency of [1,2]){
    await renderFrames({serveUrl,composition,inputProps:{},outputDir:resolve(output,'frames-'+concurrency),imageFormat:'png',frameRange:[0,3],concurrency,browserExecutable,chromiumOptions,logLevel:'error'});
  }
  const single=(await readdir(resolve(output,'frames-1'))).filter(f=>f.endsWith('.png')).sort();
  const multi=(await readdir(resolve(output,'frames-2'))).filter(f=>f.endsWith('.png')).sort();
  assert.equal(single.length,4);assert.equal(multi.length,4);
  for(let i=0;i<single.length;i++)assert.deepEqual(PNG.sync.read(await readFile(resolve(output,'frames-1',single[i]))).data,PNG.sync.read(await readFile(resolve(output,'frames-2',multi[i]))).data);
  results.push('Sequential and concurrent rendering: four frames match pixel-for-pixel');
  const switchingProps={kind:'image',imageUrl:base+'/slow',otherImageUrl:base+'/blue',rate:0};
  await renderFrames({serveUrl,composition:{...composition,props:switchingProps},inputProps:switchingProps,outputDir:resolve(output,'image-switch'),imageFormat:'png',frameRange:[8,12],concurrency:1,browserExecutable,chromiumOptions,logLevel:'error'});
  const switched=(await readdir(resolve(output,'image-switch'))).filter(f=>f.endsWith('.png')).sort();
  assert.equal(switched.length,5);
  for(let i=0;i<switched.length;i++) {
    const hash=createHash('sha256').update(PNG.sync.read(await readFile(resolve(output,'image-switch',switched[i]))).data).digest('hex');
    assert.equal(hash,i<2?red:blue,'Texture switch must apply before capture in a reused page');
  }
  results.push('Reused renderer page: delayed red texture switches to blue exactly at frame 10');
  await renderMedia({serveUrl,composition,codec:'h264',outputLocation:resolve(output,'sample.mp4'),frameRange:[0,14],concurrency:2,browserExecutable,chromiumOptions,logLevel:'error'});
  assert.ok((await readFile(resolve(output,'sample.mp4'))).length>1000);
  results.push('H.264 video exported through the actual Remotion encoder');
  await writeFile(resolve(output,'results.json'),JSON.stringify({results,browserExecutable,chromiumOptions},null,2));
  console.log(JSON.stringify({passed:results},null,2));
} finally {server.closeAllConnections();await new Promise(r=>server.close(r));}
