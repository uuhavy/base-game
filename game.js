const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const WORLD_WIDTH = 3000;
const WORLD_HEIGHT = 2000;
const TIER_THRESHOLDS = [50, 150, 350, 700, 1200, 2000];

let score = 0;
let hp = 100;
let gameOver = false;
let hasWon = false;
let currentTier = 1;
let player = null;
let bullets = [];
let enemies = [];
let gems = [];
let particles = [];
let spawnTimer = 0;
let fireTimer = 0;

const camera = { x: 0, y: 0 };

const keys = {
    w: false, a: false, s: false, d: false,
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false
};

let isTouchingJoystick = false;
let joystickVector = { x: 0, y: 0 };
const joystickBase = document.getElementById('joystick-base');
const joystickStick = document.getElementById('joystick-stick');

let userWalletAddress = null;
let username = null;

// SỬ DỤNG MÃ PROJECT ID CỦA BẠN LÀM DATA SUFFIX ĐỂ LIÊN KẾT HỆ THỐNG ON-CHAIN ATTRIBUTION
const BASE_PROJECT_ID = "6a2c3407f51db91a3690bf16"; 

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
        let moveX = 0;
        let moveY = 0;

        if (keys.w || keys.ArrowUp) moveY -= this.speed;
        if (keys.s || keys.ArrowDown) moveY += this.speed;
        if (keys.a || keys.ArrowLeft) moveX -= this.speed;
        if (keys.d || keys.ArrowRight) moveX += this.speed;

        if (isTouchingJoystick) {
            moveX += joystickVector.x * this.speed;
            moveY += joystickVector.y * this.speed;
        }

        this.x += moveX;
        this.y += moveY;

        if (moveX !== 0 || moveY !== 0) {
            const moveAngle = Math.atan2(moveY, moveX);
            this.angle = moveAngle + Math.PI; 
        }

        if (this.x < this.radius) this.x = this.radius;
        if (this.x > WORLD_WIDTH - this.radius) this.x = WORLD_WIDTH - this.radius;
        if (this.y < this.radius) this.y = this.radius;
        if (this.y > WORLD_HEIGHT - this.radius) this.y = WORLD_HEIGHT - this.radius;
    }

    draw() {
        ctx.save();
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
        this.speed = 13; 
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
        this.x = Math.random() * WORLD_WIDTH;
        this.y = Math.random() * WORLD_HEIGHT;

        let targetX = player ? player.x : WORLD_WIDTH / 2;
        let targetY = player ? player.y : WORLD_HEIGHT / 2;

        while (Math.hypot(targetX - this.x, targetY - this.y) < 400) {
            this.x = Math.random() * WORLD_WIDTH;
            this.y = Math.random() * WORLD_HEIGHT;
        }

        this.radius = Math.random() * 8 + 10;
        this.maxHp = 1; 
        this.color = '#ff2a5f';
        this.isElite = false;
        this.flashFrames = 0;

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
        if (!player) return;
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
        ctx.arc(-1, 0, this.radius * 0.4, 0, Math.PI * 2);
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

window.addEventListener('keydown', (e) => { if (e.key in keys) keys[e.key] = true; });
window.addEventListener('keyup', (e) => { if (e.key in keys) keys[e.key] = false; });

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
    joystickVector = { x: deltaX / maxRadius, y: deltaY / maxRadius };
}

if(joystickBase) {
    joystickBase.addEventListener('touchstart', (e) => { isTouchingJoystick = true; handleJoystick(e); }, { passive: true });
    window.addEventListener('touchmove', (e) => { handleJoystick(e); }, { passive: true });
    window.addEventListener('touchend', () => {
        isTouchingJoystick = false;
        joystickStick.style.transform = 'translate(0px, 0px)';
        joystickVector = { x: 0, y: 0 };
    });
}

function autoFire() {
    if (gameOver || hasWon || !player) return;
    const fireAngle = player.angle;
    const isMoving = keys.w || keys.s || keys.a || keys.d || 
                     keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight || 
                     isTouchingJoystick;

    if (!isMoving && currentTier !== 6) return; 

    if (currentTier === 1) {
        bullets.push(new Bullet(player.x, player.y, fireAngle));
    } else if (currentTier === 2) {
        const offset = 6;
        const bx1 = player.x - Math.sin(fireAngle) * offset;
        const by1 = player.y + Math.cos(fireAngle) * offset;
        const bx2 = player.x + Math.sin(fireAngle) * offset;
        const by2 = player.y - Math.cos(fireAngle) * offset;
        bullets.push(new Bullet(bx1, by1, fireAngle));
        bullets.push(new Bullet(bx2, by2, fireAngle));
    } else if (currentTier === 3) {
        bullets.push(new Bullet(player.x, player.y, fireAngle));
        bullets.push(new Bullet(player.x, player.y, fireAngle + 0.18));
        bullets.push(new Bullet(player.x, player.y, fireAngle - 0.18));
    } else if (currentTier === 4) {
        bullets.push(new Bullet(player.x, player.y, fireAngle));
        bullets.push(new Bullet(player.x, player.y, fireAngle + 0.15));
        bullets.push(new Bullet(player.x, player.y, fireAngle - 0.15));
        bullets.push(new Bullet(player.x, player.y, fireAngle + Math.PI)); 
    } else if (currentTier === 5) {
        for(let i = -2; i <= 2; i++) bullets.push(new Bullet(player.x, player.y, fireAngle + (i * 0.15)));
    } else if (currentTier === 6) {
        for(let i = 0; i < 8; i++) bullets.push(new Bullet(player.x, player.y, (Math.PI * 2 / 8) * i));
    }
}

function init() {
    score = 0; 
    hp = 100; 
    currentTier = 1; 
    gameOver = false; 
    hasWon = false;
    spawnTimer = 0; 
    fireTimer = 0;
    bullets = []; 
    enemies = []; 
    gems = []; 
    particles = [];
    
    for (let key in keys) keys[key] = false;
    
    if(document.getElementById('sign-status')) document.getElementById('sign-status').innerText = "";
    
    const btnReboot = document.getElementById('restart-btn');
    if(btnReboot) {
        btnReboot.disabled = false;
        btnReboot.innerText = "REBOOT ENGINE";
    }

    player = new Player(); 
    updateUI();
    document.getElementById('game-over-screen').classList.add('hidden');
}

function updateUI() {
    const nextThreshold = TIER_THRESHOLDS[currentTier - 1] || TIER_THRESHOLDS[TIER_THRESHOLDS.length - 1];
    const prevThreshold = currentTier === 1 ? 0 : TIER_THRESHOLDS[currentTier - 2];
    
    if(document.getElementById('score-val')) {
        document.getElementById('score-val').innerText = `${String(score).padStart(4, '0')} / ${String(nextThreshold).padStart(4, '0')}`;
    }
    if(document.getElementById('hp-bar-fill')) {
        document.getElementById('hp-bar-fill').style.width = Math.max(0, hp) + '%';
    }
    let progressPercent = ((score - prevThreshold) / (nextThreshold - prevThreshold)) * 100;
    if (currentTier === 6) progressPercent = 100;
    if(document.getElementById('progress-bar-fill')) {
        document.getElementById('progress-bar-fill').style.width = Math.min(100, Math.max(0, progressPercent)) + '%';
    }
    const status = document.getElementById('weapon-status');
    if(status) {
        status.className = `tier-${currentTier}`;
        status.innerText = currentTier === 6 ? 'TIER 6 (MAX)' : `TIER ${currentTier}`;
    }
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
        if (player) createExplosion(player.x, player.y, '#00ffff', 35);
        updateUI();
    }
}

function triggerEndGame(isVictory) {
    gameOver = true;
    const title = document.getElementById('game-title-end');
    const sub = document.getElementById('game-sub-end');
    if(document.getElementById('final-tier')) document.getElementById('final-tier').innerText = `TIER ${currentTier}`;
    if(document.getElementById('final-score')) document.getElementById('final-score').innerText = score;
    if(document.getElementById('user-live-score')) document.getElementById('user-live-score').innerText = score;

    if (isVictory) {
        if(title) title.innerText = "MISSION ACCOMPLISHED"; 
        if(title) title.style.color = "#a855f7";
        if(sub) sub.innerText = "Hệ thống không gian Base hoàn toàn được giải phóng!";
    } else {
        if(title) title.innerText = "SHIP DESTROYED"; 
        if(title) title.style.color = "#ff2a5f";
        if(sub) sub.innerText = "Hệ thống động cơ bị nổ tung";
    }
    if(document.getElementById('game-over-screen')) {
        document.getElementById('game-over-screen').classList.remove('hidden');
    }
}

function drawSpaceGrid() {
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    const gridSize = 100;
    const startX = Math.floor(camera.x / gridSize) * gridSize;
    const startY = Math.floor(camera.y / gridSize) * gridSize;

    for (let x = startX; x < startX + canvas.width + gridSize; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x - camera.x, 0); ctx.lineTo(x - camera.x, canvas.height); ctx.stroke();
    }
    for (let y = startY; y < startY + canvas.height + gridSize; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(0, y - camera.y); ctx.lineTo(canvas.width, y - camera.y); ctx.stroke();
    }
}

function animate() {
    requestAnimationFrame(animate);
    ctx.fillStyle = 'rgba(2, 6, 23, 1)'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameOver || !player) {
        drawSpaceGrid(); 
        return;
    }

    camera.x = player.x - canvas.width / 2;
    camera.y = player.y - canvas.height / 2;

    if (camera.x < 0) camera.x = 0;
    if (camera.x > WORLD_WIDTH - canvas.width) camera.x = WORLD_WIDTH - canvas.width;
    if (camera.y < 0) camera.y = 0;
    if (camera.y > WORLD_HEIGHT - canvas.height) camera.y = WORLD_HEIGHT - canvas.height;

    drawSpaceGrid();
    player.move();
    player.draw();

    fireTimer++;
    let fireRate = currentTier === 6 ? 6 : 11; 
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

player = new Player(); 
init();
animate();

async function initBaseAppFrame() {
    const walletDisplay = document.getElementById('wallet-display');
    if (typeof window !== 'undefined' && window.FrameSDK && window.FrameSDK.context) {
        try {
            if (window.FrameSDK.actions && typeof window.FrameSDK.actions.ready === 'function') {
                window.FrameSDK.actions.ready();
            }
            const contextPromise = window.FrameSDK.context;
            const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 600));
            const context = await Promise.race([contextPromise, timeoutPromise]);
            
            if (context && context.user) {
                userWalletAddress = context.user.custodyAddress || context.user.verifiedAddresses?.[0];
                username = context.user.username || "Pilot";
                if (walletDisplay) {
                    walletDisplay.innerText = username ? `@${username}` : userWalletAddress.substring(0, 6) + "..." + userWalletAddress.substring(userWalletAddress.length - 4);
                }
                return;
            }
        } catch (sdkError) {
            console.error("Lỗi đồng bộ ngầm SDK:", sdkError);
        }
    }
    if (walletDisplay) {
        walletDisplay.innerText = (typeof window !== 'undefined' && window.FrameSDK) ? "Base Pilot" : "Browser Mode";
    }
}

// ==================== CALL LỆNH TRANSACTION MÔ PHỎNG THEO GAME RẮN MẪU ====================
if(document.getElementById('restart-btn')) {
    document.getElementById('restart-btn').addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const statusText = document.getElementById('sign-status');
        const btnReboot = document.getElementById('restart-btn');

        // Nếu chạy ở trình duyệt thường -> Bypass vào thẳng game ngay để test
        if (!window.FrameSDK || !window.FrameSDK.actions || !window.FrameSDK.actions.sendTransaction) {
            init();
            return;
        }

        // Thực hiện giao dịch thanh toán on-chain qua Base Frame SDK v2 khi bấm Reboot Engine
        btnReboot.disabled = true;
        if(statusText) {
            statusText.innerText = "🚀 Đang gọi ví Base App xử lý giao dịch...";
            statusText.style.color = "#00ffff";
        }

        try {
            // Hàm payGameEnd() tương tự mã hóa calldata hex chuẩn là 0xef087a36
            const functionSelector = "0xef087a36"; 
            
            // Gọi cổng thanh toán on-chain đẩy thẳng transaction lên mạng lưới Base Mainnet
            const txHash = await window.FrameSDK.actions.sendTransaction({
                chainId: 8453, // ID mạng của Base Mainnet
                to: "0x33b8a1c97a760b1e293b1e293b1e293b1e293b1e", // Thay bằng địa chỉ ví/contract thu phí mẫu bạn đang dùng
                value: "300000000000", // Giá trị 0.0000003 ETH dạng wei giống hệt game rắn mẫu
                data: functionSelector,
                dataSuffix: `0x${BASE_PROJECT_ID}` // Nhúng mã Project ID làm dataSuffix
            });

            if (txHash && statusText) {
                statusText.innerText = "✅ Giao dịch thành công! Đang nạp lại buồng lái...";
                statusText.style.color = "#00ff66";
            }
        } catch (err) {
            console.error("Người dùng hủy giao dịch hoặc ví lỗi:", err);
            if(statusText) {
                statusText.innerText = "❌ Giao dịch thất bại hoặc bị từ chối.";
                statusText.style.color = "#ff2a5f";
            }
            btnReboot.disabled = false;
            return; // Khóa màn hình lại, bắt buộc giao dịch thành công mới cho chơi lượt mới
        }

        btnReboot.disabled = false;
        init();
    });
}

window.addEventListener('DOMContentLoaded', () => {
    initBaseAppFrame();
});