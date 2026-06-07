// DOM-based chat panel — works in both LobbyScene and GameScene.
// Press T to focus the input, Enter to send, Escape to blur.
// Expose `isFocused` so GameScene can suppress game input while typing.

export class ChatUI {
  constructor(socket, myName, initialMessages = []) {
    this.socket = socket;
    this.myName = myName;
    this.messages = initialMessages.slice();
    this.isFocused = false;
    this._el = null;
    this._msgList = null;
    this._input = null;
    this._globalKeyHandler = null;
    this._onReceived = null;
    this._onHistory = null;

    this._build();
    this._bindSocket();

    // Render messages that were passed in (history from previous scene).
    this.messages.forEach((m) => this._renderMessage(m));
  }

  _build() {
    const el = document.createElement('div');
    el.id = 'chat-panel';
    el.style.cssText = [
      'position:fixed',
      'bottom:10px',
      'right:10px',
      'width:340px',
      'display:flex',
      'flex-direction:column',
      'background:rgba(6,10,22,0.88)',
      'border:1px solid rgba(60,90,160,0.55)',
      'border-radius:3px',
      'z-index:9999',
      'font-family:VT323,monospace',
      'font-size:18px',
      'color:#f4f4f8',
      'box-shadow:0 2px 12px rgba(0,0,0,0.5)',
    ].join(';');

    // Header
    const header = document.createElement('div');
    header.style.cssText = [
      'padding:4px 10px',
      'font-family:PressStart2P,monospace',
      'font-size:10px',
      'color:#8aa0b8',
      'border-bottom:1px solid rgba(60,90,160,0.3)',
      'letter-spacing:1px',
    ].join(';');
    header.textContent = 'CHAT  [T to type]';
    el.appendChild(header);

    // Messages list
    const msgList = document.createElement('div');
    msgList.style.cssText = [
      'height:160px',
      'overflow-y:auto',
      'padding:6px 10px',
      'display:flex',
      'flex-direction:column',
      'gap:2px',
    ].join(';');
    // Scrollbar style (webkit)
    msgList.setAttribute('style', msgList.getAttribute('style') +
      ';scrollbar-width:thin;scrollbar-color:#334 #0a0e1a');
    el.appendChild(msgList);

    // Input row
    const inputRow = document.createElement('div');
    inputRow.style.cssText = [
      'display:flex',
      'border-top:1px solid rgba(60,90,160,0.3)',
      'padding:5px 6px',
      'gap:6px',
      'align-items:center',
    ].join(';');

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Press T to chat...';
    input.maxLength = 200;
    input.autocomplete = 'off';
    input.style.cssText = [
      'flex:1',
      'background:rgba(16,22,44,0.9)',
      'border:1px solid rgba(60,90,160,0.4)',
      'border-radius:2px',
      'color:#f4f4f8',
      'font-family:VT323,monospace',
      'font-size:18px',
      'padding:2px 8px',
      'outline:none',
    ].join(';');

    input.addEventListener('keydown', (e) => {
      // Prevent game systems from seeing keypresses while typing.
      e.stopPropagation();
      if (e.key === 'Enter') {
        this._send();
      } else if (e.key === 'Escape') {
        input.blur();
      }
    });

    // Prevent mouse events on the panel from propagating into the game canvas.
    el.addEventListener('mousedown', (e) => e.stopPropagation());
    el.addEventListener('wheel', (e) => e.stopPropagation());

    input.addEventListener('focus', () => { this.isFocused = true; });
    input.addEventListener('blur', () => { this.isFocused = false; });

    const sendBtn = document.createElement('button');
    sendBtn.textContent = 'SEND';
    sendBtn.style.cssText = [
      'background:rgba(30,60,120,0.85)',
      'border:1px solid rgba(60,110,200,0.5)',
      'border-radius:2px',
      'color:#f4f4f8',
      'font-family:PressStart2P,monospace',
      'font-size:9px',
      'padding:5px 8px',
      'cursor:pointer',
      'flex-shrink:0',
    ].join(';');
    sendBtn.addEventListener('click', () => this._send());
    sendBtn.addEventListener('mousedown', (e) => e.stopPropagation());

    inputRow.appendChild(input);
    inputRow.appendChild(sendBtn);
    el.appendChild(inputRow);

    document.body.appendChild(el);
    this._el = el;
    this._msgList = msgList;
    this._input = input;

    // Global T key opens chat (unless already typing somewhere else).
    this._globalKeyHandler = (e) => {
      if (e.key === 't' || e.key === 'T') {
        if (!this.isFocused && document.activeElement === document.body) {
          e.preventDefault();
          input.focus();
        }
      }
    };
    document.addEventListener('keydown', this._globalKeyHandler);
  }

  _bindSocket() {
    this._onReceived = (entry) => {
      this.messages.push(entry);
      if (this.messages.length > 60) this.messages.shift();
      this._renderMessage(entry);
    };
    this.socket.onChatReceived(this._onReceived);

    this._onHistory = (history) => {
      if (!Array.isArray(history)) return;
      this._msgList.innerHTML = '';
      this.messages = history.slice();
      this.messages.forEach((m) => this._renderMessage(m));
    };
    this.socket.onChatHistory(this._onHistory);
  }

  _renderMessage({ name, text }) {
    const row = document.createElement('div');
    row.style.cssText = 'line-height:1.35;word-break:break-word;';
    const isMe = name === this.myName;
    const nameColor = isMe ? '#f0c020' : '#9ad0ff';
    row.innerHTML =
      `<span style="color:${nameColor}">${this._esc(name)}</span>` +
      `<span style="color:#8aa0b8">: </span>` +
      `<span>${this._esc(text)}</span>`;
    this._msgList.appendChild(row);
    this._msgList.scrollTop = this._msgList.scrollHeight;
  }

  _esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  _send() {
    const text = this._input.value.trim();
    if (text) {
      this.socket.emitChat(text);
      this._input.value = '';
    }
    this._input.blur();
  }

  // Returns message history so the next scene can preserve it.
  getMessages() { return this.messages.slice(); }

  destroy() {
    if (this._globalKeyHandler) {
      document.removeEventListener('keydown', this._globalKeyHandler);
    }
    // Unbind socket listeners.
    if (this._onReceived) this.socket.socket.off('chatReceived', this._onReceived);
    if (this._onHistory) this.socket.socket.off('chatHistory', this._onHistory);
    if (this._el) this._el.remove();
    this._el = null;
    this._msgList = null;
    this._input = null;
  }
}
