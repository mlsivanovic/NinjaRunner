// game.js — ulazni modul: state machine, glavna petlja, kolizije i povezivanje svih modula.

import {
    initView, view, getScale, GROUND_Y, LOGICAL_HEIGHT, LOGICAL_WIDTH,
    screenLogicalWidth, THEMES, DEFAULT_THEME, STORAGE_KEYS
} from './config.js';
import { load, save } from './storage.js';
import * as audio from './audio.js';
import { initInput, setHandlers } from './input.js';
import { Player, SKINS } from './player.js';
import { Particle, FlyingCoin, Boss, Spike, backgroundLayers } from './entities.js';
import { LEVELS, LevelRuntime } from './levels.js';
import * as ui from './ui.js';

// --- Stanje ---
let state = 'MENU';        // MENU | PLAYING | DEAD | COMPLETE | GAMEOVER
let mode = 'CAMPAIGN';     // CAMPAIGN | PRACTICE | ENDLESS
let paused = false;
let runtime = null;
let currentLevel = null;
let player = new Player();
let particles = [];
let flyingCoins = [];
let boss = null;
let nextBossScore = 800;
let campaignBossDone = false; // bos već pobeđen u ovom pokušaju (kampanja)
let bossLives = 0;            // bafer pogodaka tokom kampanjske boss borbe
const BOSS_LIVES = 3;

let frameCount = 0;
let floorScroll = 0;
let shakeMag = 0;

// Perzistentno
let coins = load(STORAGE_KEYS.coins, 0);
let fxOn = load(STORAGE_KEYS.fx, true);
let highScore = load(STORAGE_KEYS.highScore, 0);
let unlockedSkins = load(STORAGE_KEYS.unlockedSkins, [0]);
let currentSkin = load(STORAGE_KEYS.currentSkin, 0);
let levelProgress = load(STORAGE_KEYS.levelProgress, {});
let levelComplete = load(STORAGE_KEYS.levelComplete, []);
let attemptsMap = load(STORAGE_KEYS.attempts, {});

// Po rundi
let runCoins = 0;
let score = 0;
let lives = 3;
let attempts = 1;
let practiceSelected = false;
let checkpoints = [0];

// ---------- Pomoćne ----------
function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function shake(mag) { if (fxOn) shakeMag = Math.max(shakeMag, mag); }
function spawnParticles(x, y, color, n) {
    for (let i = 0; i < n; i++) particles.push(new Particle(x, y, color));
}
function currentTheme() { return runtime ? runtime.getTheme() : THEMES[DEFAULT_THEME]; }
function currentBpm() { return runtime ? runtime.bpm : 128; }
function playerCenter() { return { x: player.x + player.width / 2, y: player.y + player.height / 2 }; }

// ---------- Pokretanje modova ----------
function startLevel(level, practice) {
    currentLevel = level;
    mode = practice ? 'PRACTICE' : 'CAMPAIGN';
    runtime = new LevelRuntime(level, { endless: false });
    player.reset();
    particles = []; flyingCoins = []; boss = null;
    campaignBossDone = false; bossLives = 0;
    runCoins = 0; attempts = 1; checkpoints = [0];
    audio.setMusic(level.music);
    ui.hideAllScreens();
    ui.showHUD(true);
    ui.showProgress(true); ui.setProgress(0);
    ui.showScore(false); ui.showLives(false);
    ui.showAttempts(true); ui.setAttempts(1);
    ui.setCoins(coins);
    ui.setPracticeHint(practice);
    ui.showBossHud(false);
    paused = false;
    state = 'PLAYING';
}

function startEndless() {
    currentLevel = null;
    mode = 'ENDLESS';
    runtime = new LevelRuntime(
        { theme: 'deepBlue', speed: 4.5, bpm: 135, elements: [], zones: [] },
        { endless: true }
    );
    player.reset();
    particles = []; flyingCoins = []; boss = null;
    runCoins = 0; lives = 3; score = 0; nextBossScore = 800;
    audio.setMusic('assets/music.mp3');
    ui.hideAllScreens();
    ui.showHUD(true);
    ui.showProgress(false);
    ui.showScore(true); ui.setScore(0);
    ui.showLives(true); ui.setLives(3);
    ui.showAttempts(false);
    ui.setCoins(coins);
    ui.setPracticeHint(false);
    ui.showBossHud(false);
    paused = false;
    state = 'PLAYING';
}

function goMenu() {
    state = 'MENU';
    runtime = null; boss = null; paused = false;
    audio.stopMusic();
    ui.showHUD(false);
    ui.showScreen('menu-screen');
}

function openLevelSelect() {
    ui.buildLevelSelect(LEVELS, {
        progress: levelProgress,
        complete: levelComplete,
        onPlay: (lvl) => startLevel(lvl, practiceSelected)
    });
    ui.showScreen('level-select-screen');
}

function openShop() {
    ui.buildShop(SKINS, {
        coins, unlocked: unlockedSkins, current: currentSkin,
        onAction: handleShopAction
    });
    ui.showScreen('shop-screen');
}

function handleShopAction(index) {
    if (unlockedSkins.includes(index)) {
        currentSkin = index;
        save(STORAGE_KEYS.currentSkin, currentSkin);
        player.setSkin(SKINS[index]);
    } else {
        const skin = SKINS[index];
        if (coins >= skin.price) {
            coins -= skin.price;
            save(STORAGE_KEYS.coins, coins);
            unlockedSkins.push(index);
            save(STORAGE_KEYS.unlockedSkins, unlockedSkins);
            currentSkin = index;
            save(STORAGE_KEYS.currentSkin, currentSkin);
            player.setSkin(SKINS[index]);
        } else {
            return; // nedovoljno novčića
        }
    }
    openShop(); // ponovo iscrtaj
}

// ---------- Smrt / restart / kraj ----------
function campaignDeath() {
    if (state !== 'PLAYING') return;
    state = 'DEAD';
    attempts++;
    attemptsMap[currentLevel.id] = (attemptsMap[currentLevel.id] || 0) + 1;
    save(STORAGE_KEYS.attempts, attemptsMap);
    ui.setAttempts(attempts);
    const c = playerCenter();
    spawnParticles(c.x, c.y, player.skin.color, 45);
    shake(18);
    ui.flashDeath();
    audio.playSfx('death');
    setTimeout(() => {
        if (mode === 'PRACTICE') respawnCheckpoint();
        else restartLevel();
    }, 450);
}

function restartLevel() {
    runtime.reset();
    player.reset();
    particles = []; flyingCoins = [];
    boss = null; campaignBossDone = false; bossLives = 0;
    audio.restartMusic();
    ui.setProgress(0);
    ui.showBossHud(false);
    ui.showLives(false);
    ui.showProgress(true);
    ui.showAttempts(true);
    state = 'PLAYING';
}

function respawnCheckpoint() {
    const cp = checkpoints[checkpoints.length - 1] || 0;
    runtime.seek(cp);
    player.reset();
    particles = []; flyingCoins = [];
    state = 'PLAYING';
}

function completeLevel() {
    state = 'COMPLETE';
    ui.showBossHud(false);
    ui.showLives(false);
    audio.pauseMusic();
    audio.playSfx('complete');
    const bonus = 100;
    coins += bonus;
    save(STORAGE_KEYS.coins, coins);
    ui.setCoins(coins);
    levelProgress[currentLevel.id] = 100;
    save(STORAGE_KEYS.levelProgress, levelProgress);
    if (!levelComplete.includes(currentLevel.id)) {
        levelComplete.push(currentLevel.id);
        save(STORAGE_KEYS.levelComplete, levelComplete);
    }
    const c = playerCenter();
    spawnParticles(c.x, c.y, '#ffd000', 80);
    ui.showComplete({ name: currentLevel.name, coins: runCoins + bonus });
}

function endlessGameOver() {
    state = 'GAMEOVER';
    audio.stopMusic();
    audio.playSfx('death');
    if (score > highScore) { highScore = score; save(STORAGE_KEYS.highScore, highScore); }
    ui.showGameOver({ score, best: highScore });
}

// ---------- Kolizije / sakupljanje ----------
function collectCoin(coin) {
    coins++; runCoins++;
    save(STORAGE_KEYS.coins, coins);
    ui.setCoins(coins);
    flyingCoins.push(new FlyingCoin(coin.x + coin.width / 2, coin.y + coin.height / 2));
    spawnParticles(coin.x + coin.width / 2, coin.y + coin.height / 2, '#ffd000', 8);
    audio.playSfx('coin');
}

function onHazardHit(entity, index) {
    if (mode === 'ENDLESS') {
        if (player.invuln > 0) return false;
        lives--;
        ui.setLives(lives);
        player.invuln = 90;
        if (entity) runtime.entities.splice(index, 1);
        const c = playerCenter();
        spawnParticles(c.x, c.y, player.skin.color, 25);
        shake(12);
        audio.playSfx('death');
        if (lives <= 0) endlessGameOver();
        return false;
    }
    // Kampanjska boss borba: bafer od nekoliko pogodaka (srca) umesto trenutne smrti.
    if (boss) {
        if (player.invuln > 0) return false;
        bossLives--;
        ui.setLives(bossLives);
        player.invuln = 90;
        if (entity) runtime.entities.splice(index, 1);
        const c = playerCenter();
        spawnParticles(c.x, c.y, player.skin.color, 25);
        shake(12);
        audio.playSfx('death');
        if (bossLives <= 0) { campaignDeath(); return true; }
        return false;
    }
    campaignDeath();
    return true; // prekini dalju obradu kolizija
}

function handleCollisions() {
    const hb = player.getHitbox();
    for (let i = runtime.entities.length - 1; i >= 0; i--) {
        const e = runtime.entities[i];
        if (e.type === 'spike') {
            if (overlap(hb, e.getHitbox())) { if (onHazardHit(e, i)) return; }
        } else if (e.type === 'block') {
            if (overlap(hb, e.getHitbox())) {
                const onTop = player.isGrounded && Math.abs((player.y + player.height) - e.y) < 6;
                if (!onTop) { if (onHazardHit(e, i)) return; }
            }
        } else if (e.type === 'coin') {
            if (overlap(hb, e.getHitbox())) { collectCoin(e); runtime.entities.splice(i, 1); }
        } else if (e.type === 'pad') {
            if (overlap(hb, e.getHitbox())) {
                player.bounce(e.force);
                shake(6);
                audio.playSfx('pad');
                spawnParticles(player.x + player.width / 2, player.y + player.height, '#ffe600', 10);
            }
        }
        // 'orb' se aktivira na pritisak skoka (vidi doJump)
    }
}

// Pod: GROUND_Y ili vrh bloka na kome igrač stoji.
function resolveFloor() {
    let floorY = GROUND_Y;
    const hb = player.getHitbox();
    for (const e of runtime.entities) {
        if (e.type !== 'block') continue;
        const b = e.getHitbox();
        if (hb.x < b.x + b.w && hb.x + hb.w > b.x) {
            const top = e.y;
            const feet = player.y + player.height;
            const prevFeet = feet - player.dy;
            if (player.dy >= 0 && feet >= top && prevFeet <= top + 8) {
                floorY = Math.min(floorY, top);
            }
        }
    }
    player.resolveFloor(floorY);
}

// ---------- Glavna logika frejma ----------
function tick() {
    frameCount++;
    if (!runtime.frozen) { // tokom boss borbe scena miruje (čista „arena")
        floorScroll += runtime.speed;
        backgroundLayers.forEach(l => l.update(runtime.speed));
    }
    runtime.update();
    player.update();
    resolveFloor();
    handleCollisions();
    if (state !== 'PLAYING') return; // smrt tokom kolizija

    // leteći novčići → novčanik
    for (let i = flyingCoins.length - 1; i >= 0; i--) {
        if (flyingCoins[i].update()) { flyingCoins.splice(i, 1); ui.pulseCoins(); }
    }
    // čestice
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].dead) particles.splice(i, 1);
    }

    if (mode === 'ENDLESS') {
        score = Math.floor(runtime.worldX / 40);
        ui.setScore(score);
        updateBoss();
    } else {
        if (!boss) ui.setProgress(runtime.progress);
        if (mode === 'PRACTICE' && player.isGrounded &&
            runtime.worldX - checkpoints[checkpoints.length - 1] > 1800) {
            checkpoints.push(runtime.worldX);
        }
        if (runtime.reachedBossArena && !boss && !campaignBossDone) startCampaignBoss();
        if (boss) runBossFight();
        else if (runtime.finished) completeLevel();
    }
}

// Boss u endless modu: okida se na pragu skora pa delegira na zajedničku petlju.
function updateBoss() {
    if (!boss && score >= nextBossScore) startEndlessBoss();
    if (boss) runBossFight();
}

function startEndlessBoss() {
    boss = new Boss();
    runtime.spawnPaused = true;
    ui.showBossHud(true);
    ui.setBossHp(100);
}

// Boss na kraju kampanjskog nivoa: skalirani HP, zamrznuta arena, bafer srca.
function startCampaignBoss() {
    if (mode === 'PRACTICE') { campaignBossDone = true; return; } // practice je za vežbanje platforminga
    boss = new Boss();
    if (runtime.bossConfig) boss.hp = boss.maxHp = runtime.bossConfig.hp;
    runtime.spawnPaused = true;
    runtime.frozen = true;
    runtime.entities = runtime.entities.filter(e => e.type === 'coin'); // očisti arenu (osim novčića)
    bossLives = BOSS_LIVES;
    ui.showBossHud(true);
    ui.setBossHp(100);
    ui.showProgress(false);
    ui.showAttempts(false);
    ui.showLives(true);
    ui.setLives(bossLives); // srca = preostali pogoci
    audio.playSfx('orb');
}

// Zajednička petlja borbe (oba moda): kretanje, napadi, dodge-damage, HUD, pobeda.
function runBossFight() {
    boss.update(runtime.speed, () => {
        const s = new Spike(screenLogicalWidth());
        s.fromBoss = true;
        runtime.entities.push(s);
    });
    // HP pad: spike koji je prošao igrača (uspešno izbegnut)
    for (const e of runtime.entities) {
        if (e.fromBoss && !e.counted && e.x + e.width < player.x) {
            e.counted = true;
            boss.hp--;
            ui.setBossHp(Math.max(0, boss.hpPct));
            spawnParticles(boss.x + boss.width / 2, boss.y + boss.height / 2, currentTheme().obstacle, 12);
        }
    }
    if (boss.hp <= 0) defeatBoss();
}

// Pobeda nad bosom — zajednička eksplozija + nagrade/tranzicija po modu.
function defeatBoss() {
    spawnParticles(boss.x + boss.width / 2, boss.y + boss.height / 2, '#ffd000', 80);
    shake(14);
    ui.showBossHud(false);
    runtime.entities = runtime.entities.filter(e => !e.fromBoss); // ukloni zaostale šiljke
    boss = null;
    coins += 50; save(STORAGE_KEYS.coins, coins); ui.setCoins(coins);
    if (mode === 'ENDLESS') {
        audio.playSfx('complete');
        score += 500;
        runtime.spawnPaused = false;
        nextBossScore += 800;
    } else {
        campaignBossDone = true;
        ui.showLives(false);
        player.invuln = 60; // zaštita do complete ekrana
        setTimeout(() => { if (state === 'PLAYING') completeLevel(); }, 700);
    }
}

// ---------- Render ----------
function drawBackground(theme, beat) {
    const ctx = view.ctx;
    const grad = ctx.createLinearGradient(0, 0, 0, view.h);
    grad.addColorStop(0, theme.bgTop);
    grad.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, view.w, view.h);

    // paralaks siluete (tamnija/svetlija varijanta accent boje)
    backgroundLayers[0].draw(shade(theme.bgBottom, 1.25));
    backgroundLayers[1].draw(shade(theme.bgBottom, 1.5));

    // suptilan beat "bljesak" preko cele pozadine
    if (fxOn && beat > 0.02) {
        ctx.save();
        ctx.globalAlpha = beat * 0.06;
        ctx.fillStyle = theme.accent;
        ctx.fillRect(0, 0, view.w, view.h);
        ctx.restore();
    }
}

function drawFloor(theme, beat) {
    const ctx = view.ctx, s = getScale();
    const gy = GROUND_Y * s;

    // popuna poda
    ctx.fillStyle = theme.floor;
    ctx.fillRect(0, gy, view.w, view.h - gy);

    // neon gornja linija
    ctx.save();
    if (fxOn) { ctx.shadowBlur = (10 + beat * 12) * s; ctx.shadowColor = theme.grid; }
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(view.w, gy); ctx.stroke();
    ctx.restore();

    // grid linije unutar poda
    ctx.save();
    ctx.globalAlpha = 0.25 + (fxOn ? beat * 0.2 : 0);
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1 * s;
    const cell = 50 * s;
    const offset = (floorScroll * s) % cell;
    for (let x = -offset; x < view.w; x += cell) {
        ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, view.h); ctx.stroke();
    }
    for (let y = gy + cell; y < view.h; y += cell) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(view.w, y); ctx.stroke();
    }
    ctx.restore();
}

function drawFinishLine(theme) {
    if (mode === 'ENDLESS' || !runtime) return;
    const remaining = runtime.length - runtime.worldX;
    if (remaining > screenLogicalWidth() + 60) return;
    const ctx = view.ctx, s = getScale();
    const x = (player.x + remaining) * s;
    ctx.save();
    if (fxOn) { ctx.shadowBlur = 20 * s; ctx.shadowColor = theme.accent; }
    ctx.fillStyle = theme.accent;
    ctx.fillRect(x - 4 * s, 0, 8 * s, GROUND_Y * s);
    // šahovska zastava
    const sq = 16 * s;
    for (let i = 0; i * sq < GROUND_Y * s; i++) {
        ctx.fillStyle = i % 2 ? '#ffffff' : '#000000';
        ctx.fillRect(x + 6 * s, i * sq, sq, sq);
    }
    ctx.restore();
}

// Posvetli/zatamni hex boju za paralaks siluete.
function shade(hex, factor) {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const num = parseInt(full, 16);
    let r = Math.min(255, Math.round(((num >> 16) & 255) * factor));
    let g = Math.min(255, Math.round(((num >> 8) & 255) * factor));
    let b = Math.min(255, Math.round((num & 255) * factor));
    return `rgb(${r},${g},${b})`;
}

function drawPaused() {
    const ctx = view.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${60 * getScale()}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', view.w / 2, view.h / 2);
    ctx.restore();
}

function frame() {
    requestAnimationFrame(frame);
    const ctx = view.ctx;
    const theme = currentTheme();
    const beat = fxOn ? audio.getBeatPulse(currentBpm()) : 0;

    if (state === 'PLAYING' && !paused) tick();

    // screen shake
    shakeMag *= 0.85;
    if (shakeMag < 0.3) shakeMag = 0;

    ctx.save();
    if (shakeMag > 0) ctx.translate((Math.random() - 0.5) * shakeMag, (Math.random() - 0.5) * shakeMag);

    drawBackground(theme, beat);
    drawFloor(theme, beat);

    if (runtime) {
        runtime.entities.forEach(e => e.draw(theme, fxOn, beat));
        if (boss) boss.draw(theme, fxOn, beat);
        drawFinishLine(theme);
        flyingCoins.forEach(c => c.draw());
        particles.forEach(p => p.draw(fxOn));
        // igrač (treperi kad je neranjiv)
        const flicker = player.invuln > 0 && Math.floor(frameCount / 4) % 2 === 0;
        if (state !== 'MENU' && !flicker) player.draw(fxOn, beat);
    }

    ctx.restore();

    if (paused && state === 'PLAYING') drawPaused();
}

// ---------- Input ----------
function doJump() {
    if (state !== 'PLAYING' || paused) return;
    // prvo orb (skok u vazduhu uz neiskorišćeni orb)
    const hb = player.getHitbox();
    for (const e of runtime.entities) {
        if (e.type === 'orb' && !e.used && overlap(hb, e.getHitbox())) {
            e.used = true;
            player.bounce(e.force);
            audio.playSfx('orb');
            spawnParticles(player.x + player.width / 2, player.y + player.height / 2, '#ffe600', 12);
            return;
        }
    }
    if (player.jump(true)) audio.playSfx('jump');
}

function togglePause() {
    if (state !== 'PLAYING') return;
    paused = !paused;
    document.getElementById('pause-btn').innerText = paused ? '▶️' : '⏸️';
    if (paused) audio.pauseMusic(); else audio.resumeMusic();
}

function placeCheckpoint() {
    if (mode !== 'PRACTICE' || state !== 'PLAYING') return;
    if (runtime.worldX - checkpoints[checkpoints.length - 1] > 100) {
        checkpoints.push(runtime.worldX);
        spawnParticles(player.x + player.width / 2, GROUND_Y - 20, '#00ff88', 12);
    }
}

// ---------- Init ----------
function init() {
    initView();
    initInput();
    player.setSkin(SKINS[currentSkin] || SKINS[0]);

    setHandlers({
        onJumpDown: doJump,
        onJumpUp: () => player.jump(false),
        onDuckDown: () => { if (state === 'PLAYING' && !paused) player.isDucking = true; },
        onDuckUp: () => { player.isDucking = false; },
        onPause: togglePause,
        onCheckpoint: placeCheckpoint
    });

    // Meni
    ui.onClick('play-btn', openLevelSelect);
    ui.onClick('endless-btn', startEndless);
    ui.onClick('menu-shop-btn', openShop);

    // Level select
    ui.onClick('ls-back-btn', goMenu);
    ui.onClick('practice-toggle', () => {
        practiceSelected = !practiceSelected;
        const btn = document.getElementById('practice-toggle');
        btn.classList.toggle('on', practiceSelected);
        btn.innerText = practiceSelected ? '🏋️ Practice: ON' : '🏋️ Practice: OFF';
    });

    // Level complete
    ui.onClick('next-level-btn', () => {
        const idx = LEVELS.findIndex(l => l.id === currentLevel.id);
        if (idx >= 0 && idx < LEVELS.length - 1) startLevel(LEVELS[idx + 1], practiceSelected);
        else openLevelSelect();
    });
    ui.onClick('lc-menu-btn', goMenu);

    // Game over (endless)
    ui.onClick('go-retry-btn', startEndless);
    ui.onClick('go-menu-btn', goMenu);

    // Shop
    ui.onClick('close-shop-btn', () => {
        if (state === 'MENU') ui.showScreen('menu-screen'); else ui.hideAllScreens();
    });

    // Top kontrole
    ui.onClick('mute-btn', () => ui.setMuteIcon(audio.toggleMute()));
    ui.onClick('fx-btn', () => {
        fxOn = !fxOn;
        save(STORAGE_KEYS.fx, fxOn);
        ui.setFxIcon(fxOn);
    });
    ui.onClick('pause-btn', togglePause);

    // Početne ikone/stanje
    ui.setMuteIcon(audio.isMuted());
    ui.setFxIcon(fxOn);
    ui.setCoins(coins);
    ui.showHUD(false);
    goMenu();
    frame();
}

init();
