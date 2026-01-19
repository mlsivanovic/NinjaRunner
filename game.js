const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreBoard = document.getElementById('score-board');
const startMessage = document.getElementById('start-message');
const highScoreElement = document.getElementById('high-score');
const livesElement = document.getElementById('lives-board');
const shieldElement = document.getElementById('shield-board');
const gameOverScreen = document.getElementById('game-over-screen');
const goScoreElement = document.getElementById('go-score');
const goBestElement = document.getElementById('go-best');
const restartBtn = document.getElementById('restart-btn');
const muteBtn = document.getElementById('mute-btn');

// Zvučni efekti
const jumpSound = new Audio('jump.mp3');
const gameOverSound = new Audio('gameover.mp3');
const bgMusic = new Audio('music.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.4; // Malo tiša pozadinska muzika

// Dinamička rezolucija
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Logičke konstante (igra se interno računa na skali od 800x400)
const LOGICAL_HEIGHT = 600;
const LOGICAL_WIDTH = 1200;
const GROUND_Y = 450; // Podignut nivo zemlje (bilo je 550) radi boljeg landscape prikaza
const getScale = () => canvas.height / LOGICAL_HEIGHT;

class BackgroundLayer {
    constructor(speedModifier, color, peaks) {
        this.speedModifier = speedModifier;
        this.color = color;
        this.peaks = peaks; // Niz {x, h} tačaka za vrhove planina
        this.x = 0;
    }

    update() {
        if (gameState === 'PLAYING') {
            this.x -= gameSpeed * this.speedModifier;
            if (this.x <= -LOGICAL_WIDTH) this.x += LOGICAL_WIDTH;
        }
    }

    draw() {
        const scale = getScale();
        const screenLogicalWidth = canvas.width / scale;
        ctx.fillStyle = this.color;

        // Crtamo sloj onoliko puta koliko je potrebno da popunimo širinu ekrana
        for (let i = 0; i <= Math.ceil(screenLogicalWidth / LOGICAL_WIDTH) + 1; i++) {
            this.render( (this.x + i * LOGICAL_WIDTH) * scale, scale);
        }
    }

    render(offsetX, scale) {
        ctx.beginPath();
        ctx.moveTo(offsetX, GROUND_Y * scale);
        this.peaks.forEach(p => {
            ctx.lineTo(offsetX + p.x * scale, (GROUND_Y - p.h) * scale);
        });
        ctx.lineTo(offsetX + LOGICAL_WIDTH * scale, GROUND_Y * scale);
        ctx.fill();
    }
}

const backgroundLayers = [
    new BackgroundLayer(0.1, 'rgba(0, 0, 0, 0.08)', [{x:0, h:50}, {x:400, h:80}, {x:800, h:40}, {x:1200, h:50}]), // Oblaci (brži i vidljiviji)
    new BackgroundLayer(0.25, '#dfe6e9', [{x:0, h:150}, {x:300, h:250}, {x:600, h:180}, {x:900, h:320}, {x:1200, h:150}]), // Daleke planine (svetlije)
    new BackgroundLayer(0.5, '#b2bec3', [{x:0, h:80}, {x:250, h:150}, {x:550, h:100}, {x:850, h:200}, {x:1200, h:80}])  // Bliža brda (tamnija i brža)
];

let gameState = 'START'; // START, PLAYING, GAMEOVER
let score = 0;
let lives = 3;

let isMuted = localStorage.getItem('ninjaMuted') === 'true';
muteBtn.innerText = isMuted ? '🔇' : '🔊';

muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    localStorage.setItem('ninjaMuted', isMuted);
    muteBtn.innerText = isMuted ? '🔇' : '🔊';
    muteBtn.blur(); // Sklanja fokus da Space taster ne bi opet aktivirao dugme
    
    if (isMuted) {
        bgMusic.pause();
    } else if (gameState === 'PLAYING') {
        bgMusic.play().catch(e => console.log(e));
    }
});

let shields = 0;
let highScore = parseInt(localStorage.getItem('ninjaHighScore')) || 0;
highScoreElement.innerText = `Best: ${highScore}`;
let gameSpeed = 3.5;
let obstacles = [];
let powerUps = [];
let coins = [];
let frameCount = 0;
let particles = [];
let obstacleTimer = 0;
let powerUpTimer = 0;
let coinTimer = 0;

const ninja = {
    x: 80,
    y: GROUND_Y - 80, // Prilagođeno novoj visini tla
    width: 30,
    height: 80,
    dy: 0,
    jumpForce: 18,
    gravity: 0.6,
    rotation: 0,
    isJumping: false,
    isGrounded: false,
    isDucking: false,
    animationFrame: 0,
    jumpCount: 0,
    maxJumps: 2,
    invulnerabilityTimer: 0,

    
    draw() {
        const scale = getScale();
        const drawX = this.x * scale;
        const drawW = this.width * scale;
        const drawH = this.height * scale;

        // Efekat treperenja: ne crtamo nindžu svaki 4. frejm ako je neranjiv
        if (this.invulnerabilityTimer > 0 && Math.floor(frameCount / 4) % 2 === 0) {
            return;
        }

        ctx.save();
        // Pozicioniramo se na dno nindže radi lakšeg crtanja ljudske figure
        // Rotacija oko centra
        const centerX = drawX + drawW / 2;
        const centerY = (this.y + this.height / 2) * scale;
        ctx.translate(centerX, centerY);
        ctx.rotate(this.rotation);
        ctx.translate(0, drawH / 2);
        
        if (shields > 0) {
            ctx.shadowBlur = 15 * scale;
            ctx.shadowColor = '#0984e3';
        }

        ctx.fillStyle = '#000000'; 

        if (!this.isDucking) {
            // LJUDSKA FIGURA - STOJEĆI
            // Glava
            ctx.beginPath();
            ctx.arc(0, -drawH * 0.85, drawW * 0.3, 0, Math.PI * 2);
            ctx.fill();
            // Vrat
            ctx.fillRect(-drawW * 0.08, -drawH * 0.75, drawW * 0.16, drawH * 0.05);
            // Torzo
            ctx.fillRect(-drawW * 0.25, -drawH * 0.7, drawW * 0.5, drawH * 0.4);
            // Noge
            ctx.fillRect(-drawW * 0.25, -drawH * 0.3, drawW * 0.15, drawH * 0.3);
            ctx.fillRect(drawW * 0.1, -drawH * 0.3, drawW * 0.15, drawH * 0.3);
            // Ruke
            ctx.fillRect(-drawW * 0.4, -drawH * 0.65, drawW * 0.12, drawH * 0.35);
            ctx.fillRect(drawW * 0.28, -drawH * 0.65, drawW * 0.12, drawH * 0.35);
        } else {
            // LJUDSKA FIGURA - ČUČEĆI
            ctx.beginPath();
            ctx.arc(0, -drawH * 0.4, drawW * 0.25, 0, Math.PI * 2);
            ctx.fill();
            // Torzo i noge spojeni u čučanj
            ctx.fillRect(-drawW * 0.35, -drawH * 0.25, drawW * 0.7, drawH * 0.25);
            // Ruke skupljene uz telo
            ctx.fillRect(-drawW * 0.5, -drawH * 0.2, drawW * 0.15, drawH * 0.2);
        }

        // Povez (traka)
        if (gameState === 'PLAYING' && this.isGrounded && !this.isDucking) {
            this.animationFrame += 0.2;
            ctx.strokeStyle = '#e74c3c';
            ctx.lineWidth = 2 * scale;
            ctx.beginPath();
            ctx.moveTo(-drawW * 0.1, -drawH * 0.85);
            ctx.lineTo(-drawW * 0.1 - 20 - Math.sin(this.animationFrame) * 5, -drawH * 0.85 + Math.cos(this.animationFrame) * 5);
            ctx.stroke();
        }

        // Maska/Oči (uvek bele)
        ctx.fillStyle = '#ecf0f1';
        const eyeY = this.isDucking ? -drawH * 0.42 : -drawH * 0.87;
        ctx.fillRect(drawW * 0.1, eyeY, 6 * scale, 2 * scale);

        ctx.restore();
    },
    
    update() {
        if (gameState !== 'PLAYING') return;
        
        if (this.invulnerabilityTimer > 0) this.invulnerabilityTimer--;

        // Varijabilna visina skoka: ako igrač pusti taster dok nindža ide gore, brže pada
        let currentGravity = this.gravity;
        if (this.dy < 0 && !this.isJumping) {
            currentGravity = this.gravity * 2.5;
        }

        this.dy += currentGravity;
        this.y += this.dy;

        // Rotacija tokom skoka
        if (!this.isGrounded) {
            this.rotation += 0.15;
        } else {
            this.rotation = 0;
        }

        // Podloga (ground level)
        if (this.y + this.height > GROUND_Y) {
            this.y = GROUND_Y - this.height;
            this.dy = 0;
            this.isGrounded = true;
            this.jumpCount = 0;
        }
    },
    
    jump(isStarting) {
        if (isStarting) {
            if (!this.isDucking && (this.isGrounded || this.jumpCount < this.maxJumps)) {
                this.dy = -this.jumpForce;
                this.isGrounded = false;
                this.isJumping = true;
                this.jumpCount++;
                
                if (!isMuted) {
                    jumpSound.currentTime = 0; // Resetuje zvuk za brze skokove (double jump)
                    jumpSound.play().catch(e => console.log(e));
                }
            }
        } else {
            this.isJumping = false;
        }
    }
};

class Obstacle {
    constructor(type) {
        this.type = type; // 'low' (preskoči) ili 'high' (prođi ispod)
        this.width = type === 'low' ? 100 : 120; 
        this.height = type === 'low' ? 60 : 90; // Povećana visina za dupli šuriken
        this.x = canvas.width / getScale(); // Spawnuje se tačno na desnoj ivici ekrana
        this.y = type === 'low' ? GROUND_Y - this.height : GROUND_Y - 135; // Podignuto da blokira skok
        this.rotation = 0;
    }

    draw() {
        const scale = getScale();
        ctx.save();
        ctx.translate((this.x + this.width / 2) * scale, (this.y + this.height / 2) * scale);
        
        if (this.type === 'low') {
            // Šiljci
            ctx.fillStyle = '#000000'; // Crne prepreke na beloj pozadini
            ctx.beginPath();
            ctx.moveTo(-this.width/2 * scale, this.height/2 * scale);
            ctx.lineTo(-this.width/4 * scale, -this.height/2 * scale);
            ctx.lineTo(0, this.height/4 * scale);
            ctx.lineTo(this.width/4 * scale, -this.height/2 * scale);
            ctx.lineTo(this.width/2 * scale, this.height/2 * scale);
            ctx.fill();
        } else {
            // Rotirajući šurikeni (Dupli)
            this.rotation += 0.2;
            const shurikenSize = 35;

            const drawShuriken = (offsetY) => {
                ctx.save();
                ctx.translate(0, offsetY * scale);
                ctx.rotate(this.rotation);
                ctx.fillStyle = '#000000';
                for(let i=0; i<4; i++) {
                    ctx.rotate(Math.PI/2);
                    ctx.fillRect(-2 * scale, -shurikenSize/2 * scale, 4 * scale, shurikenSize * scale);
                    ctx.beginPath();
                    ctx.moveTo(0, -shurikenSize/2 * scale);
                    ctx.lineTo(10 * scale, -shurikenSize/4 * scale);
                    ctx.lineTo(0, 0);
                    ctx.fill();
                }
                ctx.restore();
            };

            drawShuriken(-25); // Gornji
            drawShuriken(25);  // Donji
        }
        ctx.restore();
    }

    update() {
        this.x -= gameSpeed;
    }
}

class PowerUp {
    constructor() {
        this.width = 40;
        this.height = 40;
        this.x = canvas.width / getScale();
        // Pojavljuje se u vazduhu, na visini koju igrač može da dohvati skokom
        this.y = GROUND_Y - 180; 
    }

    draw() {
        const scale = getScale();
        ctx.save();
        ctx.translate((this.x + this.width / 2) * scale, (this.y + this.height / 2) * scale);
        
        // Crtanje štita (plavi krug sa ivicom)
        ctx.fillStyle = '#0984e3';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3 * scale;
        ctx.beginPath();
        ctx.arc(0, 0, 15 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Tekst "S" ili simbol na štitu
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${20 * scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('S', 0, 2 * scale);
        
        ctx.restore();
    }

    update() {
        this.x -= gameSpeed;
    }
}

class Coin {
    constructor() {
        this.width = 30;
        this.height = 30;
        this.x = canvas.width / getScale();
        // Novčići se pojavljuju na različitim visinama (pri zemlji ili za skok)
        this.y = GROUND_Y - 40 - Math.random() * 150; 
        this.wobble = Math.random() * Math.PI * 2;
    }

    update() {
        this.x -= gameSpeed;
        this.wobble += 0.1; // Animacija lebdenja
    }

    draw() {
        const scale = getScale();
        const drawX = (this.x + this.width/2) * scale;
        // Dodajemo sinusnu funkciju za efekat lebdenja gore-dole
        const drawY = (this.y + this.height/2 + Math.sin(this.wobble) * 5) * scale;
        const radius = (this.width/2) * scale;

        ctx.save();
        ctx.translate(drawX, drawY);
        
        // Zlatni krug
        ctx.fillStyle = '#f1c40f';
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Unutrašnji detalj (sjaj)
        ctx.fillStyle = '#f39c12';
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.7, 0, Math.PI * 2);
        ctx.fill();

        // Beli odsjaj
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.arc(-radius*0.3, -radius*0.3, radius*0.15, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 3 + 2;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0;
        this.decay = Math.random() * 0.05 + 0.02;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
    }

    draw() {
        const scale = getScale();
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x * scale, this.y * scale, this.size * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

function spawnObstacle() {
    if (obstacleTimer <= 0) {
        const type = Math.random() > 0.5 ? 'low' : 'high';
        obstacles.push(new Obstacle(type));
        // Minimalni razmak koji garantuje mogućnost preskakanja
        obstacleTimer = Math.floor(Math.random() * 40 + 80);
    }
    obstacleTimer--;
}

function spawnPowerUp() {
    if (powerUpTimer <= 0) {
        powerUps.push(new PowerUp());
        // Štitovi se pojavljuju ređe (svakih ~10-15 sekundi)
        powerUpTimer = Math.floor(Math.random() * 400 + 600);
    }
    powerUpTimer--;
}

function spawnCoin() {
    if (coinTimer <= 0) {
        coins.push(new Coin());
        coinTimer = Math.floor(Math.random() * 30 + 20); // Često pojavljivanje novčića
    }
    coinTimer--;
}

function createParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function checkCollision(n, o) {
    // "Forgiving" Hitbox: Nindža je ranjiv samo u centralnom delu tela
    const nHitW = n.width * 0.5;
    const nHitH = (n.isDucking ? n.height * 0.3 : n.height * 0.7);
    const nX = n.x + (n.width - nHitW) / 2;
    const nY = (n.isDucking ? n.y + n.height * 0.7 : n.y + (n.height * 0.15));

    // Blago smanjujemo i hitbox prepreke radi boljeg osećaja
    const oHitW = o.width * 0.8;
    const oHitH = o.height * 0.8;
    const oX = o.x + (o.width - oHitW) / 2;
    const oY = o.y + (o.height - oHitH) / 2;

    return nX < oX + oHitW &&
           nX + nHitW > oX &&
           nY < oY + oHitH &&
           nY + nHitH > oY;
}

function resetGame() {
    score = 0;
    lives = 3;
    shields = 0;
    livesElement.innerText = '❤️❤️❤️';
    shieldElement.innerText = '🛡️ 0';
    gameSpeed = 3.5;
    obstacles = [];
    powerUps = [];
    coins = [];
    particles = [];
    obstacleTimer = 40; // Prva prepreka dolazi brzo nakon starta
    powerUpTimer = 200;
    coinTimer = 0;
    ninja.y = GROUND_Y - ninja.height;
    ninja.invulnerabilityTimer = 0;
    gameState = 'PLAYING';
    startMessage.style.display = 'none';
    gameOverScreen.style.display = 'none';
    
    if (!isMuted) {
        bgMusic.play().catch(e => console.log(e));
    }
}

function gameLoop() {
    const scale = getScale();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Crtanje poda
    ctx.strokeStyle = '#2d3436';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y * scale);
    ctx.lineTo(canvas.width, GROUND_Y * scale);
    ctx.stroke();

    backgroundLayers.forEach(layer => {
        layer.update();
        layer.draw();
    });

    ninja.update();
    ninja.draw();

    if (gameState === 'PLAYING') {
        frameCount++;
        spawnObstacle();
        spawnPowerUp();
        spawnCoin();

        // Ažuriranje i crtanje čestica (iskri)
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update();
            particles[i].draw();
            if (particles[i].life <= 0) {
                particles.splice(i, 1);
            }
        }

        // Ažuriranje i crtanje novčića
        for (let i = coins.length - 1; i >= 0; i--) {
            coins[i].update();
            coins[i].draw();

            if (checkCollision(ninja, coins[i])) {
                score += 10; // Bonus poeni
                scoreBoard.innerText = `Score: ${score}`;
                createParticles(coins[i].x + coins[i].width/2, coins[i].y + coins[i].height/2, '#f1c40f', 10);
                coins.splice(i, 1);
            } else if (coins[i].x + coins[i].width < 0) {
                coins.splice(i, 1);
            }
        }

        // Ažuriranje i crtanje Power-upova (štitova)
        for (let i = powerUps.length - 1; i >= 0; i--) {
            powerUps[i].update();
            powerUps[i].draw();

            // Sakupljanje štita
            if (checkCollision(ninja, powerUps[i])) {
                shields++;
                shieldElement.innerText = `🛡️ ${shields}`;
                powerUps.splice(i, 1);
            } else if (powerUps[i].x + powerUps[i].width < 0) {
                powerUps.splice(i, 1);
            }
        }
        
        for (let i = obstacles.length - 1; i >= 0; i--) {
            obstacles[i].update();
            obstacles[i].draw();

            if (checkCollision(ninja, obstacles[i])) {
                if (ninja.invulnerabilityTimer > 0) continue; // Ignoriši sudar ako je nindža neranjiv

                // Ako ima štit, troši se štit umesto života
                if (shields > 0) {
                    createParticles(ninja.x + ninja.width / 2, ninja.y + ninja.height / 2, '#0984e3', 30);
                    shields--;
                    shieldElement.innerText = `🛡️ ${shields}`;
                } else {
                    lives--;
                    ninja.invulnerabilityTimer = 120; // 2 sekunde neranjivosti (pri 60fps)
                    let hearts = '';
                    for(let h=0; h<lives; h++) hearts += '❤️';
                    livesElement.innerText = hearts;
                }
                
                obstacles.splice(i, 1); // Uklanjamo prepreku da ne udari više puta

                if (lives <= 0) {
                    gameState = 'GAMEOVER';
                    if (!isMuted) {
                        gameOverSound.play().catch(e => console.log(e));
                    }
                    bgMusic.pause();
                    bgMusic.currentTime = 0;
                    gameOverScreen.style.display = 'flex';
                    goScoreElement.innerText = score;
                    goBestElement.innerText = highScore;
                }
                continue;
            }

            if (obstacles[i].x + obstacles[i].width < 0) {
                obstacles.splice(i, 1);
                score++;
                scoreBoard.innerText = `Score: ${score}`;
                if (score > highScore) {
                    highScore = score;
                    localStorage.setItem('ninjaHighScore', highScore);
                    highScoreElement.innerText = `Best: ${highScore}`;
                }
                gameSpeed += 0.03;
            }
        }
    }

    requestAnimationFrame(gameLoop);
}

// Kontrole
const handleInput = (type) => {
    if (gameState === 'START') {
        resetGame();
        return;
    }
    if (gameState === 'GAMEOVER') return; // Čekamo klik na dugme
    if (type === 'jump_on') ninja.jump(true);
    if (type === 'jump_off') ninja.jump(false);
    if (type === 'duck_on') ninja.isDucking = true;
    if (type === 'duck_off') ninja.isDucking = false;
};

window.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp') handleInput('jump_on');
    if (e.code === 'ArrowDown') handleInput('duck_on');
});
window.addEventListener('keyup', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp') handleInput('jump_off');
    if (e.code === 'ArrowDown') handleInput('duck_off');
});

// Touch kontrole (Leva strana skok, desna čučanj)
canvas.addEventListener('touchstart', e => {
    const touchX = e.touches[0].clientX;
    if (touchX < window.innerWidth / 2) handleInput('jump_on');
    else handleInput('duck_on');
});
canvas.addEventListener('touchend', (e) => {
    handleInput('jump_off');
    handleInput('duck_off');
});

// Restart dugme
restartBtn.addEventListener('click', resetGame);

gameLoop();
