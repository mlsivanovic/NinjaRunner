# AGENTS.md — Ninja Dash

Smernice za AI agente koji rade na ovom projektu.

## Šta je ovo

**Ninja Dash** je 2D neon platformer inspirisan Geometry Dash-om, napisan u čistom (vanilla) JavaScriptu nad HTML5 Canvas-om. Igrač (nindža ili geometrijski oblik) trči, skače i čuči kroz ručno dizajnirane nivoe pune šiljaka, blokova, odskočnih tabli i orbova; skuplja novčiće i troši ih na skinove. Igra je PWA i deploy-uje se na GitHub Pages.

- **Jezik:** JavaScript (ES moduli, bez transpilacije), HTML, CSS
- **Render:** HTML5 Canvas 2D API
- **Komentari u kodu su na srpskom** — nastavi tu konvenciju.
- **Bez build sistema, bez dependency-ja** (nema `package.json`/`node_modules`). Statički fajlovi; `index.html` učitava `<script type="module" src="js/game.js">`.

## Struktura projekta

| Fajl | Uloga |
|------|-------|
| [index.html](index.html) | DOM: canvas, HUD, ekrani (meni, level-select, complete, game-over, shop, pauza). Registruje SW. |
| [style.css](style.css) | Neon stilovi: gradijenti, glow, level-select grid, progress bar, oblici u shop-u. |
| [js/config.js](js/config.js) | Konstante (`LOGICAL_WIDTH/HEIGHT`, `GROUND_Y`), `view`+`getScale()`, `STORAGE_KEYS`, `THEMES`, `lerpTheme`. |
| [js/storage.js](js/storage.js) | localStorage wrapperi (`load`/`save`, JSON, `ninja`-prefiks). |
| [js/audio.js](js/audio.js) | SFX/muzika (otporno na nedostajuće fajlove) + **beat clock** (`getBeatPulse(bpm)`). |
| [js/input.js](js/input.js) | Tastatura + touch → akcije; `setHandlers()` registruje callback-ove. |
| [js/player.js](js/player.js) | `Player` klasa: skok/duck, oblici, neon trag, glow, neranjivost. `SKINS[]`. |
| [js/entities.js](js/entities.js) | `Spike`, `Block`, `JumpPad`, `JumpOrb`, `Coin`, `DuckBarrier`, `Saw`, `MovingPlatform` (amp=0 → statični „ledge"), `Laser` (otvor po visini), `CrumblePlatform`, `Pit`, `Shield`, `ExtraLife`, `FlyingCoin`, `Particle`, `Shuriken` (boss, čučanj), `Boss`, `BackgroundLayer`. `GRID`. |
| [js/levels.js](js/levels.js) | `LEVELS` (5 ručnih nivoa, `LevelBuilder`), `LevelRuntime` (spawner), endless generator. |
| [js/ui.js](js/ui.js) | Sav DOM: ekrani, HUD, level-select/shop render, callbacks. |
| [js/game.js](js/game.js) | **Entry modul:** state machine, game loop, kolizije, wiring. Sadrži `init()`. |
| [manifest.json](manifest.json) / [sw.js](sw.js) | PWA manifest i service worker (cache-first). |
| [.github/workflows/deploy.yml](.github/workflows/deploy.yml) | Auto-deploy na GitHub Pages pri push-u na `main`. |

## Ključni koncepti

### Koordinate i skaliranje
Sve se računa na **logičkoj skali** `1200×600`, `GROUND_Y=450`. `view` (u config.js) drži canvas/ctx/scale; `getScale()` = `view.h / LOGICAL_HEIGHT`. **Svako crtanje množi logičke koordinate sa `scale`.** Entiteti crtaju preko `view.ctx` direktno.

### State machine i modovi (game.js)
`state`: `MENU → PLAYING → (DEAD | COMPLETE | GAMEOVER)`. `mode`: `CAMPAIGN` | `PRACTICE` | `ENDLESS`.
- **CAMPAIGN:** šiljak/blok = **instant smrt** → restart nivoa od početka; brojač pokušaja.
- **PRACTICE:** isto, ali respawn na poslednjem checkpoint-u (auto svakih ~1800 jedinica + ručno taster `Z`).
- **ENDLESS:** zadržava **3 života + neranjivost** (opušteni mod), proceduralni spawn, boss na score 800.

### LevelRuntime (levels.js)
Nivo = elementi na apsolutnim `x` pozicijama + tema/BPM/dužina. Runtime vodi `worldX` (raste za `speed`/frejm), spawnuje elemente kad uđu na ekran (`x = el.x - worldX`), uklanja one van ekrana. `progress = worldX/length`, `finished` na kraju. `getTheme()` daje glatke color-shift prelaze. `seek()` za practice respawn; `spawnPaused` za boss.

### Mehanike / kolizije
`Spike` = instant smrt. `Block` = solidan (sletanje odozgo preko `resolveFloor()`, bočni sudar = smrt; **mora imati `solidTop=true`**). `JumpPad` = auto-odskok. `JumpOrb` = skok u vazduhu uz njega (aktivira se u `doJump()`). `Coin` = sakupljanje. `MovingPlatform`/`CrumblePlatform`/`Block` dele `solidTop` granu (sletanje vs bok). `MovingPlatform` sa `amp=0` = statični ledge (`LevelBuilder.ledge(w,y)`). `Laser` = vertikalni snop sa otvorom; helperi `laserJump`/`laserDuck`/`laserGap` biraju visinu otvora. `DuckBarrier`/`Shuriken` = promaši se čučnjem. `Pit` = pad u provaliju → smrt; **`player.fallingPit` „zaključava" pad** u `resolveFloor()` da rupa koja odscrolluje ne „spasi" igrača. Boss naizmenično baca `Spike` (skok) / `Shuriken` (čučanj) / `Laser` (poravnaj skok). Hitbox-evi su „forgiving" (`getHitbox()`).

### Vizuali
Per-nivo neon teme (gradijent pozadine, grid pod, glow). **Beat clock** pulsira pozadinu/pod/glow uz BPM. Trag iza igrača, screen shake na smrt/pad. **FX toggle** (`✨`/`🌙` dugme, `ninjaFX`) gasi sve efekte (reduce-motion).

## Kontrole
- **Tastatura:** `Space`/`↑`/`W` skok (drži za viši, double-jump), `↓`/`S` čučanj, `P`/`Esc` pauza, `Z` checkpoint (practice).
- **Touch:** leva pola ekrana = skok, desna = čučanj.

## Perzistencija (localStorage, `ninja`-prefiks)
`ninjaMuted`, `ninjaFX`, `ninjaHighScore`, `ninjaTotalCoins`, `ninjaUnlockedSkins`, `ninjaCurrentSkin`, `ninjaLevelProgress` (`{id:%}`), `ninjaLevelComplete` (`[id]`), `ninjaAttempts` (`{id:n}`). Ključevi su u `STORAGE_KEYS` (config.js).

## Pokretanje
Nema build korak. Service worker zahteva HTTP (ne `file://`):
```bash
python3 -m http.server 8000   # pa otvori http://localhost:8000
```

### Service worker keš — VAŽNO
`sw.js` je cache-first. **Pri izmeni bilo kog keširanog fajla povećaj `CACHE_NAME`** (trenutno `ninja-dash-v21`), inače igrači dobijaju staru verziju. Resursi su podeljeni na `CORE` (mora postojati, `addAll`) i `OPTIONAL` (audio/ikone, `allSettled` — nedostajući fajl ne ruši install).

### Nedostajući asset-i
Audio (`assets/level1-5.mp3`, `music.mp3`, `jump/gameover/coin/orb/pad/complete.mp3`) i `icon-192/512.png` **ne postoje u repo-u**. Kod gracefully radi bez njih (igra je tiha; beat clock ima free-run fallback). Korisnik treba da ih obezbedi.

## Konvencije za agente
- **Drži vanilla / ES module** — bez framework-a, bundler-a, npm dependency-ja osim ako korisnik traži.
- **Komentari na srpskom.**
- Crtanje uvek skaliraj preko `getScale()`; ne hardkoduj stvarne piksele.
- Novo trajno stanje → `STORAGE_KEYS` + `load`/`save` iz storage.js.
- Posle izmena keširanih fajlova **podigni `CACHE_NAME`** u sw.js (i `ASSETS`/`OPTIONAL` ako menjaš listu).
- Brza provera bez browsera: `node --check` nad modulima (kao ESM) hvata sintaksu; runtime se može smoke-testirati stub-ovanjem DOM/Canvas/Audio i pumpanjem `requestAnimationFrame`.
