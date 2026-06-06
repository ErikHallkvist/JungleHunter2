import { io } from 'socket.io-client';

export class SocketManager {
  constructor() {
    this.socket = io('http://localhost:3000');
  }

  // Lobby
  onAssignedName(callback) { this.socket.on('assignedName', callback); }
  onLobbyUpdate(callback) { this.socket.on('lobbyUpdate', callback); }
  onGameStarted(callback) { this.socket.on('gameStarted', callback); }
  emitStartGame() { this.socket.emit('startGame'); }

  // Spel
  onCurrentPlayers(callback) { this.socket.on('currentPlayers', callback); }
  onPlayerJoined(callback) { this.socket.on('playerJoined', callback); }
  onPlayerMoved(callback) { this.socket.on('playerMoved', callback); }
  onPlayerLeft(callback) { this.socket.on('playerLeft', callback); }
  emitMove(x, y) { this.socket.emit('playerMove', { x, y }); }

  get id() { return this.socket.id; }
}
