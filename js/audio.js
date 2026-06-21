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

let perfStart = performance.now(); // slobodan sat za beat dok muzika ne svira

function buildGraph() {
    masterGain = ctx.createGain();
    masterGain.gain.value = muted ? 0 : 1;
    masterGain.connect(ctx.destination);

    musicGain = ctx.createGain();
    musicGain.gain.value = 0.32;
    musicGain.connect(masterGain);

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
    const stepDur = (60 / curBpm) / 4; // 16-tina
    while (nextNoteTime < ctx.currentTime + 0.12) {
        scheduleStep(absStep, nextNoteTime, stepDur);
        absStep++;
        nextNoteTime += stepDur;
    }
}

function scheduleStep(abs, when, stepDur) {
    const T = curTheme;
    const stepInBar = abs % 16;
    const chord = T.prog[Math.floor(abs / 16) % T.prog.length];
    const root = T.key + chord.off;
    const iv = chord.type === 'min' ? [0, 3, 7] : [0, 4, 7];
    const beatDur = stepDur * 4;
    const barDur = stepDur * 16;

    // PAD — na početku takta, spor attack, dug rep
    if (stepInBar === 0) {
        iv.forEach(s => voice({ freq: mtof(root + 12 + s), type: 'sawtooth', unison: 2, spread: 8, dur: barDur * 0.98, attack: 0.5, release: 0.6, gain: 0.035, filterFreq: 1600, dest: musicGain, sendDelay: 0.12, when }));
    }
    // BAS — na svaki otkucaj
    if (stepInBar % 4 === 0) {
        voice({ freq: mtof(root), type: 'sawtooth', unison: 2, spread: 6, dur: beatDur * 0.92, attack: 0.01, release: 0.08, gain: 0.14, filterFreq: 700, q: 1, dest: musicGain, when });
    }
    // ARP — osmine kroz delay
    if (stepInBar % 2 === 0) {
        const n = root + 24 + iv[(stepInBar / 2) % 3];
        voice({ freq: mtof(n), type: 'triangle', dur: stepDur * 1.6, release: 0.12, gain: 0.05, dest: musicGain, sendDelay: 0.3, when });
    }
    // DRUMS — mek kick na 1&3, hat na 2&4 + tihi off-beat hatovi
    if (stepInBar === 0 || stepInBar === 8) kick(when);
    if (stepInBar === 4 || stepInBar === 12) hat(when, 0.05);
    else if (stepInBar % 4 === 2) hat(when, 0.02);
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
    stopScheduler();
    resetSequencer();
    startScheduler();
}

export function restartMusic() {
    if (!musicActive || !ctx) return;
    musicPaused = false;
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
    stopScheduler();
}

// Beat pulse: 0..1 koji skoči na otkucaj pa opada (za pulsiranje vizuala).
// Koristi ctx sat dok muzika svira, inače slobodan performance.now() sat.
export function getBeatPulse(bpm) {
    if (!bpm) return 0;
    const beatLen = 60 / bpm;
    let t;
    if (ctx && musicActive && !musicPaused) t = ctx.currentTime - musicStartCtxTime;
    else t = (performance.now() - perfStart) / 1000;
    const phase = ((t % beatLen) + beatLen) % beatLen / beatLen;
    return Math.pow(1 - phase, 2.2);
}
