// ========== SETUP ==========
const canvas = document.getElementById('antigravity-canvas');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');
const scoreEl = document.getElementById('current-score');
const bestEl = document.getElementById('best-score');
const gameOverEl = document.getElementById('game-over');
const pausedEl = document.getElementById('paused');
const pauseBtn = document.getElementById('pause-btn');

let W, H;
let particles = [];
let orbs = [];
let isGameMode = false;
let isPaused = false;
let isGameOver = false;
let score = 0;
let highScore = parseInt(localStorage.getItem('lodge_highscore')) || 0;
let spawnTimer = 0;

const COLORS = [
    '212, 175, 55', // GOLD
    '255, 255, 255', // WHITE
    '255, 68, 68',   // RED
    '76, 175, 80',   // GREEN
    '200, 160, 255'  // PURPLE
];
const GOLD = COLORS[0];
const RED = COLORS[2];

bestEl.textContent = highScore;

function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// ========== SCROLL DETECTION ==========
window.addEventListener('scroll', () => {
    const threshold = window.innerHeight * 0.3;
    if (window.scrollY > threshold) {
        if (!isGameMode && !isGameOver) activateGame();
        hud.classList.remove('hidden');
    } else {
        if (isGameMode) deactivateGame();
        hud.classList.add('hidden');
    }
});

// ========== PARTICLE CLASS ==========
class Particle {
    constructor(x, y, color = GOLD, isPulse = false) {
        this.x = x;
        this.y = y;
        this.isPulse = isPulse;

        if (isPulse) {
            this.radius = 0;
            this.maxRadius = 150;
            this.alpha = 0.5;
            this.color = color;
        } else {
            const angle = Math.random() * Math.PI * 2;
            const velocity = Math.random() * 8 + 2;
            this.vx = Math.cos(angle) * velocity;
            this.vy = Math.sin(angle) * velocity;
            this.alpha = 1;
            this.size = Math.random() * 4 + 1;
            this.color = color;
            this.gravity = 0.15;
        }
    }

    update() {
        if (this.isPulse) {
            this.radius += 10;
            this.alpha -= 0.03;
        } else {
            this.x += this.vx;
            this.y += this.vy;
            this.vy += this.gravity;
            this.alpha -= 0.02;
            this.size *= 0.96;
        }
    }

    draw() {
        if (this.alpha <= 0) return;
        ctx.save();

        if (this.isPulse) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${this.color}, ${this.alpha})`;
            ctx.lineWidth = 2;
            ctx.stroke();
        } else {
            ctx.shadowBlur = 10;
            ctx.shadowColor = `rgb(${this.color})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${this.color}, ${this.alpha})`;
            ctx.fill();
        }

        ctx.restore();
    }
}

// ========== ORB CLASS ==========
class Orb {
    constructor(type = 'auto') {
        this.type = type === 'auto' ? this.randomType() : type;
        this.init();
    }

    randomType() {
        const r = Math.random();
        if (r < 0.12) return 'hazard';
        if (r < 0.35) return 'big';
        return 'small';
    }

    init() {
        this.radius = this.type === 'big' ? 35 : 18;
        this.x = Math.random() * (W - 100) + 50;
        this.y = H + 60;
        const angle = Math.random() * (Math.PI / 2) - Math.PI * 0.75;
        const speed = Math.random() * 2.5 + 1.5;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed - 1;
        this.dead = false;
        this.color = this.type === 'hazard' ? RED : GOLD;
    }

    spawnFrom(x, y) {
        this.type = 'small';
        this.radius = 14;
        this.x = x;
        this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 3;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed - 2;
        this.color = GOLD;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < this.radius || this.x > W - this.radius) {
            this.vx *= -0.8;
            this.x = Math.max(this.radius, Math.min(W - this.radius, this.x));
        }

        if (this.y < -60) {
            this.dead = true;
            if (isGameMode && !isGameOver && this.type !== 'hazard') endGame();
        }
        if (this.y > H + 100) this.dead = true;
    }

    draw() {
        ctx.save();
        ctx.shadowBlur = 20;
        ctx.shadowColor = `rgb(${this.color})`;

        const grad = ctx.createRadialGradient(this.x - this.radius * 0.3, this.y - this.radius * 0.3, 0, this.x, this.y, this.radius);
        grad.addColorStop(0, '#fff');
        grad.addColorStop(0.3, `rgba(${this.color}, 1)`);
        grad.addColorStop(1, `rgba(${this.color}, 0.4)`);

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        if (this.type === 'hazard') {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 20px Outfit';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('!', this.x, this.y + 2);
        }
        ctx.restore();
    }
}

// ========== GAME LOGIC ==========
function activateGame() {
    isGameMode = true;
    isPaused = false;
    isGameOver = false;
    score = 0;
    scoreEl.textContent = score;
    gameOverEl.classList.add('hidden');
    pausedEl.classList.add('hidden');
    pauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    orbs = [];
    for (let i = 0; i < 5; i++) {
        let o = new Orb('small');
        o.y = H + 50 + (i * 120);
        orbs.push(o);
    }
    spawnTimer = 0;
}

function deactivateGame() {
    isGameMode = false;
    isPaused = false;
}

function togglePause() {
    if (!isGameMode || isGameOver) return;
    isPaused = !isPaused;
    if (isPaused) {
        pausedEl.classList.remove('hidden');
        pauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    } else {
        pausedEl.classList.add('hidden');
        pauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    }
}

function endGame() {
    isGameOver = true;
    gameOverEl.classList.remove('hidden');
    explode(W / 2, H / 2, RED, 100);
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('lodge_highscore', highScore);
        bestEl.textContent = highScore;
    }
}

function explode(x, y, color = GOLD, count = 25) {
    for (let i = 0; i < count; i++) {
        const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
        particles.push(new Particle(x, y, color === GOLD ? randomColor : color));
    }
}

// ========== INPUT ==========
window.addEventListener('mousedown', handleClick);
window.addEventListener('touchstart', (e) => {
    if (e.target.closest('a') || e.target.closest('button')) return;
    const touch = e.touches[0];
    handleClick({ clientX: touch.clientX, clientY: touch.clientY, target: e.target });
});

function handleClick(e) {
    if (e.target && (e.target.closest('a') || e.target.closest('button') || e.target.closest('.overlay'))) return;
    if (isPaused) return;

    const x = e.clientX;
    const y = e.clientY;
    let hit = false;

    // Check Orbs
    orbs.forEach(orb => {
        if (orb.dead) return;
        const dist = Math.hypot(orb.x - x, orb.y - y);
        if (dist < orb.radius + 35) {
            hit = true;
            orb.dead = true;
            explode(orb.x, orb.y, orb.color, 40);

            if (isGameMode) {
                if (orb.type === 'hazard') endGame();
                else if (orb.type === 'big') {
                    score += 20;
                    for (let i = 0; i < 4; i++) {
                        let child = new Orb('small');
                        child.spawnFrom(orb.x, orb.y);
                        orbs.push(child);
                    }
                } else score += 10;
                scoreEl.textContent = score;
            }
        }
    });

    if (!hit) {
        // Pulse effect on empty space
        particles.push(new Particle(x, y, '255, 255, 255', true));
        explode(x, y, '255, 255, 255', 6);
    }
}

// ========== COLLISION ==========
function checkCollisions() {
    for (let i = 0; i < orbs.length; i++) {
        for (let j = i + 1; j < orbs.length; j++) {
            const dx = orbs[i].x - orbs[j].x;
            const dy = orbs[i].y - orbs[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < (orbs[i].radius + orbs[j].radius)) {
                const midX = (orbs[i].x + orbs[j].x) / 2;
                const midY = (orbs[i].y + orbs[j].y) / 2;
                explode(midX, midY, orbs[i].color, 20);
                explode(midX, midY, orbs[j].color, 20);
                orbs[i].dead = orbs[j].dead = true;
                if (isGameMode) {
                    score += 5;
                    scoreEl.textContent = score;
                }
            }
        }
    }
}

// ========== MAIN LOOP ==========
function loop() {
    ctx.clearRect(0, 0, W, H);

    if (isGameMode && !isGameOver && !isPaused) {
        spawnTimer++;
        const rate = Math.max(20, 60 - Math.floor(score / 90));
        if (spawnTimer > rate) {
            orbs.push(new Orb());
            spawnTimer = 0;
        }
    } else if (!isGameMode) {
        if (Math.random() < 0.012) orbs.push(new Orb('small'));
    }

    if (!isPaused) checkCollisions();

    particles = particles.filter(p => {
        if (!isPaused) p.update();
        p.draw();
        return p.alpha > 0;
    });

    orbs = orbs.filter(o => {
        if (!isPaused) o.update();
        o.draw();
        return !o.dead;
    });

    requestAnimationFrame(loop);
}

loop();
