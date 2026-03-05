import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import GameState from './gameState.js';

const app = express();

// Add logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",  // Allow all origins for now to rule out CORS issues
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

const gameState = new GameState();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', participants: gameState.getParticipantsList().length });
});

io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);
  console.log('Transport:', socket.conn.transport.name);
  console.log('Total participants:', gameState.getParticipantsList().length);

  // Handle user joining the game
  socket.on('join-game', ({ name, avatar }) => {
    console.log(`${name} joined with avatar ${avatar}`);
    gameState.addParticipant(socket.id, name, avatar);
    
    // Send current game state to the new participant
    socket.emit('game-state', gameState.getState());
    
    // Broadcast updated participants list to all clients
    io.emit('participants-updated', gameState.getParticipantsList());
  });

  // Handle vote submission
  socket.on('submit-vote', (vote) => {
    console.log(`${socket.id} voted: ${vote}`);
    gameState.submitVote(socket.id, vote);
    
    // Broadcast updated participants list (to show who has voted)
    io.emit('participants-updated', gameState.getParticipantsList());
  });

  // Handle starting a new voting round
  socket.on('start-voting', (taskName) => {
    console.log(`New voting round started: ${taskName}`);
    gameState.startNewVoting(taskName);
    
    // Broadcast to all clients
    io.emit('voting-started', {
      taskName,
      participants: gameState.getParticipantsList()
    });
  });

  // Handle revealing votes
  socket.on('reveal-votes', () => {
    console.log('Votes revealed');
    gameState.revealVotes();
    
    const results = gameState.getResults();
    io.emit('votes-revealed', results);
  });

  // Handle clearing votes
  socket.on('clear-votes', () => {
    console.log('Votes cleared');
    gameState.clearVotes();
    
    io.emit('votes-cleared', {
      participants: gameState.getParticipantsList()
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    gameState.removeParticipant(socket.id);
    
    // Broadcast updated participants list
    io.emit('participants-updated', gameState.getParticipantsList());
  });
});

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket ready for connections`);
});
