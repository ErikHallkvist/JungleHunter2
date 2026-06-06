import { io } from 'socket.io-client';

export class SocketManager {
  constructor() {
    this.socket = io('http://localhost:3000');
  }

  // --- Lobby ---
  onAssignedName(callback) { this.socket.on('assignedName', callback); }
  onLobbyUpdate(callback) { this.socket.on('lobbyUpdate', callback); }
  onGameStarted(callback) { this.socket.on('gameInit', callback); }
  emitStartGame() { this.socket.emit('startGame'); }

  offLobby() {
    this.socket.off('assignedName');
    this.socket.off('lobbyUpdate');
  }

  // --- Game ---
  onGameInit(callback) { this.socket.on('gameInit', callback); }
  onGamePlayerMoved(callback) { this.socket.on('gamePlayerMoved', callback); }
  onGamePlayerLeft(callback) { this.socket.on('gamePlayerLeft', callback); }
  emitPlayerMove(x, y) { this.socket.emit('playerMove', { x, y }); }

  get id() { return this.socket.id; }
}
