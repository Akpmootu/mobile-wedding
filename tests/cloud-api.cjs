'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const http=require('node:http');
const env={GOOGLE_CLIENT_ID:'test-client',SESSION_SECRET:'s'.repeat(40),APP_ORIGIN:'http://localhost:3000'};
async function serve(t,options={}){const {createHandler}=require('../api/index');const server=http.createServer(createHandler({env,...options}));await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base=`http://127.0.0.1:${server.address().port}`;return async(path,opt={})=>fetch(base+path,{...opt,headers:{origin:env.APP_ORIGIN,...opt.headers}});}
async function login(request,credential='valid'){const config=await request('/api/auth/config');const c=await config.json();const cookie=config.headers.get('set-cookie').split(';')[0];const r=await request('/api/auth/google',{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({credential,nonce:c.nonce})});return r;}
test('Google challenge binds nonce; only exact verified Gmail can authenticate; forged tokens rejected',async t=>{
 let nonce; const request=await serve(t,{verifyGoogle:async token=>{if(token==='forged')throw Error('invalid');return {email:token==='other'?'someone@gmail.com':'akaporn1234@gmail.com',email_verified:token!=='unverified',nonce};}});
 const cfg=await request('/api/auth/config');const data=await cfg.json();nonce=data.nonce;assert.equal(data.clientId,'test-client');const cookie=cfg.headers.get('set-cookie').split(';')[0];
 const post=credential=>request('/api/auth/google',{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({credential})});
 assert.equal((await post('forged')).status,401);assert.equal((await post('other')).status,403);assert.equal((await post('unverified')).status,403);
 const good=await post('valid');assert.equal(good.status,200);assert.match(good.headers.get('set-cookie'),/HttpOnly/);assert.match(good.headers.get('set-cookie'),/SameSite=Strict/);const sessionCookie=good.headers.getSetCookie().find(x=>x.startsWith('wedding_session=')).split(';')[0];const session=await (await request('/api/session',{headers:{cookie:sessionCookie}})).json();assert.equal(session.email,'akaporn1234@gmail.com');assert.ok(session.csrf);
 assert.equal((await request('/api/logout',{method:'POST',headers:{cookie:sessionCookie}})).status,403);assert.equal((await request('/api/logout',{method:'POST',headers:{cookie:sessionCookie,'x-csrf-token':session.csrf}})).status,200);
 assert.equal((await request('/api/auth/google',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({credential:'valid',nonce})})).status,401);
 assert.equal((await request('/api/auth/google',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:'{}'})).status,403);
});
test('public seed fallback explicit, auth before missing datastore, configured failures closed',async t=>{
 const request=await serve(t); const r=await request('/api/cards');assert.equal(r.status,200);assert.equal(r.headers.get('x-data-source'),'seed');assert.equal((await r.json()).length,8);
 assert.equal((await request('/api/admin/cards')).status,401);assert.equal((await request('/api/cards',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,401);
 const broken=await serve(t,{store:{configured:true,readEvents:async()=>{throw Error('private secret');}}});assert.equal((await broken('/api/cards')).status,503);
 const health=await (await request('/api/health')).json();assert.equal(health.source,'seed');assert.ok(!JSON.stringify(health).includes(env.SESSION_SECRET));
});
test('authenticated CRUD appends auditable partial events; published filter and settings whitelist',async t=>{
 const d=require('../lib/domain');const events=d.seedEvents();let nonce;const store={configured:true,readEvents:async()=>structuredClone(events),appendEvent:async e=>events.push(e)};
 const request=await serve(t,{store,verifyGoogle:async()=>({email:d.ADMIN,email_verified:true,nonce})});const cfg=await request('/api/auth/config');nonce=(await cfg.json()).nonce;const logged=await request('/api/auth/google',{method:'POST',headers:{cookie:cfg.headers.get('set-cookie').split(';')[0],'content-type':'application/json'},body:JSON.stringify({credential:'valid',nonce})});
 const cookie=logged.headers.getSetCookie().find(x=>x.startsWith('wedding_session=')).split(';')[0];const {csrf}=await logged.json();const headers={cookie,'x-csrf-token':csrf,'content-type':'application/json'};
 let r=await request('/api/cards',{method:'POST',headers,body:JSON.stringify({title:'New',url:'https://example.com/',published:false})});assert.equal(r.status,201);const card=await r.json();assert.equal((await (await request('/api/cards')).json()).length,8);assert.equal((await (await request('/api/admin/cards',{headers:{cookie}})).json()).length,9);
 r=await request('/api/cards/'+card.id,{method:'PUT',headers,body:JSON.stringify({title:'Changed'})});assert.equal(r.status,200);assert.equal((await r.json()).url,card.url);assert.deepEqual(events.at(-1).payload,{title:'Changed'});assert.equal(events.at(-1).actor,d.ADMIN);assert.equal(events.at(-1).before.title,'New');
 const countBeforeNoop=events.length;assert.equal((await request('/api/cards/'+card.id,{method:'PUT',headers,body:'{}'})).status,200);assert.equal(events.length,countBeforeNoop);
 assert.equal((await request('/api/cards',{method:'POST',headers,body:JSON.stringify({title:'Duplicate',url:card.url})})).status,409);
 assert.equal((await request('/api/settings',{method:'POST',headers,body:JSON.stringify({SESSION_SECRET:'leak'})})).status,400);
 assert.equal((await request('/api/settings',{method:'POST',headers,body:JSON.stringify({brand:'New Brand'})})).status,200);assert.equal((await (await request('/api/settings')).json()).brand,'New Brand');
 assert.equal((await request('/api/cards/'+card.id,{method:'DELETE',headers})).status,200);assert.equal(events.at(-1).action,'delete');
});
test('raw media upload enforces signatures and size; public bytes returned without cookies',async t=>{
 const d=require('../lib/domain');let nonce;const rows=new Map();const events=[];const store={configured:true,readEvents:async()=>events,appendEvent:async e=>events.push(e),appendMedia:async m=>rows.set(m.id,m),readMedia:async id=>rows.get(id)};const request=await serve(t,{store,verifyGoogle:async()=>({email:d.ADMIN,email_verified:true,nonce})});const cfg=await request('/api/auth/config');nonce=(await cfg.json()).nonce;const logged=await request('/api/auth/google',{method:'POST',headers:{cookie:cfg.headers.get('set-cookie').split(';')[0],'content-type':'application/json'},body:JSON.stringify({credential:'valid',nonce})});const cookie=logged.headers.getSetCookie().find(x=>x.startsWith('wedding_session=')).split(';')[0];const {csrf}=await logged.json();const headers={cookie,'x-csrf-token':csrf,'content-type':'image/jpeg'};
 assert.equal((await request('/api/upload',{method:'POST',headers,body:Buffer.from('bad')})).status,400);assert.equal((await request('/api/upload',{method:'POST',headers,body:Buffer.alloc(200*1024+1)})).status,413);
 const image=Buffer.from([255,216,255,224,0,0,255,217]);const upload=await request('/api/upload',{method:'POST',headers,body:image});assert.equal(upload.status,201);const {url}=await upload.json();const media=await request(url);assert.equal(media.headers.get('content-type'),'image/jpeg');assert.equal(media.headers.get('set-cookie'),null);assert.deepEqual(Buffer.from(await media.arrayBuffer()),image);assert.equal(events.at(-1).action,'media');
});
module.exports={serve,login,env};
