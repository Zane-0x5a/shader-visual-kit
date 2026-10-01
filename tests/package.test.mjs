import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir, stat} from 'node:fs/promises';
import spawn from 'cross-spawn';
import {dirname, join, resolve} from 'node:path';

const read=file=>readFile(resolve(file),'utf8');
const json=async file=>JSON.parse(await read(file));
const pkg=await json('package.json');
const skill='plugin/skills/shader-visual-kit';
async function files(dir){
  const out=[];
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const path=join(dir,entry.name);
    out.push(...entry.isDirectory()?await files(path):[path]);
  }
  return out;
}

test('every manifest and the preview command carry the package version',async()=>{
  const claudeMarket=await json('.claude-plugin/marketplace.json');
  const versions=[(await json('plugin/.claude-plugin/plugin.json')).version,(await json('plugin/plugin.json')).version,claudeMarket.plugins[0].version];
  assert.deepEqual(versions,versions.map(()=>pkg.version));
  const tags=[...(await read(`${skill}/references/preview.md`)).matchAll(/github:Zane-0x5a\/shader-visual-kit#v([\w.-]+)/g)].map(m=>m[1]);
  assert.ok(tags.length>0);
  assert.deepEqual(tags,tags.map(()=>pkg.version));
});

test('both marketplaces install the plugin directory that holds the skill',async()=>{
  const claude=(await json('.claude-plugin/marketplace.json')).plugins[0].source;
  const codex=(await json('.agents/plugins/marketplace.json')).plugins[0].source.path;
  assert.equal(resolve(claude),resolve('plugin'));
  assert.equal(resolve(codex),resolve('plugin'));
  const front=(await read(`${skill}/SKILL.md`)).match(/^---\n([\s\S]*?)\n---/)[1];
  assert.match(front,/^name: shader-visual-kit$/m);
  assert.ok(front.match(/^description: (.*)$/m)[1].length<=1024);
  assert.equal(await read('plugin/LICENSE'),await read('LICENSE'));
});

test('installed payload has no machine-local paths or broken relative links',async()=>{
  for(const file of await files(resolve('plugin'))){
    const text=await readFile(file,'utf8');
    assert.doesNotMatch(text,/\b[A-Za-z]:[\\/](Users|Projects)\b|\/Users\/|\/home\//,file);
    if(!file.endsWith('.md'))continue;
    for(const [,target] of text.matchAll(/\]\((?!https?:|#)([^)]+)\)/g))await stat(join(dirname(file),target));
  }
});

test('git installs ship only the CLI and need no build step',()=>{
  const lifecycle=['preinstall','install','postinstall','prepare','prepack','build'];
  assert.deepEqual(Object.keys(pkg.scripts).filter(name=>lifecycle.includes(name)),[]);
  const [{files:packed}]=JSON.parse(spawn.sync('npm',['pack','--dry-run','--json','--ignore-scripts'],{encoding:'utf8'}).stdout);
  const paths=packed.map(f=>f.path).sort();
  assert.ok(paths.includes('cli/index.mjs'));
  assert.deepEqual(paths.filter(p=>!p.startsWith('cli/')&&!/^(package\.json|LICENSE|README[\w.-]*\.md)$/.test(p)),[]);
});
