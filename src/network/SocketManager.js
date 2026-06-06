import { io } from 'socket.io-client';

export class SocketManager {
  constructor() {
    this.socket = io('http://localhost:3000');
  }

  onCurrentPlayers(callback) {
    this.socket.on('currentPlayers', callback);
  }

  onPlayerJoined(callback) {
    this.socket.on('playerJoined', callback);
  }

  onPlayerMoved(callback) {
    this.socket.on('playerMoved', callback);
  }

  onPlayerLeft(callback) {
    this.socket.on('playerLeft', callback);
  }

  emitMove(x, y) {
    this.socket.emit('playerMove', { x, y });
  }

  get id() {
    return this.socket.id;
  }
}
