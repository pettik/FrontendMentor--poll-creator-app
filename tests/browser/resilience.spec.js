import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';

const key='tiebreak.workspace.v1';
const nameField=page=>page.getByRole('textbox',{name:'Your name (required)',exact:true});
async function startVote(page){await page.goto('/#/guest');await page.goto('/#/vote/pizza-night');await nameField(page).fill('Alex');await page.getByRole('radio',{name:/Pepperoni/}).check();}
async function setWriteFailure(page){await page.evaluate(()=>{const write=Storage.prototype.setItem;window.restoreStorage=()=>{Storage.prototype.setItem=write;};Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError');};});}

test('a failed final vote keeps the ballot and retries exactly once',async({page})=>{
  await startVote(page);
  await page.getByRole('button',{name:/Cast my vote for Pepperoni/}).click();
  await setWriteFailure(page);
  await page.getByRole('button',{name:'Yes, cast my vote'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('couldn’t save your changes');
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).polls[0].votes.length,key)).toBe(11);
  await page.evaluate(()=>window.restoreStorage());
  await page.getByRole('button',{name:'Yes, cast my vote'}).click();
  await expect(page.getByRole('heading',{name:'You’re in, Alex.'})).toBeVisible();
  await page.reload();await expect(page.getByRole('heading',{name:'You’re in, Alex.'})).toBeVisible();
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).polls[0].votes.length,key)).toBe(12);
});

test('an expired ballot closes visibly even when storage is full',async({page})=>{
  await page.goto('/#/guest');await page.goto('/#/vote/pizza-night');
  await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key));state.polls[0].closesAt=new Date(Date.now()+400).toISOString();localStorage.setItem(key,JSON.stringify(state));},key);
  await setWriteFailure(page);
  await expect(page.getByText('Voting is closed. Here’s the plan.')).toBeVisible({timeout:5000});
  await expect(nameField(page)).not.toBeVisible();
  await expect(page.getByRole('alert')).toContainText('couldn’t save your changes');
  await page.evaluate(()=>window.restoreStorage());
  await expect(page.getByRole('alert')).not.toBeVisible({timeout:5000});
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).polls[0].status,key)).toBe('settled');
});

test('damaged nested storage is preserved until a confirmed reset',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/#/guest');
  const damaged=await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key));state.polls[0].options=null;const raw=JSON.stringify(state);localStorage.setItem(key,raw);return raw;},key);
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Saved data could not be read');
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(damaged);
  await page.getByRole('button',{name:'Workspace settings'}).click();
  await page.getByRole('button',{name:'Reset workspace',exact:true}).click();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  expect(await page.evaluate(key=>localStorage.getItem(key),key)).toBe(damaged);
  await page.getByRole('button',{name:'Workspace settings'}).click();
  await page.getByRole('button',{name:'Reset workspace',exact:true}).click();
  await page.getByRole('button',{name:'Clear polls & start fresh'}).click();
  await expect(page.getByRole('heading',{name:'What are we deciding?'})).toBeVisible();
  expect(errors).toEqual([]);
});

test('creation errors focus the actual empty option and removing the first row keeps focus',async({page})=>{
  await page.goto('/#/new');
  await page.getByLabel('What are we deciding?').fill('The next plan?');
  await page.getByRole('textbox',{name:'Option 1',exact:true}).fill('Pizza');
  await page.getByRole('textbox',{name:'Option 2',exact:true}).fill('Tacos');
  await page.getByRole('button',{name:'Add an option'}).click();
  await page.getByRole('button',{name:'Create poll',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Option 3',exact:true})).toBeFocused();
  await page.getByRole('button',{name:'Remove option 1',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Option 1',exact:true})).toHaveValue('Tacos');
  await expect(page.getByRole('textbox',{name:'Option 1',exact:true})).toBeFocused();
});

test('updates in another tab keep the same ballot choice focused and preserve drafts',async({page,context})=>{
  await startVote(page);
  const other=await context.newPage();await other.goto('/#/poll/pizza-night');
  await page.getByRole('radio',{name:/Pepperoni/}).focus();
  await other.getByRole('button',{name:'Add it',exact:true}).click();
  await expect(page.getByRole('radio',{name:/Just order salads/})).toBeVisible();
  await expect(page.getByRole('radio',{name:/Pepperoni/})).toBeFocused();
  await expect(nameField(page)).toHaveValue('Alex');
  await expect(page.getByRole('radio',{name:/Pepperoni/})).toBeChecked();
  await page.goto('/#/new');await page.getByLabel('What are we deciding?').fill('Keep my unfinished question');
  await other.getByRole('button',{name:'End voting',exact:true}).click();await other.getByRole('button',{name:'End voting & reveal'}).click();
  await expect(page.getByLabel('What are we deciding?')).toHaveValue('Keep my unfinished question');
  await other.close();
});

test('local link and copied result are different, and deletion requires confirmation',async({page})=>{
  await page.goto('/#/guest');await page.goto('/#/poll/pizza-night');
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedText=text;}}}));
  await page.getByRole('button',{name:'Copy local link'}).click();
  expect(await page.evaluate(()=>window.copiedText)).toContain('/#/vote/pizza-night');
  await page.getByRole('button',{name:'End voting',exact:true}).click();await page.getByRole('button',{name:'End voting & reveal'}).click();
  await page.getByRole('button',{name:'Copy result'}).click();
  const result=await page.evaluate(()=>window.copiedText);
  expect(result).toContain('5 of 11 votes (45%)');expect(result).toContain('Made with Tiebreak');expect(result).not.toContain('/#/vote/');
  await page.getByRole('button',{name:'Delete poll',exact:true}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Pizza night: what are we ordering?'})).toBeVisible();
  await page.getByRole('button',{name:'Delete poll',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Delete poll',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Your next good plan.'})).toBeVisible();
  expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).polls.length,key)).toBe(4);
});

test('larger crews use exact counts, and broken avatar images retain their tint',async({page})=>{
  await page.goto('/#/guest');
  await page.evaluate(key=>{const state=JSON.parse(localStorage.getItem(key));const poll=state.polls[0];for(let n=0;n<12;n++)poll.votes.push({optionId:'detroit',voter:{name:`Friend ${n}`,avatar:{seed:'Ada',tint:'f6e0a4'}},voterToken:`new-friend-${n}`,castAt:new Date().toISOString()});localStorage.setItem(key,JSON.stringify(state));},key);
  await page.goto('/#/poll/pizza-night');
  await expect(page.getByText('17 of 23 votes · ahead by 14',{exact:true})).toBeVisible();
  await expect(page.locator('.tally')).toHaveCount(0);
  const image=page.locator('.avatar img').first();
  await image.evaluate(image=>image.dispatchEvent(new Event('error')));
  await expect(page.locator('.avatar').first()).toBeVisible();
  await expect(page.locator('.avatar').first().locator('img')).toHaveCount(0);
});

test('long freeform text reflows at 320px and zero-vote results remain shareable',async({page})=>{
  await page.setViewportSize({width:320,height:720});await page.goto('/#/guest');
  await page.evaluate(key=>{
    const state=JSON.parse(localStorage.getItem(key));const poll=state.polls[0];
    poll.title='A'.repeat(140);poll.options[0].label='B'.repeat(100);poll.options[2].label='C'.repeat(100);
    localStorage.setItem(key,JSON.stringify(state));
  },key);
  for(const route of ['/#/dashboard','/#/poll/pizza-night','/#/vote/pizza-night']){
    await page.goto(route);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.goto('/#/poll/birthday-brunch');
  await page.getByRole('button',{name:'End voting',exact:true}).click();await page.getByRole('button',{name:'End voting & reveal'}).click();
  await expect(page.getByRole('heading',{name:'No votes, no winner.'})).toBeVisible();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Save image'}).click();
  await (await download).saveAs('test-results/zero-vote-share-card.png');
});

test('loaded app completes a new voting round offline without external requests',async({page,context})=>{
  const external=[];
  page.on('request',request=>{if(/^https?:/.test(request.url())&&!new URL(request.url()).hostname.match(/^(localhost|127\.0\.0\.1)$/))external.push(request.url());});
  await page.goto('/#/new');await page.evaluate(()=>document.fonts.ready);
  await context.setOffline(true);
  await page.getByLabel('What are we deciding?').fill('Offline dinner?');
  await page.getByRole('textbox',{name:'Option 1',exact:true}).fill('Pizza');await page.getByRole('textbox',{name:'Option 2',exact:true}).fill('Tacos');
  await page.getByRole('button',{name:'Create poll',exact:true}).click();await page.getByRole('link',{name:'Start voting'}).click();
  await nameField(page).fill('Casey');await page.getByRole('radio',{name:'Tacos',exact:true}).check();
  await page.getByRole('button',{name:'Cast my vote for Tacos'}).click();await page.getByRole('button',{name:'Yes, cast my vote'}).click();
  await expect(page.getByRole('heading',{name:'You’re in, Casey.'})).toBeVisible();
  expect(external).toEqual([]);await context.setOffline(false);
});

test('production mobile load records a local performance budget',async({page})=>{
  await page.setViewportSize({width:375,height:812});
  await page.goto('/#/guest');
  const session=await page.context().newCDPSession(page);
  await session.send('Network.enable');await session.send('Network.setCacheDisabled',{cacheDisabled:true});
  await session.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200*1024,uploadThroughput:90*1024});
  await session.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.goto('/#/vote/pizza-night');await page.reload();await expect(nameField(page)).toBeVisible();
  const metrics=await page.evaluate(()=>({
    firstContentfulPaint:performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
    ballotReady:performance.now(),
    transferredBytes:performance.getEntriesByType('resource').reduce((total,entry)=>total+entry.transferSize,0),
  }));
  await writeFile('test-results/local-performance.json',JSON.stringify({profile:'Chrome, 375px, CPU 4x, 200 KiB/s, 150ms latency',...metrics},null,2));
  expect(metrics.ballotReady).toBeLessThan(3000);
  await session.send('Emulation.setCPUThrottlingRate',{rate:1});await session.detach();
  const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();expect(axe.violations).toEqual([]);
});
