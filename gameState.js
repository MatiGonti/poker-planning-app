/**
 * Game State Manager
 * Manages the in-memory state for the poker planning game
 */

class GameState {
  constructor() {
    this.participants = new Map(); // socketId -> { name, avatar, voted: boolean }
    this.votes = new Map(); // socketId -> vote value
    this.currentTask = '';
    this.votesRevealed = false;
  }

  addParticipant(socketId, name, avatar) {
    this.participants.set(socketId, {
      id: socketId,
      name,
      avatar,
      voted: false
    });
  }

  removeParticipant(socketId) {
    this.participants.delete(socketId);
    this.votes.delete(socketId);
  }

  submitVote(socketId, vote) {
    if (this.participants.has(socketId)) {
      this.votes.set(socketId, vote);
      const participant = this.participants.get(socketId);
      participant.voted = true;
    }
  }

  revealVotes() {
    this.votesRevealed = true;
  }

  clearVotes() {
    this.votes.clear();
    this.votesRevealed = false;
    this.currentTask = '';
    // Reset voted status for all participants
    this.participants.forEach(participant => {
      participant.voted = false;
    });
  }

  startNewVoting(taskName) {
    this.votes.clear();
    this.votesRevealed = false;
    this.currentTask = taskName;
    // Reset voted status for all participants
    this.participants.forEach(participant => {
      participant.voted = false;
    });
  }

  getParticipantsList() {
    return Array.from(this.participants.values());
  }

  getResults() {
    if (!this.votesRevealed) {
      return null;
    }

    const results = [];
    const numericVotes = [];

    this.votes.forEach((vote, socketId) => {
      const participant = this.participants.get(socketId);
      if (participant) {
        results.push({
          id: socketId,
          name: participant.name,
          avatar: participant.avatar,
          vote: vote
        });

        // Collect numeric votes for average/median calculation
        if (vote !== '?' && !isNaN(parseFloat(vote))) {
          numericVotes.push(parseFloat(vote));
        }
      }
    });

    // Sort results by vote value
    results.sort((a, b) => {
      if (a.vote === '?') return 1;
      if (b.vote === '?') return -1;
      return parseFloat(a.vote) - parseFloat(b.vote);
    });

    // Calculate average
    const average = numericVotes.length > 0
      ? (numericVotes.reduce((sum, v) => sum + v, 0) / numericVotes.length).toFixed(1)
      : null;

    // Calculate median
    let median = null;
    if (numericVotes.length > 0) {
      const sorted = [...numericVotes].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      median = sorted.length % 2 === 0
        ? ((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1)
        : sorted[mid].toFixed(1);
    }

    return {
      votes: results,
      average,
      median,
      totalVotes: results.length
    };
  }

  getState() {
    return {
      participants: this.getParticipantsList(),
      currentTask: this.currentTask,
      votesRevealed: this.votesRevealed,
      results: this.votesRevealed ? this.getResults() : null
    };
  }
}

export default GameState;
