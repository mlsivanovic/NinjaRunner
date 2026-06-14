// player.js — igrač (nindža ili geometrijski oblik), fizika skoka/čučnja, neon trag i glow.

import { view, getScale, GROUND_Y } from './config.js';

// Skinovi: kombinacija oblika + boje + boje traga. Otključavaju se u shop-u za novčiće.
export const SKINS = [
    { name: 'Ninja',     shape: 'ninja',    price: 0,    color: '#ffffff', trail: '#00e5ff' },
    { name: 'Cube',      shape: 'cube',     price: 100,  color: '#00e5ff', trail: '#00e5ff' },
    { name: 'Orb',       shape: 'circle',   price: 200,  color: '#39ff14', trail: '#39ff14' },
    { name: 'Spike',     shape: 'triangle', price: 300,  color: '#ff2e88', trail: '#ff2e88' },
    { name: 'Gold',      shape: 'cube',     price: 600,  color: '#ffd000', trail: '#ffd000' },
    { name: 'Plasma',    shape: 'circle',   price: 1000, color: '#b14dff', trail: '#e000ff' },
    { name: 'Ghost',     shape: 'ninja',    price: 1500, color: '#a0ffe0', trail: '#00ffd0' }
];

export class Player {
    constructor() {
        this.x = 140;
        this.width = 50;
        this.height = 50;
        this.jumpForce = 16;
        this.gravity = 0.62;
        this.maxJumps = 2;
        this.skin = SKINS[0];
        this.trail = [];
        this.reset();
    }

    setSkin(skin) { this.skin = skin; }

    reset() {
        this.y = GROUND_Y - this.height;
        this.dy = 0;
        this.rotation = 0;
        this.isGrounded = true;
        this.isJumping = false;
        this.isDucking = false;
        this.jumpCount = 0;
        this.invuln = 0; // frejmovi neranjivosti (endless mod)
        this.trail = [];
    }

    // Skok: isStart=true na pritisak, false na puštanje (za varijabilnu visinu).
    jump(isStart) {
        if (isStart) {
            if (!this.isDucking && (this.isGrounded || this.jumpCount < this.maxJumps)) {
                this.dy = -this.jumpForce;
                this.isGrounded = false;
                this.isJumping = true;
                this.jumpCount++;
                return true; // uspeo skok (game.js pušta zvuk)
            }
        } else {
            this.isJumping = false;
        }
        return false;
    }

    // Spoljni odskok (jump pad / orb) — postavlja vertikalnu brzinu direktno.
    bounce(force) {
        this.dy = -force;
        this.isGrounded = false;
        this.isJumping = true;
        this.jumpCount = 1; // dozvoljava još jedan vazdušni skok posle pada
    }

    update() {
        if (this.invuln > 0) this.invuln--;

        // Varijabilna visina skoka: ako igrač pusti taster dok ide gore, brže pada.
        let g = this.gravity;
        if (this.dy < 0 && !this.isJumping) g = this.gravity * 2.4;

        this.dy += g;
        this.y += this.dy;

        // Rotacija u vazduhu (GD osećaj), poravnanje na tlu.
        if (!this.isGrounded) this.rotation += 0.16;

        // Trag: pamtimo centar igrača.
        this.trail.push({ x: this.x + this.width / 2, y: this.y + this.height / 2 });
        if (this.trail.length > 14) this.trail.shift();
    }

    // Rešava sletanje na zadati nivo poda (GROUND_Y ili vrh bloka). Vraća true ako je sleteo.
    resolveFloor(floorY) {
        if (this.dy >= 0 && this.y + this.height >= floorY) {
            this.y = floorY - this.height;
            this.dy = 0;
            this.isGrounded = true;
            this.isJumping = false;
            this.jumpCount = 0;
            // Poravnaj rotaciju na najbliži pun krug.
            this.rotation = Math.round(this.rotation / (Math.PI / 2)) * (Math.PI / 2);
            return true;
        }
        this.isGrounded = false;
        return false;
    }

    // "Forgiving" hitbox — manji od vizuelnog tela; čučanj smanjuje visinu.
    getHitbox() {
        const w = this.width * 0.6;
        const fullH = this.isDucking ? this.height * 0.45 : this.height * 0.85;
        const x = this.x + (this.width - w) / 2;
        const y = this.isDucking ? this.y + this.height - fullH : this.y + (this.height - fullH) / 2;
        return { x, y, w, h: fullH };
    }

    draw(fxOn, beatPulse) {
        const ctx = view.ctx;
        const scale = getScale();
        const accent = this.skin.color;

        // --- Trag ---
        if (fxOn && this.trail.length > 1) {
            for (let i = 0; i < this.trail.length; i++) {
                const t = this.trail[i];
                const a = (i / this.trail.length);
                ctx.save();
                ctx.globalAlpha = a * 0.45;
                ctx.fillStyle = this.skin.trail;
                ctx.shadowBlur = 12 * scale;
                ctx.shadowColor = this.skin.trail;
                const r = (this.width * 0.28) * a * scale;
                ctx.beginPath();
                ctx.arc(t.x * scale, t.y * scale, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }

        const drawX = this.x * scale;
        const drawW = this.width * scale;
        const drawH = (this.isDucking ? this.height * 0.55 : this.height) * scale;
        const topY = (this.isDucking ? this.y + this.height * 0.45 : this.y) * scale;
        const cx = drawX + drawW / 2;
        const cy = topY + drawH / 2;

        ctx.save();
        if (fxOn) {
            ctx.shadowBlur = (14 + beatPulse * 10) * scale;
            ctx.shadowColor = accent;
        }
        ctx.fillStyle = accent;

        if (this.skin.shape === 'ninja') {
            this._drawNinja(ctx, cx, cy, drawW, drawH);
        } else {
            // Geometrijski oblici rotiraju oko centra (GD kocka).
            ctx.translate(cx, cy);
            ctx.rotate(this.rotation);
            this._drawShape(ctx, drawW, drawH, scale);
        }
        ctx.restore();
    }

    _drawShape(ctx, w, h, scale) {
        const s = Math.min(w, h);
        ctx.lineWidth = 3 * scale;
        if (this.skin.shape === 'cube') {
            ctx.fillRect(-s / 2, -s / 2, s, s);
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 0.8;
            ctx.fillRect(-s * 0.18, -s * 0.18, s * 0.36, s * 0.36); // unutrašnji sjaj
        } else if (this.skin.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(0, 0, s / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.beginPath();
            ctx.arc(-s * 0.12, -s * 0.12, s * 0.16, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.skin.shape === 'triangle') {
            ctx.beginPath();
            ctx.moveTo(0, -s / 2);
            ctx.lineTo(s / 2, s / 2);
            ctx.lineTo(-s / 2, s / 2);
            ctx.closePath();
            ctx.fill();
        }
    }

    _drawNinja(ctx, cx, cy, w, h) {
        // Ljudska figura; rotira blago samo dok je u vazduhu.
        ctx.translate(cx, cy + h / 2);
        if (!this.isGrounded) ctx.rotate(this.rotation);

        if (!this.isDucking) {
            ctx.beginPath();
            ctx.arc(0, -h * 0.85, w * 0.3, 0, Math.PI * 2); // glava
            ctx.fill();
            ctx.fillRect(-w * 0.08, -h * 0.75, w * 0.16, h * 0.05); // vrat
            ctx.fillRect(-w * 0.25, -h * 0.7, w * 0.5, h * 0.4);    // torzo
            ctx.fillRect(-w * 0.25, -h * 0.3, w * 0.15, h * 0.3);   // leva noga
            ctx.fillRect(w * 0.1, -h * 0.3, w * 0.15, h * 0.3);     // desna noga
            ctx.fillRect(-w * 0.4, -h * 0.65, w * 0.12, h * 0.35);  // leva ruka
            ctx.fillRect(w * 0.28, -h * 0.65, w * 0.12, h * 0.35);  // desna ruka
            // povez
            ctx.strokeStyle = this.skin.trail;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-w * 0.1, -h * 0.85);
            ctx.lineTo(-w * 0.45, -h * 0.8);
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.arc(0, -h * 0.5, w * 0.28, 0, Math.PI * 2); // glava (niže)
            ctx.fill();
            ctx.fillRect(-w * 0.35, -h * 0.35, w * 0.7, h * 0.35); // skupljeno telo
        }

        // oči
        ctx.fillStyle = '#0a0a1a';
        const eyeY = this.isDucking ? -h * 0.52 : -h * 0.87;
        ctx.fillRect(w * 0.08, eyeY, 6, 3);
    }
}
