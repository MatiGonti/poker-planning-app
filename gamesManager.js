/**
 * Games Manager - multiple poker planning games with LOTR-themed codes
 * When the last participant leaves a game, the game is removed.
 */

import GameState from './gameState.js';

const DEFAULT_VOTING_OPTIONS = ['0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '5', '7', '8', '10', '20', '?'];
const FIBONACCI_OPTIONS = ['1', '2', '3', '5', '8', '13', '21', '?'];

function parseVotingOptions(scale) {
  if (!scale || scale === 'default') return DEFAULT_VOTING_OPTIONS;
  if (scale === 'fibonacci') return FIBONACCI_OPTIONS;
  const custom = String(scale)
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (custom.length === 0) return DEFAULT_VOTING_OPTIONS;
  if (!custom.includes('?')) custom.push('?');
  return custom;
}

// Lord of the Rings themed funny / memorable phrases (slug-style for codes)
const LOTR_CODES = [
  'second-breakfast',
  'po-tay-toes',
  'one-ring-to-rule-them',
  'you-shall-not-pass',
  'my-precious',
  'one-does-not-simply',
  'gondor-calls-for-aid',
  'balrog-in-the-stairs',
  'elvish-bread-lembas',
  'riddles-in-the-dark',
  'eye-of-sauron',
  'nazgul-wifi',
  'mordor-standup',
  'hobbit-hole-cozy',
  'precious-indeed',
  'fly-you-fools',
  'and-my-axe',
  'no-admittance-except-party',
  'fool-of-a-took',
  'pippin-second-breakfast',
  'treebeard-waiting',
  'saruman-multitasking',
  'gollum-debugging',
  'smeagol-nice',
  'mount-doom-deploy',
  'shire-sprint',
  'rohan-scrum',
  'minas-tirith-standup',
  'palantir-call',
  'ring-bearer-oncall',
];

function slugToDisplay(slug) {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function generateGameCode() {
  const slug = LOTR_CODES[Math.floor(Math.random() * LOTR_CODES.length)];
  if (!games.has(slug)) {
    return { code: slug, displayName: slugToDisplay(slug) };
  }
  const code = `${slug}-${Math.floor(Math.random() * 9999)}`;
  return { code, displayName: slugToDisplay(slug) };
}

const games = new Map(); // gameCode -> { gameState: GameState }

export function createGame(scaleOrOptions) {
  const { code, displayName } = generateGameCode();
  const votingOptions = parseVotingOptions(scaleOrOptions);
  const gameState = new GameState(votingOptions);
  games.set(code, { gameState, displayName });
  return { gameCode: code, displayName };
}

export function getGame(gameCode) {
  const normalized = (gameCode || '').trim().toLowerCase();
  if (!normalized) return null;
  return games.get(normalized) || null;
}

export function joinGame(gameCode, socketId, name, avatar) {
  const entry = getGame(gameCode);
  if (!entry) return null;
  const { gameState } = entry;
  gameState.addParticipant(socketId, name, avatar);
  return entry;
}

export function removeParticipantAndMaybeClose(gameCode, socketId) {
  const entry = getGame(gameCode);
  if (!entry) return;
  const { gameState } = entry;
  gameState.removeParticipant(socketId);
  if (gameState.getParticipantsList().length === 0) {
    games.delete(gameCode);
    return { closed: true };
  }
  return { closed: false };
}

export function getGameState(gameCode) {
  const entry = getGame(gameCode);
  if (!entry) return null;
  const { gameState, displayName } = entry;
  return {
    ...gameState.getState(),
    gameCode,
    displayName,
  };
}

export function submitVote(gameCode, socketId, vote) {
  const entry = getGame(gameCode);
  if (!entry) return null;
  entry.gameState.submitVote(socketId, vote);
  return entry.gameState.getParticipantsList();
}

export function retractVote(gameCode, socketId) {
  const entry = getGame(gameCode);
  if (!entry) return null;
  entry.gameState.retractVote(socketId);
  return entry.gameState.getParticipantsList();
}

export function startNewVoting(gameCode, taskName) {
  const entry = getGame(gameCode);
  if (!entry) return null;
  entry.gameState.startNewVoting(taskName);
  return {
    taskName,
    participants: entry.gameState.getParticipantsList(),
  };
}

export function revealVotes(gameCode) {
  const entry = getGame(gameCode);
  if (!entry) return null;
  entry.gameState.revealVotes();
  return entry.gameState.getResults();
}

export function clearVotes(gameCode) {
  const entry = getGame(gameCode);
  if (!entry) return null;
  entry.gameState.clearVotes();
  return entry.gameState.getParticipantsList();
}
