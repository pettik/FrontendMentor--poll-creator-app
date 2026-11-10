import './styles.css';
import { icon } from './icons.js';
import { escape as e, avatar, dateInput, resultText, raceSummary } from './utils.js';
import { createPoll, validateDraft, castVote, suggestOption, moderate, endVoting, reopen, pollView } from './domain.js';
import { getWorkspace, readWorkspace, saveWorkspace, startWorkspace, updatePoll, reconcile, turnFor, deletePoll, canPersist, wipeWorkspace, hasStoredData, getStorageIssue } from './storage.js';
import * as views from './views.js';
import { saveShareCard } from './share-card.js';

const root=document.querySelector('#app');
const dialog=document.querySelector('#dialog');
const toastElement=document.querySelector('#toast');
const announcer=document.querySelector('#announcer');
let currentId=null;
let currentPage='';
let dialogAction=null;
let dialogTrigger=null;
let toastAction=null;
let toastTimer;
let announcementFrame;
let liveTimer;
let liveText='';
let lastLiveAnnouncement=0;
const drafts=new Map();
const draftFor=id=>{
  if(!drafts.has(id)) drafts.set(id,{name:'',seed:'Morgan',tint:'cbe2d8',selected:[]});
  return drafts.get(id);
};
const rawPoll=()=>getWorkspace()?.polls.find(p=>p.id===currentId);
const viewPoll=()=>rawPoll()?pollView(rawPoll()):null;
function announce(text) {
  cancelAnimationFrame(announcementFrame);
  announcer.textContent='';
  announcementFrame=requestAnimationFrame(()=>{announcer.textContent=text;});
}
function announceRace(text) {
  liveText=text;
  if(liveTimer)return;
  const delay=Math.max(0,4000-(Date.now()-lastLiveAnnouncement));
  liveTimer=setTimeout(()=>{announce(liveText);lastLiveAnnouncement=Date.now();liveTimer=null;},delay);
}
function toast(message,action=null,label='Undo') {
  clearTimeout(toastTimer);toastAction=action;
  toastElement.innerHTML=`<span role="status">${e(message)}</span>${action?`<button type="button" data-toast-action>${e(label)}</button>`:''}<button type="button" data-toast-close aria-label="Dismiss notification">${icon('close')}</button>`;
  toastElement.hidden=false;
  if(!action) toastTimer=setTimeout(()=>{toastElement.hidden=true;},7500);
}
function setError(id,message) {
  const element=document.getElementById(id);
  if(!element) return;
  element.hidden=!message;
  element.textContent=message?`Please check: ${message}`:'';
}
function focusHeading(selector) {
  const target=document.querySelector(selector||'main h1')||document.querySelector('main h1');
  if(target) {target.tabIndex=-1;target.focus({preventScroll:true});}
}
function captureFocus() {
  const element=document.activeElement;
  if(!root.contains(element))return null;
  let selector;
  if(element.id)selector=`#${CSS.escape(element.id)}`;
  else if(element.dataset.action)selector=`[data-action="${CSS.escape(element.dataset.action)}"]${element.dataset.option?`[data-option="${CSS.escape(element.dataset.option)}"]`:''}`;
  else if(element.name)selector=`[name="${CSS.escape(element.name)}"]${['radio','checkbox'].includes(element.type)?`[value="${CSS.escape(element.value)}"]`:''}`;
  else if(element.hasAttribute('href'))selector=`a[href="${CSS.escape(element.getAttribute('href'))}"]`;
  return {selector,start:element.selectionStart,end:element.selectionEnd};
}
function restoreFocus(saved) {
  if(!saved)return;
  const element=saved.selector?root.querySelector(saved.selector):null;
  if(!element){focusHeading();return;}
  element.focus({preventScroll:true});
  if(typeof saved.start==='number'&&element.setSelectionRange)element.setSelectionRange(saved.start,saved.end);
}
function navigate(path) {
  if(location.hash===`#/${path}`) render();
  else location.hash=`#/${path}`;
}
function openDialog(title,body,actions='',onSubmit=null) {
  if(dialog.open) dialog.close();
  dialogTrigger=document.activeElement;
  dialogAction=onSubmit;
  dialog.innerHTML=views.dialogFrame(title,body,actions,!!onSubmit);
  dialog.querySelectorAll('input,textarea').forEach(field=>field.setAttribute('aria-describedby',[field.getAttribute('aria-describedby'),'dialog-error'].filter(Boolean).join(' ')));
  dialog.showModal();
  const first=dialog.querySelector('input:not([type="hidden"]),textarea');
  if(first) first.focus();
}
function closeDialog() { if(dialog.open) dialog.close(); }
dialog.addEventListener('close',()=>{if(dialog.open)return;dialogAction=null;if(dialogTrigger?.isConnected)dialogTrigger.focus({preventScroll:true});});
dialog.addEventListener('click',event=>{if(event.target.closest('[data-close]'))closeDialog();});
dialog.addEventListener('input',event=>{event.target.removeAttribute('aria-invalid');setError('dialog-error','');});
dialog.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!dialogAction)return;
  const submit=dialog.querySelector('button[type="submit"]');
  if(submit)submit.disabled=true;
  try { const success=await dialogAction(new FormData(event.target));if(success!==false)closeDialog(); }
  catch(error) {setError('dialog-error',error.message);dialog.querySelector('[aria-invalid="true"]')?.focus();}
  finally {if(submit?.isConnected)submit.disabled=false;}
});
toastElement.addEventListener('click',async event=>{
  if(event.target.closest('[data-toast-close]')) {toastElement.hidden=true;return;}
  if(event.target.closest('[data-toast-action]')) {
    const action=toastAction;toastElement.hidden=true;
    try {await action?.();}catch(error){toast(error.message);}
  }
});

function render({focus=true,selector=null}={}) {
  const oldY=scrollY;
  const savedFocus=!focus&&!selector?captureFocus():null;
  let state=readWorkspace();
  try {reconcile();}catch(error){toast(error.message);}
  state=getWorkspace();
  let path=location.hash.replace(/^#\/?/,'').split('/');
  currentPage=path[0]||'landing';
  try {currentId=path[1]?decodeURIComponent(path[1]):null;}catch{currentId=null;}
  if(currentPage==='guest') {
    if(state?.polls.length&&!state.demo) {
      history.replaceState(null,'','#/dashboard');
      render({focus:false});requestDemo();return;
    }
    if(!state||!state.demo) {try{state=startWorkspace(true);}catch(error){toast(error.message);currentPage='landing';}}
    if(state)currentPage='dashboard';
  }
  if(['dashboard','settled','new'].includes(currentPage)&&!state) {
    try {state=startWorkspace(false);}catch(error){toast(error.message);currentPage='landing';}
  }
  let content,title='Tiebreak — Good plans start with a decision';
  let voter=currentPage==='vote';
  if(currentPage==='landing')content=views.landing();
  else if(currentPage==='dashboard'||currentPage==='settled') {
    content=views.dashboard(state,state.polls.map(pollView),currentPage==='settled');
    title=`${currentPage==='settled'?'Settled':'My polls'} · Tiebreak`;
  } else if(currentPage==='new') {content=views.newPollPage();title='Create a poll · Tiebreak';}
  else if(['poll','vote','share'].includes(currentPage)) {
    const poll=viewPoll();
    if(!poll){content=views.notFound();title='Poll not found · Tiebreak';}
    else {
      title=`${poll.title}: ${currentPage==='vote'?'your vote':poll.status==='settled'?'the reveal':'live results'} · Tiebreak`;
      if(currentPage==='poll')content=views.pollPage(poll);
      if(currentPage==='share')content=views.sharePage(poll);
      if(currentPage==='vote') {
        let token=state.turns[poll.id];
        if(!token&&poll.status==='open') {try {token=turnFor(poll.id);state=getWorkspace();}catch(error){toast(error.message);}}
        const existing=rawPoll().votes.filter(v=>v.voterToken===token).map(v=>({...v,label:poll.options.find(o=>o.id===v.optionId)?.label||'your choice'}));
        content=views.votePage(poll,draftFor(poll.id),existing);
      }
    }
  } else {content=views.notFound();title='Page not found · Tiebreak';}
  root.innerHTML=views.shell(content,state,currentPage,voter);
  document.title=title;
  if(!canPersist()) {
    const note=document.createElement('div');note.className='notice';note.setAttribute('role','alert');
    note.textContent=getStorageIssue()?.message||'This browser cannot save site data. Allow local storage to create polls and keep votes.';
    if(hasStoredData()&&!state) {const button=document.createElement('button');button.className='button small';button.dataset.action='settings';button.textContent='Workspace settings';note.append(document.createElement('br'),button);}
    root.querySelector('main').prepend(note);
  }
  if(currentPage==='vote')updateCastLabel();
  if(focus) {window.scrollTo(0,0);focusHeading(selector);}
  else if(selector) {focusHeading(selector);window.scrollTo(0,oldY);}
  else {restoreFocus(savedFocus);window.scrollTo(0,oldY);}
}

async function copyText(text,message) {
  try {
    if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(text);
    else throw new Error('fallback');
  } catch {
    const active=document.activeElement;
    const area=document.createElement('textarea');area.value=text;area.style.cssText='position:fixed;left:-9999px;top:0';
    document.body.append(area);area.select();
    const copied=document.execCommand('copy');area.remove();active?.focus({preventScroll:true});
    if(!copied) {openDialog('Copy this result',`<p class="dialog-copy">Select the text below and copy it to your clipboard.</p><textarea rows="8" readonly aria-label="Result to copy">${e(text)}</textarea>`,`<button type="button" class="button dark" data-close>Done</button>`);return;}
  }
  toast(message);
}
const cancelButton='<button type="button" class="button" data-close>Cancel</button>';
function requestDemo() {
  const state=getWorkspace();
  if(!state?.polls.length){startWorkspace(true);navigate('guest');return;}
  openDialog('Set the demo table?',`<p class="dialog-copy">This replaces the polls saved in this browser with Morgan’s five sample polls. Your current polls will be removed.</p>`,`${cancelButton}<button type="submit" class="button dark">Replace with demo</button>`,()=>{startWorkspace(true);closeDialog();navigate('guest');toast('Morgan’s table is ready to explore.');});
}
function settings() {
  const state=getWorkspace();
  if(!state) {openDialog('Your browser’s workspace',`<p class="dialog-copy">The stored workspace could not be opened. You can remove its saved data and start fresh.</p>`,`<button type="button" class="button" data-close>Keep data</button><button type="button" class="button dark" data-action="reset">Reset workspace</button>`);return;}
  openDialog('Your table, your rules.',`<p class="dialog-copy">No account needed. This browser is your workspace, so keep using this device to manage your polls.</p><div class="field"><label for="host-name">Your name</label><input id="host-name" name="hostName" type="text" maxlength="40" value="${e(state.creator.name)}" required/></div><div class="notice">Polls and votes are saved only in this browser. Clearing site data removes them. Save result images before you tidy up.</div><div class="compact-links"><button type="button" class="button text small" data-action="demo">${state.demo?'Reset demo polls':'Explore demo'}</button><button type="button" class="button text small" data-action="reset">Start fresh</button></div>`,`${cancelButton}<button type="submit" class="button dark">Save name</button>`,data=>{
    const name=String(data.get('hostName')).trim();
    if(!name||name.length>40) {dialog.querySelector('#host-name').setAttribute('aria-invalid','true');throw new Error('Add a name, up to 40 characters.');}
    const workspace=readWorkspace()||startWorkspace(false);saveWorkspace({...workspace,creator:{...workspace.creator,name}});closeDialog();render({focus:false});toast('Your name is saved.');
  });
}
function suggestionDialog() {
  const poll=viewPoll();
  const draft=draftFor(currentId);
  const existing=rawPoll().votes.find(v=>v.voterToken===getWorkspace().turns[currentId]);
  const identity=existing?.voter||{name:draft.name,avatar:{seed:draft.seed,tint:draft.tint}};
  openDialog('Got a better idea?',`<p class="dialog-copy">The host gets the final call. If approved, your suggestion joins the ballot with 0 votes. It won’t change a vote you’ve already cast.</p><div class="field"><label for="suggestion-name">Your name (required)</label><input id="suggestion-name" name="name" type="text" maxlength="40" value="${e(identity.name)}" required/></div><div class="field"><label for="suggestion-label">Your suggestion (required)</label><input id="suggestion-label" name="label" type="text" maxlength="100" placeholder="The idea they missed" required/></div><p class="suggested">${avatar(identity)}Your current face goes with your idea.</p>`,`${cancelButton}<button type="submit" class="button teal">Send to the host ${icon('arrow')}</button>`,data=>{
    const name=String(data.get('name')).trim();
    const label=String(data.get('label')).trim();
    if(!name){dialog.querySelector('#suggestion-name').setAttribute('aria-invalid','true');throw new Error('Add your name so the host knows whose idea this is.');}
    if(!label){dialog.querySelector('#suggestion-label').setAttribute('aria-invalid','true');throw new Error('Tell us your idea first.');}
    updatePoll(poll.id,p=>suggestOption(p,label,{...identity,name}));
    draft.name=name;
    const nameField=document.querySelector('#voter-name');if(nameField)nameField.value=name;
    updateCastLabel();toast('Idea sent to the host. It’s waiting for approval.');
  });
}

async function action(name,trigger) {
  if(name==='settings'){settings();return;}
  if(name==='how') {openDialog('A plan in three passes.',`<ol class="dialog-copy"><li><strong>1. Ask the question.</strong> Make a poll with 2–10 options and a closing time.</li><li style="margin-top:1rem"><strong>2. Pass the phone.</strong> Each friend chooses a name, a face, and their vote. Tap “Pass to next voter” between people.</li><li style="margin-top:1rem"><strong>3. Reveal the decision.</strong> End voting to see who backed what, then copy the result or save a share card.</li></ol><p class="notice">This is an on-device app. Poll links work only in the browser that created them.</p>`,`<button class="button dark" data-close>Got it</button>`);return;}
  if(name==='demo'){closeDialog();requestDemo();return;}
  if(name==='reset') {
    openDialog('A clean table?',`<p class="dialog-copy">This removes every poll and vote stored by Tiebreak in this browser. Save any result images you want to keep first. This can’t be undone.</p>`,`${cancelButton}<button class="button dark" type="submit">Clear polls & start fresh</button>`,()=>{wipeWorkspace();startWorkspace(false);closeDialog();navigate('dashboard');toast('A clean table, ready for your first poll.');});return;
  }
  if(name==='add-option') {
    const fields=document.querySelector('#option-fields');
    const count=fields.children.length;if(count>=10)return;
    fields.insertAdjacentHTML('beforeend',views.optionField(count));syncOptionFields();fields.lastElementChild.querySelector('input').focus();return;
  }
  if(name==='remove-option') {const row=trigger.closest('.option-field');const input=row.nextElementSibling?.querySelector('input')||row.previousElementSibling?.querySelector('input');row.remove();syncOptionFields();input?.focus();return;}
  const poll=viewPoll();if(!poll)throw new Error('This poll is no longer on the device.');
  if(name==='next-voter') {turnFor(poll.id,true);drafts.delete(poll.id);render();announce('Ready for the next voter. The ballot has no selections.');return;}
  if(name==='suggest'){suggestionDialog();return;}
  if(name==='local-link'){await copyText(new URL(`#/${'vote'}/${encodeURIComponent(poll.id)}`,location.href).href,'Local link copied. It opens this poll in this browser only.');return;}
  if(name==='copy-result'){if(poll.status!=='settled')throw new Error('Close voting before copying the final result.');await copyText(resultText(poll,''),'Result copied. Paste it into the group chat.');return;}
  if(name==='download') {trigger.disabled=true;try{await saveShareCard(poll);toast('Result image saved for the group chat.');}finally{trigger.disabled=false;}return;}
  if(name==='approve'||name==='decline') {
    const option=poll.pending.find(o=>o.id===trigger.dataset.option);if(!option)return;
    updatePoll(poll.id,p=>moderate(p,option.id,name==='approve'?'approved':'declined'));
    render({focus:false,selector:'#moderation-title'});
    const message=name==='approve'?`${option.label} added to the ballot with 0 votes.`:`${option.suggestedBy.name}’s suggestion declined.`;
    toast(message,name==='decline'?()=>{updatePoll(poll.id,p=>moderate(p,option.id,'pending'));render({focus:false,selector:'#moderation-title'});toast(`${option.suggestedBy.name}’s suggestion is back for review.`);}:null);return;
  }
  if(name==='end') {
    openDialog('Ready to make the call?',`<p class="dialog-copy">Voting will close for “${e(poll.title)}” and everyone’s choices will be revealed. You can reopen it later, keeping all votes.</p>`,`${cancelButton}<button class="button dark" type="submit">End voting & reveal</button>`,()=>{updatePoll(poll.id,endVoting);closeDialog();render();announce('Voting closed. The crew’s choices are revealed.');});return;
  }
  if(name==='reopen') {
    openDialog('Put it back on the table?',`<p class="dialog-copy">The decision becomes open again. Existing votes stay final, and new voters can join in. Choose a new deadline.</p><div class="field"><label for="reopen-deadline">New closing time (required)</label><input id="reopen-deadline" name="closesAt" type="datetime-local" value="${dateInput(24)}" min="${dateInput(.02)}" required/></div>`,`${cancelButton}<button class="button teal" type="submit">Reopen voting</button>`,data=>{const value=String(data.get('closesAt'));if(!Number.isFinite(Date.parse(value))||Date.parse(value)<=Date.now())dialog.querySelector('input').setAttribute('aria-invalid','true');updatePoll(poll.id,p=>reopen(p,value));closeDialog();render();toast('Voting is open again. All earlier votes are kept.');});return;
  }
  if(name==='delete') {
    openDialog('Take this off the table?',`<p class="dialog-copy">Delete “${e(poll.title)}”, including every vote and suggestion? This can’t be undone.</p>`,`${cancelButton}<button class="button dark" type="submit">Delete poll</button>`,()=>{deletePoll(poll.id);closeDialog();navigate('dashboard');toast('Poll deleted.');});return;
  }
}
document.addEventListener('click',event=>{
  const target=event.target.closest('[data-action]');if(!target||target.disabled)return;
  if(target.tagName==='A')event.preventDefault();
  Promise.resolve(action(target.dataset.action,target)).catch(error=>toast(error.message));
});
function syncOptionFields() {
  const rows=[...document.querySelectorAll('.option-field')];
  rows.forEach((row,i)=>{row.querySelector('.option-number').textContent=String(i+1).padStart(2,'0');row.querySelector('input').setAttribute('aria-label',`Option ${i+1}`);const button=row.querySelector('button');button.hidden=rows.length<=2;button.setAttribute('aria-label',`Remove option ${i+1}`);});
  document.querySelector('#option-counter').textContent=`${rows.length} of 10`;
  document.querySelector('[data-action="add-option"]').disabled=rows.length>=10;
  document.querySelector('#max-choices').max=String(rows.length);
}
function updateCastLabel() {
  const button=document.querySelector('#cast-button');if(!button)return;
  const draft=draftFor(currentId);const poll=viewPoll();
  const selections=poll?.options.filter(o=>draft.selected.includes(o.id))||[];
  button.disabled=!draft.name.trim()||!selections.length;
  const text=selections.length===1?`Cast my vote for ${selections[0].label}`:selections.length?`Cast my ${selections.length} picks`:'Cast my vote';
  button.innerHTML=`${e(text)} ${icon('arrow')}`;
  button.setAttribute('aria-label',selections.length?`Cast my vote for ${selections.map(o=>o.label).join(' and ')}`:'Cast my vote');
}
function readVoteDraft() {
  const form=document.querySelector('#vote-form');if(!form)return;
  const draft=draftFor(currentId);
  draft.name=form.elements.voterName.value;
  draft.seed=form.elements.face.value;
  draft.tint=form.elements.tint.value;
  draft.selected=[...form.querySelectorAll('input[name="choice"]:checked')].map(input=>input.value);
}
root.addEventListener('input',event=>{
  if(event.target.closest('#vote-form')) {
    readVoteDraft();
    const draft=draftFor(currentId);
    if(event.target.name==='voterName'){setError('name-error','');event.target.removeAttribute('aria-invalid');}
    updateCastLabel();
    if(['face','tint'].includes(event.target.name)) {
      document.querySelector('#avatar-preview').innerHTML=avatar({name:draft.name,avatar:{seed:draft.seed,tint:draft.tint}},'xl');
      if(event.target.name==='tint')document.querySelectorAll('.face-choice').forEach(label=>{const seed=label.querySelector('input').value;label.querySelector('.avatar').outerHTML=avatar({avatar:{seed,tint:draft.tint}});});
    }
  }
});
root.addEventListener('change',event=>{
  if(event.target.id==='vote-type')document.querySelector('#max-choices-field').hidden=event.target.value!=='multi';
  if(event.target.name==='choice') {
    readVoteDraft();const draft=draftFor(currentId);const poll=viewPoll();
    if(draft.selected.length>poll.maxChoices){event.target.checked=false;readVoteDraft();setError('choice-error',`Pick up to ${poll.maxChoices} options.`);announce(`Pick up to ${poll.maxChoices} options.`);}
    else setError('choice-error','');
    updateCastLabel();
  }
});
root.addEventListener('submit',event=>{
  event.preventDefault();
  if(event.target.id==='new-poll-form') {
    const form=event.target;const data=new FormData(form);
    const draft={title:data.get('title'),options:data.getAll('option'),type:data.get('type'),maxChoices:+data.get('maxChoices'),closesAt:data.get('closesAt'),suggestionsEnabled:data.has('suggestionsEnabled')};
    const errors=validateDraft(draft);
    for(const key of ['title','options','maxChoices','closesAt'])setError(`${key}-error`,errors[key]);
    form.querySelectorAll('[aria-invalid]').forEach(field=>field.removeAttribute('aria-invalid'));
    if(Object.keys(errors).length) {
      const invalid=[];
      for(const key of Object.keys(errors)) {
        let field=form.querySelector(`[name="${key}"]`);
        if(key==='options') {
          const fields=[...form.querySelectorAll('input[name="option"]')];
          const labels=fields.map(input=>input.value.trim().replace(/\s+/g,' ').toLocaleLowerCase());
          field=fields.find((input,index)=>!labels[index]||input.value.trim().length>100||labels.indexOf(labels[index])!==index)||fields[0];
        }
        if(field){field.setAttribute('aria-invalid','true');invalid.push(field);}
      }
      invalid[0]?.focus();announce(Object.values(errors).join(' '));return;
    }
    try {const poll=createPoll(draft);const workspace=readWorkspace()||startWorkspace(false);saveWorkspace({...workspace,polls:[...workspace.polls,poll]});navigate(`share/${poll.id}`);toast('Poll created. Time to bring in the crew.');}
    catch(error){setError('form-error',error.message);}
  }
  if(event.target.id==='vote-form') {
    readVoteDraft();const draft=draftFor(currentId);const poll=viewPoll();
    if(!draft.name.trim()){setError('name-error','Add a name so the crew knows who voted.');const field=document.querySelector('#voter-name');field.setAttribute('aria-invalid','true');field.focus();return;}
    if(!draft.selected.length){setError('choice-error','Pick an option before casting your vote.');document.querySelector('input[name="choice"]')?.focus();return;}
    const selections=poll.options.filter(o=>draft.selected.includes(o.id));
    const ballot={token:getWorkspace().turns[poll.id],voter:{name:draft.name,avatar:{seed:draft.seed,tint:draft.tint}},optionIds:[...draft.selected]};
    openDialog('Lock in your vote?',`<p class="dialog-copy">${e(draft.name)}, you’re backing:</p><ul class="dialog-choices">${selections.map(o=>`<li>${e(o.label)}</li>`).join('')}</ul><p class="dialog-copy">Once it’s in, it’s final. No takebacks.</p>`,`${cancelButton}<button type="submit" class="button teal">Yes, cast my vote ${icon('check')}</button>`,()=>{
      try {updatePoll(poll.id,p=>castVote(p,ballot));closeDialog();render();announce(`Your vote is counted, ${draft.name}. It is final.`);}
      catch(error){if(viewPoll()?.status==='settled'){closeDialog();render();toast(error.message);}else throw error;}
    });
  }
});
window.addEventListener('hashchange',()=>{clearTimeout(liveTimer);liveTimer=null;closeDialog();toastElement.hidden=true;render();});
window.addEventListener('storage',event=>{
  if(event.key!==null&&event.key!=='tiebreak.workspace.v1')return;
  if(currentPage==='new'){readWorkspace();announceRace('Other polls on this device have updated. Your draft is kept.');return;}
  readVoteDraft();
  readWorkspace();render({focus:false});
  announceRace(viewPoll()?raceSummary(viewPoll()):'The polls on this device have updated.');
});
root.addEventListener('error',event=>{if(event.target.matches?.('.avatar img'))event.target.remove();},true);
setInterval(()=>{
  try {
    const priorStatus=rawPoll()?.status;
    const priorIssue=getStorageIssue()?.kind;
    if(!reconcile())return;
    if(currentPage==='new'||currentPage==='share'||currentPage==='landing')return;
    if(['poll','vote'].includes(currentPage)&&rawPoll()?.status===priorStatus&&getStorageIssue()?.kind===priorIssue)return;
    readVoteDraft();render({focus:false});
    announceRace(viewPoll()?raceSummary(viewPoll()):'Voting has closed. The final results are ready.');
  }catch(error){toast(error.message);}
},1500);
function announceVoterState() {
  if(currentPage!=='vote')return;
  const poll=viewPoll();if(!poll)return;
  if(poll.status==='settled'){announce('Voting is closed. The final result and the crew’s choices are revealed.');return;}
  const token=getWorkspace().turns[poll.id];
  const vote=rawPoll().votes.find(vote=>vote.voterToken===token);
  if(vote)announce(`Your vote is already counted, ${vote.voter.name}. It is final. Pass the phone to start the next person’s turn.`);
}
window.addEventListener('hashchange',announceVoterState);
render({focus:false});
announceVoterState();
