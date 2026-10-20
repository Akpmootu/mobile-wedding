"""Browser acceptance checks against an actual local or deployed Node app."""
import asyncio, json, os, urllib.request
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
BASE=os.environ.get('TEST_BASE_URL','http://127.0.0.1:3000').rstrip('/')
async def main():
 with urllib.request.urlopen(BASE+'/api/cards') as response:
  cards=json.load(response)
  source=response.headers.get('x-data-source','unspecified')
 assert len(cards)==8,f'Expected initial 8 cards, got {len(cards)}'
 with urllib.request.urlopen(BASE+'/api/health') as response: health=json.load(response)
 artifact=ROOT/'artifacts';artifact.mkdir(exist_ok=True)
 results={'base':BASE,'public_cards':len(cards),'source':source,'health':health,'viewports':[]}
 async with async_playwright() as p:
  browser=await p.chromium.launch()
  for width,height in [(1440,1000),(390,844)]:
   page=await browser.new_page(viewport={'width':width,'height':height})
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   await page.goto(BASE,wait_until='domcontentloaded')
   await page.locator('.gallery-card').last.wait_for()
   body=await page.locator('body').inner_text()
   assert '1,999' in body and 'MOBILE WEDDING INVITATION' in body
   assert 'ลิงก์เดียวจบ ครบเรื่องการ์ดแต่งงาน' in body
   assert await page.locator('.gallery-card').count()==8
   assert await page.locator('a[href="https://line.me/ti/p/R8xclmk6fX"]').count()>0
   dims=await page.evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})')
   assert dims['scroll']<=width,f'Horizontal overflow {dims}'
   price_pos=await page.evaluate('(()=>{const t=[...document.querySelectorAll("*")].find(e=>e.children.length===0&&e.textContent.includes("1,999"));return t?.getBoundingClientRect().top+scrollY;})()')
   gallery_pos=await page.locator('#collection').evaluate('(e)=>e.getBoundingClientRect().top+scrollY')
   assert price_pos<gallery_pos,'Price must precede gallery'
   await page.locator('#search').fill('Mai & Benz');assert await page.locator('.gallery-card').count()==1
   await page.locator('#search').fill('')
   await page.locator('.cover-button').filter(has=page.locator('img[alt="ภาพหน้าปก Mai & Benz"]')).click()
   await page.locator('#detail-dialog').wait_for(state='visible')
   assert await page.locator('#detail-title').inner_text()=='Mai & Benz'
   assert await page.locator('#original-link').get_attribute('href')=='https://maibenz-wedding.netlify.app/'
   await page.keyboard.press('Escape');await page.locator('#detail-dialog').wait_for(state='hidden')
   await page.evaluate('scrollTo(0,0)');await page.screenshot(path=str(artifact/f'wedding-v2-{width}.png'),full_page=True)
   await page.goto(BASE+'/admin.html',wait_until='networkidle')
   assert await page.locator('input[type="password"]').count()==0,'Password fallback must not exist'
   assert 'akaporn1234@gmail.com' in await page.locator('body').inner_text()
   assert not errors,errors
   results['viewports'].append({'width':width,'overflow':False,'details':True,'search':True,'price_before_gallery':True,'no_password_login':True,'js_errors':errors})
   await page.close()
  await browser.close()
 (artifact/'cloud-acceptance.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps(results,ensure_ascii=True,indent=2))
asyncio.run(main())
