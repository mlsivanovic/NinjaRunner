// levels.js — ručno dizajnirani nivoi, runtime spawner (vođen pozicijom) i endless generator.

import { THEMES, DEFAULT_THEME, lerpTheme, GROUND_Y, screenLogicalWidth } from './config.js';
import { Spike, Block, JumpPad, JumpOrb, Coin,
         DuckBarrier, Saw, MovingPlatform, Laser, CrumblePlatform, Pit, Shield, ExtraLife, GRID } from './entities.js';

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
    // --- nove prepreke / platforme / pickupi ---
    duckbar() { this.els.push({ type: 'duckbar', x: this.x }); this.x += 46; return this; }
    saw(y) { this.els.push({ type: 'saw', x: this.x, y }); this.x += 56; return this; }
    mover(w = 2, baseY, amp) { this.els.push({ type: 'mover', x: this.x, w, baseY, amp }); this.x += w * GRID; return this; }
    // Statična lebdeća platforma (ledge) na zadatoj visini — pravi mover sa amp=0 (puna kolizija, bez kretanja).
    ledge(w = 2, y = GROUND_Y - 140) { this.els.push({ type: 'mover', x: this.x, w, baseY: y, amp: 0 }); this.x += w * GRID; return this; }
    laser(opts) { this.els.push({ type: 'laser', x: this.x, opts }); this.x += 26; return this; }
    // Laser varijante po visini (reuse Laser.gapY/gapH):
    laserJump(opts = {}) { return this.laser({ gapY: GROUND_Y - 255, gapH: 390, ...opts }); } // nizak snop pri tlu → PRESKOK
    laserDuck(opts = {}) { return this.laser({ gapY: GROUND_Y - 17, gapH: 36, ...opts }); }    // visok snop → ČUČANJ
    laserGap(opts = {}) { return this.laser({ gapY: GROUND_Y - 150, gapH: 180, ...opts }); }    // otvor u sredini → uskoči skokom
    crumble(w = 2, h = 1) { this.els.push({ type: 'crumble', x: this.x, w, h }); this.x += w * GRID; return this; }
    pit(w = 3) { this.els.push({ type: 'pit', x: this.x, w }); this.x += w * GRID; return this; }
    // Provalija premošćena pokretnom platformom (jaši je preko rupe).
    pitMover(w = 5) {
        const px = this.x;
        this.els.push({ type: 'pit', x: px, w });
        this.els.push({ type: 'mover', x: px + 20, w: 2, baseY: GROUND_Y - 80, amp: 45 });
        this.x += w * GRID;
        return this;
    }
    shield(y) { this.els.push({ type: 'shield', x: this.x, y }); this.x += 40; return this; }
    life(y) { this.els.push({ type: 'life', x: this.x, y }); this.x += 36; return this; }
    build(meta) {
        return { ...meta, length: this.x + 900, elements: this.els, zones: this.zones };
    }
}

// --- LEVEL 1: Neon Dojo — uvod; nežno uvodi solidne blokove, ledge, laser i provaliju ---
const L1 = new LevelBuilder()
    .gap(300).spike()
    .gap(360).coinArc(3)
    .gap(340).block(1, 1)                                  // prvi solidni blok (preskoči ili stani na njega)
    .gap(300).spike(2)
    .gap(360).ledge(2, GROUND_Y - 130).gap(60).coin(GROUND_Y - 180)   // prvi lebdeći ledge
    .gap(300).pad().gap(220).coin(GROUND_Y - 270)
    .gap(340).spike()
    .gap(340).block(2, 1).gap(110).coinArc(3)
    .gap(340).duckbar()
    .gap(340).laserGap({ onFrames: 55, offFrames: 85 })   // lagani laser (uskoči u otvor)
    .gap(340).spike(2)
    .gap(320).orb(GROUND_Y - 190)
    .gap(320).pit(2)                                       // uska prva provalija
    .gap(340).ledge(2, GROUND_Y - 140).gap(55).ledge(2, GROUND_Y - 200).gap(60).coinArc(3)  // stepenice naviše
    .gap(320).spike(2)
    .gap(340).shield(GROUND_Y - 120)
    .gap(320).block(1, 2).gap(70).spike(2)
    .gap(340).duckbar()
    .gap(340).coinArc(4)
    .gap(340).spike(2)
    .gap(360).pit(3)
    .gap(360).spike(2)
    .build({ id: 'l1', name: 'Neon Dojo', theme: 'cyanPurple', speed: 4.5, bpm: 128, music: 'assets/level1.mp3', boss: { hp: 12 } });

// --- LEVEL 2: Sunset Sprint — ledge+blok kombinacije, laser na čučanj, prve šire provalije ---
const L2 = new LevelBuilder()
    .gap(300).spike(2)
    .gap(340).block(1, 1).gap(70).spike()
    .gap(320).ledge(2, GROUND_Y - 140).gap(50).coin(GROUND_Y - 195)
    .gap(320).pad().gap(230).coin(GROUND_Y - 300)
    .gap(320).spike(3)
    .shift('sunset')
    .gap(340).block(1, 2).gap(60).spike(2)
    .gap(320).laserDuck({ onFrames: 70, offFrames: 65 })  // čučni ispod snopa
    .gap(320).orb(GROUND_Y - 220)
    .gap(300).spike(2)
    .gap(340).ledge(2, GROUND_Y - 150).gap(55).ledge(2, GROUND_Y - 230).gap(60).coinArc(4)
    .gap(320).duckbar().gap(300).saw()
    .gap(340).pit(3)
    .gap(340).block(2, 1).gap(80).spike(2)
    .gap(320).laserGap({ onFrames: 60, offFrames: 70 })
    .gap(320).spike(3)
    .gap(340).crumble(2, 1).gap(140).coinArc(3)
    .gap(340).mover(2, GROUND_Y - 120, 60).gap(160).coin(GROUND_Y - 205)
    .gap(320).spike(2)
    .gap(340).duckbar()
    .gap(320).block(1, 2).gap(70).block(1, 1)
    .gap(340).laserDuck({ onFrames: 65, offFrames: 65 })
    .gap(340).spike(3)
    .gap(360).pit(3)
    .gap(360).spike(2)
    .build({ id: 'l2', name: 'Sunset Sprint', theme: 'cyanPurple', speed: 5, bpm: 132, music: 'assets/level2.mp3', boss: { hp: 16 } });

// --- LEVEL 3: Toxic Temple — vertikalno platformisanje, laser preskok+otvor, više provalija, vazdušne testere ---
const L3 = new LevelBuilder()
    .gap(280).spike(2)
    .gap(320).pad().gap(230).orb(GROUND_Y - 250)
    .gap(300).spike(3)
    .gap(320).block(1, 2).gap(60).spike(2)
    .shift('toxic')
    .gap(320).ledge(2, GROUND_Y - 130).gap(55).ledge(2, GROUND_Y - 200).gap(55).ledge(2, GROUND_Y - 270).gap(70).coinArc(3)  // stepenice
    .gap(300).spike(3)
    .gap(320).laserJump({ onFrames: 60, offFrames: 75 })  // preskoči nizak snop
    .gap(300).saw(GROUND_Y - 150)
    .gap(300).spike(2).gap(70).block(1, 2)
    .gap(320).pit(3)
    .gap(320).orb(GROUND_Y - 220).gap(240).orb(GROUND_Y - 300)
    .gap(300).spike(3)
    .gap(320).laserGap({ onFrames: 65, offFrames: 60 })
    .gap(300).duckbar().gap(280).saw()
    .gap(320).mover(2, GROUND_Y - 130, 70).gap(160).coinArc(3)
    .gap(320).crumble(2, 1)
    .gap(340).pitMover(5)                                  // most preko široke provalije (odskočna platforma)
    .gap(300).spike(3)
    .gap(320).ledge(2, GROUND_Y - 150).gap(55).ledge(2, GROUND_Y - 240).gap(60).coinArc(4)
    .gap(300).laserDuck({ onFrames: 70, offFrames: 55 })
    .gap(300).spike(3)
    .gap(320).block(1, 2).gap(60).spike(2)
    .gap(320).pit(4)
    .gap(320).shield(GROUND_Y - 120)
    .gap(300).spike(3)
    .gap(340).pit(3)
    .gap(340).spike(3)
    .build({ id: 'l3', name: 'Toxic Temple', theme: 'toxic', speed: 5.4, bpm: 140, music: 'assets/level3.mp3', boss: { hp: 20 } });

// --- LEVEL 4: Deep Dive — gusto; laser parovi (čučanj→preskok), moveri/odskoci preko provalija ---
const L4 = new LevelBuilder()
    .gap(260).spike(3)
    .gap(300).block(1, 2).gap(55).spike(2)
    .gap(300).pad().gap(230).orb(GROUND_Y - 270)
    .shift('deepBlue')
    .gap(300).laserDuck({ onFrames: 70, offFrames: 55 }).gap(260).laserJump({ onFrames: 60, offFrames: 70 })  // čučni → preskoči
    .gap(300).spike(3).gap(65).block(1, 1)
    .gap(300).ledge(2, GROUND_Y - 150).gap(50).ledge(2, GROUND_Y - 240).gap(55).coinArc(3)
    .gap(300).saw(GROUND_Y - 150).gap(260).saw()
    .gap(300).spike(4)
    .gap(300).pit(4)
    .gap(300).block(2, 2)
    .gap(300).laserGap({ onFrames: 70, offFrames: 50 })
    .gap(280).spike(3).gap(65).pad()
    .gap(260).coinArc(4)
    .gap(300).duckbar().gap(280).saw()
    .gap(320).pitMover(6)
    .gap(300).mover(2, GROUND_Y - 130, 80).gap(150).orb(GROUND_Y - 260)
    .gap(300).ledge(2, GROUND_Y - 160).gap(50).ledge(2, GROUND_Y - 250).gap(50).ledge(2, GROUND_Y - 300)
    .gap(280).spike(4)
    .gap(300).laserDuck({ onFrames: 75, offFrames: 50 })
    .gap(300).pit(4)
    .gap(280).block(1, 3).gap(60).spike(2)
    .gap(300).shield(GROUND_Y - 120)
    .gap(300).spike(4)
    .gap(320).pit(3)
    .gap(320).spike(3)
    .build({ id: 'l4', name: 'Deep Dive', theme: 'deepBlue', speed: 6, bpm: 145, music: 'assets/level4.mp3', boss: { hp: 26 } });

// --- LEVEL 5: Inferno Finale — najteži; laserski gauntlet, najšire provalije, visoke stepenice, sve odjednom ---
const L5 = new LevelBuilder()
    .gap(240).spike(3)
    .gap(280).block(1, 2).gap(50).spike(3)
    .gap(280).pad().gap(210).orb(GROUND_Y - 280)
    .gap(260).spike(4)
    .shift('inferno')
    .gap(280).laserDuck({ onFrames: 75, offFrames: 45 }).gap(240).laserJump({ onFrames: 65, offFrames: 60 }).gap(240).laserGap({ onFrames: 70, offFrames: 50 })  // gauntlet: čučanj→preskok→otvor
    .gap(280).spike(4)
    .gap(280).ledge(2, GROUND_Y - 150).gap(50).ledge(2, GROUND_Y - 240).gap(50).ledge(2, GROUND_Y - 320).gap(60).coinArc(4)
    .gap(260).saw(GROUND_Y - 150).gap(230).saw()
    .gap(280).spike(4)
    .gap(280).pit(5)
    .gap(280).block(2, 2).gap(55).spike(3)
    .gap(280).duckbar().gap(240).saw().gap(240).duckbar()
    .gap(280).orb(GROUND_Y - 250)
    .gap(260).spike(4)
    .gap(280).laserGap({ onFrames: 75, offFrames: 45, offset: 30 })
    .gap(300).pitMover(6)
    .gap(280).mover(2, GROUND_Y - 130, 85).gap(140).mover(2, GROUND_Y - 210, 70)
    .gap(280).spike(4)
    .gap(280).crumble(2, 1).gap(120).crumble(2, 1)
    .gap(280).laserDuck({ onFrames: 80, offFrames: 45 })
    .gap(260).spike(4)
    .gap(280).pit(5)
    .gap(280).ledge(2, GROUND_Y - 160).gap(45).ledge(2, GROUND_Y - 260).gap(55).coinArc(4)
    .gap(280).block(1, 3).gap(55).spike(3)
    .gap(280).laserJump({ onFrames: 70, offFrames: 50 })
    .gap(280).pit(4)
    .gap(280).shield(GROUND_Y - 120)
    .gap(260).spike(4)
    .gap(320).spike(4)
    .build({ id: 'l5', name: 'Inferno Finale', theme: 'inferno', speed: 6.6, bpm: 150, music: 'assets/level5.mp3', boss: { hp: 32 } });

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
        case 'duckbar': return new DuckBarrier(sx);
        case 'saw': return new Saw(sx, el.y);
        case 'mover': return new MovingPlatform(sx, el.w || 2, el.baseY != null ? el.baseY : (GROUND_Y - 120), el.amp != null ? el.amp : 70);
        case 'laser': return new Laser(sx, el.opts || {});
        case 'crumble': return new CrumblePlatform(sx, el.w || 2, el.h || 1);
        case 'pit': return new Pit(sx, el.w || 3);
        case 'shield': return new Shield(sx, el.y);
        case 'life': return new ExtraLife(sx, el.y);
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
        // Boss arena: malo pre cilja zaustavi napredak i pokreni borbu (null = bez bosa).
        this.bossConfig = level.boss || null;
        this.bossArenaX = this.bossConfig ? this.length - screenLogicalWidth() - 200 : Infinity;
        this.reset();
    }

    reset() {
        this.worldX = 0;
        this.spawnIndex = 0;
        this.entities = [];
        this.spawnPaused = false;
        this.frozen = false; // zamrznut napredak sveta (tokom boss borbe)
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
        if (!this.frozen) this.worldX += this.speed; // zamrznuto tokom boss borbe → finished se ne okida

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
    get reachedBossArena() { return this.worldX >= this.bossArenaX; }

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

        // Bazni (uvek dostupni) obrasci — uključuju nove prepreke za raznolikost.
        const base = [
            () => { this.elements.push({ type: 'spike', x }); },
            () => { this.elements.push({ type: 'pad', x }); this.elements.push({ type: 'coin', x: x + 200, y: GROUND_Y - 300 }); },
            () => { this.elements.push({ type: 'orb', x, y: GROUND_Y - 200 }); },
            () => { for (let i = 0; i < 3; i++) this.elements.push({ type: 'coin', x: x + i * 45, y: GROUND_Y - 90 - Math.sin((i / 2) * Math.PI) * 120 }); },
            () => { this.elements.push({ type: 'duckbar', x }); },
            () => { this.elements.push({ type: 'mover', x, w: 2, baseY: GROUND_Y - 110, amp: 60 }); this.elements.push({ type: 'coin', x: x + 50, y: GROUND_Y - 175 }); },
            () => { this.elements.push({ type: 'mover', x, w: 2, baseY: GROUND_Y - 140, amp: 0 }); this.elements.push({ type: 'coin', x: x + 50, y: GROUND_Y - 195 }); } // statični ledge
        ];
        // Teški obrasci — verovatnoća raste sa težinom.
        const hard = [
            () => { this.elements.push({ type: 'spike', x }); this.elements.push({ type: 'spike', x: x + 45 }); },
            () => { this.elements.push({ type: 'block', x, w: 1, h: 1 }); this.elements.push({ type: 'spike', x: x + 70 }); },
            () => { this.elements.push({ type: 'saw', x }); },
            () => { this.elements.push({ type: 'duckbar', x }); this.elements.push({ type: 'spike', x: x + 230 }); },
            () => { this.elements.push({ type: 'crumble', x, w: 2, h: 1 }); this.elements.push({ type: 'coin', x: x + 50, y: GROUND_Y - 80 }); },
            () => { this.elements.push({ type: 'pit', x, w: 2 }); },
            () => { this.elements.push({ type: 'laser', x, opts: { gapY: GROUND_Y - 17, gapH: 36, onFrames: 70, offFrames: 60 } }); } // laser na čučanj
        ];
        // Veoma teški — samo na većoj težini.
        const veryHard = [
            () => { this.elements.push({ type: 'laser', x, opts: { onFrames: 60, offFrames: 80 } }); },
            () => { this.elements.push({ type: 'saw', x }); this.elements.push({ type: 'saw', x: x + 120, y: GROUND_Y - 150 }); },
            () => { this.elements.push({ type: 'pit', x, w: 3 }); },
            () => { this.elements.push({ type: 'pit', x, w: 4 }); this.elements.push({ type: 'mover', x: x + 20, w: 2, baseY: GROUND_Y - 80, amp: 45 }); },
            () => { this.elements.push({ type: 'laser', x, opts: { gapY: GROUND_Y - 255, gapH: 390, onFrames: 60, offFrames: 70 } }); } // laser preskok
        ];

        for (let i = 0; i < 14; i++) {
            const r = Math.random();
            if (r < 0.03) { this.elements.push({ type: 'shield', x, y: GROUND_Y - 130 }); }       // retki štit
            else if (r < 0.05) { this.elements.push({ type: 'life', x, y: GROUND_Y - 130 }); }     // ređi život
            else {
                const roll = Math.random();
                let pool;
                if (diff > 0.35 && roll < 0.18) pool = veryHard;
                else if (roll < 0.3 + diff * 0.3) pool = hard;
                else pool = base;
                pool[Math.floor(Math.random() * pool.length)]();
            }
            x += minGap + Math.random() * 160;
        }
        this._endlessCursor = x;
        this.elements.sort((a, b) => a.x - b.x);
    }
}
