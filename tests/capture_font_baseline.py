import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
async def main():
 result=[]
 async with async_playwright() as p:
  browser=await p.chromium.launch()
  for width,height in [(1440,1000),(390,844)]:
   page=await browser.new_page(viewport={'width':width,'height':height})
   await page.goto('https://mobile-wedding-ten-chi.vercel.app',wait_until='networkidle')
   sizes=await page.evaluate('Object.fromEntries([".hero-description",".story-copy p",".feature-list li",".wedding-brand>span"].map(s=>[s,getComputedStyle(document.querySelector(s)).fontSize]))')
   result.append({'width':width,'fonts':sizes});await page.close()
  await browser.close()
 out=ROOT/'artifacts'/'fonts-before.json';out.parent.mkdir(exist_ok=True);out.write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result,indent=2))
asyncio.run(main())
