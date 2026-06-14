const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Cấu hình các mốc điểm cố định để lên cấp từ Tier 1 -> Tier 6
const TIER_THRESHOLDS = [50, 150, 350, 700, 1200, 2000]; // Điểm tích lũy để đạt Tier tiếp theo

let score, hp, gameOver, currentTier, hasWon;
let player, bullets, enemies, gems, particles;
let spawnTimer;

// Trạng thái phím điều hướng bấm giữ để di chuyển phi thuyền
const keys = {
    w: false, a: false, s: false, d: false,
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false
};

class Player {
    constructor() {
        this.x = canvas.width / 2;
        this.y = canvas.height / 2;
        this.radius = 15;
        this.color = '#0052FF'; 
        this.speed = 4.5; // Tốc độ di chuyển của phi thuyền
        this.angle = 0;
    }

    move() {
        // Xử lý di chuyển đa hướng (Hỗ trợ cả WASD và phím Mũi tên)
        if (keys.w || keys.ArrowUp) this.y -= this.speed;
        if (keys.s || keys.ArrowDown) this.y += this.speed;
        if (keys.a || keys.ArrowLeft) this.x -= this.speed;
        if (keys.d || keys.ArrowRight) this.x += this.speed;

        // Giới hạn phi thuyền không bay ra ngoài rìa màn hình
        if (this.x < this.radius) this.x = this.radius;
        if (this.x > canvas.width - this.radius) this.x = canvas.width - this.radius;
        if (this.y < this.radius) this.y = this.radius;
        if (this.y > canvas.height - this.radius) this.y = canvas.height - this.radius;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;

        ctx.beginPath();
        ctx.moveTo(22, 0);
        ctx.lineTo(-12, -12);
        ctx.lineTo(-4, 0);
        ctx.lineTo(-12, 12);
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
        // Đổi màu đạn tương ứng theo sức mạnh Cấp độ vũ khí
        const colors = ['#818cf8', '#38bdf8', '#34d399', '#fbbf24', '#f43f5e', '#a855f7'];
        this.color = colors[currentTier - 1] || '#a855f7';
        this.speed = 10;
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
        ctx.restore();
    }

    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
    }
}

class Enemy {
    constructor() {
        // Xuất hiện ngẫu nhiên bên ngoài màn hình nền
        if (Math.random() < 0.5) {
            this.x = Math.random() < 0.5 ? -50 : canvas.width + 50;
            this.y = Math.random() * canvas.height;
        } else {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() < 0.5 ? -50 : canvas.height + 50;
        }

        // Cấp độ càng cao, quái vật càng đột biến
        this.radius = Math.random() * 10 + 10;
        this.maxHp = 1; 
        this.color = '#ff2a5f';
        this.isElite = false;
        this.flashFrames = 0; // Hiệu ứng nhấp nháy trắng khi bị trúng đạn

        // Từ Tier 3 trở lên: Xuất hiện Elites Quái Vật Đỏ bọc giáp to hơn, bắn nhiều phát mới chết
        if (currentTier >= 3 && Math.random() < 0.15 * (currentTier - 2)) {
            this.radius = Math.random() * 10 + 22; // Quái siêu to khổng lồ
            this.maxHp = Math.floor(currentTier * 1.3); // Yêu cầu bắn trúng nhiều phát (Ví dụ: Tier 3 cần bắn 3-4 phát)
            this.color = '#b91c1c'; // Màu đỏ sẫm giáp dày
            this.isElite = true;
        }

        this.hp = this.maxHp;
        // Cấp độ càng cao, quái bay dí theo phi thuyền càng điên cuồng
        this.speed = (Math.random() * 0.8 + 0.8) + (currentTier * 0.3);
    }

    update() {
        // Luôn luôn tính toán lại vector để đuổi bắt theo tọa độ thực tế của phi thuyền người chơi
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.velocity = {
            x: Math.cos(angle) * this.speed,
            y: Math.sin(angle) * this.speed
        };
        this.x += this.velocity.x;
        this.y += this.velocity.y;

        if (this.flashFrames > 0) this.flashFrames--;
    }

    draw() {
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        
        // Hiển thị hiệu ứng màu trắng khi quái bị dính đạn
        if (this.flashFrames > 0) {
            ctx.fillStyle = '#ffffff';
        } else {
            ctx.fillStyle = this.color;
        }

        ctx.shadowBlur = this.isElite ? 15 : 8;
        ctx.shadowColor = this.color;
        ctx.fill();

        // Vẽ lõi hạt nhân bên trong quái vật
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.4, 0, Math.PI * 2);
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
        this.color = '#00ff66'; // Hạt năng lượng màu xanh lá cây
        this.pulse = 0;
    }

    draw() {
        this.pulse += 0.1;
        let currentRadius = this.radius + Math.sin(this.pulse) * 1.5;
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 12;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.radius = Math.random() * 2.5 + 1;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3.5 + 1;
        this.velocity = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
        this.alpha = 1;
        this.decay = Math.random() * 0.02 + 0.02;
    }

    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.alpha -= this.decay;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }
}

function createExplosion(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

// Theo dõi bàn phím nhấn xuống
window.addEventListener('keydown', (e) => {
    if (e.key in keys) keys[e.key] = true;
});

// Theo dõi khi thả phím ra
window.addEventListener('keyup', (e) => {
    if (e.key in keys) keys[e.key] = false;
});

// Xoay hướng bắn theo chuột/ngón tay chạm
function handleMove(e) {
    if (gameOver) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    player.angle = Math.atan2(clientY - player.y, clientX - player.x);
}
window.addEventListener('mousemove', handleMove);
window.addEventListener('touchmove', handleMove, { passive: true });

// Kích hoạt bắn đạn
function fireWeapons() {
    if (gameOver || hasWon) return;
    
    // CẤU HÌNH SỨC MẠNH SÚNG TĂNG TIẾN QUA 6 TIER
    if (currentTier === 1) {
        // Tier 1: Súng bắn đơn cơ bản
        bullets.push(new Bullet(player.x, player.y, player.angle));
    } else if (currentTier === 2) {
        // Tier 2: Súng bắn hai tia song song cực mạnh
        bullets.push(new Bullet(player.x - Math.sin(player.angle)*6, player.y + Math.cos(player.angle)*6, player.angle));
        bullets.push(new Bullet(player.x + Math.sin(player.angle)*6, player.y - Math.cos(player.angle)*6, player.angle));
    } else if (currentTier === 3) {
        // Tier 3: Súng bắn 3 tia tỏa rộng hình quạt
        bullets.push(new Bullet(player.x, player.y, player.angle));
        bullets.push(new Bullet(player.x, player.y, player.angle + 0.18));
        bullets.push(new Bullet(player.x, player.y, player.angle - 0.18));
    } else if (currentTier === 4) {
        // Tier 4: Súng bắn tỏa 3 tia kết hợp bọc hậu phía sau lưng
        bullets.push(new Bullet(player.x, player.y, player.angle));
        bullets.push(new Bullet(player.x, player.y, player.angle + 0.15));
        bullets.push(new Bullet(player.x, player.y, player.angle - 0.15));
        bullets.push(new Bullet(player.x, player.y, player.angle + Math.PI)); // Bắn ngược dòng bảo vệ đuôi
    } else if (currentTier === 5) {
        // Tier 5: Súng Shotgun 5 nòng hủy diệt diện rộng
        for(let i = -2; i <= 2; i++) {
            bullets.push(new Bullet(player.x, player.y, player.angle + (i * 0.15)));
        }
    } else if (currentTier === 6) {
        // Tier 6: Khai hỏa vũ khí tối thượng Omnidirectional Nova Shot - Bắn vòng tròn 8 hướng
        for(let i = 0; i < 8; i++) {
            bullets.push(new Bullet(player.x, player.y, (Math.PI * 2 / 8) * i));
        }
    }
}
window.addEventListener('mousedown', fireWeapons);
window.addEventListener('touchstart', (e) => { handleMove(e); fireWeapons(); }, { passive: true });

function init() {
    score = 0;
    hp = 100;
    currentTier = 1;
    gameOver = false;
    hasWon = false;
    spawnTimer = 0;
    bullets = [];
    enemies = [];
    gems = [];
    particles = [];
    
    // Đặt lại các trạng thái nút bấm
    for (let key in keys) keys[key] = false;

    updateUI();
    document.getElementById('game-over-screen').classList.add('hidden');
    player = new Player();
}

function updateUI() {
    const nextThreshold = TIER_THRESHOLDS[currentTier - 1] || TIER_THRESHOLDS[TIER_THRESHOLDS.length - 1];
    const prevThreshold = currentTier === 1 ? 0 : TIER_THRESHOLDS[currentTier - 2];
    
    // Cập nhật text điểm số
    document.getElementById('score-val').innerText = `${String(score).padStart(4, '0')} / ${String(nextThreshold).padStart(4, '0')}`;
    
    // Cập nhật thanh máu
    document.getElementById('hp-bar-fill').style.width = Math.max(0, hp) + '%';
    
    // Cập nhật thanh tiến trình lên cấp Tier
    let progressPercent = ((score - prevThreshold) / (nextThreshold - prevThreshold)) * 100;
    if (currentTier === 6) progressPercent = 100; // Đạt cấp tối đa
    document.getElementById('progress-bar-fill').style.width = Math.min(100, Math.max(0, progressPercent)) + '%';

    // Đổi chữ và màu Rank theo Tier chuẩn
    const status = document.getElementById('weapon-status');
    status.className = `tier-${currentTier}`;
    status.innerText = currentTier === 6 ? 'TIER 6 (MAX)' : `TIER ${currentTier}`;
}

// Xử lý kiểm tra điều kiện thăng hạng
function checkLevelUp() {
    if (currentTier >= 6) {
        // Nếu đã ở Tier 6 và vượt qua mốc điểm tối đa -> Chiến thắng vinh quang
        if (score >= TIER_THRESHOLDS[TIER_THRESHOLDS.length - 1] && !hasWon) {
            hasWon = true;
            triggerEndGame(true);
        }
        return;
    }

    const currentTarget = TIER_THRESHOLDS[currentTier - 1];
    if (score >= currentTarget) {
        currentTier++;
        createExplosion(player.x, player.y, '#00ffff', 40); // Nổ hiệu ứng nâng cấp cực lớn bao quanh phi thuyền
        updateUI();
    }
}

function triggerEndGame(isVictory) {
    gameOver = true;
    const title = document.getElementById('game-title-end');
    const sub = document.getElementById('game-sub-end');
    const finalTierText = document.getElementById('final-tier');
    
    finalTierText.innerText = `TIER ${currentTier}`;
    document.getElementById('final-score').innerText = score;
    
    if (isVictory) {
        title.innerText = "MISSION ACCOMPLISHED";
        title.style.color = "#a855f7";
        sub.innerText = "Hệ thống lõi Base hoàn toàn an toàn!";
        document.querySelector('.glow-box').style.borderTop = "4px solid #a855f7";
    } else {
        title.innerText = "CORE BREACHED";
        title.style.color = "#ff2a5f";
        sub.innerText = "Hệ thống phòng thủ thất bại";
        document.querySelector('.glow-box').style.borderTop = "4px solid #ff2a5f";
    }
    document.getElementById('game-over-screen').classList.remove('hidden');
}

function animate() {
    requestAnimationFrame(animate);
    
    ctx.fillStyle = 'rgba(2, 6, 23, 0.25)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameOver) return;

    // Cập nhật vị trí di chuyển tự do của tàu vũ trụ người chơi
    player.move();
    player.draw();

    // Xử lý hạt nổ VFX
    particles.forEach((p, index) => {
        if (p.alpha <= 0) {
            particles.splice(index, 1);
        } else {
            p.update();
            p.draw();
        }
    });

    // Tốc độ ra quái dồn dập tăng đột biến theo từng bậc Tier
    spawnTimer++;
    let spawnRate = Math.max(10, 40 - (currentTier * 5)); 
    if (spawnTimer > spawnRate) {
        enemies.push(new Enemy());
        spawnTimer = 0;
    }

    // Xử lý Gems năng lượng (Người chơi giờ phải chủ động lái tàu đè trúng hạt xanh để nhặt điểm)
    gems.forEach((gem, gIndex) => {
        gem.draw();
        const dist = Math.hypot(player.x - gem.x, player.y - gem.y);
        if (dist - player.radius - gem.radius < 1) {
            score += 10;
            createExplosion(gem.x, gem.y, gem.color, 8);
            gems.splice(gIndex, 1);
            updateUI();
            checkLevelUp();
        }
    });

    // Xử lý Đạn bay
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

        // Quái chạm vào Người chơi -> Gây sát thương nổ
        const distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (distToPlayer - player.radius - enemy.radius < 1) {
            hp -= enemy.isElite ? 25 : 12; // Quái Elites đỏ cắn đau gấp đôi quái thường
            createExplosion(enemy.x, enemy.y, enemy.color, 15);
            enemies.splice(eIndex, 1);
            updateUI();

            if (hp <= 0) {
                triggerEndGame(false);
            }
        }

        // Bắn trúng quái vật màu đỏ
        bullets.forEach((bullet, bIndex) => {
            const distToBullet = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
            if (distToBullet - bullet.radius - enemy.radius < 1) {
                // Xóa viên đạn ngay khi chạm mục tiêu
                bullets.splice(bIndex, 1);
                
                enemy.hp--; // Trừ 1 giáp của quái
                enemy.flashFrames = 3; // Kích hoạt nhấp nháy trắng báo hiệu trúng đạn

                // Nếu quái cạn sạch máu bọc giáp mới nổ tung rơi Gems
                if (enemy.hp <= 0) {
                    createExplosion(enemy.x, enemy.y, enemy.color, enemy.isElite ? 22 : 10);
                    // Quái to bọc giáp đỏ chắc chắn 100% rơi Gems xịn, quái nhỏ xác suất rơi 55%
                    if (enemy.isElite || Math.random() < 0.55) {
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