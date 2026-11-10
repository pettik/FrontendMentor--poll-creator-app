import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isWorkspace } from '../src/workspace.js';
import { seedWorkspace, createPoll, castVote, suggestOption, moderate, endVoting, reopen } from '../src/domain.js';

const dataset=JSON.parse(await readFile(new URL('../data/sample-polls.json',import.meta.url),'utf8'));
const now=Date.parse('2026-11-10T10:00:00Z');
const fresh=()=>seedWorkspace(dataset,now);
const person={name:'Alex',avatar:{seed:'Kai',tint:'e3d2f2'}};

test('the full demo and a new empty workspace are valid stored data',()=>{
  assert.equal(isWorkspace(fresh()),true);
  assert.equal(isWorkspace({...fresh(),polls:[],turns:{},demo:false}),true);
});
test('a complete single-device voting and moderation lifecycle remains readable',()=>{
  const state={...fresh(),polls:[],turns:{},demo:false};
  let poll=createPoll({title:'The plan?',options:['Pizza','Tacos'],type:'multi',maxChoices:2,suggestionsEnabled:true,closesAt:new Date(now+3600000).toISOString()},now);
  poll=castVote(poll,{token:'friend-one',voter:person,optionIds:poll.options.map(option=>option.id)},now);
  poll=suggestOption(poll,'Noodles',person,now);
  poll=moderate(poll,poll.options.at(-1).id,'approved',now);
  poll=endVoting(poll,now+100);
  poll=reopen(poll,new Date(now+7200000).toISOString(),now+200);
  assert.equal(isWorkspace({...state,polls:[poll],turns:{[poll.id]:'friend-one'}}),true);
});
test('damaged nested records and unknown versions are rejected without rendering',()=>{
  for(const bad of [null,[],{}, {...fresh(),version:2}, {...fresh(),creator:null}, {...fresh(),turns:[]}, {...fresh(),demo:'yes'}])assert.equal(isWorkspace(bad),false);
  const changes=[
    poll=>{poll.options=null;}, poll=>{poll.votes=[null];},
    poll=>{poll.closesAt='not a date';}, poll=>{poll.status='closed';},
    poll=>{poll.options[0].suggestedBy.avatar.tint='not-a-color';},
    poll=>{poll.options[0].label={text:'wrong shape'};},
    poll=>{poll.votes[0].voter.avatar=null;},
    poll=>{poll.options.push({...poll.options[0]});},
  ];
  for(const change of changes){const state=fresh();change(state.polls[0]);assert.equal(isWorkspace(state),false);}
});
test('duplicate or foreign votes cannot enter a stored workspace',()=>{
  let state=fresh();state.polls[0].votes.push({...state.polls[0].votes[0]});assert.equal(isWorkspace(state),false);
  state=fresh();state.polls[0].votes[0].optionId='not-on-this-ballot';assert.equal(isWorkspace(state),false);
  state=fresh();state.polls[0].votes[0].optionId='salads';assert.equal(isWorkspace(state),false);
  state=fresh();state.polls.push(structuredClone(state.polls[0]));assert.equal(isWorkspace(state),false);
  state=fresh();state.turns['missing-poll']='some-turn';assert.equal(isWorkspace(state),false);
});
