// Validate stored records before they can reach the UI. A damaged workspace is
// never replaced automatically; the host can explicitly reset it in settings.
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const identifier = value => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,99}$/i.test(value);
const avatar = value => record(value) && text(value.seed, 50) && ['f8c9b9', 'cbe2d8', 'f6e0a4', 'e3d2f2'].includes(value.tint);
const person = value => record(value) && text(value.name, 40) && avatar(value.avatar);

function validPoll(poll) {
  if (!record(poll) || !identifier(poll.id) || !text(poll.title, 140)) return false;
  if (!['single', 'multi'].includes(poll.type) || !['open', 'settled'].includes(poll.status)) return false;
  if (typeof poll.suggestionsEnabled !== 'boolean' || !timestamp(poll.createdAt) || !timestamp(poll.closesAt)) return false;
  if (poll.status === 'settled' ? !timestamp(poll.settledAt) : poll.settledAt !== null) return false;
  if (!Array.isArray(poll.options) || !Array.isArray(poll.votes)) return false;

  const options = new Map();
  for (const option of poll.options) {
    if (!record(option) || !identifier(option.id) || options.has(option.id) || !text(option.label, 100)) return false;
    if (!['creator', 'suggestion'].includes(option.source)) return false;
    if (option.source === 'suggestion' && (!['pending', 'approved', 'declined'].includes(option.suggestionStatus) || !person(option.suggestedBy))) return false;
    options.set(option.id, option);
  }
  const approved = poll.options.filter(option => option.source === 'creator' || option.suggestionStatus === 'approved');
  if (approved.length < 2 || approved.length > 10) return false;
  if (!Number.isInteger(poll.maxChoices) || poll.maxChoices > approved.length) return false;
  if (poll.type === 'single' ? poll.maxChoices !== 1 : poll.maxChoices < 2) return false;

  const ballots = new Map();
  for (const vote of poll.votes) {
    if (!record(vote) || !text(vote.voterToken, 100) || !person(vote.voter) || !timestamp(vote.castAt)) return false;
    const option = options.get(vote.optionId);
    if (!option || (option.source === 'suggestion' && option.suggestionStatus !== 'approved')) return false;
    const ballot = ballots.get(vote.voterToken) || {voter: vote.voter, selections: new Set()};
    if (ballot.selections.has(vote.optionId) || ballot.selections.size >= poll.maxChoices) return false;
    if (ballot.voter.name !== vote.voter.name || ballot.voter.avatar.seed !== vote.voter.avatar.seed || ballot.voter.avatar.tint !== vote.voter.avatar.tint) return false;
    ballot.selections.add(vote.optionId);
    ballots.set(vote.voterToken, ballot);
  }
  return true;
}

export function isWorkspace(value) {
  if (!record(value) || value.version !== 1 || typeof value.demo !== 'boolean' || !person(value.creator)) return false;
  if (!Array.isArray(value.polls) || !value.polls.every(validPoll) || !record(value.turns)) return false;
  const ids = new Set(value.polls.map(poll => poll.id));
  if (ids.size !== value.polls.length) return false;
  return Object.entries(value.turns).every(([pollId, token]) => ids.has(pollId) && text(token, 100));
}
