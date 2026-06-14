// audio.js — zvučni efekti, muzika po nivou i "beat clock" za pulsiranje vizuala.
// Sve gracefully radi i ako audio fajlovi ne postoje (igra je tada tiha).

import { load, save } from './storage.js';
import { STORAGE_KEYS } from './config.js';

let muted = load(STORAGE_KEYS.muted, false);

// Helper koji pravi Audio objekat otporan na fajl-koji-ne-postoji.
function makeSound(src, { loop = false, volume = 1 } = {}) {
    const a = new Audio(src);
    a.loop = loop;
    a.volume = volume;
    a.addEventListener('error', () => { a._broken = true; });
    return a;
}

const sfx = {
    jump: makeSound('assets/jump.mp3', { volume: 0.6 }),
    death: makeSound('assets/gameover.mp3', { volume: 0.7 }),
    coin: makeSound('assets/coin.mp3', { volume: 0.5 }),
    orb: makeSound('assets/orb.mp3', { volume: 0.5 }),
    pad: makeSound('assets/pad.mp3', { volume: 0.5 }),
    complete: makeSound('assets/complete.mp3', { volume: 0.8 })
};

let music = null;        // trenutna pozadinska numera
let musicStartTime = 0;  // performance.now() kada je muzika krenula (za beat fallback)

export function isMuted() { return muted; }

export function toggleMute() {
    muted = !muted;
    save(STORAGE_KEYS.muted, muted);
    if (muted && music) music.pause();
    else if (!muted && music) music.play().catch(() => {});
    return muted;
}

export function playSfx(name) {
    if (muted) return;
    const s = sfx[name];
    if (!s || s._broken) return;
    try {
        s.currentTime = 0;
        s.play().catch(() => {});
    } catch (e) { /* ignore */ }
}

// Učitava i (po potrebi) pušta muziku za nivo. src može biti null (npr. endless).
export function setMusic(src) {
    if (music) { music.pause(); music = null; }
    if (src) {
        music = makeSound(src, { loop: true, volume: 0.4 });
    }
    musicStartTime = performance.now();
    if (music && !muted) music.play().catch(() => {});
}

export function restartMusic() {
    musicStartTime = performance.now();
    if (music) {
        try { music.currentTime = 0; } catch (e) {}
        if (!muted) music.play().catch(() => {});
    }
}

export function pauseMusic() { if (music) music.pause(); }
export function resumeMusic() { if (music && !muted) music.play().catch(() => {}); }
export function stopMusic() {
    if (music) { music.pause(); try { music.currentTime = 0; } catch (e) {} }
}

// Beat pulse: vraća 0..1 koji raste na svaki "kucaj" pa opada (za pulsiranje vizuala).
// Koristi vreme muzike ako svira, inače slobodan sat preko performance.now().
export function getBeatPulse(bpm) {
    if (!bpm) return 0;
    const beatLen = 60 / bpm; // sekundi po otkucaju
    let t;
    if (music && !music._broken && !music.paused && music.currentTime > 0) {
        t = music.currentTime;
    } else {
        t = (performance.now() - musicStartTime) / 1000;
    }
    const phase = (t % beatLen) / beatLen; // 0..1 unutar otkucaja
    // Oštar napad na 0, pa eksponencijalno opadanje — daje "puls" osećaj.
    return Math.pow(1 - phase, 2.2);
}
