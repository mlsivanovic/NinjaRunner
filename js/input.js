// input.js — sluša tastaturu i touch, prevodi ih u akcije i prosleđuje game.js-u.
// game.js registruje callback-ove preko setHandlers().

import { view } from './config.js';

const handlers = {
    onJumpDown: () => {},
    onJumpUp: () => {},
    onDuckDown: () => {},
    onDuckUp: () => {},
    onPause: () => {},
    onCheckpoint: () => {} // za practice mod (taster Z)
};

export function setHandlers(h) {
    Object.assign(handlers, h);
}

export function initInput() {
    window.addEventListener('keydown', e => {
        if (e.repeat) return; // ignoriši auto-repeat držanja tastera
        switch (e.code) {
            case 'Space':
            case 'ArrowUp':
            case 'KeyW':
                e.preventDefault();
                handlers.onJumpDown();
                break;
            case 'ArrowDown':
            case 'KeyS':
                e.preventDefault();
                handlers.onDuckDown();
                break;
            case 'KeyP':
            case 'Escape':
                handlers.onPause();
                break;
            case 'KeyZ':
                handlers.onCheckpoint();
                break;
        }
    });

    window.addEventListener('keyup', e => {
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') handlers.onJumpUp();
        if (e.code === 'ArrowDown' || e.code === 'KeyS') handlers.onDuckUp();
    });

    // Touch: leva polovina ekrana = skok, desna = čučanj.
    const canvas = view.canvas;
    canvas.addEventListener('touchstart', e => {
        e.preventDefault();
        for (const t of e.changedTouches) {
            if (t.clientX < window.innerWidth / 2) handlers.onJumpDown();
            else handlers.onDuckDown();
        }
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
        e.preventDefault();
        handlers.onJumpUp();
        handlers.onDuckUp();
    }, { passive: false });
}
