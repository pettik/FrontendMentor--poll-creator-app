import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function demo(page) {await page.goto('/#/guest');await expect(page.getByRole('heading',{name:'Your next good plan.'})).toBeVisible();}
async function noAxeViolations(page) {
  await page.mouse.move(0,0);
  const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
  expect(results.violations).toEqual([]);
}
async function overflow(page) {expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);}

test('landing, guest dashboard, result, and closed result are accessible',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await noAxeViolations(page);
  await page.screenshot({path:'docs/screenshots/landing.png',fullPage:true});
  await page.getByRole('link',{name:'Try as guest',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Your next good plan.'})).toBeVisible();
  await noAxeViolations(page);await overflow(page);
  await page.screenshot({path:'docs/screenshots/dashboard.png',fullPage:true});
  await page.getByRole('link',{name:'View results'}).click();
  await expect(page.getByRole('heading',{name:'Detroit-style from Emmy\'s'})).toBeVisible();
  await expect(page.getByText('5 of 11 votes · ahead by 2',{exact:true})).toBeVisible();
  await noAxeViolations(page);
  await page.screenshot({path:'docs/screenshots/results.png',fullPage:true});
  await page.goto('/#/poll/lake-weekend');
  await expect(page.getByText('THE CREW HAS SPOKEN',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'The A-frame cabin'})).toBeVisible();
  await noAxeViolations(page);await page.screenshot({path:'docs/screenshots/reveal.png',fullPage:true});
  expect(errors).toEqual([]);
});

test('phone ballot: suggestions, final votes, refresh, next voter, and reveal',async({page})=>{
  await page.setViewportSize({width:375,height:812});await demo(page);
  await page.goto('/#/vote/pizza-night');
  await expect(page.getByRole('button',{name:'Cast my vote',exact:true})).toBeDisabled();
  await expect(page.getByRole('radio',{name:/Detroit/})).not.toBeChecked();
  await noAxeViolations(page);await overflow(page);
  await page.getByRole('textbox',{name:'Your name (required)',exact:true}).fill('Alex');
  await page.getByRole('radio',{name:'Face 3',exact:true}).check();
  await page.getByRole('radio',{name:'Lilac background'}).check();
  await page.getByRole('radio',{name:/Pepperoni from Slice House/}).check();
  await page.screenshot({path:'docs/screenshots/vote-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'Suggest something else'}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Your suggestion').fill('Pesto from the corner shop');
  await page.getByRole('button',{name:/Send to the host/}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('radio',{name:/Pepperoni/})).toBeChecked();
  await page.getByRole('button',{name:/Cast my vote for Pepperoni/}).click();
  await noAxeViolations(page);
  await page.getByRole('button',{name:'Yes, cast my vote'}).click();
  await expect(page.getByRole('heading',{name:'You’re in, Alex.'})).toBeVisible();
  await expect(page.getByText('5 of 12 votes · ahead by 1',{exact:true})).toBeVisible();
  await page.reload();await expect(page.getByRole('heading',{name:'You’re in, Alex.'})).toBeVisible();
  await page.getByRole('button',{name:'Pass to next voter'}).click();
  await expect(page.getByRole('textbox',{name:'Your name (required)',exact:true})).toHaveValue('');
  await expect(page.getByRole('radio',{name:/Pepperoni/})).not.toBeChecked();
  await page.getByRole('textbox',{name:'Your name (required)',exact:true}).fill('Robin');
  await page.getByRole('radio',{name:/Pepperoni/}).check();
  await page.getByRole('button',{name:/Cast my vote for Pepperoni/}).click();
  await page.getByRole('button',{name:'Yes, cast my vote'}).click();
  await expect(page.getByRole('heading',{name:'It’s neck and neck.'})).toBeVisible();
  await page.getByRole('link',{name:'Back to host'}).click();
  await page.getByRole('button',{name:'End voting',exact:true}).click();
  await page.getByRole('button',{name:'End voting & reveal'}).click();
  await expect(page.getByText('No single winner. Every tied option gets equal billing.')).toBeVisible();
  await noAxeViolations(page);await overflow(page);
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'Save image'}).click();
  const file=await download;expect(file.suggestedFilename()).toMatch(/\.png$/);
  await file.saveAs('test-results/tie-share-card.png');
});

test('moderation keeps focus, decline undo, reopen retains votes',async({page})=>{
  await demo(page);await page.goto('/#/poll/pizza-night');
  await page.getByRole('button',{name:'Not this time'}).click();
  await expect(page.getByText('Sam’s suggestion declined.')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Pizza night: what are we ordering?'})).toBeFocused();
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  await expect(page.getByRole('button',{name:'Add it',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Add it',exact:true}).click();
  await expect(page.getByText('Just order salads added to the ballot with 0 votes.')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Pizza night: what are we ordering?'})).toBeFocused();
  await page.getByRole('button',{name:'End voting',exact:true}).click();
  await page.getByRole('button',{name:'End voting & reveal'}).click();
  await expect(page.getByText('Individual choices are now revealed.')).toBeVisible();
  await page.getByRole('button',{name:'Reopen voting'}).click();
  await noAxeViolations(page);
  await page.getByRole('dialog').getByRole('button',{name:'Reopen voting'}).click();
  await expect(page.getByText('5 of 11 votes · ahead by 2',{exact:true})).toBeVisible();
  await expect(page.getByText('Voting open',{exact:true})).toBeVisible();
});

test('first run validates and creates a multi-choice poll without templates',async({page})=>{
  await page.goto('/#/dashboard');
  await expect(page.getByRole('heading',{name:'What are we deciding?'})).toBeVisible();
  await page.getByRole('link',{name:'Make your first poll'}).click();
  await page.getByRole('button',{name:'Create poll',exact:true}).click();
  await expect(page.getByLabel('What are we deciding?')).toBeFocused();
  await page.getByLabel('What are we deciding?').fill('Weekend plans?');
  await page.getByRole('textbox',{name:'Option 1',exact:true}).fill('Board games');
  await page.getByRole('textbox',{name:'Option 2',exact:true}).fill('A long walk');
  await page.getByRole('button',{name:'Add an option'}).click();
  await page.getByRole('textbox',{name:'Option 3',exact:true}).fill('A very long coffee');
  await page.getByLabel('How can people vote?').selectOption('multi');
  await noAxeViolations(page);
  await page.getByRole('button',{name:'Create poll',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Your poll is ready. Bring in the crew.'})).toBeVisible();
  await page.getByRole('link',{name:'Start voting'}).click();
  await page.getByRole('textbox',{name:'Your name (required)',exact:true}).fill('Taylor');
  await page.getByRole('checkbox',{name:'Board games',exact:true}).check();
  await page.getByRole('checkbox',{name:'A long walk',exact:true}).check();
  await page.getByRole('checkbox',{name:'A very long coffee',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:'A very long coffee',exact:true})).not.toBeChecked();
  await expect(page.getByText('Please check: Pick up to 2 options.')).toBeVisible();
  await page.getByRole('button',{name:'Cast my vote for Board games and A long walk'}).click();
  await page.getByRole('button',{name:'Yes, cast my vote'}).click();
  await expect(page.getByRole('heading',{name:'You’re in, Taylor.'})).toBeVisible();
  await page.reload();await expect(page.getByRole('heading',{name:'You’re in, Taylor.'})).toBeVisible();
});

test('320px, large text, unknown links, and deadline transitions',async({page})=>{
  await page.setViewportSize({width:320,height:720});await demo(page);await overflow(page);
  await page.goto('/#/vote/pizza-night');await overflow(page);
  await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});await overflow(page);
  await page.evaluate(()=>{document.documentElement.style.fontSize='';});
  await page.goto('/#/poll/does-not-exist');await expect(page.getByRole('heading',{name:'That poll isn’t on this phone.'})).toBeVisible();
  await page.evaluate(()=>{
    const state=JSON.parse(localStorage.getItem('tiebreak.workspace.v1'));
    state.polls.find(p=>p.id==='pizza-night').closesAt=new Date(Date.now()-1000).toISOString();
    localStorage.setItem('tiebreak.workspace.v1',JSON.stringify(state));
  });
  await page.goto('/#/vote/pizza-night');
  await expect(page.getByText('Voting is closed. Here’s the plan.')).toBeVisible();
  await expect(page.getByRole('textbox',{name:'Your name (required)',exact:true})).not.toBeVisible();
  await overflow(page);await noAxeViolations(page);
});

test('keyboard confirms a vote and Escape restores dialog focus',async({page})=>{
  await demo(page);await page.goto('/#/vote/birthday-brunch');
  await page.getByRole('textbox',{name:'Your name (required)',exact:true}).focus();await page.keyboard.type('Keyboard friend');
  await page.getByRole('checkbox',{name:'The Marlowe'}).focus();await page.keyboard.press('Space');
  await page.getByRole('button',{name:'Suggest something else'}).focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'Suggest something else'})).toBeFocused();
  await page.getByRole('button',{name:'Cast my vote for The Marlowe'}).focus();await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'Yes, cast my vote'}).focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('heading',{name:'You’re in, Keyboard friend.'})).toBeVisible();
});
