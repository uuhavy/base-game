const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Tự động resize canvas theo màn hình mobile/desktop
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Khởi tạo trạng thái Game
let score = 0;
let gameOver = false;
let player;
let bullets = [];
let enemies = [];
let gems = [];

// Đối tượng người chơi (Tàu vũ trụ)
class Player {
    constructor() {
        this.x = canvas.width / 2;
        this.y = canvas.height / 2;
        this.radius = 18;
        this.color = '#0052FF'; // Base Blue
        this.angle = 0;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Vẽ phi thuyền dạng tam giác Neon cường độ cao
        ctx.beginPath();
        ctx.moveTo(22, 0);
        ctx.lineTo(-14, -14);
        ctx.lineTo(-6, 0);
        ctx.lineTo(-14, 14);
        ctx.closePath();
        
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.restore();
    }
}

// Đạn bắn ra
class Bullet {
    constructor(x, y, angle) {
        this.x = x;
        this.y = y;
        this.radius = 4;
        this.color = '#00FFFF';
        this.speed = 7;
        this.velocity = {
            x: Math.cos(angle) * this.speed,
            y: Math.sin(angle) * this.speed
        };
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fill();
    }

    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
    }
}

// Thiên thạch/Quái vật bay vào tâm
class Enemy {
    constructor() {
        // Xuất hiện ngẫu nhiên từ rìa màn hình ngoài
        if (Math.random() < 0.5) {
            this.x = Math.random() < 0.5 ? 0 - 20 : canvas.width + 20;
            this.y = Math.random() * canvas.height;
        } else {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() < 0.5 ? 0 - 20 : canvas.height + 20;
        }
        this.radius = Math.random() * 12 + 10;
        this.color = '#ff3b3b';
        this.speed = Math.random() * 1.5 + 1;
        
        // Hướng bay thẳng về phía người chơi
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.velocity = {
            x: Math.cos(angle) * this.speed,
            y: Math.sin(angle) * this.speed
        };
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = this.color;
        ctx.fill();
    }

    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
    }
}

// Gems năng lượng rơi ra khi bắn hạ Enemy
class Gem {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 6;
        this.color = '#00FF66'; // Màu xanh lá cây của Profit/Gems
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 12;
        ctx.shadowColor = this.color;
        ctx.fill();
    }
}

// Khởi tạo/Đặt lại Game
function init() {
    score = 0;
    gameOver = false;
    bullets = [];
    enemies = [];
    gems = [];
    document.getElementById('score-val').innerText = score;
    document.getElementById('game-over-screen').classList.add('hidden');
    player = new Player();
}

// Xử lý Input (Hỗ trợ cả Chuột trên PC lẫn Chạm trên Mobile)
function handlePointerMove(e) {
    if (gameOver) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // Xoay đầu tàu về phía con trỏ/ngón tay tay chạm
    player.angle = Math.atan2(clientY - player.y, clientX - player.x);
}

function handlePointerDown(e) {
    if (gameOver) return;
    // Bắn đạn
    bullets.push(new Bullet(player.x, player.y, player.angle));
}

window.addEventListener('mousemove', handlePointerMove);
window.addEventListener('touchmove', handlePointerMove);
window.addEventListener('mousedown', handlePointerDown);
window.addEventListener('touchstart', handlePointerDown);

// Vòng lặp Game (Game Loop)
let spawnTimer = 0;
function animate() {
    requestAnimationFrame(animate);
    if (gameOver) return;

    // Clear màn hình với hiệu ứng mờ nhẹ để tạo đuôi chuyển động (motion blur)
    ctx.fillStyle = 'rgba(0, 8, 20, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    player.draw();

    // Spawn quái vật định kỳ
    spawnTimer++;
    if (spawnTimer > 45) { 
        enemies.push(new Enemy());
        spawnTimer = 0;
    }

    // Xử lý Gems
    gems.forEach((gem, gIndex) => {
        gem.draw();
        // Kiểm tra va chạm giữa người chơi và Gems nhặt điểm
        const dist = Math.hypot(player.x - gem.x, player.y - gem.y);
        if (dist - player.radius - gem.radius < 1) {
            score += 10;
            document.getElementById('score-val').innerText = score;
            gems.splice(gIndex, 1);
        }
    });

    // Xử lý Đạn
    bullets.forEach((bullet, bIndex) => {
        bullet.update();
        bullet.draw();

        // Xóa đạn khi bay ra ngoài màn hình
        if (bullet.x < 0 || bullet.x > canvas.width || bullet.y < 0 || bullet.y > canvas.height) {
            bullets.splice(bIndex, 1);
        }
    });

    // Xử lý Quái vật (Enemy)
    enemies.forEach((enemy, eIndex) => {
        enemy.update();
        enemy.draw();

        // Kiểm tra va chạm với Người chơi -> Game Over
        const distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (distToPlayer - player.radius - enemy.radius < 1) {
            gameOver = true;
            document.getElementById('final-score').innerText = score;
            document.getElementById('game-over-screen').classList.remove('hidden');
        }

        // Kiểm tra va chạm giữa Đạn và Quái vật
        bullets.forEach((bullet, bIndex) => {
            const distToBullet = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
            if (distToBullet - bullet.radius - enemy.radius < 1) {
                // Rơi ra hạt năng lượng (Gem) tại vị trí quái chết
                if(Math.random() < 0.7) { 
                    gems.push(new Gem(enemy.x, enemy.y));
                }
                enemies.splice(eIndex, 1);
                bullets.splice(bIndex, 1);
            }
        });
    });
}

document.getElementById('restart-btn').addEventListener('click', (e) => {
    e.stopPropagation(); // Không kích hoạt phát bắn khi bấm restart
    init();
});

// Chạy game
init();
animate();