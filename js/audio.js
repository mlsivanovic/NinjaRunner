// audio.js — proceduralni zvuk (Web Audio API): synthwave muzika po nivou,
// zvučni efekti i "beat clock" za pulsiranje vizuala. Ništa se ne učitava sa diska —
// sve se sintetizuje u kodu, pa radi offline i bez ikakvih audio fajlova.

import { load, save } from './storage.js';
import { STORAGE_KEYS } from './config.js';

let muted = load(STORAGE_KEYS.muted, false);

// ---------- AudioContext i graf čvorova (lenjo se kreira na prvi gest) ----------
let ctx = null;
let masterGain = null;   // glavni izlaz; mute = rampa na 0
let musicGain = null;    // bus za muziku
let sfxGain = null;      // bus za efekte
let delaySend = null;    // ulaz u feedback-delay (synthwave "dreamy" rep)
let pumpGain = null;     // sidechain "pump" bus za tonske slojeve (pad/bas/arp/lead)

let perfStart = performance.now(); // slobodan sat za beat dok muzika ne svira

function buildGraph() {
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 1;
    masterGain.connect(ctx.destination);

    musicGain = ctx.createGain();
    musicGain.gain.value = MUSIC_GAIN;
    musicGain.connect(masterGain);

    pumpGain = ctx.createGain(); // tonski slojevi prolaze ovde i "pumpaju" na svaki kick
    pumpGain.gain.value = 1;
    pumpGain.connect(musicGain);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.5;
    sfxGain.connect(masterGain);

    // Feedback delay: send -> delay -> lowpass -> (master + nazad u delay)
    delaySend = ctx.createGain();
    const delay = ctx.createDelay(1.0);
    delay.delayTime.value = 0.26;
    const dfb = ctx.createGain();
    dfb.gain.value = 0.3;
    const dlp = ctx.createBiquadFilter();
    dlp.type = 'lowpass';
    dlp.frequency.value = 2000;
    delaySend.connect(delay);
    delay.connect(dlp);
    dlp.connect(masterGain);
    dlp.connect(dfb);
    dfb.connect(delay);
}

function ensureCtx() {
    if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        buildGraph();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
}

// Defanzivno: probudi kontekst na prvi korisnički gest (ako je usnuo).
function armResume() {
    const r = () => { if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); };
    window.addEventListener('pointerdown', r);
    window.addEventListener('keydown', r);
    window.addEventListener('touchstart', r);
}
armResume();

// ---------- Sintetski glasovi ----------
const mtof = m => 440 * Math.pow(2, (m - 69) / 12); // MIDI broj -> frekvencija

// Oscilatorski glas sa lowpass filterom i AD+release envelope-om.
// Podržava unison (zadebljanje detune-om) i pitch/filter glide.
function voice(o) {
    if (!ctx) return;
    const t0 = o.when != null ? o.when : ctx.currentTime;
    const dur = o.dur ?? 0.3, attack = o.attack ?? 0.005, release = o.release ?? 0.08;
    const gain = o.gain ?? 0.3, type = o.type || 'sawtooth';
    const count = o.unison || 1, spread = o.spread || 0;

    const g = ctx.createGain();
    let input = g;
    if (o.filterFreq) {
        const f = ctx.createBiquadFilter();
        f.type = o.filterType || 'lowpass';
        f.frequency.setValueAtTime(o.filterFreq, t0);
        if (o.filterTo) f.frequency.linearRampToValueAtTime(o.filterTo, t0 + dur);
        f.Q.value = o.q ?? 0.7;
        f.connect(g);
        input = f;
    }
    for (let i = 0; i < count; i++) {
        const osc = ctx.createOscillator();
        osc.type = type;
        const det = count > 1 ? (-spread + 2 * spread * (i / (count - 1))) : 0;
        osc.frequency.setValueAtTime(o.freq, t0);
        if (o.slideTo) osc.frequency.linearRampToValueAtTime(o.slideTo, t0 + dur);
        osc.detune.setValueAtTime(det + (o.detune || 0), t0);
        osc.connect(input);
        osc.start(t0);
        osc.stop(t0 + dur + 0.03);
    }
    const peak = gain / Math.sqrt(count); // da unison ne klipuje
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.setValueAtTime(peak, Math.max(t0 + attack, t0 + dur - release));
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    g.connect(o.dest || sfxGain);
    if (o.sendDelay) {
        const s = ctx.createGain();
        s.gain.value = o.sendDelay;
        g.connect(s);
        s.connect(delaySend);
    }
}

// Kratak filtrirani šum (hat, whoosh, pucanje).
function noise(o) {
    if (!ctx) return;
    const t0 = o.when != null ? o.when : ctx.currentTime;
    const dur = o.dur ?? 0.2;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.value = o.freq ?? 2000;
    f.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(o.gain ?? 0.2, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(o.dest || sfxGain);
    src.start(t0); src.stop(t0 + dur + 0.02);
}

function kick(when) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, when);
    osc.frequency.exponentialRampToValueAtTime(48, when + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(0.5, when + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.2);
    osc.connect(g); g.connect(musicGain);
    osc.start(when); osc.stop(when + 0.22);
}
const hat = (when, gain) => noise({ dur: 0.05, gain, filter: 'highpass', freq: 7000, q: 0.7, dest: musicGain, when });

// ---------- Zvučni efekti (synthwave: meki talasi + delay) ----------
const SFX = {
    jump: () => voice({ freq: 330, slideTo: 640, type: 'triangle', dur: 0.18, gain: 0.4, release: 0.1, sendDelay: 0.12 }),
    death: () => {
        voice({ freq: 300, slideTo: 90, type: 'sawtooth', unison: 3, spread: 14, dur: 0.6, gain: 0.32, filterFreq: 1400, filterTo: 300, release: 0.4, sendDelay: 0.25 });
        voice({ freq: 150, slideTo: 60, type: 'sine', dur: 0.6, gain: 0.2, release: 0.4 });
    },
    coin: () => {
        const t = ctx.currentTime;
        voice({ freq: mtof(88), type: 'sine', dur: 0.1, gain: 0.3, sendDelay: 0.25, when: t });
        voice({ freq: mtof(95), type: 'sine', dur: 0.14, gain: 0.3, sendDelay: 0.25, when: t + 0.07 });
    },
    orb: () => {
        const t = ctx.currentTime;
        [79, 84, 91].forEach((n, i) => voice({ freq: mtof(n), type: 'sine', dur: 0.3, gain: 0.22, release: 0.2, sendDelay: 0.35, when: t + i * 0.06 }));
    },
    pad: () => voice({ freq: 180, slideTo: 560, type: 'triangle', dur: 0.24, gain: 0.4, release: 0.12, sendDelay: 0.1 }),
    complete: () => {
        const t = ctx.currentTime;
        [72, 76, 79, 84].forEach((n, i) => voice({ freq: mtof(n), type: 'triangle', dur: 0.35, gain: 0.28, release: 0.25, sendDelay: 0.3, when: t + i * 0.12 }));
        [60, 64, 67].forEach(n => voice({ freq: mtof(n), type: 'sawtooth', unison: 2, spread: 8, dur: 1.0, gain: 0.05, attack: 0.05, release: 0.6, filterFreq: 1800, when: t }));
    },
    laser: () => {
        voice({ freq: 900, type: 'sawtooth', dur: 0.3, gain: 0.26, filterFreq: 3500, filterTo: 400, q: 6, release: 0.2, sendDelay: 0.15 });
        noise({ dur: 0.12, gain: 0.12, filter: 'bandpass', freq: 2500, q: 1 });
    },
    shuriken: () => noise({ dur: 0.18, gain: 0.18, filter: 'bandpass', freq: 3200, q: 1.4 }),
    crumble: () => {
        noise({ dur: 0.32, gain: 0.22, filter: 'lowpass', freq: 500, q: 1 });
        voice({ freq: 110, slideTo: 70, type: 'sawtooth', unison: 2, spread: 12, dur: 0.3, gain: 0.16, filterFreq: 600, release: 0.2 });
    },
    shop: () => {
        const t = ctx.currentTime;
        [67, 71, 74].forEach((n, i) => voice({ freq: mtof(n), type: 'triangle', dur: 0.22, gain: 0.26, release: 0.16, sendDelay: 0.25, when: t + i * 0.07 }));
    },
    click: () => voice({ freq: 880, type: 'sine', dur: 0.05, gain: 0.16, attack: 0.002, release: 0.03 })
};

export function playSfx(name) {
    if (muted) return;
    if (!ensureCtx()) return;
    const f = SFX[name];
    if (!f) return;
    try { f(); } catch (e) { /* ignore */ }
}

// ---------- Proceduralna muzika (synthwave sekvenser) ----------
// Mol-progresije (i–VI–III–VII i varijante); ključ je MIDI broj, off je polustepen pomak.
const MUSIC_THEMES = {
    l1: { key: 45, prog: [{ off: 0, type: 'min' }, { off: -4, type: 'maj' }, { off: 3, type: 'maj' }, { off: -2, type: 'maj' }] }, // A: Am-F-C-G
    l2: { key: 50, prog: [{ off: 0, type: 'min' }, { off: -4, type: 'maj' }, { off: 3, type: 'maj' }, { off: -2, type: 'maj' }] }, // D: Dm-Bb-F-C
    l3: { key: 52, prog: [{ off: 0, type: 'min' }, { off: -4, type: 'maj' }, { off: -2, type: 'maj' }, { off: 0, type: 'min' }] }, // E: Em-C-D-Em
    l4: { key: 48, prog: [{ off: 0, type: 'min' }, { off: -4, type: 'maj' }, { off: 3, type: 'maj' }, { off: -2, type: 'maj' }] }, // C: Cm-Ab-Eb-Bb
    l5: { key: 54, prog: [{ off: 0, type: 'min' }, { off: -4, type: 'maj' }, { off: -2, type: 'maj' }, { off: 0, type: 'min' }] }, // F#: F#m-D-E-F#m
    endless: { key: 47, prog: [{ off: 0, type: 'min' }, { off: -4, type: 'maj' }, { off: 3, type: 'maj' }, { off: -2, type: 'maj' }] } // B: Bm-G-D-A
};
const TEMPO = { l1: 128, l2: 132, l3: 140, l4: 145, l5: 150, endless: 135 };

function themeKey(src) {
    if (!src) return 'endless';
    const m = src.match(/level(\d)/);
    return m ? 'l' + m[1] : 'endless';
}

let schedulerId = null;
let nextNoteTime = 0;
let absStep = 0;             // apsolutni 16-tinski korak
let curTheme = null;
let curBpm = 128;
let musicActive = false;     // ima učitanu numeru (između setMusic i stopMusic)
let musicPaused = false;
let musicStartCtxTime = 0;   // ctx.currentTime kada je takt 0 krenuo (za beat puls)
let tempoMul = 1;            // progresivno ubrzanje (1.0 = osnovni tempo nivoa)
let bossMode = false;        // dramatičan boss aranžman + brži tempo
let beatPhase = 0;           // akumulirana faza beat pulsa (radi i pri promeni tempa)
let beatLastT = null;        // poslednji ctx.currentTime viđen u getBeatPulse

const MUSIC_GAIN = 0.32, BOSS_MUSIC_GAIN = 0.42;
const BOSS_TEMPO_MUL = 1.12; // boss je toliko brži od trenutnog (već ubrzanog) tempa
const BOSS_PROG = [{ off: 0, type: 'min' }, { off: 8, type: 'maj' }, { off: 7, type: 'maj' }, { off: 0, type: 'min' }]; // i–bVI–V–i (napeto)

// Efektivni tempo: osnovni × progresivno ubrzanje, a u boss modu dodatno ubrzano.
function effectiveBpm() { return curBpm * (bossMode ? tempoMul * BOSS_TEMPO_MUL : tempoMul); }

function resetSequencer() {
    absStep = 0;
    const t0 = ctx.currentTime + 0.08;
    nextNoteTime = t0;
    musicStartCtxTime = t0;
}

function startScheduler() {
    if (schedulerId == null) schedulerId = setInterval(scheduler, 25);
}
function stopScheduler() {
    if (schedulerId != null) { clearInterval(schedulerId); schedulerId = null; }
}

function scheduler() {
    if (!ctx || !curTheme || musicPaused) return;
    const stepDur = (60 / effectiveBpm()) / 4; // 16-tina (uklj. ubrzanje/boss)
    while (nextNoteTime < ctx.currentTime + 0.12) {
        scheduleStep(absStep, nextNoteTime, stepDur);
        absStep++;
        nextNoteTime += stepDur;
    }
}

// Glavni rif (lead) — sinkopiran, sa pauzama; brojevi su stepenici mol-pentatonike,
// null = pauza. 32 koraka (2 takta); svira u refrenu radi pamtljivosti/uzbuđenja.
const PENTA = [0, 3, 5, 7, 10];
const scaleNote = d => PENTA[((d % 5) + 5) % 5] + 12 * Math.floor(d / 5);
const LEAD = [
    0, null, 2, 3, null, 2, null, 4,    3, null, null, 2, null, 0, 2, null,
    4, null, 3, 4, null, 5, null, 4,    3, null, 2, null, 0, null, 2, null
];

// Riser pred refren: rastući šum + ton (napetost, "diže se").
function riser(when, dur) {
    noise({ dur, gain: 0.06, filter: 'bandpass', freq: 1200, q: 0.5, dest: musicGain, when });
    voice({ freq: 200, slideTo: 1600, type: 'sawtooth', dur, attack: 0.05, release: 0.05, gain: 0.04, filterFreq: 4000, dest: musicGain, when });
}

// Sidechain "pump": na svaki kick utišaj tonski bus pa ga brzo vrati (groove/energija).
function pump(when, beatDur) {
    if (!pumpGain) return;
    const g = pumpGain.gain;
    g.cancelScheduledValues(when);
    g.setValueAtTime(0.5, when);
    g.linearRampToValueAtTime(1, when + Math.min(0.3, beatDur * 0.95));
}

function scheduleStep(abs, when, stepDur) {
    const T = curTheme;
    const boss = bossMode;
    const prog = boss ? BOSS_PROG : T.prog;
    const stepInBar = abs % 16;
    const bar = Math.floor(abs / 16);
    const chord = prog[bar % prog.length];
    const root = T.key + chord.off;
    const iv = chord.type === 'min' ? [0, 3, 7] : [0, 4, 7];
    const beatDur = stepDur * 4;
    const barDur = stepDur * 16;

    // Struktura: 8-taktni ciklus → strofa (0–3) pa refren (4–7, jači + lead).
    const cycleBar = bar % 8;
    const chorus = boss || cycleBar >= 4;   // boss ide stalno na "refren" energiji
    const build = cycleBar / 7;             // 0..1 kroz ciklus (otvaranje filtera)
    const lastVerseBar = cycleBar === 3;    // pred refren → riser
    const lastBar = cycleBar === 7;         // pred loop → fill
    const arpCut = (boss ? 1700 : 800) + (chorus ? 2400 : 1300) * (0.4 + 0.6 * build);

    // ---------- PAD ----------
    if (stepInBar === 0) {
        const pg = chorus ? 0.045 : 0.03;
        iv.forEach(s => voice({ freq: mtof(root + 12 + s), type: 'sawtooth', unison: 2, spread: chorus ? 11 : 7, dur: barDur * 0.98, attack: chorus ? 0.15 : 0.5, release: 0.6, gain: pg, filterFreq: 1400 + 1000 * build, dest: pumpGain, sendDelay: 0.12, when }));
        if (boss) voice({ freq: mtof(root - 12), type: 'sawtooth', unison: 2, spread: 8, dur: barDur * 0.98, attack: 0.15, release: 0.5, gain: 0.06, filterFreq: 480, dest: pumpGain, when }); // boss dron
    }

    // ---------- BAS (na otkucaj) + outrun offbeat pluck u refrenu ----------
    if (stepInBar % 4 === 0) {
        voice({ freq: mtof(root), type: 'sawtooth', unison: 2, spread: 6, dur: beatDur * 0.5, attack: 0.005, release: 0.06, gain: 0.16, filterFreq: 850, q: 1, dest: pumpGain, when });
    }
    if (chorus && stepInBar % 2 === 1) {
        voice({ freq: mtof(root + 12), type: 'sawtooth', dur: stepDur * 0.9, attack: 0.004, release: 0.05, gain: 0.09, filterFreq: 1300, dest: pumpGain, when });
    }

    // ---------- ARP (strofa: osmine/triangle; refren: 16-tine/saw, svetliji) ----------
    const arpEvery = chorus ? 1 : 2;
    if (stepInBar % arpEvery === 0) {
        const ai = Math.floor(stepInBar / arpEvery) % 3;
        const oct = stepInBar % 8 >= 4 ? 12 : 0;
        voice({ freq: mtof(root + 24 + iv[ai] + oct), type: chorus ? 'sawtooth' : 'triangle', dur: stepDur * (chorus ? 1.0 : 1.6), release: 0.1, gain: chorus ? 0.045 : 0.05, filterFreq: arpCut, dest: pumpGain, sendDelay: 0.28, when });
    }

    // ---------- LEAD (pamtljiv rif u refrenu; ne u bossu da ne bije sa V akordom) ----------
    if (chorus && !boss) {
        const d = LEAD[abs % 32];
        if (d != null) {
            const f = mtof(T.key + 24 + scaleNote(d));
            voice({ freq: f, type: 'square', dur: stepDur * 2.2, attack: 0.005, release: 0.18, gain: 0.07, filterFreq: 2600 + 1400 * build, q: 1, dest: pumpGain, sendDelay: 0.33, when });
            voice({ freq: f * 2, type: 'triangle', dur: stepDur * 1.4, release: 0.12, gain: 0.018, dest: pumpGain, sendDelay: 0.3, when }); // tanak oktavni sjaj
        }
    }

    // ---------- DRUMS ----------
    const fourFloor = boss || chorus;
    if (fourFloor ? stepInBar % 4 === 0 : (stepInBar === 0 || stepInBar === 8)) { kick(when); pump(when, beatDur); }
    if (stepInBar === 4 || stepInBar === 12) {
        noise({ dur: 0.14, gain: 0.12, filter: 'highpass', freq: 1700, q: 0.7, dest: musicGain, when }); // snare/backbeat
        if (chorus) noise({ dur: 0.07, gain: 0.07, filter: 'bandpass', freq: 1600, q: 0.6, dest: musicGain, when }); // clap sloj
    }
    if (chorus) hat(when, stepInBar % 2 === 1 ? 0.03 : 0.016);    // 16-tine = drive
    else if (stepInBar % 2 === 1) hat(when, 0.025);               // strofa: offbeat 8-tine

    // ---------- RISER / FILL ----------
    if (lastVerseBar && stepInBar === 8) riser(when, barDur / 2);
    if (lastBar && stepInBar >= 12 && stepInBar % 2 === 0) noise({ dur: 0.07, gain: 0.1, filter: 'highpass', freq: 1700, q: 0.7, dest: musicGain, when }); // snare fill pred loop
}

// ---------- Javni API (isti potpis kao ranije) ----------
export function isMuted() { return muted; }

export function toggleMute() {
    muted = !muted;
    save(STORAGE_KEYS.muted, muted);
    if (ensureCtx()) {
        const t = ctx.currentTime;
        masterGain.gain.cancelScheduledValues(t);
        masterGain.gain.setValueAtTime(masterGain.gain.value, t);
        masterGain.gain.linearRampToValueAtTime(muted ? 0 : 1, t + 0.08);
    }
    return muted;
}

// Učitava/pušta muziku za nivo. src se mapira u temu, bpm zadaje tempo (fallback iz TEMPO).
export function setMusic(src, bpm) {
    if (!ensureCtx()) return;
    const key = themeKey(src);
    curTheme = MUSIC_THEMES[key] || MUSIC_THEMES.endless;
    curBpm = bpm || TEMPO[key] || 128;
    musicActive = true;
    musicPaused = false;
    tempoMul = 1;
    bossMode = false;
    if (musicGain) musicGain.gain.value = MUSIC_GAIN;
    stopScheduler();
    resetSequencer();
    startScheduler();
}

export function restartMusic() {
    if (!musicActive || !ctx) return;
    musicPaused = false;
    tempoMul = 1;
    bossMode = false;
    if (musicGain) musicGain.gain.value = MUSIC_GAIN;
    resetSequencer();
    startScheduler();
}

export function pauseMusic() {
    if (!musicActive || !ctx) return;
    musicPaused = true;
    stopScheduler();
    ctx.suspend().catch(() => {});
}

export function resumeMusic() {
    if (!musicActive || !ctx) return;
    musicPaused = false;
    ctx.resume().catch(() => {});
    nextNoteTime = Math.max(nextNoteTime, ctx.currentTime + 0.02);
    startScheduler();
}

export function stopMusic() {
    musicActive = false;
    musicPaused = false;
    tempoMul = 1;
    bossMode = false;
    if (musicGain) musicGain.gain.value = MUSIC_GAIN;
    stopScheduler();
}

// Progresivno ubrzanje muzike kako nivo napreduje (1.0 = osnovni tempo nivoa).
export function setTempo(mul) {
    tempoMul = Math.max(0.5, Math.min(2, mul || 1));
}

// Uključi/isključi dramatičan boss aranžman (napeta progresija, brže, glasnije).
export function setBossMode(on) {
    on = !!on;
    if (bossMode === on) return;
    bossMode = on;
    if (on) absStep = 0; // čist dramatičan ulaz od početka takta
    if (musicGain && ctx) {
        const t = ctx.currentTime;
        musicGain.gain.cancelScheduledValues(t);
        musicGain.gain.setValueAtTime(musicGain.gain.value, t);
        musicGain.gain.linearRampToValueAtTime(on ? BOSS_MUSIC_GAIN : MUSIC_GAIN, t + 0.3);
    }
}

// Beat pulse: 0..1 koji skoči na otkucaj pa opada (za pulsiranje vizuala).
// Akumulira fazu po efektivnom tempu — ostaje sinhron i pri ubrzavanju/boss modu.
export function getBeatPulse(bpm) {
    if (ctx && musicActive && !musicPaused) {
        const now = ctx.currentTime;
        let dt = beatLastT == null ? 0 : now - beatLastT;
        if (dt < 0 || dt > 0.25) dt = 0; // re-anchor posle pauze/skoka
        beatLastT = now;
        beatPhase = (beatPhase + dt * (effectiveBpm() / 60)) % 1;
        return Math.pow(1 - beatPhase, 2.2);
    }
    // Fallback: slobodan sat dok muzika ne svira (meni vizuali)
    beatLastT = null;
    if (!bpm) return 0;
    const beatLen = 60 / bpm;
    const t = (performance.now() - perfStart) / 1000;
    const phase = (((t % beatLen) + beatLen) % beatLen) / beatLen;
    return Math.pow(1 - phase, 2.2);
}
