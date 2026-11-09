// Pure product rules. All writes go through these functions, including demo polls.
export class PollError extends Error {}
const fail = message => { throw new PollError(message); };
const clean = value => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
const id = () => crypto.randomUUID();
export const ballotOptions = poll => poll.options.filter(option => option.source !== 'suggestion' || option.suggestionStatus === 'approved');
export const isOpen = (poll, now = Date.now()) => poll.status === 'open' && Date.parse(poll.closesAt) > now;
export function settleDue(polls, now = Date.now()) {
  return polls.map(poll => poll.status === 'open' && Date.parse(poll.closesAt) <= now ? {...poll, status:'settled', settledAt:poll.closesAt} : poll);
}
export function validateDraft(draft, now = Date.now()) {
  const errors = {};
  const labels = (draft.options || []).map(clean);
  if (!clean(draft.title)) errors.title = 'Give this decision a name.';
  else if (clean(draft.title).length > 140) errors.title = 'Keep the title to 140 characters or fewer.';
  if (labels.length < 2 || labels.length > 10) errors.options = 'Add between 2 and 10 options.';
  else if (labels.some(label => !label)) errors.options = 'Give every option a name, or remove the empty one.';
  else if (labels.some(label => label.length > 100)) errors.options = 'Keep each option to 100 characters or fewer.';
  else if (new Set(labels.map(s => s.toLocaleLowerCase())).size !== labels.length) errors.options = 'Each option needs a different name.';
  if (!Number.isFinite(Date.parse(draft.closesAt)) || Date.parse(draft.closesAt) <= now) errors.closesAt = 'Choose a closing time in the future.';
  if (!['single', 'multi'].includes(draft.type)) errors.type = 'Choose how the crew can vote.';
  if (draft.type === 'multi' && (!Number.isInteger(+draft.maxChoices) || +draft.maxChoices < 2 || +draft.maxChoices > labels.length)) errors.maxChoices = `Choose between 2 and ${labels.length} picks.`;
  return errors;
}
export function createPoll(draft, now = Date.now()) {
  const errors = validateDraft(draft, now);
  if (Object.keys(errors).length) fail(Object.values(errors)[0]);
  return {id:id(), title:clean(draft.title), type:draft.type, maxChoices:draft.type === 'multi' ? +draft.maxChoices : 1, suggestionsEnabled:!!draft.suggestionsEnabled, status:'open', createdAt:new Date(now).toISOString(), closesAt:new Date(draft.closesAt).toISOString(), settledAt:null, options:draft.options.map(label => ({id:id(),label:clean(label),source:'creator'})), votes:[]};
}
function requireOpen(poll, now) {
  if (!isOpen(poll, now)) fail('Voting has closed. Let’s see what the crew decided.');
}
export function voterIdentity(voter) {
  const name = clean(voter?.name);
  if (!name) fail('Add a name so the crew knows who voted.');
  if (name.length > 40) fail('Keep your name to 40 characters or fewer.');
  const avatar = voter.avatar || {};
  if (!['f8c9b9','cbe2d8','f6e0a4','e3d2f2'].includes(avatar.tint)) fail('Pick one of the four background colors.');
  if (!clean(avatar.seed) || avatar.seed.length > 50) fail('Pick a face for your vote.');
  return {name,avatar:{seed:clean(avatar.seed),tint:avatar.tint}};
}
export function castVote(poll, ballot, now = Date.now()) {
  const token = clean(ballot.token);
  if (!token || token.length > 100) fail('Start a new turn before voting.');
  const selected = [...new Set(ballot.optionIds || [])];
  const existing = poll.votes.filter(vote => vote.voterToken === token);
  if (existing.length) {
    if (existing.length === selected.length && existing.every(vote => selected.includes(vote.optionId))) return poll;
    fail('Your vote is already in. No takebacks.');
  }
  requireOpen(poll, now);
  const voter = voterIdentity(ballot.voter);
  if (selected.length < 1) fail('Pick an option before casting your vote.');
  if (selected.length > poll.maxChoices) fail(`Pick up to ${poll.maxChoices} options.`);
  if (selected.some(optionId => !ballotOptions(poll).some(option => option.id === optionId))) fail('That option is not on the ballot. Choose another.');
  return {...poll, votes:[...poll.votes, ...selected.map(optionId => ({optionId,voter:structuredClone(voter),voterToken:token,castAt:new Date(now).toISOString()}))]};
}
export function suggestOption(poll, label, voter, now = Date.now()) {
  requireOpen(poll, now);
  if (!poll.suggestionsEnabled) fail('This poll is keeping to the original options.');
  const name = clean(label);
  if (!name || name.length > 100) fail('Give your suggestion a name, up to 100 characters.');
  if (poll.options.some(option => option.label.toLocaleLowerCase() === name.toLocaleLowerCase() && option.suggestionStatus !== 'declined')) fail('That idea is already on the list or waiting for approval.');
  if (poll.options.filter(option => option.suggestionStatus === 'pending').length >= 20) fail('There are plenty of ideas waiting. Ask the host to review them first.');
  const suggestedBy = voterIdentity(voter);
  return {...poll, options:[...poll.options,{id:id(),label:name,source:'suggestion',suggestionStatus:'pending',suggestedBy,createdAt:new Date(now).toISOString()}]};
}
export function moderate(poll, optionId, action, now = Date.now()) {
  requireOpen(poll, now);
  if (!['approved','declined','pending'].includes(action)) fail('Choose Add it or Not this time.');
  const option = poll.options.find(option => option.id === optionId);
  if (!option || option.source !== 'suggestion') fail('That suggestion is no longer here.');
  const expected = action === 'pending' ? 'declined' : 'pending';
  if (option.suggestionStatus !== expected) fail('That suggestion has already been reviewed.');
  if (action === 'approved' && ballotOptions(poll).length >= 10) fail('The ballot already has 10 options. This suggestion can’t be added.');
  return {...poll, options:poll.options.map(option => option.id === optionId ? {...option,suggestionStatus:action} : option)};
}
export function endVoting(poll, now = Date.now()) {
  requireOpen(poll, now);
  return {...poll,status:'settled',settledAt:new Date(now).toISOString()};
}
export function reopen(poll, closesAt, now = Date.now()) {
  if (poll.status !== 'settled') fail('This poll is already open.');
  if (!Number.isFinite(Date.parse(closesAt)) || Date.parse(closesAt) <= now) fail('Choose a new closing time in the future.');
  return {...poll,status:'open',settledAt:null,closesAt:new Date(closesAt).toISOString()};
}
export function pollView(poll) {
  const voters = [...new Map(poll.votes.map(vote => [vote.voterToken,vote.voter])).values()];
  const options = ballotOptions(poll).map(option => ({...option,count:poll.votes.filter(vote=>vote.optionId===option.id).length,backers:poll.status === 'settled' ? poll.votes.filter(vote=>vote.optionId===option.id).map(vote=>vote.voter) : []}));
  return {...poll, votes:undefined,options,totalVoters:voters.length,totalSelections:poll.votes.length,crew:voters,pending:poll.options.filter(option=>option.suggestionStatus==='pending')};
}
export function seedWorkspace(dataset, now = Date.now()) {
  const workspace = structuredClone(dataset);
  const shift = now - Date.parse('2026-09-17T15:00:00Z');
  const move = value => value ? new Date(Date.parse(value)+shift).toISOString() : null;
  workspace.polls.forEach(poll => {
    delete poll.shareUrl;
    for (const field of ['createdAt','closesAt','settledAt']) poll[field] = move(poll[field]);
    poll.votes.forEach(vote => { vote.castAt = move(vote.castAt); });
  });
  return {version:1,...workspace,turns:{},demo:true};
}
