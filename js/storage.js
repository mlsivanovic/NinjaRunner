// storage.js — tanki wrapperi nad localStorage. Sve vrednosti se čuvaju kao JSON.
// (Stare vrednosti su brojevi/boolean/JSON nizovi, pa JSON.parse radi unazad-kompatibilno.)

export function load(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        return JSON.parse(raw);
    } catch (e) {
        return fallback;
    }
}

export function save(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        // localStorage može biti nedostupan (privatni mod) — tiho ignorišemo.
    }
}
