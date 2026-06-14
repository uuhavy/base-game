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
        this.angle = 0; // Hướng nhìn/hướng di chuyển của tàu
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

        // Thiết kế phi thuyền hướng về phía trước (hướng góc xoay)
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

// TỐI ƯU HƯỚNG XOAY THEO CHUỘT (PC)
window.addEventListener('mousemove', (e) => {
    if (gameOver) return;
    const screenPlayerX = player.x - camera.x;
    const screenPlayerY = player.y - camera.y;
    // Tàu luôn hướng đầu về phía con trỏ chuột để định hướng di chuyển
    player.angle = Math.atan2(e.clientY - screenPlayerY, e.clientX - screenPlayerX);
});

// XỬ LÝ SỰ KIỆN JOYSTICK CẢM ỨNG (MOBILE)
function handleJoystick(e) {
    if (!isTouchingJoystick || gameOver) return;
    const rect = joystickBase.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;