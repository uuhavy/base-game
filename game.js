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

// ============================================================================
// CẤU HÌNH KẾT NỐI SMART CONTRACT THEO CHUẨN SOURCE SLITHER GITHUB
// ============================================================================
const SNAKE_FEES_CONTRACT_ADDRESS = "0x9c3d15Ab52f7DcB2ed3fB275568Ba67dd40aB31f"; 

// ABI tối giản chứa chính xác hàm payGameEnd() của contract để Ethers.js gọi ví
const CONTRACT_ABI = [
    "function payGameEnd() external payable"
];

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
        let moveX = 0; moveY = 0;
        if (keys.w || keys.ArrowUp) moveY -= this.speed;
        if (keys.s || keys.ArrowDown) moveY += this.speed;
        if (keys.a || keys.ArrowLeft) moveX -= this.speed;
        if (keys.d || keys.ArrowRight) moveX += this.speed;

        if (isTouchingJoystick) {
            moveX += joystickVector.x * this.speed;
            moveY += joystickVector.y * this.speed;
        }
        this.x += moveX; this.y += moveY;

        if (moveX !== 0 || moveY !== 0) {
            this.angle = Math.atan2(moveY, moveX) + Math.PI; 
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
        ctx.moveTo(22, 0); ctx.lineTo(-12, -11); ctx.lineTo(-4, 0); ctx.lineTo(-12, 11);
        ctx.closePath(); ctx.fillStyle = this.color; ctx.fill();
        ctx.restore();
    }
}

class Bullet {
    constructor(x, y, angle) {
        this.x = x; this.y = y; this.radius = 3.5;
        const colors = ['#818cf8', '#38bdf8', '#34d399', '#fbbf24', '#f43f5e', '#a855f7'];
        this.color = colors[currentTier - 1] || '#a855f7';
        this.speed = 13; 
        this.velocity = { x: Math.cos(angle) * this.speed, y: Math.sin(angle) * this.speed };
    }
    update() { this.x += this.velocity.x; this.y += this.velocity.y; }
    draw() {
        ctx.save(); ctx.beginPath();
        ctx.arc(this.x - camera.x, this.y - camera.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color; ctx.shadowBlur = 10; ctx.shadowColor = this.color;
        ctx.fill(); ctx.restore();
    }
}

class Enemy {
    constructor() {
        this.x = Math.random() * WORLD_WIDTH; this.y = Math.random() * WORLD_HEIGHT;
        let targetX = player ? player.x : WORLD_WIDTH / 2;
        let targetY = player ? player.y : WORLD_HEIGHT / 2;
        while (Math.hypot(targetX - this.x, targetY - this.y) < 400) {
            this.x = Math.random() * WORLD_WIDTH; this.y = Math.random() * WORLD_HEIGHT;
        }
        this.radius = Math.random() * 8 + 10; this.maxHp = 1; this.color = '#ff2a5f'; this.isElite = false; this.flashFrames = 0;
        if (currentTier >= 3 && Math.random() < 0.2 * (currentTier - 2)) {
            this.radius = Math.random() * 8 + 22; this.maxHp = Math.floor(currentTier * 1.5); this.color = '#b91c1c'; this.isElite = true;
        }
        this.hp = this.maxHp; this.speed = (Math.random() * 0.6 + 0.8) + (currentTier * 0.3);
    }
    update() {
        if (!player) return;
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        this.x += Math.cos(angle) * this.speed; this.y += Math.sin(angle) * this.speed;
        if (this.flashFrames > 0) this.flashFrames--;
    }
    draw() {
        ctx.save(); ctx.beginPath();
        ctx.arc(this.x - camera.x, this.y - camera.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.flashFrames > 0 ? '#ffffff' : this.color;
        ctx.shadowBlur = this.isElite ? 15 : 8; ctx.shadowColor = this.color;
        ctx.fill(); ctx.restore();
    }
}

class Gem {
    constructor(x, y) { this.x = x; this.y = y; this.radius = 6; this.color = '#00ff66'; this.pulse = Math.random() * 10; }
    draw() {
        this.pulse += 0.1; let currentRadius = this.radius + Math.sin(this.pulse) * 1.5;
        ctx.save(); ctx.beginPath(); ctx.arc(this.x - camera.x, this.y - camera.y, currentRadius, 0, Math.PI * 2);
        ctx.fillStyle = this.color; ctx.shadowBlur = 12; ctx.shadowColor = this.color;
        ctx.fill(); ctx.restore();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color; this.radius = Math.random() * 2 + 1;
        const angle = Math.random() * Math.PI * 2; const speed = Math.random() * 3 + 1;
        this.velocity = { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
        this.alpha = 1; this.decay = Math.random() * 0.02 + 0.02;
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
    const centerX = rect.left + rect.width / 2; const centerY = rect.top + rect.height / 2;
    const touch = e.touches[0]; let deltaX = touch.clientX - centerX; let deltaY = touch.clientY - centerY;
    const distance = Math.hypot(deltaX, deltaY); const maxRadius = rect.width / 2;
    if (distance > maxRadius) { deltaX = (deltaX / distance) * maxRadius; deltaY = (deltaY / distance) * maxRadius; }
    joystickStick.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    joystickVector = { x: deltaX / maxRadius, y: deltaY / maxRadius };
}

if(joystickBase) {
    joystickBase.addEventListener('touchstart', (e) => { isTouchingJoystick = true; handleJoystick(e); }, { passive: true });
    window.addEventListener('touchmove', (e) => { handleJoystick(e); }, { passive: true });
    window.addEventListener('touchend', () => { isTouchingJoystick = false; joystickStick.style.transform = 'translate(0px, 0px)'; joystickVector = { x: 0, y: 0 }; });
}

function autoFire() {
    if (gameOver || hasWon || !player) return;
    const fireAngle = player.angle;
    const isMoving = keys.w || keys.s || keys.a || keys.d || keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight || isTouchingJoystick;
    if (!isMoving && currentTier !== 6) return; 
    if (currentTier === 1) { bullets.push(new Bullet(player.x, player.y, fireAngle)); }
    else if (currentTier === 2) {
        const offset = 6;
        bullets.push(new Bullet(player.x - Math.sin(fireAngle) * offset, player.y + Math.cos(fireAngle) * offset, fireAngle));
        bullets.push(new Bullet(player.x + Math.sin(fireAngle) * offset, player.y - Math.cos(fireAngle) * offset, fireAngle));
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
    score = 0; hp = 100; currentTier = 1; gameOver = false; hasWon = false; spawnTimer = 0; fireTimer = 0;
    bullets = []; enemies = []; gems = []; particles = [];
    for (let key in keys) keys[key] = false;
    if(document.getElementById('sign-status')) document.getElementById('sign-status').innerText = "";
    const btnReboot = document.getElementById('restart-btn');
    if(btnReboot) { btnReboot.disabled = false; btnReboot.innerText = "REBOOT ENGINE"; }
    player = new Player(); updateUI();
    document.getElementById('game-over-screen').style.display = 'none';
}

function updateUI() {
    const nextThreshold = TIER_THRESHOLDS[currentTier - 1] || TIER_THRESHOLDS[TIER_THRESHOLDS.length - 1];
    const prevThreshold = currentTier === 1 ? 0 : TIER_THRESHOLDS[currentTier - 2];
    if(document.getElementById('score-val')) document.getElementById('score-val').innerText = `${String(score).padStart(4, '0')} / ${String(nextThreshold).padStart(4, '0')}`;
    if(document.getElementById('hp-bar-fill')) document.getElementById('hp-bar-fill').style.width = Math.max(0, hp) + '%';
    let progressPercent = currentTier === 6 ? 100 : ((score - prevThreshold) / (nextThreshold - prevThreshold)) * 100;
    if(document.getElementById('progress-bar-fill')) document.getElementById('progress-bar-fill').style.width = Math.min(100, Math.max(0, progressPercent)) + '%';
    const status = document.getElementById('weapon-status');
    if(status) { status.className = `tier-${currentTier}`; status.innerText = currentTier === 6 ? 'TIER 6 (MAX)' : `TIER ${currentTier}`; }
}

function checkLevelUp() {
    if (currentTier >= 6) {
        if (score >= TIER_THRESHOLDS[TIER_THRESHOLDS.length - 1] && !hasWon) { hasWon = true; triggerEndGame(true); }
        return;
    }
    if (score >= TIER_THRESHOLDS[currentTier - 1]) {
        currentTier++; if (player) createExplosion(player.x, player.y, '#00ffff', 35); updateUI();
    }
}

function triggerEndGame(isVictory) {
    gameOver = true;
    const title = document.getElementById('game-title-end'); const sub = document.getElementById('game-sub-end');
    if(document.getElementById('final-tier')) document.getElementById('final-tier').innerText = `TIER ${currentTier}`;
    if(document.getElementById('final-score')) document.getElementById('final-score').innerText = score;
    if(document.getElementById('user-live-score')) document.getElementById('user-live-score').innerText = score;
    if (isVictory) { title.innerText = "MISSION ACCOMPLISHED"; title.style.color = "#a855f7"; sub.innerText = "Hệ thống không gian Base hoàn toàn giải phóng!"; }
    else { title.innerText = "SHIP DESTROYED"; title.style.color = "#ff2a5f"; sub.innerText = "Hệ thống động cơ bị nổ tung"; }
    if(document.getElementById('game-over-screen')) document.getElementById('game-over-screen').style.display = 'flex';
}

function drawSpaceGrid() {
    ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 1; const gridSize = 100;
    const startX = Math.floor(camera.x / gridSize) * gridSize; const startY = Math.floor(camera.y / gridSize) * gridSize;
    for (let x = startX; x < startX + canvas.width + gridSize; x += gridSize) { ctx.beginPath(); ctx.moveTo(x - camera.x, 0); ctx.lineTo(x - camera.x, canvas.height); ctx.stroke(); }
    for (let y = startY; y < startY + canvas.height + gridSize; y += gridSize) { ctx.beginPath(); ctx.moveTo(0, y - camera.y); ctx.lineTo(canvas.width, y - camera.y); ctx.stroke(); }
}

function animate() {
    requestAnimationFrame(animate); ctx.fillStyle = 'rgba(2, 6, 23, 1)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (gameOver || !player) { drawSpaceGrid(); return; }
    camera.x = player.x - canvas.width / 2; camera.y = player.y - canvas.height / 2;
    if (camera.x < 0) camera.x = 0; if (camera.x > WORLD_WIDTH - canvas.width) camera.x = WORLD_WIDTH - canvas.width;
    if (camera.y < 0) camera.y = 0; if (camera.y > WORLD_HEIGHT - canvas.height) camera.y = WORLD_HEIGHT - canvas.height;
    drawSpaceGrid(); player.move(); player.draw();
    fireTimer++; if (fireTimer >= (currentTier === 6 ? 6 : 11)) { autoFire(); fireTimer = 0; }
    particles.forEach((p, i) => { if (p.alpha <= 0) particles.splice(i, 1); else { p.update(); p.draw(); } });
    spawnTimer++; if (spawnTimer > Math.max(8, 35 - (currentTier * 4)) && enemies.length < 60) { enemies.push(new Enemy()); spawnTimer = 0; }
    gems.forEach((gem, gIndex) => { gem.draw(); if (Math.hypot(player.x - gem.x, player.y - gem.y) - player.radius - gem.radius < 1) { score += 10; createExplosion(gem.x, gem.y, gem.color, 6); gems.splice(gIndex, 1); updateUI(); checkLevelUp(); } });
    bullets.forEach((bullet, bIndex) => { bullet.update(); bullet.draw(); if (bullet.x < 0 || bullet.x > WORLD_WIDTH || bullet.y < 0 || bullet.y > WORLD_HEIGHT) bullets.splice(bIndex, 1); });
    enemies.forEach((enemy, eIndex) => {
        enemy.update(); enemy.draw();
        if (Math.hypot(player.x - enemy.x, player.y - enemy.y) - player.radius - enemy.radius < 1) { hp -= enemy.isElite ? 20 : 8; createExplosion(enemy.x, enemy.y, enemy.color, 12); enemies.splice(eIndex, 1); updateUI(); if (hp <= 0) triggerEndGame(false); }
        bullets.forEach((bullet, bIndex) => { if (Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) - bullet.radius - enemy.radius < 1) { bullets.splice(bIndex, 1); enemy.flashFrames = 3; enemy.hp--; if (enemy.hp <= 0) { createExplosion(enemy.x, enemy.y, enemy.color, enemy.isElite ? 20 : 10); if (enemy.isElite || Math.random() < 0.65) gems.push(new Gem(enemy.x, enemy.y)); enemies.splice(eIndex, 1); } } });
    });
}

// ==================== ĐỒNG BỘ HIỂN THỊ VÍ THEO CHUẨN ĐỊNH DANH ====================
async function checkWallet() {
    const walletDisplay = document.getElementById('wallet-display');
    if (window.ethereum) {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                walletDisplay.innerText = accounts[0].substring(0, 6) + "..." + accounts[0].substring(accounts[0].length - 4);
                return;
            }
        } catch (e) { console.error(e); }
    }
    walletDisplay.innerText = "Base Pilot";
}

// ==================== KHU VỰC KẾT NỐI VÀ GỌI VÍ GIỐNG HỆT SOURCE SLITHER ====================
if(document.getElementById('restart-btn')) {
    document.getElementById('restart-btn').addEventListener('click', async (e) => {
        e.preventDefault();
        
        const statusText = document.getElementById('sign-status');
        const btnReboot = document.getElementById('restart-btn');

        // Nếu chạy ngoài môi trường không có ví dApp cung cấp ngầm -> Cho chơi luôn để test
        if (!window.ethereum) {
            init();
            return;
        }

        btnReboot.disabled = true;
        statusText.innerText = "⏳ Đang kết nối ví Base App...";
        statusText.style.color = "#00ffff";

        try {
            // 1. Khởi tạo Web3Provider từ cửa sổ ethereum có sẵn giống hệt Slither
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            
            // 2. Yêu cầu quyền truy cập tài khoản ví người dùng
            await provider.send("eth_requestAccounts", []);
            
            // 3. Lấy Signer để thực thi ký giao dịch
            const signer = provider.getSigner();
            
            // 4. Khởi tạo đối tượng Contract kết nối thẳng tới Blockchain
            const contract = new ethers.Contract(SNAKE_FEES_CONTRACT_ADDRESS, CONTRACT_ABI, signer);

            statusText.innerText = "🚀 Đang kích hoạt pop-up thanh toán ví Base...";
            
            // 5. Gọi hàm payGameEnd() và truyền đúng 0.0000003 ETH (Dạng Wei) lên chuỗi
            const tx = await contract.payGameEnd({
                value: ethers.utils.parseEther("0.0000003")
            });

            statusText.innerText = "⚡ Đang đợi xác nhận block giao dịch...";
            statusText.style.color = "#ffaa00";
            
            // 6. Chờ đợi giao dịch hoàn tất trên mạng lưới
            await tx.wait();

            statusText.innerText = "✅ Thành công! Hệ thống đã được tái sinh.";
            statusText.style.color = "#00ff66";
            
            btnReboot.disabled = false;
            init(); // Hồi sinh game thành công

        } catch (err) {
            console.error("Lỗi giao dịch blockchain:", err);
            statusText.innerText = "❌ Thất bại: " + (err.message || "Giao dịch bị từ chối.");
            statusText.style.color = "#ff2a5f";
            btnReboot.disabled = false;
        }
    });
}

window.addEventListener('DOMContentLoaded', () => {
    player = new Player();
    init();
    animate();
    checkWallet();
});