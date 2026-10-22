import '../scripts/common.mjs';
import {chromium, type Page, type Locator} from 'playwright';
import {expect} from '../../frontend/node_modules/@playwright/test/index.mjs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import path from 'node:path';

const rehearsal = process.argv.includes('--rehearsal');
const highResolution=process.argv.includes('--4k');
const viewport=highResolution?{width:3840,height:2160}:{width:1920,height:1080};
const displayZoom=highResolution?2:1;
const output = rehearsal ? '.local/rehearsal' : highResolution?'public/generated/production/recordings-4k':'public/generated/production/recordings';
await mkdir(output,{recursive:true});
const timeline = rehearsal ? [] : JSON.parse(await readFile('planning/timeline.json','utf8'));
const logs: Record<string,unknown>[] = [];
let epoch=performance.now();
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport,deviceScaleFactor:1,locale:'en-US',...(rehearsal?{}:{recordVideo:{dir:output,size:viewport}})});
const page=await context.newPage();
if(highResolution)await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{document.documentElement.style.zoom='2';document.body.style.width='1920px';}));
const errors:string[]=[];
page.on('pageerror',e=>errors.push(e.message));
page.setDefaultTimeout(12000);
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function click(locator:Locator,label:string){
  await locator.scrollIntoViewIfNeeded();
  const box=await locator.boundingBox();
  if(box)await page.mouse.move(box.x+box.width/2,box.y+box.height/2,{steps:highResolution?4:20});
  if(!rehearsal)await wait(180);
  logs.push({event:'click',target:label,time:(performance.now()-epoch)/1000,box});
  await locator.click();
}
const button=(name:string)=>page.getByRole('button',{name,exact:true});
async function nav(name:string){await click(button(name),name);await page.getByRole('heading',{level:1}).waitFor();}
const closeReview=async()=>{if(await page.getByRole('dialog').count())await click(button('Close review'),'Close review');};
const actions:Record<string,()=>Promise<void>>={
  overview:async()=>{await expect(page.getByRole('table')).toBeVisible();await page.getByRole('table').scrollIntoViewIfNeeded();},
  reject:async()=>{await nav('Physics compiler');await click(button('Compile & attest'),'Compile flagged slice');await expect(page.getByText('Rejected',{exact:true})).toBeVisible();await expect(page.getByText(/observed 108.2/)).toBeVisible();await expect(page.getByText(/INDIRECT PROMPT INJECTION · QUARANTINED/)).toBeVisible();},
  attest:async()=>{await page.getByLabel('Experimental slice',{exact:true}).selectOption('slice_catalysis_oer_nife_001');await click(button('Compile & attest'),'Compile eligible benchmark');await click(page.getByRole('button',{name:/Inspect attestation/}),'Inspect attestation');await expect(page.getByRole('button',{name:/Formal verification/})).toBeVisible();await click(page.getByRole('button',{name:/Priority attestation/}),'Inspect priority record');await expect(page.getByText(/demo_merkle_oer_001/)).toBeVisible();},
  propose:async()=>{await nav('Data exchange');await click(button('Propose exchange'),'Propose exchange');await click(button('Review authorization'),'Review agreement');await expect(page.getByRole('dialog')).toBeVisible();await expect(button('Approve as Lab A PI')).toBeVisible();},
  first:async()=>{await click(button('Approve as Lab A PI'),'First PI approval');await expect(button('Approval recorded')).toBeVisible();await expect(page.getByText('Data release remains locked')).toBeVisible();},
  second:async()=>{await click(button('Approve as Lab B PI'),'Second PI approval');await expect(page.getByText('Simulated exchange settled')).toBeVisible();},
  catalysis:async()=>{await closeReview();await nav('Scientific analytics');await expect(page.getByText('42.5 mV/dec')).toBeVisible();await expect(page.getByText(/Causal guardrail/)).toBeVisible();},
  battery:async()=>{await click(button('Battery cycling'),'Battery cycling');await expect(page.getByRole('heading',{name:'Differential capacity',exact:true})).toBeVisible();const plot=page.locator('.scientific-plot').first();const curve=plot.locator('.recharts-line-curve').first();const before=await curve.getAttribute('d');const handle=plot.locator('.recharts-brush-traveller').last();await handle.scrollIntoViewIfNeeded();const box=await handle.boundingBox();if(!box)throw new Error('Chart range handle missing');await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x-120,box.y+box.height/2,{steps:30});await page.mouse.up();await expect.poll(()=>curve.getAttribute('d')).not.toBe(before);logs.push({event:'range-changed',time:(performance.now()-epoch)/1000});},
  context:async()=>{const warning=page.getByText(/Temperature and electrolyte are confounders/);await warning.scrollIntoViewIfNeeded();await expect(warning).toBeVisible();},
  vault:async()=>{await nav('Data vault');await click(button('Stake failure data'),'Deposit eligible failure slice');await expect(page.getByText('Minted SciCredit')).toBeVisible();await expect(button('Deposit recorded')).toBeDisabled();},
  market:async()=>{await nav('Buy data');await click(page.getByRole('button',{name:'Buy data: NiFe-LDH OER kinetics',exact:true}),'Select benchmark for purchase');await click(button('Request data access'),'Request access');await expect(page.getByText('HTTP 402 · Payment required')).toBeVisible();if(!rehearsal)await wait(1700);await click(button('Pay SciCredit & acquire'),'Authorize simulated credit purchase');await expect(page.getByText('Simulated purchase confirmed')).toBeVisible();const event=page.waitForEvent('download');await click(button('Download data'),'Download authorized fixture');const download=await event;await download.saveAs(path.join(output,'acquired-demo.csv'));logs.push({event:'download',filename:download.suggestedFilename(),time:(performance.now()-epoch)/1000});await expect(button('Download data')).toBeVisible();},
};
try{
  await page.goto('http://127.0.0.1:5178');
  await page.getByRole('table').waitFor();
  await page.getByRole('combobox',{name:'Language',exact:true}).selectOption('en');
  await expect(page.getByText('Demo mode · simulated')).toBeVisible();
  await page.evaluate((zoom)=>{
    const cursor=document.createElement('div');cursor.id='recording-cursor';cursor.setAttribute('aria-hidden','true');cursor.style.cssText='position:fixed;left:-50px;top:-50px;width:24px;height:24px;border:2px solid #67e8f9;background:#22d3ee22;border-radius:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:2147483647;box-shadow:0 0 15px #22d3ee55';document.body.append(cursor);document.addEventListener('mousemove',e=>{cursor.style.left=e.clientX/zoom+'px';cursor.style.top=e.clientY/zoom+'px';});
  },displayZoom);
  epoch=performance.now();
  const scenes=rehearsal?JSON.parse(await readFile('narration/script.json','utf8')).filter((s:{kind:string})=>s.kind==='demo'):timeline.filter((s:{kind:string})=>s.kind==='demo');
  for(const scene of scenes){
    if(scene.action==='market'){await page.reload();await page.getByRole('table').waitFor();logs.push({event:'fresh-demo-session',reason:'Show independent credit purchase without prior barter grants; loading is cut before the scene',time:(performance.now()-epoch)/1000});}
    const start=performance.now();
    if(!rehearsal)await wait(500);
    await actions[scene.action]();
    if(!highResolution)await page.screenshot({path:path.join(output,scene.id+'.png')});
    const elapsed=(performance.now()-start)/1000;
    const duration=rehearsal?elapsed+0.3:scene.duration;
    if(elapsed>duration-0.2&&!rehearsal)throw new Error(`Actions exceed scene duration: ${scene.id} ${elapsed}/${duration}`);
    await wait(Math.max(0,(duration-elapsed)*1000));
    logs.push({event:'scene',id:scene.id,start:(start-epoch)/1000,end:(performance.now()-epoch)/1000,duration,verified:true});
    console.log('Verified scene',scene.id,Math.round(duration*100)/100);
  }
  if(errors.length)throw new Error(errors.join('\n'));
  await writeFile(path.join(output,'interaction-log.json'),JSON.stringify({rehearsal,viewport,displayZoom,mode:'mock',errors,logs},null,2));
  const video=page.video();
  await context.close();
  if(video)await video.saveAs(path.join(output,'walkthrough.webm'));
}catch(error){await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});await writeFile(path.join(output,'failure.txt'),String(error));await writeFile(path.join(output,'failed-interaction-log.json'),JSON.stringify({rehearsal,viewport,displayZoom,mode:'mock',errors,logs},null,2));throw error;}
finally{await browser.close();}
