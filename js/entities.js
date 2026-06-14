// entities.js — sve prepreke, sakupljivi predmeti, efekti i pozadina (neon stil).
// Sve koordinate su logičke; crtanje se množi sa getScale(). Pozitivan smer kretanja je ulevo.

import { view, getScale, GROUND_Y, LOGICAL_WIDTH, screenLogicalWidth } from './config.js';

export const GRID = 50; // veličina jednog bloka u logičkim jedinicama

function glow(ctx, on, color, blur, beatPulse = 0) {
    if (on) {
        ctx.shadowBlur = (blur + beatPulse * blur * 0.5) * getScale();
        ctx.shadowColor = color;
    }
}

// --- SPIKE: trougao na tlu, instant smrt na dodir ---
export class Spike {
    constructor(x) {
        this.type = 'spike';
        this.width = 45;
        this.height = 45;
        this.x = x;
        this.y = GROUND_Y - this.height;
    }
    update(speed) { this.x -= speed; }
    draw(theme, fxOn, beatPulse) {
        const ctx = view.ctx, s = getScale();
        ctx.save();
        glow(ctx, fxOn, theme.obstacle, 14, beatPulse);
        ctx.fillStyle = theme.obstacle;
        ctx.beginPath();
        ctx.moveTo(this.x * s, (this.y + this.height) * s);
        ctx.lineTo((this.x + this.width / 2) * s, this.y * s);
        ctx.lineTo((this.x + this.width) * s, (this.y + this.height) * s);
        ctx.closePath();
        ctx.fill();
        // svetla srž
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.moveTo((this.x + this.width / 2) * s, (this.y + this.height * 0.25) * s);
        ctx.lineTo((this.x + this.width * 0.62) * s, (this.y + this.height) * s);
        ctx.lineTo((this.x + this.width * 0.38) * s, (this.y + this.height) * s);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
    // Uži hitbox (vrh trougla) — pravedniji prema igraču.
    getHitbox() {
        return { x: this.x + this.width * 0.25, y: this.y + this.height * 0.35,
                 w: this.width * 0.5, h: this.height * 0.65 };
    }
    get offscreen() { return this.x + this.width < 0; }
}

// --- BLOCK: solidna platforma. Sletanje odozgo, bočni sudar = smrt ---
export class Block {
    constructor(x, wCells = 1, hCells = 1) {
        this.type = 'block';
        this.width = wCells * GRID;
        this.height = hCells * GRID;
        this.x = x;
        this.y = GROUND_Y - this.height;
    }
    update(speed) { this.x -= speed; }
    draw(theme, fxOn, beatPulse) {
        const ctx = view.ctx, s = getScale();
        ctx.save();
        glow(ctx, fxOn, theme.grid, 10, beatPulse);
        ctx.fillStyle = theme.floor;
        ctx.fillRect(this.x * s, this.y * s, this.width * s, this.height * s);
        // neon ivica
        ctx.strokeStyle = theme.grid;
        ctx.lineWidth = 3 * s;
        ctx.strokeRect(this.x * s, this.y * s, this.width * s, this.height * s);
        ctx.restore();
    }
    getHitbox() {
        // mali inset radi praštanja na ivicama
        return { x: this.x + 3, y: this.y, w: this.width - 6, h: this.height };
    }
    get top() { return this.y; }
    get offscreen() { return this.x + this.width < 0; }
}

// --- JUMP PAD: na tlu, automatski jak odskok ---
export class JumpPad {
    constructor(x) {
        this.type = 'pad';
        this.width = 50;
        this.height = 16;
        this.x = x;
        this.y = GROUND_Y - this.height;
        this.force = 24;
    }
    update(speed) { this.x -= speed; }
    draw(theme, fxOn, beatPulse) {
        const ctx = view.ctx, s = getScale();
        ctx.save();
        glow(ctx, fxOn, '#ffe600', 16, beatPulse);
        ctx.fillStyle = '#ffe600';
        // tabla
        ctx.fillRect(this.x * s, (this.y + this.height * 0.5) * s, this.width * s, this.height * 0.5 * s);
        // strelica nagore
        ctx.beginPath();
        ctx.moveTo((this.x + this.width / 2) * s, this.y * s);
        ctx.lineTo((this.x + this.width * 0.85) * s, (this.y + this.height * 0.6) * s);
        ctx.lineTo((this.x + this.width * 0.15) * s, (this.y + this.height * 0.6) * s);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
    getHitbox() { return { x: this.x, y: this.y - 6, w: this.width, h: this.height + 12 }; }
    get offscreen() { return this.x + this.width < 0; }
}

// --- JUMP ORB: lebdi u vazduhu; skok u vazduhu uz njega daje odskok ---
export class JumpOrb {
    constructor(x, y) {
        this.type = 'orb';
        this.width = 40;
        this.height = 40;
        this.x = x;
        this.y = y != null ? y : GROUND_Y - 180;
        this.force = 18;
        this.used = false;
        this.wobble = Math.random() * Math.PI * 2;
    }
    update(speed) { this.x -= speed; this.wobble += 0.1; }
    draw(theme, fxOn, beatPulse) {
        const ctx = view.ctx, s = getScale();
        const cx = (this.x + this.width / 2) * s;
        const cy = (this.y + this.height / 2 + Math.sin(this.wobble) * 4) * s;
        const r = (this.width / 2) * s;
        ctx.save();
        ctx.globalAlpha = this.used ? 0.25 : 1;
        glow(ctx, fxOn, '#ffe600', 18, beatPulse);
        ctx.strokeStyle = '#ffe600';
        ctx.lineWidth = 4 * s;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,230,0,0.25)';
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    getHitbox() { return { x: this.x - 10, y: this.y - 10, w: this.width + 20, h: this.height + 20 }; }
    get offscreen() { return this.x + this.width < 0; }
}

// --- COIN: sakupljivi novčić sa lebdenjem ---
export class Coin {
    constructor(x, y) {
        this.type = 'coin';
        this.width = 30;
        this.height = 30;
        this.x = x;
        this.y = y != null ? y : GROUND_Y - 40 - Math.random() * 150;
        this.wobble = Math.random() * Math.PI * 2;
    }
    update(speed) { this.x -= speed; this.wobble += 0.1; }
    draw(theme, fxOn) {
        const ctx = view.ctx, s = getScale();
        const cx = (this.x + this.width / 2) * s;
        const cy = (this.y + this.height / 2 + Math.sin(this.wobble) * 5) * s;
        const r = (this.width / 2) * s;
        ctx.save();
        glow(ctx, fxOn, '#ffd000', 12);
        ctx.fillStyle = '#ffd000';
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff9f1a';
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.65, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.18, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
    getHitbox() { return { x: this.x, y: this.y, w: this.width, h: this.height }; }
    get offscreen() { return this.x + this.width < 0; }
}

// --- FLYING COIN: animacija sakupljenog novčića ka novčaniku (HUD) ---
export class FlyingCoin {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.width = 24;
        this.speed = 14;
    }
    // Vraća true kad stigne do mete.
    update() {
        const s = getScale();
        const targetX = 40 / s, targetY = 80 / s; // pozicija novčanika u HUD-u (logički)
        const dx = targetX - this.x, dy = targetY - this.y;
        const dist = Math.hypot(dx, dy);
        if (dist < this.speed) return true;
        const ang = Math.atan2(dy, dx);
        this.x += Math.cos(ang) * this.speed;
        this.y += Math.sin(ang) * this.speed;
        this.speed *= 1.12;
        return false;
    }
    draw() {
        const ctx = view.ctx, s = getScale();
        const cx = this.x * s, cy = this.y * s, r = (this.width / 2) * s;
        ctx.save();
        ctx.fillStyle = '#ffd000';
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
}

// --- PARTICLE: iskre / eksplozije ---
export class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color;
        this.size = Math.random() * 4 + 2;
        const ang = Math.random() * Math.PI * 2;
        const sp = Math.random() * 6 + 2;
        this.vx = Math.cos(ang) * sp;
        this.vy = Math.sin(ang) * sp;
        this.life = 1;
        this.decay = Math.random() * 0.04 + 0.02;
    }
    update() { this.x += this.vx; this.y += this.vy; this.vy += 0.15; this.life -= this.decay; }
    draw(fxOn) {
        const ctx = view.ctx, s = getScale();
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        glow(ctx, fxOn, this.color, 8);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x * s, this.y * s, this.size * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    get dead() { return this.life <= 0; }
}

// --- BOSS: leteći protivnik (zadržan iz originala, neon prepravka) ---
export class Boss {
    constructor() {
        this.width = 120;
        this.height = 120;
        this.x = screenLogicalWidth() + 150;
        this.targetX = screenLogicalWidth() - 220;
        this.baseY = GROUND_Y - 240;
        this.y = this.baseY;
        this.hp = 20;
        this.maxHp = 20;
        this.attackTimer = 60;
        this.state = 'ENTERING';
        this.wobble = 0;
    }
    update(speed, spawnAttack) {
        this.wobble += 0.08;
        this.y = this.baseY + Math.sin(this.wobble) * 40;
        if (this.state === 'ENTERING') {
            if (this.x > this.targetX) this.x -= 4;
            else this.state = 'FIGHTING';
        } else {
            this.attackTimer--;
            if (this.attackTimer <= 0) {
                spawnAttack(this.x);
                this.attackTimer = 45 + Math.random() * 25;
            }
        }
    }
    draw(theme, fxOn, beatPulse) {
        const ctx = view.ctx, s = getScale();
        ctx.save();
        ctx.translate((this.x + this.width / 2) * s, (this.y + this.height / 2) * s);
        glow(ctx, fxOn, theme.obstacle, 24, beatPulse);
        ctx.fillStyle = theme.obstacle;
        ctx.fillRect(-this.width / 2 * s, -this.height / 2 * s, this.width * s, this.height * s);
        // ljute oči
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(-30 * s, -20 * s); ctx.lineTo(-8 * s, -8 * s); ctx.lineTo(-30 * s, 2 * s); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(30 * s, -20 * s); ctx.lineTo(8 * s, -8 * s); ctx.lineTo(30 * s, 2 * s); ctx.fill();
        ctx.restore();
    }
    get hpPct() { return (this.hp / this.maxHp) * 100; }
}

// --- BACKGROUND LAYER: paralaks planine/brda (neon siluete) ---
export class BackgroundLayer {
    constructor(speedModifier, color, peaks) {
        this.speedModifier = speedModifier;
        this.color = color;
        this.peaks = peaks;
        this.x = 0;
    }
    update(gameSpeed) {
        this.x -= gameSpeed * this.speedModifier;
        if (this.x <= -LOGICAL_WIDTH) this.x += LOGICAL_WIDTH;
    }
    draw(color) {
        const ctx = view.ctx, scale = getScale();
        const slw = screenLogicalWidth();
        ctx.fillStyle = color || this.color;
        for (let i = 0; i <= Math.ceil(slw / LOGICAL_WIDTH) + 1; i++) {
            this._render((this.x + i * LOGICAL_WIDTH) * scale, scale);
        }
    }
    _render(offsetX, scale) {
        const ctx = view.ctx;
        ctx.beginPath();
        ctx.moveTo(offsetX, GROUND_Y * scale);
        this.peaks.forEach(p => ctx.lineTo(offsetX + p.x * scale, (GROUND_Y - p.h) * scale));
        ctx.lineTo(offsetX + LOGICAL_WIDTH * scale, GROUND_Y * scale);
        ctx.fill();
    }
}

export const backgroundLayers = [
    new BackgroundLayer(0.25, null, [{ x: 0, h: 150 }, { x: 300, h: 250 }, { x: 600, h: 180 }, { x: 900, h: 320 }, { x: 1200, h: 150 }]),
    new BackgroundLayer(0.5, null, [{ x: 0, h: 80 }, { x: 250, h: 150 }, { x: 550, h: 100 }, { x: 850, h: 200 }, { x: 1200, h: 80 }])
];
