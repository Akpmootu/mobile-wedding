'use strict';
const fs=require('node:fs');const path=require('node:path');const {execFileSync}=require('node:child_process');const root=path.resolve(__dirname,'..');
for(const name of ['public/index.html','public/styles.css','public/app.js','public/admin.html','public/admin.js','public/assets/line-qr.png','api/index.js','vercel.json'])if(!fs.existsSync(path.join(root,name)))throw Error(`Missing build input: ${name}`);
for(const name of ['public/app.js','public/admin.js','api/index.js','dev-server.cjs'])execFileSync(process.execPath,['--check',path.join(root,name)],{stdio:'inherit'});
const landing=fs.readFileSync(path.join(root,'public/index.html'),'utf8');if(!landing.includes('1,999'))throw Error('Required single-price package missing');if(!landing.includes('MOBILE WEDDING INVITATION'))throw Error('Required brand missing');
for(const name of fs.readdirSync(path.join(root,'public')))if(name.startsWith('.env')||/service.account|credential|private.key/i.test(name))throw Error('Secret-like filename in public output');
console.log('Build checks passed: static frontend + Vercel Node API. No generated client secrets.');
