// Regenerates the README media in docs/assets from the demo gallery.
// Needs the dev dependencies and ffmpeg on PATH: npm run demo:capture
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createServer} from 'vite';
import {chromium} from 'playwright';

const out = resolve('docs/assets');
const frames = await mkdtemp(join(tmpdir(), 'svk-media-'));
const ffmpeg = (...args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args]);
await mkdir(out, {recursive: true});
const server = await createServer({root: resolve('demo/gallery'), logLevel: 'error', server: {host: '127.0.0.1', port: 0}});
let browser;
try {
  await server.listen();
  browser = await chromium.launch({executablePath: process.env.REMOTION_BROWSER_EXECUTABLE, args: ['--ignore-gpu-blocklist', '--use-angle=d3d11']});
  const page = await browser.newPage({viewport: {width: 1440, height: 900}, deviceScaleFactor: 2, reducedMotion: 'reduce'});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => document.querySelectorAll('div[data-paper-shader] canvas').length >= 6);
  // Reduced motion starts the gallery paused, so every artwork renders its curated frame.
  // Paper time is in milliseconds; a paused instance renders exactly the frame it is given.
  const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const setFrame = ms => page.evaluate(ms => document.querySelector('.stage div[data-paper-shader]').paperShaderMount.setFrame(ms), ms);
  const canvas = () => page.evaluate(() => document.querySelector('.stage div[data-paper-shader] canvas').toDataURL('image/png'));
  const save = (file, dataUrl) => writeFile(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
  await settle();

  await page.screenshot({path: join(frames, 'gallery.png'), fullPage: true});
  ffmpeg('-i', join(frames, 'gallery.png'), '-vf', 'scale=1600:-1:flags=lanczos', '-quality', '88', join(out, 'gallery.webp'));

  const ids = await page.evaluate(() => [...document.querySelectorAll('button[aria-label^="查看"]')].map(b => b.getAttribute('aria-label')));
  const stills = [];
  for (const [index, label] of ids.entries()) {
    await page.getByRole('button', {name: label}).click();
    await page.waitForFunction(() => document.querySelector('.stage div[data-paper-shader] canvas'));
    await settle();
    const file = join(frames, `still-${index}.png`);
    await save(file, await canvas());
    stills.push(file);
  }
  // Five centre-cropped portrait tiles with thin gutters between them, none at the outer edges.
  const tiles = stills.map((_, i) => `[${i}:v]crop=ih*0.62:ih,scale=-2:560:flags=lanczos,pad=iw+12:ih:6:0:color=0x171916[t${i}]`).join(';');
  ffmpeg(...stills.flatMap(file => ['-i', file]), '-filter_complex', `${tiles};${stills.map((_, i) => `[t${i}]`).join('')}hstack=inputs=${stills.length},crop=iw-12:ih:6:0`, '-quality', '86', join(out, 'effects.webp'));

  // Hero loop: the first artwork moving forward, then back, so the loop has no seam.
  await page.getByRole('button', {name: ids[0]}).click();
  await settle();
  const start = 8000, step = 40, count = 90;
  for (let i = 0; i < count; i++) {
    await setFrame(start + i * step);
    await settle();
    await save(join(frames, `hero-${String(i).padStart(3, '0')}.png`), await canvas());
  }
  ffmpeg('-framerate', '24', '-i', join(frames, 'hero-%03d.png'), '-filter_complex', '[0:v]scale=1200:-2:flags=lanczos,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1', '-loop', '0', '-quality', '82', '-compression_level', '6', join(out, 'hero.webp'));

  if (errors.length) throw new Error(`Page errors: ${errors.join('; ')}`);
  console.log(`README media written to ${out}`);
} finally {
  await browser?.close();
  await server.close();
  await rm(frames, {recursive: true, force: true});
}
