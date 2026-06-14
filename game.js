const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Quản lý trạng thái cốt lõi của game
let score, hp, gameOver, weaponTier;
let player, bullets, enemies, gems, particles;
let spawnTimer;

class Player {
    constructor() {
        this.x = canvas.width / 2;
        this.y = canvas.height / 2;
        this.radius = 16;
        this.color = '#0052FF'; // Base Blue
        this.angle = 0;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Vẽ Khung hào quang bảo vệ của Core
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;

        // Vẽ phi thuyền thiết kế Cyberpunk góc cạnh
        ctx.beginPath();
        ctx.moveTo(24, 0);
        ctx.lineTo(-12, -14);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-12, 14);
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();

        // Vẽ động cơ phản lực neon phía sau
        ctx.beginPath();
        ctx.arc(-6, 0, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffaa00';
        ctx.shadowColor = '#ffaa00';
        ctx.fill();

        ctx.restore();
    }
}

class Bullet {
    constructor(x, y, angle, speedBonus = 0) {
        this.x = x;
        this.y = y;
        this.radius = 3.5;
        this.color = weaponTier === 3 ? '#ff00ff' : (weaponTier === 2 ? '#ffaa00' : '#00ffff');
        this.speed = 8 + speedBonus;
        this.velocity = {
            x: Math.cos(angle) * this.speed,
            y: Math.sin(angle) * this.speed
        };
    }

    draw() {
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 12;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.restore();
    }

    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
    }
}

class Enemy {
    constructor() {
        if (Math.random() < 0.5) {
            this.x = Math.random() < 0.5 ? -40 : canvas.width + 40;
            this.y = Math.random() * canvas.height;
        } else {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() < 0.5 ? -40 : canvas.height + 40;
        }
        // Kích thước quái ngẫu nhiên
        this.radius = Math.random() * 14 + 10;
        this.color = '#ff2a5f';
        // Quái càng nhỏ bay càng nhanh
        this.speed = (30 / this.radius) * (Math.random() * 0.5 + 0.8);
        
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.velocity = {
            x: Math.cos(angle) * this.speed,
            y: Math.sin(angle) * this.speed
        };
    }

    draw() {
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fill();
        
        // Tâm quái vật màu tối tạo chiều sâu hình khối
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = '#1e1b4b';
        ctx.fill();
        ctx.restore();
    }

    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
    }
}

class Gem {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 5;
        this.color = '#00ff66';
        this.pulse = 0;
    }

    draw() {
        this.pulse += 0.1;
        let currentRadius = this.radius + Math.sin(this.pulse) * 1.5;
        
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.restore();
    }
}

// Hệ thống hạt bụi nổ (VFX Particles)
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.radius = Math.random() * 3 + 1;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 1;
        this.velocity = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
        this.alpha = 1;
        this.decay = Math.random() * 0.02 + 0.015;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 6;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.restore();
    }

    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.alpha -= this.decay;
    }
}

function createExplosion(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function init() {
    score = 0;
    hp = 100;
    weaponTier = 1;
    gameOver = false;
    spawnTimer = 0;
    bullets = [];
    enemies = [];
    gems = [];
    particles = [];
    
    document.getElementById('score-val').innerText = '0000';
    document.getElementById('hp-bar-fill').style.width = '100%';
    updateWeaponUI();
    document.getElementById('game-over-screen').classList.add('hidden');
    player = new Player();
}

function updateWeaponUI() {
    const status = document.getElementById('weapon-status');
    status.className = `tier-${weaponTier}`;
    status.innerText = `TIER ${weaponTier}`;
}

// Xử lý logic nâng cấp vũ khí dựa trên điểm số gặt hái được
function checkWeaponUpgrade() {
    let oldTier = weaponTier;
    if (score >= 300) weaponTier = 3;
    else if (score >= 100) weaponTier = 2;
    else weaponTier = 1;

    if (oldTier !== weaponTier) updateWeaponUI();
}

// Điều khiển cho cả PC và Mobile
function handleMove(e) {
    if (gameOver) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    player.angle = Math.atan2(clientY - player.y, clientX - player.x);
}

function fireWeapons() {
    if (gameOver) return;
    
    if (weaponTier === 1) {
        // Cấp 1: Bắn tia đơn cơ bản
        bullets.push(new Bullet(player.x, player.y, player.angle));
    } else if (weaponTier === 2) {
        // Cấp 2: Bắn tia kép song song
        const offset = 8;
        const x1 = player.x + Math.cos(player.angle + Math.PI/2) * offset;
        const y1 = player.y + Math.sin(player.angle + Math.PI/2) * offset;
        const x2 = player.x + Math.cos(player.angle - Math.PI/2) * offset;
        const y2 = player.y + Math.sin(player.angle - Math.PI/2) * offset;
        bullets.push(new Bullet(x1, y1, player.angle));
        bullets.push(new Bullet(x2, y2, player.angle));
    } else if (weaponTier === 3) {
        // Cấp 3: Bắn 3 hướng quét sạch bản đồ
        bullets.push(new Bullet(player.x, player.y, player.angle));
        bullets.push(new Bullet(player.x, player.y, player.angle + 0.2));
        bullets.push(new Bullet(player.x, player.y, player.angle - 0.2));
    }
}

window.addEventListener('mousemove', handleMove);
window.addEventListener('touchmove', handleMove, { passive: true });
window.addEventListener('mousedown', fireWeapons);
window.addEventListener('touchstart', (e) => {
    handleMove(e);
    fireWeapons();
}, { passive: true });

function animate() {
    requestAnimationFrame(animate);
    
    // Tạo không gian vũ trụ huyền ảo bằng cách dọn nền mờ nhẹ
    ctx.fillStyle = 'rgba(2, 6, 23, 0.25)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameOver) return;

    // Quản lý hệ thống hạt nổ VFX
    particles.forEach((particle, index) => {
        if (particle.alpha <= 0) {
            particles.splice(index, 1);
        } else {
            particle.update();
            particle.draw();
        }
    });

    player.draw();

    // Tốc độ sinh quái tăng tiến theo điểm số của người chơi
    spawnTimer++;
    let spawnRate = Math.max(15, 45 - Math.floor(score / 50));
    if (spawnTimer > spawnRate) {
        enemies.push(new Enemy());
        spawnTimer = 0;
    }

    // Xử lý Gems năng lượng
    gems.forEach((gem, gIndex) => {
        gem.draw();
        const dist = Math.hypot(player.x - gem.x, player.y - gem.y);
        if (dist - player.radius - gem.radius < 1) {
            score += 10;
            document.getElementById('score-val').innerText = String(score).padStart(4, '0');
            createExplosion(gem.x, gem.y, gem.color, 8);
            gems.splice(gIndex, 1);
            checkWeaponUpgrade();
        }
    });

    // Xử lý Đạn
    bullets.forEach((bullet, bIndex) => {
        bullet.update();
        bullet.draw();
        if (bullet.x < 0 || bullet.x > canvas.width || bullet.y < 0 || bullet.y > canvas.height) {
            bullets.splice(bIndex, 1);
        }
    });

    // Xử lý Quái vật
    enemies.forEach((enemy, eIndex) => {
        enemy.update();
        enemy.draw();

        // Va chạm với Tâm Lõi (Người chơi) -> Trừ HP thay vì chết ngay
        const distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (distToPlayer - player.radius - enemy.radius < 1) {
            hp -= Math.floor(enemy.radius);
            createExplosion(enemy.x, enemy.y, enemy.color, 15);
            enemies.splice(eIndex, 1);
            
            // Cập nhật thanh máu UI
            const hpBarPercent = Math.max(0, hp);
            document.getElementById('hp-bar-fill').style.width = hpBarPercent + '%';

            if (hp <= 0) {
                gameOver = true;
                document.getElementById('final-score').innerText = score;
                document.getElementById('game-over-screen').classList.remove('hidden');
            }
        }

        // Bắn trúng quái vật
        bullets.forEach((bullet, bIndex) => {
            const distToBullet = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
            if (distToBullet - bullet.radius - enemy.radius < 1) {
                createExplosion(enemy.x, enemy.y, enemy.color, 12);
                if (Math.random() < 0.6) {
                    gems.push(new Gem(enemy.x, enemy.y));
                }
                enemies.splice(eIndex, 1);
                bullets.splice(bIndex, 1);
            }
        });
    });
}

document.getElementById('restart-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    init();
});

// Kích hoạt
init();
animate();