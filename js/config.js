// config.js — centralne konstante, view (canvas), storage ključevi i neon teme.
// Igra se interno računa na logičkoj skali; sve crtanje se množi sa view.scale.

export const LOGICAL_WIDTH = 1200;
export const LOGICAL_HEIGHT = 600;
export const GROUND_Y = 450;       // nivo tla u logičkim koordinatama
export const FLOOR_HEIGHT = LOGICAL_HEIGHT - GROUND_Y; // visina poda ispod linije tla

// Deljeni view objekat — popunjava ga initView()/resize(), koriste ga svi moduli za crtanje.
export const view = { canvas: null, ctx: null, scale: 1, w: 0, h: 0 };

export function initView() {
    view.canvas = document.getElementById('gameCanvas');
    view.ctx = view.canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
}

export function resize() {
    view.canvas.width = window.innerWidth;
    view.canvas.height = window.innerHeight;
    view.w = view.canvas.width;
    view.h = view.canvas.height;
    view.scale = view.h / LOGICAL_HEIGHT;
}

export const getScale = () => view.scale;
// Logička širina koja stane na trenutni ekran (za spawnovanje na desnoj ivici).
export const screenLogicalWidth = () => view.w / view.scale;

// localStorage ključevi (svi sa "ninja" prefiksom radi konzistentnosti).
export const STORAGE_KEYS = {
    muted: 'ninjaMuted',
    fx: 'ninjaFX',                 // efekti uključeni (true) / reduce-motion (false)
    highScore: 'ninjaHighScore',   // endless rekord
    coins: 'ninjaTotalCoins',
    unlockedSkins: 'ninjaUnlockedSkins',
    currentSkin: 'ninjaCurrentSkin',
    levelProgress: 'ninjaLevelProgress',   // { levelId: best% }
    levelComplete: 'ninjaLevelComplete',   // [levelId, ...]
    attempts: 'ninjaAttempts'              // { levelId: brojPokušaja }
};

// Neon palete tema. Svaka tema: gradijent pozadine (od vrha ka dnu), boja poda/grida,
// accent (glow) boja i boja prepreka. Koriste ih nivoi i color-shift zone.
export const THEMES = {
    cyanPurple: {
        bgTop: '#1a0b2e', bgBottom: '#3d1e6d',
        floor: '#2a1a4a', grid: '#7b4dff', accent: '#00e5ff', obstacle: '#ff2e88'
    },
    sunset: {
        bgTop: '#2b1055', bgBottom: '#7597de',
        floor: '#3a1c5a', grid: '#ff7e5f', accent: '#feb47b', obstacle: '#ff3860'
    },
    toxic: {
        bgTop: '#0a2a1a', bgBottom: '#10502f',
        floor: '#0d3320', grid: '#39ff14', accent: '#aaff00', obstacle: '#ff1493'
    },
    deepBlue: {
        bgTop: '#02010a', bgBottom: '#0a1a4a',
        floor: '#06102e', grid: '#2e6bff', accent: '#00b3ff', obstacle: '#ff4d6d'
    },
    inferno: {
        bgTop: '#1a0000', bgBottom: '#5a0a0a',
        floor: '#200505', grid: '#ff6b00', accent: '#ffd000', obstacle: '#ff2e2e'
    }
};

export const DEFAULT_THEME = 'cyanPurple';

// Linearna interpolacija dve boje (hex) — za glatke color-shift prelaze.
export function lerpColor(a, b, t) {
    const ca = hexToRgb(a), cb = hexToRgb(b);
    const r = Math.round(ca.r + (cb.r - ca.r) * t);
    const g = Math.round(ca.g + (cb.g - ca.g) * t);
    const bl = Math.round(ca.b + (cb.b - ca.b) * t);
    return `rgb(${r}, ${g}, ${bl})`;
}

function hexToRgb(hex) {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const num = parseInt(full, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

// Lerp između dve cele teme (za color-shift zone).
export function lerpTheme(a, b, t) {
    return {
        bgTop: lerpColor(a.bgTop, b.bgTop, t),
        bgBottom: lerpColor(a.bgBottom, b.bgBottom, t),
        floor: lerpColor(a.floor, b.floor, t),
        grid: lerpColor(a.grid, b.grid, t),
        accent: lerpColor(a.accent, b.accent, t),
        obstacle: lerpColor(a.obstacle, b.obstacle, t)
    };
}
