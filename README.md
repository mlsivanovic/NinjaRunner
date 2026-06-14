# 🥷 Ninja Dash

Neon 2D platformer inspirisan **Geometry Dash-om**, napisan u čistom (vanilla) JavaScriptu nad HTML5 Canvas-om. Trči, skači i čuči kroz ručno dizajnirane nivoe pune šiljaka, blokova, odskočnih tabli i orbova — sve uz pulsiranje vizuala u ritmu i živopisne neon teme.

🎮 **Igraj online:** [mlsivanovic.github.io/NinjaRunner](https://mlsivanovic.github.io/NinjaRunner/)

> Igra je **PWA** — može da se instalira na telefon/desktop i igra offline.

---

## ✨ Mogućnosti

- 🗺️ **Kampanja** — 5 ručno dizajniranih nivoa sa rastućom težinom (*Neon Dojo → Sunset Sprint → Toxic Temple → Deep Dive → Inferno Finale*), progress bar i otključavanje nivoa redom
- ⚡ **Geometry Dash smrt** — jedan udarac = trenutni restart nivoa, uz brojač pokušaja
- 🏋️ **Practice mod** — postavljaj checkpoint-e i vežbaj teške deonice
- ∞ **Endless mod** — beskonačni izazov sa 3 života, proceduralnim preprekama i boss borbom
- 🎯 **Mehanike** — dupli skok, odskočne table, vazdušni orbovi, solidni blokovi/platforme
- 🌈 **Neon estetika** — gradijent pozadine, glow efekti, trag iza igrača, screen shake, color-shift zone i **pulsiranje u ritmu (beat-sync)**
- 🛒 **Prodavnica** — otključaj nindžu i 6 geometrijskih oblika (kocka, krug, trougao…) za skupljene novčiće
- ♿ **FX toggle** — isključi efekte (reduce-motion) jednim klikom

## 🎮 Kontrole

| Akcija | Tastatura | Touch |
|--------|-----------|-------|
| Skok (drži za viši, dupli u vazduhu) | `Space` / `↑` / `W` | leva polovina ekrana |
| Čučanj | `↓` / `S` | desna polovina ekrana |
| Pauza | `P` / `Esc` | dugme ⏸️ |
| Checkpoint (practice) | `Z` | — |

## 🚀 Lokalno pokretanje

Nema build koraka. Pošto se koristi service worker, igri treba HTTP server (ne `file://`):

```bash
git clone https://github.com/mlsivanovic/NinjaRunner.git
cd NinjaRunner
python3 -m http.server 8000
# pa otvori http://localhost:8000
```

## 🗂️ Struktura projekta

```
index.html        — DOM: canvas, HUD, ekrani
style.css         — neon stilovi
manifest.json     — PWA manifest
sw.js             — service worker (cache-first)
js/
  config.js       — konstante, skaliranje, neon teme
  storage.js      — localStorage
  audio.js        — zvuk + beat clock
  input.js        — tastatura + touch
  player.js       — igrač (oblici, trag, fizika)
  entities.js     — prepreke, novčići, boss, pozadina
  levels.js       — nivoi + spawner + endless generator
  ui.js           — ekrani i HUD
  game.js         — game loop, kolizije, wiring
```

Detaljnije o arhitekturi: [AGENTS.md](AGENTS.md).

## 🛠️ Tehnologije

Vanilla JavaScript (ES moduli) · HTML5 Canvas 2D · CSS3 · PWA (service worker + manifest) · GitHub Pages (auto-deploy sa `main`).

> **Napomena:** zvučni fajlovi (`assets/*.mp3`) i ikone nisu uključeni u repo — igra radi i bez njih (tiha, uz vizuelni beat-sync fallback). Dodaj svoje `.mp3` fajlove za pun doživljaj.
