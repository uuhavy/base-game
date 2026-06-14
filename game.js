const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// KÍCH THƯỚC BẢN ĐỒ KHÔNG GIAN (Rộng gấp nhiều lần màn hình hiển thị)
const WORLD_WIDTH = 3000;
const WORLD_HEIGHT = 2000;
const TIER_THRESHOLDS = [50, 150, 350, 700, 1200, 2000];

let score, hp, gameOver, currentTier, hasWon;
let player, bullets, enemies, gems, particles;
let spawnTimer, fireTimer = 0;

// Đối tượng Camera để cuộn màn hình theo người chơi
const camera = { x: 0, y: 0 };

const keys = {
    w: false, a: false, s: false, d: false,
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false
};

// Quản lý Joystick cho Mobile
let isTouchingJoystick = false;
let joystickVector = { x: 0, y: 0 };
const joystickBase = document.getElementById('joystick-base');
const joystickStick = document.getElementById('joystick-stick');

class Player {
    constructor() {
        this.x = WORLD_WIDTH / 2;
        this.y = WORLD_HEIGHT / 2;
        this.radius = 16;
        this.color = '#0052FF'; 
        this.speed = 5;
        this.angle = 0;
    }

    move() {
        // Di chuyển bằng bàn phím (PC)
        if (keys.w || keys.ArrowUp) this.y -= this.speed;
        if (keys.s || keys.ArrowDown) this.y += this.speed;
        if (keys.a || keys.ArrowLeft) this.x -= this.speed;
        if (keys.d || keys.ArrowRight) this.x += this.speed;

        // Di chuyển bằng Joystick (Mobile)
        if (isTouchingJoystick) {
            this.x += joystickVector.x * this.speed;
            this.y += joystickVector.y * this.speed;
        }

        // Giới hạn trong biên giới thế giới rộng WORLD_WIDTH x WORLD_HEIGHT
        if (this.x < this.radius) this.x = this.radius;
        if (this.x > WORLD_WIDTH - this.radius) this.x = WORLD_WIDTH - this.radius;
        if (this.y < this.radius) this.y = this.radius;
        if (this.y > WORLD_HEIGHT - this.radius) this.y = WORLD_HEIGHT - this.radius;
    }

    draw() {
        ctx.save();
        // Vẽ đối tượng dựa trên hệ tọa độ thế giới dịch chuyển bởi Camera
        ctx.translate(this.x - camera.x, this.y - camera.y);
        ctx.rotate(this.angle);
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;

        ctx.beginPath();
        ctx.moveTo(22, 0);
        ctx.lineTo(-12, -11);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-12, 11);
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(-5, 0, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#00ffff';
        ctx.fill();
        ctx.restore();
    }
}

class Bullet {
    constructor(x, y, angle) {
        this.x = x;
        this.y = y;
        this.radius = 3.5;
        const colors = ['#818cf8', '#38bdf8', '#34d399', '#fbbf24', '#f43f5e', '#a855f7'];
        this.color = colors[currentTier - 1] || '#a855f7';
        this.speed = 12;
        this.velocity = { x: Math.cos(angle) * this.speed, y: Math.sin(angle) * this.speed };
    }

    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
    }

    draw() {
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x - camera.x, this.y - camera.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.restore();
    }
}

class Enemy {
    constructor() {
        // Sinh quái vật ngẫu nhiên bao quanh vùng biên thế giới rộng lớn
        this.x = Math.random() * WORLD_WIDTH;
        this.y = Math.random() * WORLD_HEIGHT;

        // Tránh sinh ngay sát vị trí người chơi đang đứng
        while (Math.hypot(player.x - this.x, player.y - this.y) < 400) {
            this.x = Math.random() * WORLD_WIDTH;
            this.y = Math.random() * WORLD_HEIGHT;
        }

        this.radius = Math.random() * 8 + 10;
        this.maxHp = 1; 
        this.color = '#ff2a5f';
        this.isElite = false;
        this.flashFrames = 0;

        // Từ Tier 3+: Quái bọc giáp đỏ cực trâu xuất hiện dày đặc
        if (currentTier >= 3 && Math.random() < 0.2 * (currentTier - 2)) {
            this.radius = Math.random() * 8 + 22; 
            this.maxHp = Math.floor(currentTier * 1.5); 
            this.color = '#b91c1c'; 
            this.isElite = true;
        }

        this.hp = this.maxHp;
        this.speed = (Math.random() * 0.6 + 0.8) + (currentTier * 0.3);
    }

    update() {
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.x += Math.cos(angle) * this.speed;
        this.y += Math.sin(angle) * this.speed;
        if (this.flashFrames > 0) this.flashFrames--;
    }

    draw() {
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x - camera.x, this.y - camera.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.flashFrames > 0 ? '#ffffff' : this.color;
        ctx.shadowBlur = this.isElite ? 15 : 8;
        ctx.shadowColor = this.color;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(this.x - camera.x, this.y - camera.y, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        ctx.restore();
    }
}

class Gem {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 6;
        this.color = '#00ff66';
        this.pulse = Math.random() * 10;
    }

    draw() {
        this.pulse += 0.1;
        let currentRadius = this.radius + Math.sin(this.pulse) * 1.5;
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x - camera.x, this.y - camera.y, currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 12;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color;
        this.radius = Math.random() * 2 + 1;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 1;
        this.velocity = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
        this.alpha = 1;
        this.decay = Math.random() * 0.02 + 0.02;
    }
    update() { this.x += this.velocity.x; this.y += this.velocity.y; this.alpha -= this.decay; }
    draw() {
        ctx.save(); ctx.globalAlpha = this.alpha; ctx.beginPath();
        ctx.arc(this.x - camera.x, this.y - camera.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color; ctx.fill(); ctx.restore();
    }
}

function createExplosion(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y, color));
}

// LẮNG NGHE ĐIỀU KHIỂN BÀN PHÍM
window.addEventListener('keydown', (e) => { if (e.key in keys) keys[e.key] = true; });
window.addEventListener('keyup', (e) => { if (e.key in keys) keys[e.key] = false; });

// TỰ ĐỘNG BẮN KHI DI CHUYỂN CHUỘT (PC)
window.addEventListener('mousemove', (e) => {
    if (gameOver) return;
    // Tính toán góc xoay dựa trên vị trí thực tế của người chơi trên màn hình hiển thị
    const screenPlayerX = player.x - camera.x;
    const screenPlayerY = player.y - camera.y;
    player.angle = Math.atan2(e.clientY - screenPlayerY, e.clientX - screenPlayerX);
});

// XỬ LÝ SỰ KIỆN JOYSTICK CẢM ỨNG (MOBILE)
function handleJoystick(e) {
    if (!isTouchingJoystick || gameOver) return;
    const rect = joystickBase.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const touch = e.touches[0];
    let deltaX = touch.clientX - centerX;
    let deltaY = touch.clientY - centerY;
    const distance = Math.hypot(deltaX, deltaY);
    const maxRadius = rect.width / 2;

    if (distance > maxRadius) {
        deltaX = (deltaX / distance) * maxRadius;
        deltaY = (deltaY / distance) * maxRadius;
    }

    joystickStick.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    
    // Cập nhật hướng di chuyển và hướng đầu súng tự động xoay theo Joystick
    joystickVector = { x: deltaX / maxRadius, y: deltaY / maxRadius };
    player.angle = Math.atan2(deltaY, deltaX);
}

joystickBase.addEventListener('touchstart', (e) => { isTouchingJoystick = true; handleJoystick(e); }, { passive: true });
window.addEventListener('touchmove', (e) => { handleJoystick(e); }, { passive: true });
window.addEventListener('touchend', () => {
    isTouchingJoystick = false;
    joystickStick.style.transform = 'translate(0px, 0px)';
    joystickVector = { x: 0, y: 0 };
});

function autoFire() {
    if (gameOver || hasWon) return;
    
    if (currentTier === 1) {
        bullets.push(new Bullet(player.x, player.y, player.angle));
    } else if (currentTier === 2) {
        bullets.push(new Bullet(player.x - Math.sin(player.angle)*6, player.y + Math.cos(player.angle)*6, player.angle));
        bullets.push(new Bullet(player.x + Math.sin(player.angle)*6, player.y - Math.sin(player.angle)*6, player.angle));
    } else if (currentTier === 3) {
        bullets.push(new Bullet(player.x, player.y, player.angle));
        bullets.push(new Bullet(player.x, player.y, player.angle + 0.18));
        bullets.push(new Bullet(player.x, player.y, player.angle - 0.18));
    } else if (currentTier === 4) {
        bullets.push(new Bullet(player.x, player.y, player.angle));
        bullets.push(new Bullet(player.x, player.y, player.angle + 0.15));
        bullets.push(new Bullet(player.x, player.y, player.angle - 0.15));
        bullets.push(new Bullet(player.x, player.y, player.angle + Math.PI)); 
    } else if (currentTier === 5) {
        for(let i = -2; i <= 2; i++) bullets.push(new Bullet(player.x, player.y, player.angle + (i * 0.15)));
    } else if (currentTier === 6) {
        // Tier 6: Bắn vòng tròn 8 hướng quét sạch thiên hà
        for(let i = 0; i < 8; i++) bullets.push(new Bullet(player.x, player.y, (Math.PI * 2 / 8) * i));
    }
}

function init() {
    score = 0; hp = 100; currentTier = 1; gameOver = false; hasWon = false;
    spawnTimer = 0; bullets = []; enemies = []; gems = []; particles = [];
    for (let key in keys) keys[key] = false;
    updateUI();
    document.getElementById('game-over-screen').classList.add('hidden');
    player = new Player();
}

function updateUI() {
    const nextThreshold = TIER_THRESHOLDS[currentTier - 1] || TIER_THRESHOLDS[TIER_THRESHOLDS.length - 1];
    const prevThreshold = currentTier === 1 ? 0 : TIER_THRESHOLDS[currentTier - 2];
    document.getElementById('score-val').innerText = `${String(score).padStart(4, '0')} / ${String(nextThreshold).padStart(4, '0')}`;
    document.getElementById('hp-bar-fill').style.width = Math.max(0, hp) + '%';
    let progressPercent = ((score - prevThreshold) / (nextThreshold - prevThreshold)) * 100;
    if (currentTier === 6) progressPercent = 100;
    document.getElementById('progress-bar-fill').style.width = Math.min(100, Math.max(0, progressPercent)) + '%';
    const status = document.getElementById('weapon-status');
    status.className = `tier-${currentTier}`;
    status.innerText = currentTier === 6 ? 'TIER 6 (MAX)' : `TIER ${currentTier}`;
}

function checkLevelUp() {
    if (currentTier >= 6) {
        if (score >= TIER_THRESHOLDS[TIER_THRESHOLDS.length - 1] && !hasWon) {
            hasWon = true; triggerEndGame(true);
        }
        return;
    }
    if (score >= TIER_THRESHOLDS[currentTier - 1]) {
        currentTier++;
        createExplosion(player.x, player.y, '#00ffff', 35);
        updateUI();
    }
}

function triggerEndGame(isVictory) {
    gameOver = true;
    const title = document.getElementById('game-title-end');
    const sub = document.getElementById('game-sub-end');
    document.getElementById('final-tier').innerText = `TIER ${currentTier}`;
    document.getElementById('final-score').innerText = score;
    if (isVictory) {
        title.innerText = "MISSION ACCOMPLISHED"; title.style.color = "#a855f7";
        sub.innerText = "Hệ thống không gian Base hoàn toàn được giải phóng!";
    } else {
        title.innerText = "SHIP DESTROYED"; title.style.color = "#ff2a5f";
        sub.innerText = "Hệ thống động cơ bị nổ tung";
    }
    document.getElementById('game-over-screen').classList.remove('hidden');
}

// VẼ NỀN LƯỚI KHÔNG GIAN ĐỂ NHẬN BIẾT BẢN ĐỒ ĐANG CUỘN
function drawSpaceGrid() {
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    const gridSize = 100;
    
    // Tìm điểm bắt đầu vẽ lưới dựa trên Camera để tối ưu hiệu năng
    const startX = Math.floor(camera.x / gridSize) * gridSize;
    const startY = Math.floor(camera.y / gridSize) * gridSize;

    for (let x = startX; x < startX + canvas.width + gridSize; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x - camera.x, 0);
        ctx.lineTo(x - camera.x, canvas.height);
        ctx.stroke();
    }
    for (let y = startY; y < startY + canvas.height + gridSize; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y - camera.y);
        ctx.lineTo(canvas.width, y - camera.y);
        ctx.stroke();
    }
}

function animate() {
    requestAnimationFrame(animate);
    
    ctx.fillStyle = 'rgba(2, 6, 23, 0.25)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameOver) return;

    // CẬP NHẬT CAMERA ĐUỔI THEO TỌA ĐỘ PHI THUYỀN (Giúp màn hình rộng vô cực)
    camera.x = player.x - canvas.width / 2;
    camera.y = player.y - canvas.height / 2;

    // Giới hạn camera không chạy ra ngoài biên giới World Map
    if (camera.x < 0) camera.x = 0;
    if (camera.x > WORLD_WIDTH - canvas.width) camera.x = WORLD_WIDTH - canvas.width;
    if (camera.y < 0) camera.y = 0;
    if (camera.y > WORLD_HEIGHT - canvas.height) camera.y = WORLD_HEIGHT - canvas.height;

    drawSpaceGrid();

    player.move();
    player.draw();

    // CƠ CHẾ TỰ ĐỘNG BẮN LIÊN TỤC (Tốc độ xả đạn phụ thuộc vào Tier)
    fireTimer++;
    let fireRate = currentTier === 6 ? 6 : 12; // Càng Cấp cao bắn càng nhanh điên cuồng
    if (fireTimer >= fireRate) {
        autoFire();
        fireTimer = 0;
    }

    particles.forEach((p, index) => {
        if (p.alpha <= 0) particles.splice(index, 1);
        else { p.update(); p.draw(); }
    });

    spawnTimer++;
    let spawnRate = Math.max(8, 35 - (currentTier * 4)); 
    if (spawnTimer > spawnRate && enemies.length < 60) {
        enemies.push(new Enemy());
        spawnTimer = 0;
    }

    gems.forEach((gem, gIndex) => {
        gem.draw();
        const dist = Math.hypot(player.x - gem.x, player.y - gem.y);
        if (dist - player.radius - gem.radius < 1) {
            score += 10;
            createExplosion(gem.x, gem.y, gem.color, 6);
            gems.splice(gIndex, 1);
            updateUI();
            checkLevelUp();
        }
    });

    bullets.forEach((bullet, bIndex) => {
        bullet.update();
        bullet.draw();
        if (bullet.x < 0 || bullet.x > WORLD_WIDTH || bullet.y < 0 || bullet.y > WORLD_HEIGHT) {
            bullets.splice(bIndex, 1);
        }
    });

    enemies.forEach((enemy, eIndex) => {
        enemy.update();
        enemy.draw();

        const distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (distToPlayer - player.radius - enemy.radius < 1) {
            hp -= enemy.isElite ? 20 : 8;
            createExplosion(enemy.x, enemy.y, enemy.color, 12);
            enemies.splice(eIndex, 1);
            updateUI();
            if (hp <= 0) triggerEndGame(false);
        }

        bullets.forEach((bullet, bIndex) => {
            const distToBullet = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
            if (distToBullet - bullet.radius - enemy.radius < 1) {
                bullets.splice(bIndex, 1);
                enemy.flashFrames = 3;
                enemy.hp--;

                if (enemy.hp <= 0) {
                    createExplosion(enemy.x, enemy.y, enemy.color, enemy.isElite ? 20 : 10);
                    if (enemy.isElite || Math.random() < 0.65) {
                        gems.push(new Gem(enemy.x, enemy.y));
                    }
                    enemies.splice(eIndex, 1);
                }
            }
        });
    });
}

document.getElementById('restart-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    init();
});

init();
animate();