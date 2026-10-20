"""Real-browser acceptance for typography, preset, hero, motion and YouTube fallback."""
import asyncio,json,os
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
BASE=os.environ.get('TEST_BASE_URL','http://127.0.0.1:3000').rstrip('/')
async def main():
 artifact=ROOT/'artifacts';artifact.mkdir(exist_ok=True)
 baseline=json.loads((artifact/'fonts-before.json').read_text()) if (artifact/'fonts-before.json').exists() else []
 reports=[]
 async with async_playwright() as p:
  browser=await p.chromium.launch()
  for width,height in [(1440,1000),(390,844),(320,760)]:
   context=await browser.new_context(viewport={'width':width,'height':height})
   page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   await page.goto(BASE,wait_until='domcontentloaded');await page.locator('.gallery-card').last.wait_for()
   await page.wait_for_timeout(1600)
   assert await page.locator('.gallery-card').count()==8
   fonts=await page.evaluate('Object.fromEntries([".hero-description",".story-copy p",".feature-list li"].map(s=>[s,getComputedStyle(document.querySelector(s)).fontSize]))')
   old=next((x['fonts'] for x in baseline if x['width']==width),None)
   if old:
    for selector,value in fonts.items():assert float(value[:-2])>float(old[selector][:-2]),f'Font not enlarged: {selector}'
   assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'Overflow {width}'
   bubble=page.locator('.floating-contact');assert await bubble.is_visible()
   bounds=await bubble.bounding_box();assert bounds is not None;assert bounds['width']>=44 and bounds['height']>=44
   assert bounds['x']+bounds['width']<=width and bounds['y']+bounds['height']<=height
   assert await bubble.get_attribute('href')=='https://line.me/ti/p/R8xclmk6fX'
   assert await page.locator('[data-hero-url]').count()==2
   await page.screenshot(path=str(artifact/f'experience-initial-{width}.png'))
   if await page.locator('#wedding-music-close').is_visible():
    await page.locator('#wedding-music-close').click()
   assert await page.locator('#wedding-music-panel').is_hidden()
   for name in ['DM Wedding 01','Mai & Benz']:
    phone=page.locator('.hero-art').get_by_role('button',name='ดู '+name,exact=True)
    await phone.locator('.hero-phone-caption').click()
    await page.locator('#detail-dialog').wait_for(state='visible')
    assert await page.locator('#detail-title').inner_text()==('DM Wedding01' if name=='DM Wedding 01' else name)
    ratio=await page.locator('.detail-phone .phone-screen').evaluate('(e)=>e.getBoundingClientRect().width/e.getBoundingClientRect().height')
    assert abs(ratio-1320/2868)<.003,ratio
    if name=='Mai & Benz' and width in (1440,390):
     await page.locator('#live-preview').click()
     await page.wait_for_function('document.querySelector("#preview-frame iframe")?.style.width==="440px"')
     frame=page.frame_locator('#preview-frame iframe')
     await frame.locator('body').wait_for(timeout=45000)
     dims=await frame.locator('body').evaluate('()=>({width:innerWidth,height:innerHeight})')
     assert dims=={'width':440,'height':956},dims
     await page.screenshot(path=str(artifact/f'experience-live-{width}.png'))
    await page.locator('#close-dialog').click();await page.locator('#detail-dialog').wait_for(state='hidden')
   await page.locator('#wedding-music-open').click()
   await page.wait_for_timeout(13500 if width==1440 else 1000)
   status=await page.locator('#wedding-music-status').inner_text()
   panel_bounds=await page.locator('#wedding-music-panel').bounding_box()
   assert panel_bounds is not None
   assert panel_bounds['x']+panel_bounds['width']<=bounds['x'] or panel_bounds['y']+panel_bounds['height']<=bounds['y'],'Music panel overlaps contact bubble'
   iframe=page.locator('iframe#wedding-music-player')
   player_bounds=await iframe.bounding_box() if await iframe.count() else None
   if player_bounds:assert player_bounds['width']>=200 and player_bounds['height']>=200,player_bounds
   playback=[]
   for f in page.frames:
    if 'youtube.com/embed/G5kFdvmxdfo' in f.url:
     for video in await f.locator('video').all():
      try:playback.append(await video.evaluate('(v)=>({paused:v.paused,time:v.currentTime,readyState:v.readyState})'))
      except Exception:pass
   await page.locator('#wedding-music-close').click();assert await page.locator('#wedding-music-panel').is_hidden()
   await page.evaluate('window.scrollTo({top:0,behavior:"instant"})');await page.wait_for_timeout(200)
   await page.screenshot(path=str(artifact/f'experience-clean-{width}.png'))
   assert not errors,errors
   reports.append({'width':width,'fonts':fonts,'no_overflow':True,'hero_details':True,'preset_ratio':ratio,'bubble':bounds,'youtube_status':status,'youtube_player_bounds':player_bounds,'youtube_video_observation':playback,'javascript_errors':errors})
   await context.close()
  await browser.close()
 (artifact/'experience-acceptance.json').write_text(json.dumps({'base':BASE,'reports':reports},ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps({'base':BASE,'reports':reports},ensure_ascii=True,indent=2))
asyncio.run(main())
