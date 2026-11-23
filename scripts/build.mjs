import {mkdir,cp,copyFile,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
await copyFile('index.html','dist/index.html');
await copyFile('_headers','dist/_headers');
await cp('src','dist/src',{recursive:true});
