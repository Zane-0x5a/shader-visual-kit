import assert from 'node:assert/strict';
import {mkdir, writeFile, rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
import {chromium} from 'playwright';

const output = resolve('.test-output/player');
await mkdir(output, {recursive:true});
await rm(resolve(output,'results.json'),{force:true});
const server = await createServer({root:resolve('tests/fixtures/player'), server:{host:'127.0.0.1',port:0}});
let browser;
const results = [];
try {
  await server.listen();
  browser = await chromium.launch({executablePath:process.env.REMOTION_BROWSER_EXECUTABLE});
  const page = await browser.newPage({viewport:{width:1000,height:800},deviceScaleFactor:1});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let mode = 'blue';
  const svg = (color, width=128) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="128"><rect width="${width}" height="128" fill="${color}"/></svg>`;
  await page.route('**/invalid-texture', async route => {
    const requested = mode;
    if(requested==='slow-error' || requested==='timeout')await new Promise(r=>setTimeout(r,requested==='timeout'?16000:700));
    if(requested==='slow-error' || requested==='timeout')return route.fulfill({status:404,body:'missing'}).catch(()=>{});
    return route.fulfill({contentType:'image/svg+xml',body:svg('blue',requested==='oversized'?131072:128)});
  });
  await page.goto(server.resolvedUrls.local[0]);
  const ready = () => page.waitForFunction(() => !!document.querySelector('[data-paper-time-ms] canvas') && !document.querySelector('[role=alert]'));
  const pixels = async () => createHash('sha256').update(await page.locator('[data-paper-time-ms] canvas').evaluate(canvas=>canvas.toDataURL())).digest('hex');
  const descriptor = () => page.evaluate(() => {
    const prototype=WebGL2RenderingContext.prototype;
    return ['getError','createTexture'].map(key=>{
      const d=Object.getOwnPropertyDescriptor(prototype,key);
      return {value:String(d.value),configurable:d.configurable,enumerable:d.enumerable,writable:d.writable};
    });
  });
  await ready();
  const original = await descriptor();
  await page.getByText('Switch effect',{exact:true}).click();
  await ready();
  const red = await pixels();
  mode='oversized';
  await page.getByText('Toggle broken texture',{exact:true}).click();
  await page.getByRole('alert').filter({hasText:/WebGL.*1281/}).waitFor();
  assert.equal(await page.locator('[data-paper-time-ms]').count(),0);
  assert.deepEqual(await descriptor(),original);
  await page.getByText('Toggle broken texture',{exact:true}).click();
  await ready();
  assert.equal(await pixels(),red);
  results.push('Oversized update: visible failure, stale canvas removed, same-instance recovery matches original pixels');

  // Force the allocation-null path independently of GL error flags, as drivers may do.
  await page.evaluate(() => {
    const prototype=WebGL2RenderingContext.prototype;
    prototype.createTexture=function(){return null;};
    prototype.getError=function(){return 0;};
  });
  mode='blue';
  // Evict the cached oversized URL by remounting before this new allocation.
  await page.getByText('Mount / unmount',{exact:true}).click();
  await page.getByText('Mount / unmount',{exact:true}).click();
  await page.getByRole('alert').filter({hasText:/WebGL.*1285/}).waitFor();
  // checkedPaperCall restores the descriptor present on entry, including our injected one.
  await page.reload();
  await ready();
  assert.deepEqual(await descriptor(),original);
  results.push('Texture allocation returning null: visible failure even without a GL error flag');

  await page.getByText('Switch effect',{exact:true}).click();
  await ready();
  const before = await pixels();
  mode='slow-error';
  await page.getByText('Toggle broken texture',{exact:true}).click();
  await page.getByText('Toggle broken texture',{exact:true}).click();
  await ready();
  await page.waitForTimeout(900);
  assert.equal(await page.getByRole('alert').count(),0);
  assert.equal(await pixels(),before);
  results.push('Rapid slow-failing texture round trip: aborted old request cannot overwrite current pixels or error state');
  await page.getByText('Toggle broken texture',{exact:true}).click();
  await page.getByText('Mount / unmount',{exact:true}).click();
  await page.waitForTimeout(900);
  assert.equal(await page.getByRole('alert').count(),0);
  await page.getByText('Toggle broken texture',{exact:true}).click();
  await page.getByText('Mount / unmount',{exact:true}).click();
  await ready();
  results.push('Unmount during pending texture: no late errors; remount recovers');

  await page.evaluate(() => document.querySelector('[data-paper-time-ms] canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await page.getByRole('alert').filter({hasText:/context lost/}).waitFor();
  await page.getByText('Switch effect',{exact:true}).click();
  await ready();
  results.push('Context loss: visible failure and effect-change recovery');
  mode='timeout';
  await page.getByText('Toggle broken texture',{exact:true}).click();
  await page.getByRole('alert').filter({hasText:/within 15 seconds/}).waitFor({timeout:20000});
  await page.getByText('Toggle broken texture',{exact:true}).click();
  await ready();
  results.push('Resource deadline: visible timeout, playback unblocked, valid source recovers');
  assert.deepEqual(await descriptor(),original);
  assert.deepEqual(errors,[]);
  await page.screenshot({path:resolve(output,'recovered.png')});
  await page.addInitScript(() => {
    const getContext=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){
      if(type==='webgl2' && this.parentElement?.style.flexShrink==='0')return null;
      return getContext.call(this,type,...args);
    };
  });
  await page.reload();
  await page.getByRole('alert').filter({hasText:/WebGL is not supported/}).waitFor();
  assert.equal(await page.locator('[data-paper-time-ms]').count(),0);
  assert.deepEqual(errors,[]);
  assert.deepEqual(await descriptor(),original);
  results.push('WebGL unavailable: visible initialization failure, no success marker, browser methods restored');
  await writeFile(resolve(output,'results.json'),JSON.stringify({results,browser:browser.version()},null,2));
  console.log(JSON.stringify({passed:results},null,2));
} finally {await browser?.close(); await server.close();}
