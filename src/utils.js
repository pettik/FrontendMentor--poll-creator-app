import { createAvatar } from '@dicebear/core';
import * as micah from '@dicebear/micah';

export const escape = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cache = new Map();
export const tints = ['f8c9b9', 'cbe2d8', 'f6e0a4', 'e3d2f2'];
export const faces = ['Morgan', 'Priya', 'Kai', 'Ada', 'Jonah', 'Sam'];
export function avatar(person = {}, size = '', label = '') {
  const seed = person.avatar?.seed || person.name || 'Morgan';
  const tint = tints.includes(person.avatar?.tint) ? person.avatar.tint : 'cbe2d8';
  const key = seed + tint;
  if (!cache.has(key)) cache.set(key, createAvatar(micah, {seed, backgroundColor:[tint]}).toDataUri());
  return `<span class="avatar ${size}" style="--tint:#${tint}" ${label ? `role="img" aria-label="${escape(label)}"` : 'aria-hidden="true"'}><img src="${cache.get(key)}" width="48" height="48" alt="" /></span>`;
}
export const plural = (n, word = 'vote') => `${n} ${word}${n === 1 ? '' : 's'}`;
export function closing(value, settled = false) {
  const date = new Date(value);
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate()+1);
  const day = date.toDateString() === today.toDateString() ? 'today' : date.toDateString() === tomorrow.toDateString() ? 'tomorrow' : date.toLocaleDateString('en', {month:'short',day:'numeric'});
  const time = date.toLocaleTimeString('en', {hour:'numeric',minute:'2-digit'});
  return `${settled ? 'Settled' : 'Closes'} ${day} at ${time}`;
}
export const dateInput = (hours = 24) => { const d = new Date(Date.now() + hours * 3600000); return new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,16); };
export const pollIcon = (title) => /pizza|takeaway|food/i.test(title) ? 'pizza' : /film|movie/i.test(title) ? 'film' : /airbnb|cabin|weekend|trip/i.test(title) ? 'home' : /brunch|coffee/i.test(title) ? 'coffee' : 'calendar';
export function race(poll) {
  const sorted = [...poll.options].sort((a,b) => b.count-a.count);
  const top = sorted[0]?.count || 0;
  const leaders = sorted.filter(o => o.count === top && top > 0);
  return { sorted, top, leaders, tied:leaders.length > 1, margin:top-(sorted[1]?.count || 0) };
}
export const percentage = (count, total) => total ? Math.round(count/total*100) : 0;
export function raceSummary(poll) {
  const {leaders, tied}=race(poll);
  const total=`${plural(poll.totalVoters)} counted.`;
  if(!leaders.length)return `${poll.title}. ${poll.status==='settled'?'Voting closed with no votes.':'Waiting for the first vote.'}`;
  if(tied)return `${poll.title}. ${poll.status==='settled'?'Voting closed. ':''}Tied at ${plural(leaders[0].count)} each. ${total}`;
  return `${poll.title}. ${leaders[0].label}: ${leaders[0].count} of ${plural(poll.totalVoters)}. ${poll.status==='settled'?'The winner.':poll.totalVoters===1?'The first vote.':'In the lead.'}`;
}
export function resultText(poll, url='') {
  const {leaders, tied} = race(poll);
  const summary = !leaders.length ? 'No votes this round.' : tied ? `A tie: ${leaders.map(o=>o.label).join(' & ')} — ${plural(leaders[0].count)} each.` : `${leaders[0].label} wins — ${leaders[0].count} of ${plural(poll.totalVoters)} (${percentage(leaders[0].count,poll.totalVoters)}%).`;
  return `${poll.title}\n${summary}\n${poll.totalVoters} ${poll.totalVoters===1?'person':'people'} voted.${poll.type==='multi'?' Multi-choice poll.':''}\nMade with Tiebreak${url?`\n${url}`:''}`;
}
