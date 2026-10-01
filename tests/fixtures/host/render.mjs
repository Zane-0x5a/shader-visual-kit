import {bundle} from '@remotion/bundler';
import {renderStill,renderMedia,selectComposition} from '@remotion/renderer';
import {resolve} from 'node:path';
const serveUrl=await bundle({entryPoint:resolve('render-entry.tsx'),publicDir:resolve('public')});
const browserExecutable=process.env.REMOTION_BROWSER_EXECUTABLE;
const chromiumOptions={gl:'angle'};
const composition=await selectComposition({serveUrl,id:'Study',browserExecutable,chromiumOptions});
await renderStill({serveUrl,composition,frame:0,output:'study.png',browserExecutable,chromiumOptions});
await renderMedia({serveUrl,composition,codec:'h264',frameRange:[0,5],outputLocation:'study.mp4',concurrency:1,browserExecutable,chromiumOptions});
