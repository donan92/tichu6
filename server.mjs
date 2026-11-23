import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {context} from 'esbuild';
const root=resolve('dist');
const builder=await context({entryPoints:['src/app.js'],bundle:true,format:'esm',target:['es2022'],outfile:'dist/assets/app.js',legalComments:'linked'});
await builder.watch();
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'};
createServer(async(req,res)=>{try{
 const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
 if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403).end();return;}
 const file=path===root?resolve(root,'index.html'):path;
 const body=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
}catch{if(!res.headersSent)res.writeHead(404);res.end('Not found');}}).listen(5173,'127.0.0.1',()=>console.log('6T ready: http://localhost:5173'));
