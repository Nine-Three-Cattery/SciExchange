import '../scripts/common.mjs';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width:1920,height:1080}});
  await page.goto('http://127.0.0.1:5178');
  await page.getByRole('table').waitFor();
  await page.getByRole('combobox',{name:'Language',exact:true}).selectOption('en');
  await mkdir('.local/exploration',{recursive:true});
  await page.screenshot({path:'.local/exploration/overview.png'});
  const report: Record<string,unknown> = {mode:await page.getByText('Demo mode · simulated').isVisible(),views:{}};
  for(const view of ['Physics compiler','Data exchange','Scientific analytics','Data vault','Buy data']) {
    await page.getByRole('button',{name:view,exact:true}).click();
    await page.getByRole('heading',{level:1}).waitFor();
    (report.views as Record<string,unknown>)[view] = {text:(await page.locator('main').innerText()).slice(0,10000),buttons:await page.getByRole('button').allTextContents()};
    await page.screenshot({path:`.local/exploration/${view.replaceAll(' ','-')}.png`});
  }
  await writeFile('.local/exploration/report.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}finally{await browser.close();}
