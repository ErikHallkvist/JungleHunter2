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
  requestLobby() { this.socket.emit('requestLobby'); }

  offLobby() {
    this.socket.off('assignedName');
    this.socket.off('lobbyUpdate');
    this.socket.off('gameInit');
  }

  // --- Game ---
  onGameInit(callback) { this.socket.on('gameInit', callback); }
  onGamePlayerMoved(callback) { this.socket.on('gamePlayerMoved', callback); }
  onGamePlayerLeft(callback) { this.socket.on('gamePlayerLeft', callback); }
  emitPlayerMove(x, y) { this.socket.emit('playerMove', { x, y }); }

  // --- Chat ---
  emitChat(text) { this.socket.emit('chatMessage', text); }
  onChatReceived(callback) { this.socket.on('chatReceived', callback); }
  onChatHistory(callback) { this.socket.on('chatHistory', callback); }
  offChat() {
    this.socket.off('chatReceived');
    this.socket.off('chatHistory');
  }

  get id() { return this.socket.id; }
}
