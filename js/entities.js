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
        this.solidTop = true; // solidan: sletanje odozgo (resolveFloor), bočni sudar = smrt
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

// --- DUCK BARRIER: viseća prepreka na visini glave; promaši se SAMO čučanjem ---
export class DuckBarrier {
    constructor(x) {
        this.type = 'duckbar';
        this.width = 46;
        this.topY = GROUND_Y - 200;     // visi odozgo
        this.bottomY = GROUND_Y - 35;   // = 415: gađa stojećeg (do 446), promašuje čučećeg (od 427.5)
        this.height = this.bottomY - this.topY;
        this.x = x;
        this.y = this.topY;
    }
    update(speed) { this.x -= speed; }
    draw(theme, fxOn, beatPulse) {
        const ctx = view.ctx, s = getScale();
        ctx.save();
        glow(ctx, fxOn, theme.obstacle, 14, beatPulse);
        // viseći stub (lanac)
        ctx.fillStyle = theme.grid;
        ctx.fillRect((this.x + this.width * 0.4) * s, this.topY * s, this.width * 0.2 * s, (this.height - 34) * s);
        // opasna nazubljena glava (gleda nadole)
        const teethTop = this.bottomY - 34;
        ctx.fillStyle = theme.obstacle;
        ctx.fillRect(this.x * s, teethTop * s, this.width * s, 18 * s);
        const teeth = 3, tw = this.width / teeth;
        for (let i = 0; i < teeth; i++) {
            const tx = this.x + i * tw;
            ctx.beginPath();
            ctx.moveTo(tx * s, (teethTop + 18) * s);
            ctx.lineTo((tx + tw / 2) * s, this.bottomY * s);
            ctx.lineTo((tx + tw) * s, (teethTop + 18) * s);
            ctx.closePath();
            ctx.fill();
        }
        // svetla srž
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(this.x * s, teethTop * s, this.width * s, 4 * s);
        ctx.restore();
    }
    getHitbox() {
        return { x: this.x + 6, y: this.topY, w: this.width - 12, h: this.bottomY - this.topY };
    }
    get offscreen() { return this.x + this.width < 0; }
}

// --- SAW: rotirajuće sečivo, hazard na dodir (tlo ili vazduh) ---
export class Saw {
    constructor(x, y) {
        this.type = 'saw';
        this.width = 56;
        this.height = 56;
        this.x = x;
        this.y = y != null ? y : GROUND_Y - this.height;
        this.angle = 0;
    }
    update(speed) { this.x -= speed; this.angle += 0.3; }
    draw(theme, fxOn, beatPulse) {
        const ctx = view.ctx, s = getScale();
        const cx = (this.x + this.width / 2) * s, cy = (this.y + this.height / 2) * s;
        const r = (this.width / 2) * s;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(this.angle);
        glow(ctx, fxOn, theme.obstacle, 16, beatPulse);
        ctx.fillStyle = theme.obstacle;
        // nazubljeni krug
        const teeth = 10;
        ctx.beginPath();
        for (let i = 0; i < teeth * 2; i++) {
            const rr = i % 2 === 0 ? r : r * 0.76;
            const a = (i / (teeth * 2)) * Math.PI * 2;
            const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        // središnji disk
        ctx.fillStyle = theme.floor;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * s;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
    }
    getHitbox() {
        const inset = this.width * 0.18;
        return { x: this.x + inset, y: this.y + inset, w: this.width - inset * 2, h: this.height - inset * 2 };
    }
    get offscreen() { return this.x + this.width < 0; }
}

// --- MOVING PLATFORM: vertikalna sin-oscilacija; staje se odozgo (solidTop).
//     Sa amp=0 postaje STATIČNA lebdeća platforma (ledge) na zadatoj visini. ---
export class MovingPlatform {
    constructor(x, wCells = 2, baseY = GROUND_Y - 120, amp = 70, period = 150) {
        this.type = 'mover';
        this.solidTop = true;
        this.width = wCells * GRID;
        this.height = 22;
        this.x = x;
        this.baseY = baseY;
        this.amp = amp;
        this.phase = Math.random() * Math.PI * 2;
        this.phaseStep = (Math.PI * 2) / period;
        this.y = baseY + Math.sin(this.phase) * amp;
        this.prevY = this.y;
    }
    update(speed) {
        this.x -= speed;
        this.prevY = this.y;
        this.phase += this.phaseStep;
        this.y = this.baseY + Math.sin(this.phase) * this.amp;
    }
    draw(theme, fxOn, beatPulse) {
        const ctx = view.ctx, s = getScale();
        ctx.save();
        glow(ctx, fxOn, theme.accent, 12, beatPulse);
        ctx.fillStyle = theme.floor;
        ctx.fillRect(this.x * s, this.y * s, this.width * s, this.height * s);
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = 3 * s;
        ctx.strokeRect(this.x * s, this.y * s, this.width * s, this.height * s);
        // vertikalne strelice (indikacija kretanja) — samo za stvarno pokretne (amp>0); kod statičnog ledge-a (amp=0) se izostavljaju
        if (this.amp !== 0) {
            ctx.fillStyle = theme.accent;
            ctx.globalAlpha = 0.85;
            const mx = (this.x + this.width / 2) * s, my = (this.y + this.height / 2) * s, a = 6 * s;
            ctx.beginPath(); ctx.moveTo(mx, my - a * 1.6); ctx.lineTo(mx - a, my - a * 0.4); ctx.lineTo(mx + a, my - a * 0.4); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(mx, my + a * 1.6); ctx.lineTo(mx - a, my + a * 0.4); ctx.lineTo(mx + a, my + a * 0.4); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
    }
    getHitbox() { return { x: this.x + 3, y: this.y, w: this.width - 6, h: this.height }; }
    get top() { return this.y; }
    get offscreen() { return this.x + this.width < 0; }
}

// --- LASER: vertikalni snop sa OTVOROM (gap); prolaz se poravnanjem visine ---
// Otvor se markira (uvek vidljiv). Visok otvor → skok u njega; nizak → čučanj/prizemno.
export class Laser {
    constructor(x, { onFrames = 80, offFrames = 60, offset = 0, gapY, gapH = 170 } = {}) {
        this.type = 'laser';
        this.width = 26;
        this.x = x;
        this.y = 0;
        this.height = GROUND_Y;
        this.gapH = gapH;
        this.gapY = gapY != null ? gapY : GROUND_Y - 150;       // centar otvora (default → skok)
        this.gapTop = Math.max(0, this.gapY - gapH / 2);
        this.gapBottom = Math.min(GROUND_Y, this.gapY + gapH / 2);
        this.onFrames = onFrames;
        this.offFrames = offFrames;
        this.period = onFrames + offFrames;
        this.timer = ((offset % this.period) + this.period) % this.period;
    }
    get active() { return (this.timer % this.period) < this.onFrames; }
    update(speed) { this.x -= speed; this.timer++; }
    draw(theme, fxOn, beatPulse) {
        const ctx = view.ctx, s = getScale();
        const cx = (this.x + this.width / 2) * s;
        ctx.save();
        // emiteri (gore i dole)
        glow(ctx, fxOn, theme.grid, 8, beatPulse);
        ctx.fillStyle = theme.grid;
        ctx.fillRect(this.x * s, 0, this.width * s, 12 * s);
        ctx.fillRect(this.x * s, (GROUND_Y - 12) * s, this.width * s, 12 * s);
        // markeri otvora (uvek vidljivi — pokazuju kuda se prolazi)
        ctx.fillStyle = theme.accent;
        ctx.fillRect((this.x - 4) * s, this.gapTop * s, (this.width + 8) * s, 4 * s);
        ctx.fillRect((this.x - 4) * s, (this.gapBottom - 4) * s, (this.width + 8) * s, 4 * s);
        if (this.active) {
            glow(ctx, fxOn, theme.obstacle, 20, beatPulse);
            ctx.fillStyle = theme.obstacle;
            ctx.globalAlpha = 0.7 + Math.sin(this.timer * 0.8) * 0.3;
            // segment iznad i ispod otvora
            ctx.fillRect((this.x + this.width * 0.3) * s, 12 * s, this.width * 0.4 * s, Math.max(0, this.gapTop - 12) * s);
            ctx.fillRect((this.x + this.width * 0.3) * s, this.gapBottom * s, this.width * 0.4 * s, Math.max(0, GROUND_Y - 12 - this.gapBottom) * s);
            ctx.globalAlpha = 1;
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.fillRect((this.x + this.width * 0.45) * s, 12 * s, this.width * 0.1 * s, Math.max(0, this.gapTop - 12) * s);
            ctx.fillRect((this.x + this.width * 0.45) * s, this.gapBottom * s, this.width * 0.1 * s, Math.max(0, GROUND_Y - 12 - this.gapBottom) * s);
        } else {
            // telegraph: isprekidani segmenti (najava)
            ctx.strokeStyle = theme.obstacle;
            ctx.globalAlpha = 0.28;
            ctx.setLineDash([6 * s, 8 * s]);
            ctx.lineWidth = 2 * s;
            ctx.beginPath();
            ctx.moveTo(cx, 12 * s); ctx.lineTo(cx, this.gapTop * s);
            ctx.moveTo(cx, this.gapBottom * s); ctx.lineTo(cx, (GROUND_Y - 12) * s);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        ctx.restore();
    }
    // Pun vertikalni pravougaonik dok gori (horizontalni presek je stvarni uslov);
    // „u otvoru" proveru radi inGap() — pogađa samo ako igrač NIJE ceo unutar otvora.
    getHitbox() {
        if (!this.active) return null;
        return { x: this.x + 5, y: 0, w: this.width - 10, h: GROUND_Y };
    }
    inGap(hb) { return hb.y >= this.gapTop && hb.y + hb.h <= this.gapBottom; }
    get offscreen() { return this.x + this.width < 0; }
}

// --- CRUMBLE PLATFORM: staje se odozgo; raspada se kratko nakon sletanja ---
export class CrumblePlatform {
    constructor(x, wCells = 2, hCells = 1) {
        this.type = 'crumble';
        this.solidTop = true;
        this.width = wCells * GRID;
        this.height = hCells * GRID;
        this.x = x;
        this.y = GROUND_Y - this.height;
        this.state = 'IDLE';      // IDLE -> SHAKING -> GONE
        this.timer = 0;
        this.shakeFrames = 36;    // grejs period ~0.6s
    }
    trigger() { if (this.state === 'IDLE') { this.state = 'SHAKING'; this.timer = this.shakeFrames; } }
    update(speed) {
        this.x -= speed;
        if (this.state === 'SHAKING') { this.timer--; if (this.timer <= 0) this.state = 'GONE'; }
    }
    draw(theme, fxOn, beatPulse) {
        if (this.state === 'GONE') return;
        const ctx = view.ctx, s = getScale();
        let jx = 0, jy = 0, alpha = 1;
        if (this.state === 'SHAKING') {
            const t = this.timer / this.shakeFrames;
            jx = (Math.random() - 0.5) * 6;
            jy = (Math.random() - 0.5) * 6;
            alpha = 0.4 + t * 0.6;
        }
        const shaking = this.state === 'SHAKING';
        ctx.save();
        ctx.globalAlpha = alpha;
        glow(ctx, fxOn, shaking ? theme.obstacle : theme.grid, 10, beatPulse);
        ctx.fillStyle = theme.floor;
        ctx.fillRect((this.x + jx) * s, (this.y + jy) * s, this.width * s, this.height * s);
        ctx.strokeStyle = shaking ? theme.obstacle : theme.grid;
        ctx.lineWidth = 3 * s;
        ctx.strokeRect((this.x + jx) * s, (this.y + jy) * s, this.width * s, this.height * s);
        if (shaking) {
            ctx.beginPath();
            ctx.moveTo((this.x + this.width * 0.5 + jx) * s, (this.y + jy) * s);
            ctx.lineTo((this.x + this.width * 0.4 + jx) * s, (this.y + this.height + jy) * s);
            ctx.stroke();
        }
        ctx.restore();
    }
    getHitbox() {
        if (this.state === 'GONE') return null; // KLJUČNO: izlazi iz poda/kolizija
        return { x: this.x + 3, y: this.y, w: this.width - 6, h: this.height };
    }
    get top() { return this.y; }
    get offscreen() { return this.x + this.width < 0; }
}

// --- PIT: provalija u podu; pad u nju = smrt (logika u game.js: resolveFloor/pitDeath) ---
export class Pit {
    constructor(x, wCells = 3) {
        this.type = 'pit';
        this.width = wCells * GRID;
        this.x = x;
        this.y = GROUND_Y;
        this.height = 1; // nominalno; stvarni efekat je odsustvo poda
    }
    update(speed) { this.x -= speed; }
    draw(theme, fxOn, beatPulse) {
        const ctx = view.ctx, s = getScale();
        const gy = GROUND_Y * s;
        ctx.save();
        // „iseci" pod bojom donje pozadine → izgleda kao rupa (prekrij i neon liniju tla)
        ctx.fillStyle = theme.bgBottom;
        ctx.fillRect(this.x * s, gy - 3 * s, this.width * s, (view.h - gy) + 3 * s);
        // neon ivice provalije (leva i desna)
        glow(ctx, fxOn, theme.obstacle, 12, beatPulse);
        ctx.fillStyle = theme.obstacle;
        ctx.fillRect(this.x * s, gy - 3 * s, 4 * s, (view.h - gy) + 3 * s);
        ctx.fillRect((this.x + this.width - 4) * s, gy - 3 * s, 4 * s, (view.h - gy) + 3 * s);
        ctx.restore();
    }
    getHitbox() { return null; } // nije touch-hazard; efekat je u resolveFloor
    get offscreen() { return this.x + this.width < 0; }
}

// --- SHIELD: sakupljivi štit; upija jedan pogodak (radi u svim modovima) ---
export class Shield {
    constructor(x, y) {
        this.type = 'shield';
        this.width = 40;
        this.height = 40;
        this.x = x;
        this.y = y != null ? y : GROUND_Y - 120;
        this.wobble = Math.random() * Math.PI * 2;
    }
    update(speed) { this.x -= speed; this.wobble += 0.1; }
    draw(theme, fxOn, beatPulse) {
        const ctx = view.ctx, s = getScale();
        const cx = (this.x + this.width / 2) * s;
        const cy = (this.y + this.height / 2 + Math.sin(this.wobble) * 4) * s;
        const r = (this.width / 2) * s;
        ctx.save();
        glow(ctx, fxOn, '#00e5ff', 18, beatPulse);
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 3.5 * s;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
            const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = 'rgba(0,229,255,0.22)';
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(cx - r * 0.25, cy - r * 0.25, r * 0.14, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
    getHitbox() { return { x: this.x - 8, y: this.y - 8, w: this.width + 16, h: this.height + 16 }; }
    get offscreen() { return this.x + this.width < 0; }
}

// --- EXTRA LIFE: sakupljivi +1 život (samo endless/boss kontekst) ---
export class ExtraLife {
    constructor(x, y) {
        this.type = 'life';
        this.width = 36;
        this.height = 36;
        this.x = x;
        this.y = y != null ? y : GROUND_Y - 130;
        this.wobble = Math.random() * Math.PI * 2;
    }
    update(speed) { this.x -= speed; this.wobble += 0.12; }
    draw(theme, fxOn, beatPulse) {
        const ctx = view.ctx, s = getScale();
        const cx = (this.x + this.width / 2) * s;
        const cy = (this.y + this.height / 2 + Math.sin(this.wobble) * 4) * s;
        const r = (this.width / 2) * s;
        ctx.save();
        glow(ctx, fxOn, '#ff2e88', 16, beatPulse);
        ctx.fillStyle = '#ff2e88';
        // srce (bezier)
        ctx.beginPath();
        ctx.moveTo(cx, cy + r * 0.7);
        ctx.bezierCurveTo(cx - r * 1.1, cy - r * 0.1, cx - r * 0.5, cy - r * 0.9, cx, cy - r * 0.25);
        ctx.bezierCurveTo(cx + r * 0.5, cy - r * 0.9, cx + r * 1.1, cy - r * 0.1, cx, cy + r * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath(); ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.13, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
    getHitbox() { return { x: this.x - 6, y: this.y - 6, w: this.width + 12, h: this.height + 12 }; }
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

// --- SHURIKEN: leteća zvezda (boss projektil); leti ulevo na visini glave → izbegava se ČUČNJEM ---
// Princip kao DuckBarrier: dno hitboxa (~GROUND_Y-28=422) je IZNAD temena čučećeg igrača (427.5),
// pa čučanj prolazi ispod, a stojeći biva pogođen.
export class Shuriken {
    constructor(x) {
        this.type = 'shuriken';
        this.size = 44;
        this.width = this.size;
        this.x = x;
        this.cy = GROUND_Y - 45;          // centar leta = visina glave stojećeg igrača
        this.y = this.cy - this.size / 2;
        this.angle = 0;
    }
    update(speed) { this.x -= speed; this.angle += 0.35; }
    draw(theme, fxOn, beatPulse) {
        const ctx = view.ctx, s = getScale();
        const cx = (this.x + this.size / 2) * s, cy = this.cy * s;
        const r = (this.size / 2) * s;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(this.angle);
        glow(ctx, fxOn, theme.obstacle, 16, beatPulse);
        ctx.fillStyle = theme.obstacle;
        // četvorokraka zvezda (8 temena: vrh kraka / udubljenje)
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const rr = i % 2 === 0 ? r : r * 0.32;
            const a = (i / 8) * Math.PI * 2;
            const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        // središnja rupa + sjaj
        ctx.fillStyle = theme.floor;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(0, 0, r * 0.1, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
    getHitbox() { return { x: this.x + 6, y: GROUND_Y - 60, w: this.size - 12, h: 32 }; }
    get offscreen() { return this.x + this.size < 0; }
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
