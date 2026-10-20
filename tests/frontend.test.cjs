const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const app=path.join(__dirname,'../public/app.js');
function bootGallery(settings){
 const vm=require('node:vm'),html=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8'),elements=new Map();let ready;
 const element=key=>{if(!elements.has(key))elements.set(key,{textContent:'',innerHTML:'',hidden:false,href:'',dataset:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){}});return elements.get(key);};
 const brands=[element('brand-header'),element('brand-footer')];
 const taglines=[element('#tagline'),...Array.from(html.matchAll(/<[^>]*data-tagline[^>]*>/g),(_,i)=>element('tagline-'+i))];
 const contacts=Array.from(html.matchAll(/<a\b[^>]*href="https:\/\/line.me\/ti\/p\/R8xclmk6fX"[^>]*>/g),([tag],i)=>({tag,el:element(tag.includes('id="contact-link"')?'#contact-link':'contact-'+i)}));
 const context={URL,location:{origin:'https://studio.test',href:'https://studio.test/'},localStorage:{getItem:()=>null},window:{addEventListener(){}},document:{querySelector:element,querySelectorAll:selector=>selector==='[data-brand]'?brands:selector==='[data-tagline]'?taglines:selector==='[data-contact]'?contacts.filter(c=>c.tag.includes('data-contact')).map(c=>c.el):[],addEventListener:(_,fn)=>{ready=fn;}},fetch:async url=>({ok:true,json:async()=>url==='/api/cards'?[]:settings})};
 vm.runInNewContext(fs.readFileSync(app,'utf8'),context);ready();
 return {element,brands,taglines,contacts,flush:async()=>{for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));}};
}
test('saved public settings resolve without HTML interpretation and update every contact CTA',async()=>{
 const settings={brand:'<b>Saved brand</b>',tagline:'<img src=x> Saved tagline',contact_url:'https://example.com/contact'};
 const {publicSettings}=require(app);assert.equal(typeof publicSettings,'function');assert.deepEqual(publicSettings(settings,'https://studio.test'),settings);
 const ui=bootGallery(settings);await ui.flush();
 for(const el of ui.brands)assert.equal(el.textContent,settings.brand);
 for(const el of ui.taglines)assert.equal(el.textContent,settings.tagline);
 assert.ok(ui.contacts.length>=4);for(const {el}of ui.contacts){assert.equal(el.href,settings.contact_url);assert.equal(el.hidden,false);}
 assert.equal(ui.element('#load-state').hidden,true);
});
test('public settings distinguish absent defaults from explicit blank and unsafe contact values',async()=>{
 const {publicSettings}=require(app);const defaults={brand:'MOBILE WEDDING INVITATION',tagline:'ลิงก์เดียวจบ ครบเรื่องการ์ดแต่งงาน',contact_url:'https://line.me/ti/p/R8xclmk6fX'};
 assert.deepEqual(publicSettings({}),defaults);
 const fallback=bootGallery({});await fallback.flush();assert.equal(fallback.element('#tagline').textContent,defaults.tagline);for(const {el}of fallback.contacts)assert.equal(el.href,defaults.contact_url);
 for(const contact_url of ['', 'javascript:alert(1)', 'data:text/html,unsafe']){
  assert.equal(publicSettings({contact_url}).contact_url,'');const ui=bootGallery({brand:'',tagline:'',contact_url});await ui.flush();
  assert.equal(ui.element('#contact-link').hidden,true);for(const {el}of ui.contacts){assert.equal(el.hidden,true);assert.equal(el.href,'');}for(const el of ui.brands)assert.equal(el.textContent,'');assert.equal(ui.element('#tagline').textContent,'');
 }
});
test('header and footer tagline copies are connected to saved settings',async()=>{
 const ui=bootGallery({tagline:'Saved across the page'});await ui.flush();assert.equal(ui.taglines.length,3);for(const el of ui.taglines)assert.equal(el.textContent,'Saved across the page');
});
test('gallery filters combine category, favorites and Thai search without changing source',()=>{
 assert.ok(fs.existsSync(app),'gallery implementation must exist');
 const {filterCards}=require(app);
 const cards=[{id:1,title:'รักแรก',category:'Classic',published:true},{id:2,title:'Rose',category:'Modern',published:true},{id:3,title:'Hidden',category:'Classic',published:false}];
 assert.deepEqual(filterCards(cards,{query:'รัก',category:'Classic',favoritesOnly:true,favorites:['1']}).map(c=>c.id),[1]);
 assert.equal(filterCards(cards,{}).length,2);
 assert.equal(cards.length,3);
});
test('URLs reject missing and unsafe values without inventing contact links',()=>{const {safeHttpURL}=require(app);assert.equal(typeof safeHttpURL,'function');assert.equal(safeHttpURL(undefined,'https://vow.test'),'');assert.equal(safeHttpURL('','https://vow.test'),'');assert.equal(safeHttpURL('javascript:alert(1)','https://vow.test'),'');assert.equal(safeHttpURL('/assets/card-1.jpg','https://vow.test'),'https://vow.test/assets/card-1.jpg');});
test('Wix live preview scales its legacy canvas into the requested screen ratio',()=>{const {previewLayout}=require(app);assert.equal(typeof previewLayout,'function');const wix=previewLayout('https://couple.wixsite.com/invite',230,490);assert.equal(wix.width,980);assert.equal(wix.height,980*2868/1320);assert.ok(wix.width*wix.scale<=230);assert.ok(wix.height*wix.scale<=490);for(const url of ['https://example.com','https://notwixsite.com']){const p=previewLayout(url,230,490);assert.equal(p.width,440);assert.equal(p.height,956);assert.ok(p.width*p.scale<=230);assert.ok(p.height*p.scale<=490);}});
