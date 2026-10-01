import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {render} from './dist/server/entry-server.js';
const root=resolve('dist');
const types={'.js':'text/javascript','.html':'text/html; charset=utf-8','.svg':'image/svg+xml','.css':'text/css'};
createServer(async(req,res)=>{
  try {
    if(req.url==='/'){res.setHeader('Content-Type',types['.html']);res.end((await readFile(resolve(root,'index.html'),'utf8')).replace('<!--app-->',render()));return;}
    const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(!path.startsWith(root+sep)){res.writeHead(403).end();return;}
    res.setHeader('Content-Type',types[extname(path)]||'application/octet-stream');res.end(await readFile(path));
  } catch(error){res.writeHead(req.url==='/'?500:404).end(error.message);}
}).listen(Number(process.argv[2]),'127.0.0.1');
