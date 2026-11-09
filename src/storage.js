import dataset from '../data/sample-polls.json';
import { settleDue, seedWorkspace } from './domain.js';

const KEY = 'tiebreak.workspace.v1';
let state;
let storageAvailable = true;
export function readWorkspace() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) { state = null; return null; }
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1 || !Array.isArray(parsed.polls) || !parsed.creator || !parsed.turns) throw new Error('Invalid workspace');
    state = parsed;
  } catch {
    storageAvailable = false;
    if (state === undefined) state = null;
  }
  return state;
}
readWorkspace();
export const getWorkspace = () => state;
export const canPersist = () => storageAvailable;
export const hasStoredData = () => { try { return !!localStorage.getItem(KEY); } catch { return false; } };
export function saveWorkspace(next) {
  // Serialize before changing memory. A quota failure leaves the old workspace intact.
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
    throw new Error('This browser couldn’t save your changes. Free some storage or allow site storage, then try again. Your earlier polls are unchanged.');
  }
  state = next;
  return state;
}
export function startWorkspace(demo = false) {
  if (!state && hasStoredData()) throw new Error('Saved data could not be read. Open workspace settings to reset it, or keep this browser’s data for recovery.');
  const next = demo ? seedWorkspace(dataset) : {version:1,creator:{name:'You',avatar:{seed:'Morgan',tint:'cbe2d8'}},polls:[],turns:{},demo:false};
  return saveWorkspace(next);
}
export function updatePoll(id, transform) {
  readWorkspace();
  if (!state) throw new Error('Start a workspace first.');
  let found = false;
  const polls = state.polls.map(poll => { if (poll.id !== id) return poll; found=true; return transform(poll); });
  if (!found) throw new Error('That poll is no longer on this device.');
  saveWorkspace({...state,polls:settleDue(polls)});
  return state.polls.find(poll => poll.id === id);
}
export function reconcile() {
  readWorkspace();
  if (!state) return false;
  const polls = settleDue(state.polls);
  if (!polls.some((poll,i) => poll !== state.polls[i])) return false;
  saveWorkspace({...state,polls});
  return true;
}
export function turnFor(pollId, fresh = false) {
  readWorkspace();
  if (!state) throw new Error('This poll is only available on the device that created it.');
  let token = state.turns[pollId];
  if (!token || fresh) {
    token = crypto.randomUUID();
    saveWorkspace({...state,turns:{...state.turns,[pollId]:token}});
  }
  return token;
}
export function deletePoll(pollId) {
  readWorkspace();
  const turns = {...state.turns};
  delete turns[pollId];
  saveWorkspace({...state,polls:state.polls.filter(poll=>poll.id!==pollId),turns});
}
export function wipeWorkspace() {
  localStorage.removeItem(KEY);
  state = null;
}
