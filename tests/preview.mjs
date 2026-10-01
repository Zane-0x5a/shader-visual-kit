import assert from 'node:assert/strict';
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';

// The preview page (assets/preview) in a real browser: the demo content, plus a fixture for
// host styles, fixed layers, layered saves, a single candidate and a candidate that throws.
const output = resolve('.test-output/preview');
await mkdir(output, {recursive: true});
await rm(join(output, 'results.json'), {force: true});
const serve = async root => {
  const server = await createServer({root: resolve(root), logLevel: 'error', server: {host: '127.0.0.1', port: 0}});
  await server.listen();
  return server;
};
const servers = [await serve('demo/preview'), await serve('tests/fixtures/preview')];
const [demo, fixture] = servers.map(server => server.resolvedUrls.local[0]);
const intended = 'fixture: intentional render failure';
const checks = [];
let browser;
const opened = [];

async function open(url, {width = 1440, height = 900, reducedMotion = 'no-preference', dpr = 1} = {}) {
  const context = await browser.newContext({viewport: {width, height}, deviceScaleFactor: dpr, reducedMotion, acceptDownloads: true});
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {origin: new URL(url).origin});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => message.type() === 'error' && !message.text().includes(intended) && errors.push(message.text()));
  await page.goto(url);
  opened.push({page, errors});
  await ready(page);
  return page;
}
const ready = page => page.waitForFunction(() => {
  const shaders = [...document.querySelectorAll('.sp-content [data-paper-shader]')];
  return shaders.length > 0 && shaders.every(element => element.paperShaderMount) && !document.querySelector('.sp-loading');
});
const frame = page => page.evaluate(() => document.querySelector('.sp-content [data-paper-shader]').paperShaderMount.getCurrentFrame());
const hash = page => page.evaluate(() => location.hash);
const caption = page => page.locator('.sp-caption h2, .sp-label-caption h2').textContent();
const shade = page => page.locator('.sp-stage').evaluate(stage => getComputedStyle(stage, '::after').display);
const clipboard = page => page.evaluate(() => navigator.clipboard.readText());
const blur = page => page.evaluate(() => document.activeElement?.blur());
const rect = (page, selector) => page.locator(selector).first().evaluate(element => element.getBoundingClientRect().toJSON());
async function savedPng(page, name) {
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', {name}).click()]);
  const file = join(output, download.suggestedFilename());
  await download.saveAs(file);
  const png = PNG.sync.read(await readFile(file));
  const colors = new Set();
  for (let i = 0; i < png.data.length; i += 4 * 97) colors.add(png.data.readUInt32BE(i));
  return {file, width: png.width, height: png.height, colors: colors.size};
}
async function check(name, run) {
  await run();
  checks.push(name);
  console.log(`ok - ${name}`);
}

try {
  browser = await chromium.launch({executablePath: process.env.REMOTION_BROWSER_EXECUTABLE, args: ['--ignore-gpu-blocklist', '--use-angle=d3d11']});
  const page = await open(`${demo}?lang=zh`);

  await check('every candidate renders on the stage and as a thumbnail', async () => {
    const sizes = await page.evaluate(() => [...document.querySelectorAll('.sp-root [data-paper-shader] canvas')].map(c => c.width * c.height));
    assert.equal(sizes.length, 6);
    assert.ok(sizes.every(size => size > 0), String(sizes));
  });

  await check('tiles, arrow keys and the wordmark switch candidates and keep the hash in step', async () => {
    assert.equal(await hash(page), '#afterglow');
    await page.getByRole('button', {name: '查看静潮'}).click();
    assert.equal(await hash(page), '#tide');
    assert.equal(await caption(page), '静潮');
    await blur(page);
    await page.keyboard.press('ArrowRight');
    assert.equal(await caption(page), '光的轨道');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await hash(page), '#iris');
    await page.getByRole('button', {name: '回到第一个候选'}).click();
    assert.equal(await hash(page), '#afterglow');
  });

  await check('playback advances the Paper frame and pause holds it', async () => {
    await ready(page);
    const start = await frame(page);
    await page.waitForTimeout(600);
    assert.ok(await frame(page) > start);
    await page.getByRole('button', {name: '暂停动画'}).click();
    const held = await frame(page);
    await page.waitForTimeout(600);
    assert.equal(await frame(page), held);
    assert.equal(await page.locator('.sp-status').textContent(), '已暂停');
    await blur(page);
    await page.keyboard.press('Space');
    assert.equal(await page.locator('.sp-status').textContent(), '播放中');
  });

  await check('adjustments stay with their candidate, show in the hash and copy back in words', async () => {
    await page.getByRole('button', {name: '查看静潮'}).click();
    await page.getByRole('button', {name: '微调'}).click();
    await page.getByLabel('流动速度').press('End');
    assert.equal(await hash(page), '#tide&speed=2');
    await page.getByRole('button', {name: '复制选择'}).click();
    assert.equal(await clipboard(page), '候选「静潮」(tide)；流动速度 2.00×（推荐 1.00×）');
    await page.getByRole('button', {name: '查看光的轨道'}).click();
    assert.equal(await hash(page), '#orbit');
    await page.getByRole('button', {name: '查看静潮'}).click();
    assert.equal(await hash(page), '#tide&speed=2');
    assert.equal(await page.locator('.sp-slider output').first().textContent(), '2.00×');
    await page.getByRole('button', {name: '恢复推荐值'}).click();
    assert.equal(await hash(page), '#tide');
    await page.getByRole('button', {name: '复制选择'}).click();
    assert.equal(await clipboard(page), '候选「静潮」(tide)，使用推荐值');
    await page.getByRole('button', {name: '关闭微调'}).click();
  });

  await check('saving writes a non-blank PNG from a canvas without preserveDrawingBuffer', async () => {
    // Closing the panel widened the stage; let Paper's resize observer catch up first.
    await page.waitForFunction(() => document.querySelector('.sp-content canvas').width === Math.round(document.querySelector('.sp-content').getBoundingClientRect().width));
    assert.equal(await page.evaluate(() => document.querySelector('.sp-content canvas').getContext('webgl2').getContextAttributes().preserveDrawingBuffer), false);
    const size = await page.evaluate(() => {const c = document.querySelector('.sp-content canvas'); return [c.width, c.height];});
    const png = await savedPng(page, '保存当前帧');
    assert.deepEqual([png.width, png.height], size);
    assert.ok(png.colors > 100, `${png.file} has ${png.colors} colours`);
  });

  await check('immersive view hides the page chrome and Escape brings it back', async () => {
    await page.getByRole('button', {name: '沉浸模式'}).click();
    assert.equal(await page.locator('.sp-header').isVisible(), false);
    assert.ok(Math.abs((await rect(page, '.sp-stage')).height - (900 - 77)) <= 1);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.sp-header').isVisible(), true);
  });

  await check('a lost WebGL context is reported and disables saving', async () => {
    await page.evaluate(() => document.querySelector('.sp-content canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
    await page.getByRole('alert').filter({hasText: '图形上下文已丢失'}).waitFor();
    assert.equal(await page.getByRole('button', {name: '保存当前帧'}).isDisabled(), true);
  });

  await check('a link opens its candidate with clamped values; unknown ids fall back; hash edits apply', async () => {
    const linked = await open(`${demo}?lang=zh#signal&detail=5&speed=0.5&bogus=1`);
    assert.equal(await caption(linked), '野生信号');
    assert.equal(await hash(linked), '#signal&speed=0.5&detail=1');
    await linked.evaluate(() => {location.hash = '#orbit&speed=1.5';});
    await linked.waitForFunction(() => document.querySelector('.sp-caption h2').textContent === '光的轨道');
    assert.equal(await hash(linked), '#orbit&speed=1.5');
    const unknown = await open(`${demo}?lang=zh#nope`);
    assert.equal(await caption(unknown), '余晖');
    assert.equal(await hash(unknown), '#afterglow');
  });

  await check('reduced motion starts paused on the curated frame', async () => {
    const calm = await open(`${demo}?lang=zh`, {reducedMotion: 'reduce'});
    assert.equal(await calm.locator('.sp-status').textContent(), '已暂停');
    assert.equal(await frame(calm), 8000);
    await calm.waitForTimeout(500);
    assert.equal(await frame(calm), 8000);
  });

  await check('on a phone the page does not overflow, the strip scrolls, and immersive adjusting fits', async () => {
    const phone = await open(`${demo}?lang=zh`, {width: 390, height: 844});
    assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= 390));
    assert.ok(await phone.locator('.sp-filmstrip').evaluate(e => e.scrollWidth > e.clientWidth));
    assert.equal((await rect(phone, '.sp-tile')).left, 18);
    await phone.getByRole('button', {name: '沉浸模式'}).click();
    await phone.getByRole('button', {name: '微调'}).click();
    const boxes = await Promise.all(['.sp-stage', '.sp-panel', '.sp-transport'].map(s => rect(phone, s)));
    assert.ok(boxes.every(box => box.top >= 0 && box.bottom <= 844), JSON.stringify(boxes));
    assert.ok(boxes[0].height >= 190);
    await phone.screenshot({path: join(output, 'phone-immersive-adjust.png')});
  });

  const host = await open(fixture, {dpr: 2});
  await check('English labels; candidate content keeps host styles while the page keeps its own', async () => {
    for (const name of ['Copy choice', 'Save frame', 'Immersive view', 'Next candidate', 'View Layered', /^(Play|Pause) animation$/])
      assert.equal(await host.getByRole('button', {name, exact: true}).count(), 1, String(name));
    const styles = await host.evaluate(() => {
      const css = selector => getComputedStyle(document.querySelector(selector));
      return {title: [css('.sp-content .host-title').fontFamily, css('.sp-content .host-title').color, css('.sp-content .host-title').marginTop],
        hostButton: css('.sp-content .host-button').backgroundColor, pageButton: css('.sp-tools .sp-button').backgroundColor,
        heading: [css('.sp-heading h1').fontFamily, css('.sp-heading h1').marginTop], captionMargin: css('.sp-label-caption h2').marginTop};
    });
    assert.match(styles.title[0], /Courier New/);
    assert.deepEqual(styles.title.slice(1), ['rgb(10, 20, 30)', '40px']);
    assert.equal(styles.hostButton, 'rgb(255, 0, 0)');
    assert.equal(styles.pageButton, 'rgba(0, 0, 0, 0)');
    assert.match(styles.heading[0], /SVK DM Sans/);
    assert.equal(styles.heading[1], '0px');
    assert.equal(styles.captionMargin, '0px');
  });

  await check('a fixed page background stays inside the stage, and keys inside host content are left alone', async () => {
    const [canvas, content] = await Promise.all([rect(host, '.sp-content canvas'), rect(host, '.sp-content')]);
    for (const key of ['left', 'top', 'width', 'height']) assert.ok(Math.abs(canvas[key] - content[key]) <= 1, `${key}: ${canvas[key]} vs ${content[key]}`);
    assert.ok(await host.locator('.sp-thumb-content').first().evaluate(e => e.hasAttribute('inert')));
    await host.locator('.sp-content .host-button').focus();
    await host.keyboard.press('ArrowRight');
    assert.equal(await caption(host), 'In context');
  });

  await check('host layout shows untouched, with its caption below the stage instead of over it', async () => {
    assert.equal(await shade(host), 'none');
    assert.equal(await host.locator('.sp-stage .sp-stage-bottom').count(), 0);
    const [stage, label] = await Promise.all([rect(host, '.sp-stage'), rect(host, '.sp-label')]);
    assert.ok(label.top >= stage.bottom, `${label.top} < ${stage.bottom}`);
    assert.equal(await host.locator('.sp-label').getByRole('button', {name: 'Copy choice'}).count(), 1);
  });

  await check('a layered candidate saves its layers into one PNG at the stage size', async () => {
    await host.getByRole('button', {name: 'View Layered'}).click();
    await ready(host);
    assert.equal(await host.locator('.sp-content [data-paper-shader]').count(), 2);
    assert.equal(await shade(host), 'block');
    assert.equal(await host.locator('.sp-stage .sp-stage-bottom').count(), 1);
    const content = await rect(host, '.sp-content');
    const png = await savedPng(host, 'Save frame');
    assert.deepEqual([png.width, png.height], [Math.round(content.width * 2), Math.round(content.height * 2)]);
    assert.ok(png.colors > 50, `${png.file} has ${png.colors} colours`);
  });

  await check('a candidate that throws shows its own error at once instead of the load timeout', async () => {
    const started = Date.now();
    await host.getByRole('button', {name: 'View Broken'}).click();
    await host.getByRole('alert').filter({hasText: `The candidate failed to render: ${intended}`}).waitFor({timeout: 3000});
    assert.ok(Date.now() - started < 3000);
  });

  await check('a single candidate drops the candidate navigation and the empty adjust button', async () => {
    const one = await open(`${fixture}?single`);
    for (const selector of ['.sp-collection', '.sp-position']) assert.equal(await one.locator(selector).count(), 0, selector);
    for (const name of ['Previous candidate', 'Next candidate', 'Adjust']) assert.equal(await one.getByRole('button', {name, exact: true}).count(), 0, name);
  });

  for (const {page: opened_page, errors} of opened) assert.deepEqual(errors, [], opened_page.url());
  checks.push('no page or console errors');
  await writeFile(join(output, 'results.json'), JSON.stringify({checks}, null, 2));
  console.log(`${checks.length} preview page checks passed`);
} finally {
  await browser?.close();
  for (const server of servers) await server.close();
}
