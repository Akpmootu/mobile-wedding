const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const admin=path.join(__dirname,'../public/admin.js');
test('Google authentication requires a verified allowlisted session, not just an ok response',async()=>{
 const {authenticateGoogle}=require(admin);assert.equal(typeof authenticateGoogle,'function');
 const calls=[];const request=async(url,options)=>{calls.push([url,options]);return url==='/api/session'?{authenticated:true,csrf:'verified-token',email:'akaporn1234@gmail.com'}:{ok:true};};
 assert.equal((await authenticateGoogle('signed-token',request)).csrf,'verified-token');
 assert.deepEqual(calls,[['/api/auth/google',{method:'POST',body:{credential:'signed-token'}}],['/api/session',undefined]]);
 for(const session of [{authenticated:false},{authenticated:true,csrf:'x',email:'other@gmail.com'},{authenticated:true,email:'akaporn1234@gmail.com'}])await assert.rejects(authenticateGoogle('token',async url=>url==='/api/session'?session:{ok:true}));
 await assert.rejects(authenticateGoogle('',request));
});
function bootAdmin(responses,{googleBlocked=false}={}){
 const vm=require('node:vm');const elements=new Map();const calls=[];let ready,googleOptions,rendered=false;
 const element=selector=>{if(!elements.has(selector))elements.set(selector,{hidden:false,value:'',textContent:'',innerHTML:'',dataset:{},elements:new Proxy({},{get:(target,key)=>target[key]??=( {value:'',checked:false,addEventListener(){},focus(){}} )}),classList:{toggle(){}},addEventListener(){},appendChild(){},setAttribute(){},focus(){},showModal(){},close(){},reset(){}});return elements.get(selector);};
 const context={console,URL,location:{origin:'https://studio.test'},setTimeout,clearTimeout,document:{querySelector:element,querySelectorAll:()=>[],addEventListener:(name,fn)=>{ready=fn;},createElement:()=>({remove(){}}),head:{appendChild:script=>{queueMicrotask(()=>googleBlocked?script.onerror():script.onload());}}},google:{accounts:{id:{initialize:options=>{googleOptions=options;},renderButton:()=>{rendered=true;},disableAutoSelect(){}}}},fetch:async(url,options)=>{calls.push([url,options]);const value=responses[url];if(value instanceof Error)throw value;const data=typeof value==='function'?value(options):value;return {ok:!data?.status||data.status<400,status:data?.status||200,json:async()=>data||{}};}};
 vm.runInNewContext(fs.readFileSync(admin,'utf8'),context);ready();
 return {elements,element,calls,get googleOptions(){return googleOptions;},get rendered(){return rendered;},flush:async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));}};
}
test('unconfigured Google login is blocked clearly without a password fallback',async()=>{
 const ui=bootAdmin({'/api/session':{authenticated:false},'/api/auth/config':{configured:false},'/api/health':{sheets:{configured:false,connected:false}}});await ui.flush();
 assert.equal(ui.element('#admin-workspace').hidden,true);assert.equal(ui.rendered,false);assert.match(ui.element('#login-feedback').textContent,/ยังไม่ได้ตั้งค่า/);assert.match(ui.element('#sheets-status').textContent,/ยังไม่ได้ตั้งค่า/);
 const html=fs.readFileSync(path.join(__dirname,'../public/admin.html'),'utf8');assert.doesNotMatch(html,/type="password"|id="login-form"/);assert.doesNotMatch(fs.readFileSync(admin,'utf8'),/['"]\/api\/login['"]/);
});
test('configured Google button carries nonce and verifies session after server login',async()=>{
 let authenticated=false;const ui=bootAdmin({'/api/session':()=>authenticated?{authenticated:true,csrf:'csrf-secret',email:'akaporn1234@gmail.com'}:{authenticated:false},'/api/auth/config':{configured:true,clientId:'client.apps.googleusercontent.com',nonce:'nonce'},'/api/auth/google':()=>{authenticated=true;return {ok:true};},'/api/admin/cards':[], '/api/settings':{brand:'MOBILE WEDDING INVITATION'},'/api/health':{sheets:{configured:true,connected:true}}});await ui.flush();
 assert.equal(ui.rendered,true);assert.equal(ui.googleOptions.nonce,'nonce');assert.equal(ui.googleOptions.client_id,'client.apps.googleusercontent.com');await ui.googleOptions.callback({credential:'signed-id'});await ui.flush();
 assert.equal(ui.element('#admin-workspace').hidden,false);const post=ui.calls.find(([url])=>url==='/api/auth/google')[1];assert.equal(post.credentials,'same-origin');assert.deepEqual(JSON.parse(post.body),{credential:'signed-id'});
});
test('session expiry restores Google login and failed Google verification stays locked',async()=>{
 const ui=bootAdmin({'/api/session':{authenticated:true,csrf:'old',email:'akaporn1234@gmail.com'},'/api/admin/cards':{status:401,error:'Session expired'},'/api/auth/config':{configured:true,clientId:'client',nonce:'fresh'},'/api/auth/google':{status:401,error:'Email is not allowed'},'/api/health':{}});await ui.flush();assert.equal(ui.element('#admin-workspace').hidden,true);assert.equal(ui.rendered,true);await ui.googleOptions.callback({credential:'wrong-account'});assert.equal(ui.element('#admin-workspace').hidden,true);assert.match(ui.element('#login-feedback').textContent,/Email is not allowed/);
});
test('logout uses CSRF and refreshes Google challenge before another sign-in',async()=>{
 let authenticated=false,challenge=0;const ui=bootAdmin({'/api/session':()=>authenticated?{authenticated:true,csrf:'session-csrf',email:'akaporn1234@gmail.com'}:{authenticated:false},'/api/auth/config':()=>({configured:true,clientId:'client',nonce:'challenge-'+(++challenge)}),'/api/auth/google':()=>{authenticated=true;return {ok:true};},'/api/logout':()=>{authenticated=false;return {ok:true};},'/api/admin/cards':[], '/api/settings':{},'/api/health':{}});await ui.flush();await ui.googleOptions.callback({credential:'id-token'});await ui.element('#logout').onclick({currentTarget:ui.element('#logout')});await ui.flush();
 const logout=ui.calls.find(([url])=>url==='/api/logout')[1];assert.equal(logout.headers['X-CSRF-Token'],'session-csrf');assert.equal(ui.element('#admin-workspace').hidden,true);assert.equal(ui.googleOptions.nonce,'challenge-2');
});
test('flat health config does not claim real connectivity without a probe',async()=>{
 for(const configured of [false,true]){const ui=bootAdmin({'/api/session':{authenticated:false},'/api/auth/config':{configured:false},'/api/health':{ok:true,sheetsConfigured:configured,source:configured?'google-sheets':'seed'}});await ui.flush();assert.match(ui.element('#sheets-status').textContent,configured?/ตั้งค่าแล้ว.*ยังไม่ยืนยัน/:/ยังไม่ได้ตั้งค่า/);assert.doesNotMatch(ui.element('#sheets-status').textContent,/เชื่อมต่อแล้ว/);}
});
test('Google script failure and configured-but-disconnected Sheets are not success',async()=>{
 const ui=bootAdmin({'/api/session':{authenticated:false},'/api/auth/config':{configured:true,clientId:'client',nonce:'nonce'},'/api/health':{sheets:{configured:true,connected:false}}},{googleBlocked:true});await ui.flush();assert.equal(ui.rendered,false);assert.match(ui.element('#login-feedback').textContent,/Google.*(โหลด|บล็อก)/);assert.match(ui.element('#sheets-status').textContent,/เชื่อมต่อไม่ได้/);
});
test('new card editor starts in Modern and submits a backend-valid category',async()=>{
 let saved;const ui=bootAdmin({'/api/session':{authenticated:true,csrf:'token',email:'akaporn1234@gmail.com'},'/api/health':{},'/api/admin/cards':()=>saved?[{id:'new',...saved}]:[],'/api/settings':{},'/api/cards':options=>{saved=JSON.parse(options.body);require('../lib/validation').validateCard(saved);return {id:'new'};}});await ui.flush();
 ui.element('#add-card').onclick();const form=ui.element('#card-form');assert.equal(form.elements.category.value,'Modern');
 form.elements.title.value='New card';form.elements.url.value='https://example.com/invite';await form.onsubmit({preventDefault(){}});
 assert.equal(saved.category,'Modern');assert.equal(ui.element('#global-feedback').textContent,'บันทึกการ์ดแล้ว');
});
test('blank cover is normalized before create and readback, toggle sends only one mutable field',async()=>{
 let cards=[];const ui=bootAdmin({'/api/session':{authenticated:true,csrf:'token',email:'akaporn1234@gmail.com'},'/api/health':{},'/api/admin/cards':()=>cards.map(c=>({...c})), '/api/settings':{},'/api/cards':options=>{const payload=JSON.parse(options.body);cards=[{id:'one',...payload,cover:payload.cover||'/assets/card-1.jpg'}];return {id:'one'};},'/api/cards/one':options=>{Object.assign(cards[0],JSON.parse(options.body));return {ok:true};}});await ui.flush();
 const form=ui.element('#card-form');form.elements.title.value='Test';form.elements.url.value='https://example.com';form.elements.sort_order.value='0';form.elements.published.checked=true;await form.onsubmit({preventDefault(){}});
 assert.equal(JSON.parse(ui.calls.find(([url])=>url==='/api/cards')[1].body).cover,'/assets/card-1.jpg');assert.equal(ui.element('#global-feedback').textContent,'บันทึกการ์ดแล้ว');
 const toggle={dataset:{toggle:'published',id:'one'}};await ui.element('#admin-list').onclick({target:{closest:selector=>selector==='[data-toggle]'?toggle:null}});assert.deepEqual(JSON.parse(ui.calls.find(([url])=>url==='/api/cards/one')[1].body),{published:false});
});
test('cover compression scales to 900px, iterates JPEG quality, and enforces 160KB',async()=>{
 const {compressCover}=require(admin);assert.equal(typeof compressCover,'function');let closed=false,draws=[],qualities=[];
 const image={width:1800,height:1200,close(){closed=true;}};const canvas={width:0,height:0,getContext:()=>({fillRect(){},drawImage(...args){draws.push(args);}}),toBlob(callback,type,quality){qualities.push(quality);assert.equal(type,'image/jpeg');callback(new Blob([new Uint8Array(quality>.7?180000:150000)],{type}));}};
 const blob=await compressCover({type:'image/png',size:1000000},{decode:async()=>image,makeCanvas:()=>canvas});assert.equal(blob.type,'image/jpeg');assert.ok(blob.size<=160*1024);assert.equal(canvas.width,900);assert.equal(canvas.height,600);assert.ok(qualities.length>1);assert.ok(draws.length);assert.equal(closed,true);
 canvas.toBlob=cb=>cb(new Blob([new Uint8Array(170000)],{type:'image/jpeg'}));await assert.rejects(compressCover({type:'image/png',size:1},{decode:async()=>image,makeCanvas:()=>canvas}),/160/);
 await assert.rejects(compressCover({type:'image/svg+xml',size:1}),/JPEG/);
 canvas.toBlob=cb=>cb(null);await assert.rejects(compressCover({type:'image/png',size:1},{decode:async()=>image,makeCanvas:()=>canvas}),/JPEG/);
});
test('cover validation restricts MIME and five megabyte upload limit',()=>{assert.ok(fs.existsSync(admin),'admin implementation must exist');const {validateCover}=require(admin);assert.equal(validateCover({type:'image/webp',size:5*1024*1024}), '');assert.match(validateCover({type:'image/svg+xml',size:1}),/JPEG/);assert.match(validateCover({type:'image/png',size:5*1024*1024+1}),/5 MB/);});
