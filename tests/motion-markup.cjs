'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
test('hero offers exactly the two named canonical in-page preview buttons',()=>{
 const buttons=[...html.matchAll(/<button\b[^>]*data-hero-url="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g)];
 assert.equal(buttons.length,2,'two hero preview buttons required');
 assert.deepEqual(buttons.map(b=>b[1]).sort(),['https://akaporn1234.wixsite.com/dmwedding','https://maibenz-wedding.netlify.app/'].sort());
 for(const [url,name,asset] of [['https://akaporn1234.wixsite.com/dmwedding','DM Wedding 01','/assets/card-1.jpg'],['https://maibenz-wedding.netlify.app/','Mai &amp; Benz','/assets/card-2.jpg']]){
  const b=buttons.find(b=>b[1]===url);assert.ok(b[0].includes(`aria-label="ดู ${name}"`));assert.ok(b[2].includes(asset));assert.ok(b[2].includes('fetchpriority="high"'));assert.ok(!b[2].includes('loading="lazy"'));assert.ok(b[2].includes(`hero-phone-caption">${name}`));
 }
});
test('enhancements load after base styles and app; LINE uses saved-settings hook',()=>{
 assert.ok(html.indexOf('/enhancements.css')>html.indexOf('/styles.css'));
 assert.match(html,/<script defer src="\/app.js"><\/script><script defer src="\/motion.js"><\/script><script defer src="\/music.js"><\/script>/);
 assert.match(html,/<a[^>]*class="floating-contact"[^>]*data-contact[^>]*href="https:\/\/line.me\/ti\/p\/R8xclmk6fX"/);
 assert.ok(html.includes('พรีเซ็ตหน้าจอ 6.9 นิ้ว • 1320×2868px • จำลองสัดส่วน'));
});
