import {mkdir,copyFile,rm,readFile,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
await rm('dist',{recursive:true,force:true});
await mkdir('dist/assets',{recursive:true});
await copyFile('_headers','dist/_headers');
await copyFile('src/style.css','dist/assets/style.css');
await build({entryPoints:['src/app.js'],bundle:true,format:'esm',target:['es2022'],outfile:'dist/assets/app.js',minify:true,legalComments:'linked'});
const html=await readFile('index.html','utf8');
await writeFile('dist/index.html',html.replace('./src/app.js','./assets/app.js').replace('./src/style.css','./assets/style.css'));
