'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=()=>fs.readFileSync(require('node:path').join(__dirname,'../public/motion.js'),'utf8');
function load(){const context={module:{exports:{}}};vm.runInNewContext(source(),context);return context.module.exports;}
test('first visit is claimed once per session and blocked storage skips animation safely',()=>{
 assert.ok(fs.existsSync(require('node:path').join(__dirname,'../public/motion.js')),'motion module must exist');
 const {claimFirstVisit}=load();const values=new Map();const storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 assert.equal(claimFirstVisit(storage),true);assert.equal(claimFirstVisit(storage),false);
 assert.equal(claimFirstVisit({getItem(){throw Error('blocked');}}),false);
 assert.equal(claimFirstVisit(null),false);
});
test('reveal animation ends at the original transform with fully readable opacity',()=>{
 const {entranceFrames}=load();const frames=entranceFrames('rotate(9deg)',true);
 assert.equal(frames.length,2);assert.equal(frames[1].opacity,1);assert.equal(frames[1].transform,'rotate(9deg)');
 assert.match(frames[0].transform,/translateY/);assert.match(frames[0].transform,/rotate/);
});
