// ui.js — upravljanje DOM ekranima (meni, level-select, complete, game-over, shop) i HUD-om.
// game.js prosleđuje podatke i callback-ove; ovaj modul samo crta i sluša klikove.

const el = id => document.getElementById(id);

const SCREENS = ['menu-screen', 'level-select-screen', 'level-complete-screen', 'game-over-screen', 'shop-screen'];

export function showScreen(id) {
    SCREENS.forEach(s => { el(s).style.display = (s === id) ? 'flex' : 'none'; });
}
export function hideAllScreens() {
    SCREENS.forEach(s => { el(s).style.display = 'none'; });
}

// Pomoćni: postavi klik handler (uklanja prethodni kloniranjem da se ne gomilaju).
export function onClick(id, fn) {
    const node = el(id);
    if (!node) return;
    node.onclick = (e) => { fn(e); node.blur(); };
}

// --- HUD ---
export function showHUD(show) { el('hud').style.display = show ? 'block' : 'none'; }

export function setProgress(pct) { el('progress-bar').style.width = `${Math.round(pct * 100)}%`; }
export function showProgress(show) { el('progress-wrap').style.display = show ? 'block' : 'none'; }

export function setAttempts(n) { el('attempts-board').innerText = `Attempt ${n}`; }
export function showAttempts(show) { el('attempts-board').style.display = show ? 'block' : 'none'; }

export function setCoins(n) { el('coins-board').innerText = `💰 ${n}`; }
export function pulseCoins() {
    const c = el('coins-board');
    c.style.transition = 'transform 0.1s';
    c.style.transform = 'scale(1.3)';
    setTimeout(() => { c.style.transform = 'scale(1)'; }, 100);
}

export function setScore(n) { el('score-board').innerText = `Score: ${n}`; }
export function showScore(show) { el('score-board').style.display = show ? 'block' : 'none'; }
export function setLives(lives) {
    el('lives-board').innerText = '❤️'.repeat(Math.max(0, lives));
}
export function showLives(show) { el('lives-board').style.display = show ? 'block' : 'none'; }

export function showBossHud(show) { el('boss-hud').style.display = show ? 'block' : 'none'; }
export function setBossHp(pct) { el('boss-hp-bar').style.width = `${pct}%`; }

export function setPracticeHint(show) { el('practice-hint').style.display = show ? 'block' : 'none'; }

// --- Toggle dugmad (mute / fx) ---
export function setMuteIcon(muted) { el('mute-btn').innerText = muted ? '🔇' : '🔊'; }
export function setFxIcon(on) { el('fx-btn').innerText = on ? '✨' : '🌙'; }

// --- Level select ---
export function buildLevelSelect(levels, { progress, complete, onPlay }) {
    const list = el('levels-list');
    list.innerHTML = '';
    levels.forEach((lvl, i) => {
        const prevDone = i === 0 || complete.includes(levels[i - 1].id);
        const isDone = complete.includes(lvl.id);
        const best = progress[lvl.id] || 0;
        const locked = !prevDone;

        const card = document.createElement('div');
        card.className = `level-card${locked ? ' locked' : ''}${isDone ? ' done' : ''}`;
        card.innerHTML = `
            <div class="level-num">${i + 1}</div>
            <div class="level-name">${lvl.name}</div>
            <div class="level-meta">${locked ? '🔒 Locked' : (isDone ? '★★★ Complete' : `Best: ${best}%`)}</div>
        `;
        if (!locked) card.onclick = () => onPlay(lvl);
        list.appendChild(card);
    });
}

// --- Shop ---
export function buildShop(skins, { coins, unlocked, current, onAction }) {
    el('shop-coins').innerText = `💰 ${coins}`;
    const list = el('skins-list');
    list.innerHTML = '';
    skins.forEach((skin, index) => {
        const isUnlocked = unlocked.includes(index);
        const isCurrent = index === current;
        const item = document.createElement('div');
        item.className = `skin-item${isCurrent ? ' selected' : ''}`;
        const label = isCurrent ? 'Equipped' : (isUnlocked ? 'Equip' : `Buy ${skin.price}`);
        item.innerHTML = `
            <div class="skin-preview shape-${skin.shape}" style="--c:${skin.color};--t:${skin.trail}"></div>
            <strong>${skin.name}</strong>
            <button>${label}</button>
        `;
        item.querySelector('button').onclick = () => onAction(index);
        list.appendChild(item);
    });
}

// --- Level complete ---
export function showComplete({ name, coins }) {
    el('lc-name').innerText = name;
    el('lc-coins').innerText = `💰 +${coins}`;
    showScreen('level-complete-screen');
}

// --- Game over (endless) ---
export function showGameOver({ score, best }) {
    el('go-score').innerText = score;
    el('go-best').innerText = best;
    showScreen('game-over-screen');
}

// Kratak crveni flash preko ekrana (smrt u kampanji).
export function flashDeath() {
    const f = el('death-flash');
    f.style.transition = 'none';
    f.style.opacity = '0.7';
    requestAnimationFrame(() => {
        f.style.transition = 'opacity 0.35s';
        f.style.opacity = '0';
    });
}
