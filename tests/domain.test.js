import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateDraft, createPoll, castVote, suggestOption, moderate, endVoting, reopen, pollView, settleDue, seedWorkspace } from '../src/domain.js';

const now=Date.parse('2026-11-09T18:00:00Z');
const draft=(extras={})=>({title:'Dinner?',options:['Pizza','Tacos'],type:'single',maxChoices:1,closesAt:new Date(now+3600000).toISOString(),suggestionsEnabled:true,...extras});
const poll=(extras={})=>createPoll(draft(extras),now);
const voter={name:'Ada',avatar:{seed:'Ada',tint:'f6e0a4'}};
const ballot=(p,extra={})=>({token:'a-unique-turn',voter,optionIds:[p.options[0].id],...extra});

test('creation requires 2–10 distinct, named options and a future deadline',()=>{
  for(const options of [[],['Pizza'],Array.from({length:11},(_,i)=>`Idea ${i}`),['Pizza',' pizza '],['Pizza','']])assert.ok(validateDraft(draft({options}),now).options);
  assert.ok(validateDraft(draft({closesAt:new Date(now).toISOString()}),now).closesAt);
  assert.ok(validateDraft(draft({title:' '}),now).title);
  assert.deepEqual(validateDraft(draft(),now),{});
});
test('multi-choice max is bounded by option count and requires at least two',()=>{
  assert.ok(validateDraft(draft({type:'multi',maxChoices:3}),now).maxChoices);
  assert.ok(validateDraft(draft({type:'multi',maxChoices:1}),now).maxChoices);
});
test('identical vote retries are idempotent, including after closing',()=>{
  const p=poll();const b=ballot(p);const voted=castVote(p,b,now);
  assert.equal(castVote(voted,b,now),voted);
  const closed=endVoting(voted,now+1000);
  assert.equal(castVote(closed,b,now+2000),closed);
  assert.equal(closed.votes.length,1);
});
test('a token cannot change or append to its final vote',()=>{
  const p=poll();const voted=castVote(p,ballot(p),now);
  assert.throws(()=>castVote(voted,ballot(p,{optionIds:[p.options[1].id]}),now),/already in/);
});
test('settled and expired polls reject new votes even before reconciliation',()=>{
  const p=poll();
  assert.throws(()=>castVote(endVoting(p,now),ballot(p),now),/closed/);
  assert.throws(()=>castVote(p,ballot(p),now+3600000),/closed/);
});
test('single-choice rejects multiple picks; multi-choice deduplicates selections',()=>{
  const p=poll();assert.throws(()=>castVote(p,ballot(p,{optionIds:p.options.map(o=>o.id)}),now),/up to 1/);
  const multi=poll({type:'multi',maxChoices:2});const voted=castVote(multi,ballot(multi,{optionIds:[multi.options[0].id,multi.options[0].id,multi.options[1].id]}),now);
  assert.equal(voted.votes.length,2);assert.equal(pollView(voted).totalVoters,1);assert.equal(pollView(voted).totalSelections,2);
});
test('pending suggestions cannot receive votes',()=>{
  const p=suggestOption(poll(),'Noodles',voter,now);
  assert.throws(()=>castVote(p,ballot(p,{optionIds:[p.options.at(-1).id]}),now),/not on the ballot/);
  assert.equal(pollView(p).options.length,2);
});
test('approval adds an attributed option with zero votes and cannot run twice',()=>{
  const p=suggestOption(poll(),'Noodles',voter,now);const id=p.options.at(-1).id;
  const approved=moderate(p,id,'approved',now);
  const view=pollView(approved).options.find(o=>o.id===id);
  assert.equal(view.count,0);assert.equal(view.suggestedBy.name,'Ada');
  assert.throws(()=>moderate(approved,id,'approved',now),/already/);
});
test('a declined suggestion must be explicitly undone before approval',()=>{
  const p=suggestOption(poll(),'Noodles',voter,now);const id=p.options.at(-1).id;
  const declined=moderate(p,id,'declined',now);
  assert.throws(()=>moderate(declined,id,'approved',now),/already/);
  const restored=moderate(declined,id,'pending',now);
  assert.equal(moderate(restored,id,'approved',now).options.at(-1).suggestionStatus,'approved');
});
test('approved ballot never exceeds ten options',()=>{
  const p=suggestOption(poll({options:Array.from({length:10},(_,i)=>`Idea ${i}`)}),'Noodles',voter,now);
  assert.throws(()=>moderate(p,p.options.at(-1).id,'approved',now),/10 options/);
});
test('suggestions respect the toggle, duplicate labels, and the deadline',()=>{
  assert.throws(()=>suggestOption(poll({suggestionsEnabled:false}),'Noodles',voter,now),/original options/);
  assert.throws(()=>suggestOption(poll(),' pizza ',voter,now),/already/);
  assert.throws(()=>suggestOption(poll(),'Noodles',voter,now+3600000),/closed/);
});
test('auto-close records the exact deadline, without needing an open page',()=>{
  const p=poll();assert.equal(settleDue([p],now)[0],p);
  const settled=settleDue([p],now+7200000)[0];
  assert.equal(settled.status,'settled');assert.equal(settled.settledAt,p.closesAt);
});
test('reopening requires a new future deadline and retains all original votes',()=>{
  const p=poll();const voted=castVote(p,ballot(p),now);const closed=endVoting(voted,now+1000);
  assert.throws(()=>reopen(closed,new Date(now).toISOString(),now+2000),/future/);
  const opened=reopen(closed,new Date(now+7200000).toISOString(),now+2000);
  assert.equal(opened.status,'open');assert.deepEqual(opened.votes,voted.votes);
  assert.throws(()=>castVote(opened,ballot(p,{optionIds:[p.options[1].id]}),now+3000),/already/);
});
test('results derive counts from vote records and reveal backers only when settled',()=>{
  const p=poll();const voted=castVote(p,ballot(p),now);
  const open=pollView(voted);assert.equal(open.options[0].count,1);assert.deepEqual(open.options[0].backers,[]);assert.equal(open.votes,undefined);
  const closed=pollView(endVoting(voted,now+1000));assert.equal(closed.options[0].backers[0].name,'Ada');
});
test('demo seeding preserves all 32 votes, offsets, suggestions, and zero state',async()=>{
  const dataset=JSON.parse(await readFile(new URL('../data/sample-polls.json',import.meta.url),'utf8'));
  const state=seedWorkspace(dataset,now);
  assert.equal(state.polls.length,5);assert.equal(state.polls.reduce((sum,p)=>sum+p.votes.length,0),32);
  assert.equal(state.polls.filter(p=>p.status==='open').length,3);
  for(const p of state.polls.filter(p=>p.status==='open'))assert.ok(Date.parse(p.closesAt)>now);
  assert.equal(pollView(state.polls[0]).pending.length,1);
  assert.equal(pollView(state.polls[0]).options[0].count,5);
  assert.equal(pollView(state.polls.at(-1)).totalVoters,0);
  assert.equal(state.polls[0].shareUrl,undefined);
});
