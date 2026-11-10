import dataset from '../data/sample-polls.json';
import { settleDue, seedWorkspace } from './domain.js';
import { isWorkspace } from './workspace.js';

const KEY = 'tiebreak.workspace.v1';
let state = null;
let issue = null;
let pendingSettlementSave = false;

const corruptMessage = 'Saved data could not be read. Keep this browser’s data for recovery, or reset it in workspace settings.';
const writeMessage = 'This browser couldn’t save your changes. Free some storage or allow site storage, then try again. Your earlier polls are unchanged.';

export function readWorkspace() {
  let raw;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    issue = {kind: 'unavailable', message: 'This browser cannot access site storage. Allow local storage to create polls and keep votes.'};
    if (state) state = {...state, polls: settleDue(state.polls)};
    return state;
  }
  if (!raw) {
    state = null;
    issue = null;
    pendingSettlementSave = false;
    return state;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
    if (!isWorkspace(parsed)) throw new Error('Invalid workspace');
  } catch {
    state = null;
    issue = {kind: 'corrupt', message: corruptMessage};
    pendingSettlementSave = false;
    return state;
  }
  const polls = settleDue(parsed.polls);
  state = {...parsed, polls};
  pendingSettlementSave = polls.some((poll, index) => poll !== parsed.polls[index]);
  if (issue?.kind !== 'write') issue = null;
  return state;
}

export const getWorkspace = () => state;
export const getStorageIssue = () => issue;
export const canPersist = () => !issue;
export const hasStoredData = () => { try { return !!localStorage.getItem(KEY); } catch { return false; } };

export function saveWorkspace(next) {
  if (issue?.kind === 'corrupt') throw new Error(corruptMessage);
  if (!isWorkspace(next)) throw new Error('The changes couldn’t be saved. Your existing workspace is unchanged.');
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    issue = {kind: 'write', message: writeMessage};
    throw new Error(writeMessage);
  }
  state = next;
  issue = null;
  pendingSettlementSave = false;
  return state;
}

export function startWorkspace(demo = false) {
  readWorkspace();
  if (!state && hasStoredData()) throw new Error(corruptMessage);
  const next = demo ? seedWorkspace(dataset) : {version: 1, creator: {name: 'You', avatar: {seed: 'Morgan', tint: 'cbe2d8'}}, polls: [], turns: {}, demo: false};
  return saveWorkspace(next);
}

function requireWorkspace() {
  readWorkspace();
  if (!state) throw new Error(issue?.message || 'This poll is only available on the device that created it.');
}

export function updatePoll(id, transform) {
  requireWorkspace();
  let found = false;
  const polls = state.polls.map(poll => {
    if (poll.id !== id) return poll;
    found = true;
    return transform(poll);
  });
  if (!found) throw new Error('That poll is no longer on this device.');
  saveWorkspace({...state, polls: settleDue(polls)});
  return state.polls.find(poll => poll.id === id);
}

export function reconcile() {
  const previous = state;
  const priorIssue = issue?.kind;
  readWorkspace();
  const changed = !!previous && !!state && state.polls.some(poll => previous.polls.some(before => before.id === poll.id && before.status !== poll.status));
  if (pendingSettlementSave) {
    // A deadline is true even when persisting it fails. Keep the derived closed
    // state visible and retry persistence later, without a repeating toast.
    try { saveWorkspace(state); } catch { /* The storage notice carries the error. */ }
  }
  return changed || priorIssue !== issue?.kind;
}

export function turnFor(pollId, fresh = false) {
  requireWorkspace();
  let token = Object.hasOwn(state.turns, pollId) ? state.turns[pollId] : null;
  if (!token || fresh) {
    token = crypto.randomUUID();
    saveWorkspace({...state, turns: {...state.turns, [pollId]: token}});
  }
  return token;
}

export function deletePoll(pollId) {
  requireWorkspace();
  const turns = {...state.turns};
  delete turns[pollId];
  saveWorkspace({...state, polls: state.polls.filter(poll => poll.id !== pollId), turns});
}

export function wipeWorkspace() {
  try { localStorage.removeItem(KEY); }
  catch { throw new Error('This browser couldn’t clear the workspace. Allow site storage and try again.'); }
  state = null;
  issue = null;
  pendingSettlementSave = false;
}

readWorkspace();
