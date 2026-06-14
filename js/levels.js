// levels.js — ručno dizajnirani nivoi, runtime spawner (vođen pozicijom) i endless generator.

import { THEMES, DEFAULT_THEME, lerpTheme, GROUND_Y, screenLogicalWidth } from './config.js';
import { Spike, Block, JumpPad, JumpOrb, Coin, GRID } from './entities.js';

// --- Builder: kompaktno "ručno" slaganje sekvenci uz pomeranje kursora po x-osi ---
class LevelBuilder {
    constructor() { this.x = 700; this.els = []; this.zones = []; }
    gap(d) { this.x += d; return this; }
    spike(n = 1) { for (let i = 0; i < n; i++) { this.els.push({ type: 'spike', x: this.x }); this.x += 45; } return this; }
    block(w = 1, h = 1) { this.els.push({ type: 'block', x: this.x, w, h }); this.x += w * GRID; return this; }
    pad() { this.els.push({ type: 'pad', x: this.x }); this.x += GRID; return this; }
    orb(y) { this.els.push({ type: 'orb', x: this.x, y }); this.x += 40; return this; }
    coin(y) { this.els.push({ type: 'coin', x: this.x, y: y != null ? y : GROUND_Y - 120 }); this.x += 40; return this; }
    coinArc(n = 3) { // luk novčića (nagrada za skok)
        for (let i = 0; i < n; i++) {
            const t = i / (n - 1);
            this.els.push({ type: 'coin', x: this.x, y: GROUND_Y - 90 - Math.sin(t * Math.PI) * 130 });
            this.x += 45;
        }
        return this;
    }
    shift(theme) { this.zones.push({ x: this.x, theme }); return this; }
    build(meta) {
        return { ...meta, length: this.x + 900, elements: this.els, zones: this.zones };
    }
}

// --- LEVEL 1: Neon Dojo — uvod, blagi razmaci ---
const L1 = new LevelBuilder()
    .gap(300).spike()
    .gap(380).spike()
    .gap(420).coinArc(3)
    .gap(200).spike(2)
    .gap(450).block(1, 1)
    .gap(360).pad()
    .gap(220).coin(GROUND_Y - 260)
    .gap(480).spike()
    .gap(400).block(2, 1).gap(120).coinArc(3)
    .gap(420).spike(2)
    .gap(500).orb(GROUND_Y - 190)
    .gap(380).spike()
    .gap(460).coinArc(4)
    .gap(420).spike(2)
    .build({ id: 'l1', name: 'Neon Dojo', theme: 'cyanPurple', speed: 4.5, bpm: 128, music: 'assets/level1.mp3' });

// --- LEVEL 2: Sunset Sprint — padovi i blokovi ---
const L2 = new LevelBuilder()
    .gap(320).spike(2)
    .gap(420).block(1, 1).gap(70).spike()
    .gap(400).pad().gap(250).coin(GROUND_Y - 300)
    .gap(360).spike(3)
    .shift('sunset')
    .gap(440).block(1, 2)
    .gap(360).orb(GROUND_Y - 220)
    .gap(300).spike(2)
    .gap(460).coinArc(4)
    .gap(380).block(2, 1).gap(80).spike(2)
    .gap(480).pad().gap(220).coinArc(3)
    .gap(400).spike(3)
    .gap(440).block(1, 1).gap(70).block(1, 2)
    .gap(420).spike(2)
    .build({ id: 'l2', name: 'Sunset Sprint', theme: 'cyanPurple', speed: 5, bpm: 132, music: 'assets/level2.mp3' });

// --- LEVEL 3: Toxic Temple — orbovi i platforming ---
const L3 = new LevelBuilder()
    .gap(300).spike(2)
    .gap(380).pad().gap(240).orb(GROUND_Y - 250)
    .gap(360).spike(3)
    .gap(420).block(1, 2).gap(60).spike(2)
    .shift('toxic')
    .gap(440).orb(GROUND_Y - 200).gap(260).orb(GROUND_Y - 280)
    .gap(360).spike(3)
    .gap(420).block(2, 1).coinArc(3)
    .gap(400).spike(2).gap(70).block(1, 2)
    .gap(460).pad().gap(220).coinArc(4)
    .gap(380).spike(3)
    .gap(420).orb(GROUND_Y - 230)
    .gap(360).spike(3)
    .gap(440).block(1, 1).gap(60).spike(2)
    .build({ id: 'l3', name: 'Toxic Temple', theme: 'toxic', speed: 5.4, bpm: 140, music: 'assets/level3.mp3' });

// --- LEVEL 4: Deep Dive — brzo i gusto ---
const L4 = new LevelBuilder()
    .gap(280).spike(3)
    .gap(360).block(1, 2).gap(60).spike(2)
    .gap(400).pad().gap(240).orb(GROUND_Y - 270)
    .shift('deepBlue')
    .gap(340).spike(3).gap(70).block(1, 1)
    .gap(420).orb(GROUND_Y - 210).gap(240).orb(GROUND_Y - 300)
    .gap(340).spike(4)
    .gap(420).block(2, 2)
    .gap(380).spike(3).gap(70).pad()
    .gap(260).coinArc(4)
    .gap(360).spike(3)
    .gap(420).block(1, 2).gap(60).block(1, 3)
    .gap(440).spike(3)
    .gap(400).pad().gap(220).orb(GROUND_Y - 260)
    .gap(360).spike(4)
    .build({ id: 'l4', name: 'Deep Dive', theme: 'deepBlue', speed: 6, bpm: 145, music: 'assets/level4.mp3' });

// --- LEVEL 5: Inferno Finale — najteži ---
const L5 = new LevelBuilder()
    .gap(260).spike(3)
    .gap(320).block(1, 2).gap(55).spike(3)
    .gap(360).pad().gap(220).orb(GROUND_Y - 280)
    .gap(300).spike(4)
    .shift('inferno')
    .gap(360).block(2, 2).gap(60).spike(2)
    .gap(380).orb(GROUND_Y - 220).gap(220).orb(GROUND_Y - 320)
    .gap(300).spike(4)
    .gap(360).block(1, 3).gap(55).block(1, 1)
    .gap(400).pad().gap(200).coinArc(5)
    .gap(320).spike(4)
    .gap(360).block(2, 1).gap(60).spike(3)
    .gap(380).orb(GROUND_Y - 250)
    .gap(300).spike(4)
    .gap(360).pad().gap(220).orb(GROUND_Y - 300)
    .gap(300).spike(4)
    .build({ id: 'l5', name: 'Inferno Finale', theme: 'inferno', speed: 6.6, bpm: 150, music: 'assets/level5.mp3' });

export const LEVELS = [L1, L2, L3, L4, L5];

export function getLevel(id) { return LEVELS.find(l => l.id === id); }

// element-spec -> instanca entiteta (pozicionirana relativno na trenutni worldX)
function makeEntity(el, worldX) {
    const sx = el.x - worldX;
    switch (el.type) {
        case 'spike': return new Spike(sx);
        case 'block': return new Block(sx, el.w || 1, el.h || 1);
        case 'pad': return new JumpPad(sx);
        case 'orb': return new JumpOrb(sx, el.y);
        case 'coin': return new Coin(sx, el.y);
        default: return null;
    }
}

// --- LevelRuntime: vodi worldX, spawnuje elemente, prati napredak i temu ---
export class LevelRuntime {
    constructor(level, { endless = false } = {}) {
        this.endless = endless;
        this.speed = level.speed;
        this.bpm = level.bpm;
        this.baseThemeKey = level.theme || DEFAULT_THEME;
        this.length = level.length || Infinity;
        this.elements = (level.elements || []).slice();
        this.zones = (level.zones || []).slice().sort((a, b) => a.x - b.x);
        this.TRANS = 500; // dužina lerp prelaza između tema
        this.reset();
    }

    reset() {
        this.worldX = 0;
        this.spawnIndex = 0;
        this.entities = [];
        this.spawnPaused = false;
        if (this.endless) { this._endlessCursor = 1500; this._appendEndlessChunk(); }
    }

    // Premotaj na zadatu poziciju (practice checkpoint): obriši entitete i podesi spawnIndex.
    seek(worldX) {
        this.worldX = worldX;
        this.entities = [];
        this.spawnIndex = 0;
        while (this.spawnIndex < this.elements.length && this.elements[this.spawnIndex].x < worldX) {
            this.spawnIndex++;
        }
    }

    update() {
        this.worldX += this.speed;

        // spawn elemenata koji ulaze sa desne strane (osim kad je spawn pauziran — npr. boss)
        const horizon = this.worldX + screenLogicalWidth() + 120;
        while (!this.spawnPaused && this.spawnIndex < this.elements.length &&
               this.elements[this.spawnIndex].x <= horizon) {
            const ent = makeEntity(this.elements[this.spawnIndex], this.worldX);
            if (ent) this.entities.push(ent);
            this.spawnIndex++;
        }
        if (this.endless && !this.spawnPaused && this.spawnIndex >= this.elements.length - 2) {
            this._appendEndlessChunk();
        }

        // kretanje + uklanjanje sa ekrana
        for (let i = this.entities.length - 1; i >= 0; i--) {
            this.entities[i].update(this.speed);
            if (this.entities[i].offscreen) this.entities.splice(i, 1);
        }

        // endless: postepeno ubrzanje
        if (this.endless) this.speed += 0.0015;
    }

    get progress() { return Math.min(1, this.worldX / this.length); }
    get finished() { return !this.endless && this.worldX >= this.length; }

    // Trenutna tema (uz glatke color-shift prelaze).
    getTheme() {
        let curKey = this.baseThemeKey, prevKey = this.baseThemeKey, zoneX = -Infinity;
        for (const z of this.zones) {
            if (this.worldX >= z.x) { prevKey = curKey; curKey = z.theme; zoneX = z.x; }
            else break;
        }
        if (zoneX === -Infinity) return THEMES[curKey];
        const t = Math.min(1, (this.worldX - zoneX) / this.TRANS);
        if (t >= 1) return THEMES[curKey];
        return lerpTheme(THEMES[prevKey], THEMES[curKey], t);
    }

    // --- Endless proceduralni generator ---
    _appendEndlessChunk() {
        let x = this._endlessCursor;
        const diff = Math.min(1, this.worldX / 12000); // 0..1 rampa težine
        const minGap = 360 - diff * 60 + this.speed * 18;
        const patterns = [
            () => { this.elements.push({ type: 'spike', x }); },
            () => { this.elements.push({ type: 'spike', x }); this.elements.push({ type: 'spike', x: x + 45 }); },
            () => { this.elements.push({ type: 'block', x, w: 1, h: 1 }); this.elements.push({ type: 'spike', x: x + 70 }); },
            () => { this.elements.push({ type: 'pad', x }); this.elements.push({ type: 'coin', x: x + 200, y: GROUND_Y - 300 }); },
            () => { this.elements.push({ type: 'orb', x, y: GROUND_Y - 200 }); },
            () => { for (let i = 0; i < 3; i++) this.elements.push({ type: 'coin', x: x + i * 45, y: GROUND_Y - 90 - Math.sin((i / 2) * Math.PI) * 120 }); }
        ];
        for (let i = 0; i < 14; i++) {
            const hard = Math.random() < 0.3 + diff * 0.3;
            patterns[hard ? Math.floor(Math.random() * 5) : Math.floor(Math.random() * patterns.length)]();
            x += minGap + Math.random() * 160;
        }
        this._endlessCursor = x;
        this.elements.sort((a, b) => a.x - b.x);
    }
}
