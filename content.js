/**
 * AI Pet Companion - Content Script V28 (Refined Concept)
 * Removed 'WOODCUTTER' phrase as per user feedback.
 */

const CELL_WIDTH = 192;
const CELL_HEIGHT = 208;
const FPS = 8;
const SPEED_MULT = 0.5;
const SCALE = 0.5;

const PET_STATES = [
  { name: 'idle',          row: 0, frames: 6 },
  { name: 'running-right', row: 1, frames: 8 },
  { name: 'running-left',  row: 2, frames: 8 },
  { name: 'waving',        row: 3, frames: 4 },
  { name: 'jumping',       row: 4, frames: 5 },
  { name: 'failed',        row: 5, frames: 8 },
  { name: 'waiting',       row: 6, frames: 6 },
  { name: 'running',       row: 7, frames: 6 },
  { name: 'review',        row: 8, frames: 6 },
];

class RoamingPet {
  constructor() {
    this.container = null;
    this.canvas = null;
    this.ctx = null;
    this.bubble = null;
    this.shadowFloor = null;
    this.img = null;
    this.selectedPet = 'dude';
    
    this.pos = { x: Math.random() * 300, y: 0 };
    this.vel = { x: 0, y: 0 };
    this.state = PET_STATES.find(s => s.name === 'idle');
    this.frame = 0;
    this.lastTime = 0;
    this.lastActivity = Date.now();
    
    this.isDragging = false;
    this.isHovered = false;
    this.dragDistance = 0;
    this.lastPointerPos = { x: 0, y: 0 };
    this.dragVelocity = { x: 0, y: 0 };
    this.bubbleTimeout = null;
    this.isLocked = false;
    this.targetX = null;
    
    this.init();
  }

  async init() {
    const data = await chrome.storage.local.get('selectedPet');
    this.selectedPet = data.selectedPet || 'dude';

    this.container = document.createElement('div');
    this.container.id = 'ai-pet-companion-root';
    this.container.style.cssText = `
      position: fixed; top: 0; left: 0;
      width: ${CELL_WIDTH * SCALE}px; height: ${CELL_HEIGHT * SCALE}px;
      z-index: 2147483647; pointer-events: none; will-change: transform;
    `;

    this.shadow = this.container.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = `
      .canvas-pet {
        width: 100%; height: 100%;
        pointer-events: auto; cursor: grab;
        image-rendering: pixelated; touch-action: none;
        position: relative; z-index: 2;
      }
      .shadow-floor {
        position: absolute; bottom: 0; left: 50%;
        width: 40px; height: 8px;
        background: rgba(0,0,0,0.15);
        border-radius: 50%; transform: translateX(-50%);
        filter: blur(3px); z-index: 1;
      }
      .bubble {
        position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%);
        background: white; border: 2px solid #333; padding: 4px 10px;
        border-radius: 12px; font-family: 'Courier New', monospace; font-size: 11px;
        font-weight: bold; color: black; opacity: 0; transition: opacity 0.2s;
        pointer-events: none; white-space: nowrap; margin-bottom: 8px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.1); z-index: 3;
        text-transform: uppercase;
      }
    `;
    this.shadow.appendChild(style);

    this.bubble = document.createElement('div');
    this.bubble.className = 'bubble';
    this.shadow.appendChild(this.bubble);

    this.shadowFloor = document.createElement('div');
    this.shadowFloor.className = 'shadow-floor';
    this.shadow.appendChild(this.shadowFloor);

    this.canvas = document.createElement('canvas');
    this.canvas.width = CELL_WIDTH;
    this.canvas.height = CELL_HEIGHT;
    this.canvas.className = 'canvas-pet';
    this.ctx = this.canvas.getContext('2d');
    this.shadow.appendChild(this.canvas);

    await this.loadPetAssets();

    document.body.appendChild(this.container);
    this.setupEvents();
    this.loop();
  }

  async loadPetAssets() {
    const spritesheetUrl = chrome.runtime.getURL(`assets/${this.selectedPet}/spritesheet.webp`);
    this.img = new Image();
    this.img.src = spritesheetUrl;
    await this.img.decode();
  }

  showSpeech(phrases, duration = 2000) {
    if (this.bubbleTimeout) clearTimeout(this.bubbleTimeout);
    this.bubble.textContent = phrases[Math.floor(Math.random() * phrases.length)];
    this.bubble.style.opacity = '1';
    if (duration) {
      this.bubbleTimeout = setTimeout(() => {
        if (!this.isHovered && !this.isDragging && this.state.name !== 'failed') {
          this.bubble.style.opacity = '0';
        }
      }, duration);
    }
  }

  changeState(name, lockDuration = 0) {
    if (this.isLocked && name !== 'idle') return;
    if (this.state.name === name) return;
    this.state = PET_STATES.find(s => s.name === name);
    this.frame = 0;
    if (lockDuration > 0) {
      this.isLocked = true;
      setTimeout(() => { this.isLocked = false; this.changeState('idle'); }, lockDuration);
    }
  }

  setupEvents() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'PET_CHANGED') {
        this.selectedPet = message.pet;
        this.loadPetAssets();
        this.showSpeech(["NEW LOOK!", "READY!"]);
      }
    });

    this.canvas.addEventListener('mouseenter', () => {
      this.lastActivity = Date.now();
      this.isHovered = true;
      if (!this.isDragging && !this.isLocked) {
        if (this.state.name === 'failed') this.showSpeech(["Zzz...", "READY?"]);
        else this.showSpeech(["READY.", "COMMAND?"]);
      }
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.isHovered = false;
      if (!this.isLocked && this.state.name !== 'failed') this.bubble.style.opacity = '0';
    });

    this.canvas.addEventListener('pointerdown', (e) => {
      this.lastActivity = Date.now();
      this.isDragging = true;
      this.isHovered = false;
      this.targetX = null;
      this.dragDistance = 0;
      this.lastPointerPos = { x: e.clientX, y: e.clientY };
      this.vel = { x: 0, y: 0 };
      this.showSpeech(["WHY DID YOU DO THAT?", "LET ME GO!", "PUT ME DOWN!"]);
      e.currentTarget.setPointerCapture(e.pointerId);
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastPointerPos.x;
      const dy = e.clientY - this.lastPointerPos.y;
      this.dragDistance += Math.sqrt(dx*dx + dy*dy);
      this.dragVelocity = { x: dx, y: dy };
      this.pos.x = e.clientX - (CELL_WIDTH * SCALE) / 2;
      this.pos.y = e.clientY - (CELL_HEIGHT * SCALE) / 2;
      this.lastPointerPos = { x: e.clientX, y: e.clientY };
      this.changeState('jumping');
    });

    window.addEventListener('pointerup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.lastActivity = Date.now();
        if (this.dragDistance < 5) {
          this.changeState('waving', 2000);
          this.showSpeech(["YES?", "DUDE?"]);
        } else {
          this.vel = { x: this.dragVelocity.x, y: this.dragVelocity.y };
          this.showSpeech(["WHY DID YOU DO THAT?", "LET ME GO!", "PUT ME DOWN!"], 1500);
        }
      }
    });

    document.addEventListener('click', (e) => {
      if (e.target.closest('button, input, textarea, a, select, [contenteditable="true"]')) return;
      if (e.target.id === 'ai-pet-companion-root' || this.container.contains(e.target)) return;
      this.targetX = e.clientX;
      this.lastActivity = Date.now();
      this.showSpeech(["RIGHT.", "I WILL.", "OKAY."]);
      if (this.state.name === 'failed') {
        this.changeState('idle');
        this.bubble.style.opacity = '0';
      }
    });
  }

  loop(time = 0) {
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const petW = CELL_WIDTH * SCALE;
    const petH = CELL_HEIGHT * SCALE;

    if (!this.isDragging) {
      this.pos.x += this.vel.x;
      this.pos.y += this.vel.y;
      this.vel.y += 0.8 * SPEED_MULT;

      if (this.pos.y >= winH - petH) {
        this.pos.y = winH - petH;
        this.vel.y = 0;
        
        if (this.targetX !== null && !this.isLocked && this.state.name !== 'failed') {
          const dist = this.targetX - (this.pos.x + petW/2);
          if (Math.abs(dist) > 20) {
            this.changeState(dist > 0 ? 'running-right' : 'running-left');
            this.vel.x = (dist > 0 ? 5 : -5) * SPEED_MULT;
          } else {
            this.vel.x = 0;
            this.targetX = null;
            this.changeState('idle');
          }
        } else {
          this.vel.x *= 0.9;
          if (Math.abs(this.vel.x) < 0.2) {
            this.vel.x = 0;
            if ((this.state.name === 'jumping' || this.state.name.startsWith('running')) && !this.isLocked) {
              this.changeState('idle');
            }
          }
        }
      }
    }

    if (this.pos.x < 0) { this.pos.x = 0; this.vel.x = 0; }
    else if (this.pos.x > winW - petW) { this.pos.x = winW - petW; this.vel.x = 0; }
    if (this.pos.y < 0) { this.pos.y = 0; this.vel.y = 2; }

    if (!this.isDragging && !this.isLocked && Date.now() - this.lastActivity > 30000) {
      if (this.state.name !== 'failed') {
        this.changeState('failed');
        this.showSpeech(["Zzz..."], 0);
      }
    }

    const distToFloor = (winH - petH) - this.pos.y;
    const shadowScale = Math.max(0.2, 1 - distToFloor / 200);
    this.shadowFloor.style.transform = `translateX(-50%) scale(${shadowScale})`;
    this.shadowFloor.style.opacity = this.isDragging ? '0' : (0.2 * shadowScale).toString();

    if (time - this.lastTime >= 1000 / FPS) {
      this.frame = (this.frame + 1) % this.state.frames;
      this.lastTime = time;
    }
    this.ctx.clearRect(0, 0, CELL_WIDTH, CELL_HEIGHT);
    this.ctx.drawImage(this.img, this.frame * CELL_WIDTH, this.state.row * CELL_HEIGHT, CELL_WIDTH, CELL_HEIGHT, 0, 0, CELL_WIDTH, CELL_HEIGHT);
    this.container.style.transform = `translate(${this.pos.x}px, ${this.pos.y}px)`;
    
    requestAnimationFrame((t) => this.loop(t));
  }
}

new RoamingPet();
