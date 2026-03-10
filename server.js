import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import * as gamesManager from './gamesManager.js';

const app = express();

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// Which game each socket is in (socketId -> gameCode)
const socketToGame = new Map();

function getSocketGameCode(socket) {
  return socketToGame.get(socket.id);
}

function getParticipantName(gameCode, socketId) {
  const state = gamesManager.getGameState(gameCode);
  if (!state || !state.participants) return 'Someone';
  const p = state.participants.find((x) => x.id === socketId);
  return p ? p.name : 'Someone';
}

function emitGameLog(io, gameCode, entry) {
  io.to(gameCode).emit('game-log', entry);
}

io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);

  socket.on('join-game', ({ gameCode, name, avatar, scale }) => {
    const isCreate = !gameCode || !String(gameCode).trim();

    if (isCreate) {
      const { gameCode: newCode, displayName } = gamesManager.createGame(scale);
      const entry = gamesManager.joinGame(newCode, socket.id, name, avatar);
      if (!entry) {
        socket.emit('join-error', { message: 'Failed to create game' });
        return;
      }
      socketToGame.set(socket.id, newCode);
      socket.join(newCode);
      const state = gamesManager.getGameState(newCode);
      socket.emit('game-state', { ...state, gameLog: [] });
      io.to(newCode).emit('participants-updated', state.participants);
      emitGameLog(io, newCode, { type: 'joined', name });
      console.log(`Game created: ${newCode} (${displayName}), ${name} joined`);
      return;
    }

    const normalizedCode = String(gameCode).trim().toLowerCase();
    const entry = gamesManager.joinGame(normalizedCode, socket.id, name, avatar);
    if (!entry) {
      socket.emit('join-error', { message: 'Game not found. Check the code or create a new game.' });
      return;
    }
    socketToGame.set(socket.id, normalizedCode);
    socket.join(normalizedCode);
    const state = gamesManager.getGameState(normalizedCode);
    socket.emit('game-state', { ...state, gameLog: [] });
    io.to(normalizedCode).emit('participants-updated', state.participants);
    emitGameLog(io, normalizedCode, { type: 'joined', name });
    console.log(`${name} joined game ${normalizedCode}`);
  });

  socket.on('submit-vote', (vote) => {
    const gameCode = getSocketGameCode(socket);
    if (!gameCode) return;
    const participants = gamesManager.submitVote(gameCode, socket.id, vote);
    if (participants) {
      io.to(gameCode).emit('participants-updated', participants);
      emitGameLog(io, gameCode, { type: 'voted', name: getParticipantName(gameCode, socket.id) });
    }
  });

  socket.on('retract-vote', () => {
    const gameCode = getSocketGameCode(socket);
    if (!gameCode) return;
    const participants = gamesManager.retractVote(gameCode, socket.id);
    if (participants) {
      io.to(gameCode).emit('participants-updated', participants);
      emitGameLog(io, gameCode, { type: 'retracted-vote', name: getParticipantName(gameCode, socket.id) });
    }
  });

  socket.on('start-voting', (taskName) => {
    const gameCode = getSocketGameCode(socket);
    if (!gameCode) return;
    const data = gamesManager.startNewVoting(gameCode, taskName);
    if (data) {
      io.to(gameCode).emit('voting-started', data);
      emitGameLog(io, gameCode, { type: 'started-voting', name: getParticipantName(gameCode, socket.id), taskName });
    }
  });

  socket.on('reveal-votes', () => {
    const gameCode = getSocketGameCode(socket);
    if (!gameCode) return;
    const results = gamesManager.revealVotes(gameCode);
    if (results !== null) {
      io.to(gameCode).emit('votes-revealed', results);
      emitGameLog(io, gameCode, { type: 'revealed-results', name: getParticipantName(gameCode, socket.id) });
    }
  });

  socket.on('clear-votes', () => {
    const gameCode = getSocketGameCode(socket);
    if (!gameCode) return;
    const participants = gamesManager.clearVotes(gameCode);
    if (participants) {
      io.to(gameCode).emit('votes-cleared', { participants });
      emitGameLog(io, gameCode, { type: 'cleared-results', name: getParticipantName(gameCode, socket.id) });
    }
  });

  socket.on('disconnect', () => {
    const gameCode = getSocketGameCode(socket);
    socketToGame.delete(socket.id);
    if (!gameCode) {
      console.log('User disconnected (no game):', socket.id);
      return;
    }
    const leftName = getParticipantName(gameCode, socket.id);
    const result = gamesManager.removeParticipantAndMaybeClose(gameCode, socket.id);
    const state = gamesManager.getGameState(gameCode);
    if (result?.closed) {
      io.to(gameCode).emit('game-closed', { message: 'Last person left. Game closed.' });
      console.log(`Game closed: ${gameCode}`);
    } else if (state) {
      io.to(gameCode).emit('participants-updated', state.participants);
      emitGameLog(io, gameCode, { type: 'left', name: leftName });
    }
    console.log('User disconnected:', socket.id, 'from game', gameCode);
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('WebSocket ready for connections');
});
