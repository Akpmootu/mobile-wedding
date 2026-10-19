'use strict';
const {test}=require('node:test'); const assert=require('node:assert/strict');
test('event fold seeds stable ordering and preserves unrelated patch fields and tombstones',()=>{
 const d=require('../lib/domain'); const seeds=d.seedEvents(); assert.equal(seeds.length,8); assert.match(seeds[0].id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
 const state=d.foldEvents([...seeds,d.event('patch','seed-2',{title:'Edited'},null),d.event('delete','seed-3',{},null)]);
 assert.equal(state.cards.length,7); assert.equal(state.cards[0].url,'https://akaporn1234.wixsite.com/dmwedding'); assert.equal(state.cards[1].title,'Edited'); assert.equal(state.cards[1].category,'Classic'); assert.equal(state.settings.brand,'MOBILE WEDDING INVITATION');
});
test('settings preserve omitted contact and allow explicit disabled contact without weakening HTTPS checks',()=>{
 const {validateSettings}=require('../lib/validation');
 assert.deepEqual(validateSettings({contact_url:''}),{contact_url:''});
 assert.deepEqual(validateSettings({brand:'Saved'}),{brand:'Saved'});
 assert.equal(Object.hasOwn(validateSettings({}),'contact_url'),false);
 assert.deepEqual(validateSettings({contact_url:'https://line.me/ti/p/R8xclmk6fX'}),{contact_url:'https://line.me/ti/p/R8xclmk6fX'});
 for(const contact_url of [' ','http://example.com','javascript:alert(1)','https://localhost/','https://127.0.0.1/','https://user:pass@example.com/',null,undefined])assert.throws(()=>validateSettings({contact_url}));
});
test('strict card and public HTTPS validation rejects dangerous URLs and unknown fields',()=>{
 const {validateCard,validateSettings}=require('../lib/validation'); const base=require('../lib/domain').seedEvents()[0].payload;
 for(const url of ['http://example.com','https://localhost/','https://127.1/','https://10.0.0.1/','https://[::1]/','https://user:pass@example.com/','https://example.local/','https://169.254.1.1/','https://2130706433/','https://[::ffff:127.0.0.1]/'])assert.throws(()=>validateCard({...base,url}));
 assert.equal(validateCard({title:'New'},base).title,'New'); assert.throws(()=>validateCard({...base,actor:'evil'})); assert.throws(()=>validateCard({...base,cover:'https://example.com/x.jpg'})); assert.throws(()=>validateSettings({SESSION_SECRET:'leak'}));
});
