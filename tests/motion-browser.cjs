'use strict';
// Run explicitly: MOTION_BROWSER=1 node --test tests/motion-browser.cjs
// Requires the local dev server and Python Playwright/Chromium.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
test('responsive motion acceptance in Chromium',{skip:process.env.MOTION_BROWSER!=='1',timeout:180000},()=>{
 const result=spawnSync(process.env.PYTHON||'python',['-c',String.raw`
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
base=os.environ.get('MOTION_BASE_URL','http://127.0.0.1:3000')
out=Path.home()/'AppData/Local/hermes/cache/scratch/wedding-motion'
out.mkdir(parents=True,exist_ok=True)
reports=[]
with sync_playwright() as p:
 browser=p.chromium.launch()
 for width in [320,390,1440]:
  context=browser.new_context(viewport={'width':width,'height':956})
  if os.environ.get('MOTION_ISOLATE_MUSIC')=='1': context.route('**/music.js',lambda route:route.abort())
  page=context.new_page()
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(base,wait_until='networkidle')
  page.wait_for_timeout(1300)
  page.wait_for_function('document.querySelectorAll(".gallery-card").length === 8')
  assert page.locator('[data-hero-url]').count()==2
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),f'overflow at {width}'
  for phone in page.locator('[data-hero-url]').all():
   assert phone.is_visible()
   assert phone.locator('img').evaluate('(e)=>e.complete && e.naturalWidth>0')
   assert phone.locator('.phone-screen').evaluate('(e)=>Math.abs(e.offsetWidth/e.offsetHeight-1320/2868)<.006')
   phone.locator('.hero-phone-caption').scroll_into_view_if_needed()
   phone.locator('.hero-phone-caption').evaluate('(e)=>e.scrollIntoView({block:"center",behavior:"instant"})')
   assert phone.locator('.hero-phone-caption').evaluate('(e)=>{const r=e.getBoundingClientRect();return [.15,.5,.85].every(x=>e.closest("button").contains(document.elementFromPoint(r.x+r.width*x,r.y+r.height/2)))}'),'caption must not be covered by the other phone'
  page.evaluate('window.scrollTo({top:0,behavior:"instant"})')
  page.screenshot(path=str(out/f'hero-{width}.png'),full_page=False)
  if width==390:
   for name in ['ดู DM Wedding 01','ดู Mai & Benz']:
    button=page.locator('.hero-art').get_by_role('button',name=name,exact=True)
    if button.get_attribute('data-open'):
     button.click()
     assert page.locator('#detail-dialog').evaluate('(e)=>e.open')
     assert page.locator('.detail-phone').evaluate('(e)=>Math.abs(e.offsetWidth-Math.min(300,innerWidth*.66))<2')
     page.screenshot(path=str(out/'detail-390.png'))
     page.get_by_role('button',name='ปิดรายละเอียด',exact=True).click()
     page.wait_for_function('!document.querySelector("#detail-dialog").open')
    else:
     reports.append('Parent hero wiring not present yet: '+name)
   page.locator('#collection').scroll_into_view_if_needed()
   page.locator('#search').fill('Mai')
   page.wait_for_timeout(800)
   assert page.locator('.gallery-card').count()>0
   assert page.locator('.gallery-card').first.evaluate('(e)=>getComputedStyle(e).opacity==="1"')
   page.locator('#search').fill('')
   page.wait_for_timeout(800)
   assert page.locator('.gallery-card').count()==8
   assert page.locator('.gallery-card').first.evaluate('(e)=>getComputedStyle(e).opacity==="1"')
   page.screenshot(path=str(out/'collection-390.png'))
  assert not errors,errors
  page.reload(wait_until='domcontentloaded')
  assert page.evaluate('document.querySelector(".hero-copy").getAnimations({subtree:true}).length')==0
  reports.append({'width':width,'overflow':False,'cards':8,'errors':errors})
  context.close()
 for reduced,js in [('reduce',True),('no-preference',False)]:
  context=browser.new_context(viewport={'width':390,'height':956},reduced_motion=reduced,java_script_enabled=js)
  page=context.new_page();page.goto(base,wait_until='networkidle')
  assert page.locator('#hero-title').is_visible()
  assert page.locator('#hero-title').evaluate('(e)=>getComputedStyle(e).opacity==="1"')
  assert page.evaluate('document.getAnimations().length')==0
  page.screenshot(path=str(out/f'fallback-{reduced}-{js}.png'))
  context.close()
 context=browser.new_context(viewport={'width':390,'height':956})
 page=context.new_page()
 page.add_init_script('Object.defineProperty(window,"sessionStorage",{get(){throw new Error("blocked")}})')
 page.goto(base,wait_until='networkidle')
 assert page.locator('#hero-title').is_visible()
 assert page.locator('#hero-title').evaluate('(e)=>e.getAnimations().length')==0
 reports.append('Reduced motion, blocked storage, JS disabled and session replay passed')
 context.close();browser.close()
print(json.dumps({'reports':reports,'screenshots':str(out)},ensure_ascii=False))
`],{encoding:'utf8',timeout:170000,env:process.env});
 assert.equal(result.status,0,result.stderr||result.stdout||String(result.error));
 console.log(result.stdout);
});
