// ========== 游戏配置 ==========
const CONFIG = {
    gameDuration: 60,
    monsterSpawnInterval: 2000,
    monsterSpeed: 1.0,
    webRadius: 50,
    maxMonsters: 15,
    maxWebEffects: 5,        // 蛛蛛网击中范围
    baseScore: 100,
    comboMultiplier: 1.5,
    comboTimeout: 2000
};

// ========== 游戏状态 ==========
const gameState = {
    isPlaying: false,
    score: 0,
    highScore: parseInt(localStorage.getItem('spiderHighScore')) || 0,
    timeLeft: CONFIG.gameDuration,
    combo: 0,
    lastHitTime: 0,
    monsters: [],
    webEffects: [],
    // 双手状态
    hands: [
        { landmarks: null, isShootGesture: false, palmCenter: null },
        { landmarks: null, isShootGesture: false, palmCenter: null }
    ]
};

// ========== DOM 元素 ==========
const elements = {
    startScreen: document.getElementById('start-screen'),
    gameScreen: document.getElementById('game-screen'),
    endScreen: document.getElementById('end-screen'),
    startBtn: document.getElementById('start-btn'),
    restartBtn: document.getElementById('restart-btn'),
    video: document.getElementById('video'),
    gameCanvas: document.getElementById('game-canvas'),
    handCanvas: document.getElementById('hand-canvas'),
    scoreDisplay: document.getElementById('score'),
    timeDisplay: document.getElementById('time'),
    finalScore: document.getElementById('final-score'),
    highScoreDisplay: document.getElementById('high-score'),
    gestureStatus: document.getElementById('gesture-status'),
    gestureIcon: document.getElementById('gesture-icon'),
    gestureText: document.getElementById('gesture-text'),
    comboDisplay: document.getElementById('combo-display'),
    combo: document.getElementById('combo')
};

// ========== Canvas 上下文 ==========
let gameCtx, handCtx;
let canvasWidth, canvasHeight;

// ========== MediaPipe Hands ==========
let hands, camera;

// ========== 定时器引用（用于清理） ==========
let gameLoopId = null;
let timerInterval = null;
let spawnerInterval = null;
let lastFrameTime = 0;
let lastHandUpdateTime = 0;
let handWatchdogInterval = null;
const SHOOT_COOLDOWN = 250; // 全局射击冷却时间(ms)，双手共享
let lastGlobalShootTime = 0;
let lastProcessTime = 0;
const PROCESS_INTERVAL = 50; // 处理间隔(ms)，限制处理频率为20fps

// ========== 怪物类型 ==========
const MONSTER_TYPES = [
    { emoji: '👾', points: 100, size: 60 },
    { emoji: '👻', points: 150, size: 55 },
    { emoji: '🤖', points: 120, size: 65 },
    { emoji: '👹', points: 200, size: 70 },
    { emoji: '💀', points: 180, size: 50 },
    { emoji: '🦇', points: 130, size: 45 },
    { emoji: '🐙', points: 160, size: 60 },
    { emoji: '👽', points: 140, size: 55 }
];

// ========== 初始化 ==========
function init() {
    setupCanvas();
    setupEventListeners();
    elements.highScoreDisplay.textContent = gameState.highScore;
}

function setupCanvas() {
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;
    
    elements.gameCanvas.width = canvasWidth;
    elements.gameCanvas.height = canvasHeight;
    elements.handCanvas.width = canvasWidth;
    elements.handCanvas.height = canvasHeight;
    
    gameCtx = elements.gameCanvas.getContext('2d');
    handCtx = elements.handCanvas.getContext('2d');
}

function setupEventListeners() {
    elements.startBtn.addEventListener('click', startGame);
    elements.restartBtn.addEventListener('click', startGame);
    window.addEventListener('resize', setupCanvas);
}

// ========== MediaPipe 手势识别 ==========
async function setupMediaPipe() {
    try {
        console.log('正在初始化 MediaPipe...');
        
        hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });
        
        hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 0,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.4
        });
        
        hands.onResults(onHandResults);
        
        camera = new Camera(elements.video, {
            onFrame: async () => {
                await hands.send({ image: elements.video });
            },
            width: 640,
            height: 480
        });
        
        await camera.start();
        console.log('摄像头启动成功！');
        elements.gestureText.textContent = '摄像头已启动';
    } catch (error) {
        console.error('MediaPipe 初始化失败:', error);
        elements.gestureText.textContent = '摄像头启动失败，请刷新重试';
    }
}

function onHandResults(results) {
    lastHandUpdateTime = Date.now();
    
    // 节流处理，限制处理频率
    const now = Date.now();
    if (now - lastProcessTime < PROCESS_INTERVAL) {
        return;
    }
    lastProcessTime = now;
    
    try {
        handCtx.clearRect(0, 0, canvasWidth, canvasHeight);
        
        // 重置未检测到的手
        const detectedCount = results.multiHandLandmarks ? results.multiHandLandmarks.length : 0;
        for (let i = detectedCount; i < 2; i++) {
            gameState.hands[i].landmarks = null;
            gameState.hands[i].palmCenter = null;
            gameState.hands[i].isShootGesture = false;
        }
    
    let anyGesture = false;
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        // 处理每只检测到的手
        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const landmarks = results.multiHandLandmarks[i];
            const handState = gameState.hands[i];
            
            drawHandLandmarks(landmarks);
            
            // 获取手腕位置
            const wristPos = getWristPosition(landmarks);
            
            // 检测发射手势
            const isShootGesture = detectShootGesture(landmarks);
            
            handState.landmarks = landmarks;
            
            // 单次触发：只在手势从无到有时发射，全局冷却（谁先触发谁发射）
            const now = Date.now();
            if (isShootGesture && !handState.isShootGesture && gameState.isPlaying && now - lastGlobalShootTime > SHOOT_COOLDOWN) {
                shootWebAtPosition(wristPos.x, wristPos.y);
                lastGlobalShootTime = now;
            }
            
            handState.palmCenter = wristPos;
            handState.isShootGesture = isShootGesture;
            
            if (isShootGesture) anyGesture = true;
        }
    }
    
    updateGestureStatus(anyGesture);
    } catch (err) {
        console.error('手势处理错误:', err);
    }
}

// 获取手腕位置（返回屏幕坐标）
function getWristPosition(landmarks) {
    const wrist = landmarks[0];
    
    // 转换为屏幕坐标（镜像翻转）
    return {
        x: (1 - wrist.x) * canvasWidth,
        y: wrist.y * canvasHeight
    };
}


function drawHandLandmarks(landmarks) {
    handCtx.fillStyle = '#e63946';
    handCtx.strokeStyle = '#ffffff';
    handCtx.lineWidth = 2;
    
    // 绘制21个关键点
    for (let i = 0; i < landmarks.length; i++) {
        const x = (1 - landmarks[i].x) * canvasWidth;
        const y = landmarks[i].y * canvasHeight;
        
        handCtx.beginPath();
        handCtx.arc(x, y, 5, 0, 2 * Math.PI);
        handCtx.fill();
    }
    
    // 绘制23条连接线
    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],
        [0, 5], [5, 6], [6, 7], [7, 8],
        [0, 9], [9, 10], [10, 11], [11, 12],
        [0, 13], [13, 14], [14, 15], [15, 16],
        [0, 17], [17, 18], [18, 19], [19, 20],
        [5, 9], [9, 13], [13, 17]
    ];
    
    handCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    connections.forEach(([start, end]) => {
        const startX = (1 - landmarks[start].x) * canvasWidth;
        const startY = landmarks[start].y * canvasHeight;
        const endX = (1 - landmarks[end].x) * canvasWidth;
        const endY = landmarks[end].y * canvasHeight;
        
        handCtx.beginPath();
        handCtx.moveTo(startX, startY);
        handCtx.lineTo(endX, endY);
        handCtx.stroke();
    });
}

// 检测蛛蛛侠经典手势（任意角度）
function detectShootGesture(landmarks) {
    const wrist = landmarks[0];
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    
    const indexPip = landmarks[6];
    const middlePip = landmarks[10];
    const ringPip = landmarks[14];
    const pinkyPip = landmarks[18];
    
    const indexMcp = landmarks[5];
    const middleMcp = landmarks[9];
    const ringMcp = landmarks[13];
    const pinkyMcp = landmarks[17];
    
    // 计算手掌中心
    const palmCenterX = (wrist.x + middleMcp.x) / 2;
    const palmCenterY = (wrist.y + middleMcp.y) / 2;
    
    // 计算手指到掌心的距离（使用相对距离，不受角度影响）
    const dist = (p1, p2) => Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
    
    // 食指伸展：指尖到掌心距离 > 指节到掌心距离
    const indexExtended = dist(indexTip, wrist) > dist(indexPip, wrist) * 1.1;
    
    // 小指伸展
    const pinkyExtended = dist(pinkyTip, wrist) > dist(pinkyPip, wrist) * 1.1;
    
    // 中指弯曲：指尖到掌心距离 < 指节到掌心距离
    const middleBent = dist(middleTip, wrist) < dist(middleMcp, wrist) * 1.3;
    
    // 无名指弯曲
    const ringBent = dist(ringTip, wrist) < dist(ringMcp, wrist) * 1.3;
    
    // 拇指张开：拇指尖离食指根部有一定距离
    const thumbOut = dist(thumbTip, indexMcp) > 0.08;
    
    return indexExtended && pinkyExtended && middleBent && ringBent && thumbOut;
}

function updateGestureStatus(isActive) {
    if (isActive) {
        elements.gestureStatus.classList.add('active');
        elements.gestureStatus.classList.remove('targeting');
        elements.gestureIcon.textContent = '🕸️';
        elements.gestureText.textContent = '发射蛛蛛网！';
    } else {
        elements.gestureStatus.classList.remove('active');
        elements.gestureStatus.classList.remove('targeting');
        elements.gestureIcon.textContent = '🤟';
        elements.gestureText.textContent = '做出蛛蛛侠手势';
    }
}

// ========== 2.5D蜘蛛网系统 ==========
function shootWebAtPosition(x, y) {
    if (x === undefined || y === undefined) return;
    
    const radius = CONFIG.webRadius;
    
    // 创建蜘蛛网动效
    createWebEffect(x, y, radius);
    
    // 找到范围内最近的一个怪物
    let closestMonster = null;
    let closestIndex = -1;
    let closestDistance = Infinity;
    
    for (let i = 0; i < gameState.monsters.length; i++) {
        const monster = gameState.monsters[i];
        if (monster.hit) continue; // 跳过已被击中的怪物
        
        const dx = monster.x - x;
        const dy = monster.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // 检查怪物是否在蜘蛛网范围内，并且是最近的
        if (distance < radius + monster.size / 2 && distance < closestDistance) {
            closestDistance = distance;
            closestMonster = monster;
            closestIndex = i;
        }
    }
    
    // 只击中最近的一个怪物
    if (closestMonster && !closestMonster.hit) {
        closestMonster.hit = true; // 立即标记为已击中，防止另一只手重复击中
        hitMonster(closestMonster, closestIndex);
    } else {
        showMissEffect(x, y);
    }
}

// 创建蜘蛛网动效
function createWebEffect(x, y, radius) {
    // 限制动效数量
    if (gameState.webEffects.length >= CONFIG.maxWebEffects) {
        gameState.webEffects.shift();
    }
    
    const webEffect = {
        x: x,
        y: y,
        radius: radius,
        startTime: Date.now(),
        duration: 400
    };
    gameState.webEffects.push(webEffect);
    
    // 创建DOM蜘蛛网动画
    const webDiv = document.createElement('div');
    webDiv.className = 'web-catch-effect';
    webDiv.style.left = `${x}px`;
    webDiv.style.top = `${y}px`;
    webDiv.innerHTML = `
        <svg width="${radius * 2}" height="${radius * 2}" viewBox="-${radius} -${radius} ${radius * 2} ${radius * 2}">
            <circle cx="0" cy="0" r="${radius * 0.9}" fill="none" stroke="white" stroke-width="3" opacity="0.9"/>
            <circle cx="0" cy="0" r="${radius * 0.6}" fill="none" stroke="white" stroke-width="2" opacity="0.7"/>
            <circle cx="0" cy="0" r="${radius * 0.3}" fill="none" stroke="white" stroke-width="1.5" opacity="0.5"/>
            <line x1="0" y1="-${radius * 0.9}" x2="0" y2="${radius * 0.9}" stroke="white" stroke-width="2" opacity="0.8"/>
            <line x1="-${radius * 0.9}" y1="0" x2="${radius * 0.9}" y2="0" stroke="white" stroke-width="2" opacity="0.8"/>
            <line x1="-${radius * 0.64}" y1="-${radius * 0.64}" x2="${radius * 0.64}" y2="${radius * 0.64}" stroke="white" stroke-width="2" opacity="0.8"/>
            <line x1="${radius * 0.64}" y1="-${radius * 0.64}" x2="-${radius * 0.64}" y2="${radius * 0.64}" stroke="white" stroke-width="2" opacity="0.8"/>
            <line x1="-${radius * 0.45}" y1="-${radius * 0.8}" x2="${radius * 0.45}" y2="${radius * 0.8}" stroke="white" stroke-width="1.5" opacity="0.6"/>
            <line x1="${radius * 0.45}" y1="-${radius * 0.8}" x2="-${radius * 0.45}" y2="${radius * 0.8}" stroke="white" stroke-width="1.5" opacity="0.6"/>
        </svg>
    `;
    document.body.appendChild(webDiv);
    setTimeout(() => webDiv.remove(), 500);
}

// 更新蜘蛛网动效
function updateWebEffects() {
    const now = Date.now();
    for (let i = gameState.webEffects.length - 1; i >= 0; i--) {
        const effect = gameState.webEffects[i];
        if (now - effect.startTime > effect.duration) {
            gameState.webEffects.splice(i, 1);
        }
    }
}

// 绘制蜘蛛网动效（Canvas层）
function drawWebEffects() {
    const now = Date.now();
    gameState.webEffects.forEach(effect => {
        const elapsed = now - effect.startTime;
        const progress = elapsed / effect.duration;
        const alpha = 1 - progress;
        const scale = 0.5 + progress * 0.5;
        
        gameCtx.save();
        gameCtx.translate(effect.x, effect.y);
        gameCtx.scale(scale, scale);
        gameCtx.globalAlpha = alpha;
        
        // 绘制蜘蛛网同心圆
        gameCtx.strokeStyle = '#ffffff';
        gameCtx.lineWidth = 3;
        gameCtx.beginPath();
        gameCtx.arc(0, 0, effect.radius * 0.9, 0, 2 * Math.PI);
        gameCtx.stroke();
        
        gameCtx.lineWidth = 2;
        gameCtx.beginPath();
        gameCtx.arc(0, 0, effect.radius * 0.6, 0, 2 * Math.PI);
        gameCtx.stroke();
        
        gameCtx.lineWidth = 1.5;
        gameCtx.beginPath();
        gameCtx.arc(0, 0, effect.radius * 0.3, 0, 2 * Math.PI);
        gameCtx.stroke();
        
        // 绘制放射线
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            gameCtx.beginPath();
            gameCtx.moveTo(0, 0);
            gameCtx.lineTo(Math.cos(angle) * effect.radius * 0.9, Math.sin(angle) * effect.radius * 0.9);
            gameCtx.stroke();
        }
        
        gameCtx.restore();
    });
}

// 空发效果
function showMissEffect(x, y) {
    const popup = document.createElement('div');
    popup.className = 'score-popup';
    popup.textContent = '💨';
    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;
    popup.style.fontSize = '30px';
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 600);
}

// ========== 怪物系统 ==========
function spawnMonster() {
    if (!gameState.isPlaying) return;
    if (gameState.monsters.length >= CONFIG.maxMonsters) return;
    
    const type = MONSTER_TYPES[Math.floor(Math.random() * MONSTER_TYPES.length)];
    
    // 捕鱼达人风格：从屏幕边缘进入，穿过屏幕到对面
    let x, y, targetX, targetY;
    const speed = CONFIG.monsterSpeed + Math.random() * 0.5;
    
    // 随机选择从哪边进入（0=左, 1=右）
    const fromLeft = Math.random() > 0.5;
    
    if (fromLeft) {
        // 从左边进入
        x = -type.size;
        y = 100 + Math.random() * (canvasHeight - 200);
        // 目标点在右边
        targetX = canvasWidth + type.size + 200;
        targetY = 100 + Math.random() * (canvasHeight - 200);
    } else {
        // 从右边进入
        x = canvasWidth + type.size;
        y = 100 + Math.random() * (canvasHeight - 200);
        // 目标点在左边
        targetX = -type.size - 200;
        targetY = 100 + Math.random() * (canvasHeight - 200);
    }
    
    // 计算方向向量
    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const vx = (dx / dist) * speed;
    const vy = (dy / dist) * speed;
    
    const monster = {
        ...type,
        id: Date.now() + Math.random(),
        x, y, vx, vy,
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 0.05,
        hit: false
    };
    
    gameState.monsters.push(monster);
}

function updateMonsters(deltaTime) {
    // 基准速度因子（60fps时的速度）
    const speedFactor = deltaTime * 60;
    
    for (let i = gameState.monsters.length - 1; i >= 0; i--) {
        const monster = gameState.monsters[i];
        
        // 怪物沿轨迹移动（使用deltaTime确保速度一致）
        monster.x += monster.vx * speedFactor;
        monster.y += monster.vy * speedFactor;
        monster.rotation += monster.rotationSpeed * speedFactor;
        
        // 只在走出屏幕外时消失（像捕鱼达人的鱼）
        const outOfBounds = 
            monster.x < -150 || monster.x > canvasWidth + 150 ||
            monster.y < -150 || monster.y > canvasHeight + 150;
        
        if (outOfBounds) {
            gameState.monsters.splice(i, 1);
        }
    }
}

function drawMonsters() {
    gameState.monsters.forEach(monster => {
        gameCtx.save();
        gameCtx.translate(monster.x, monster.y);
        gameCtx.rotate(monster.rotation);
        
        gameCtx.font = `${monster.size}px Arial`;
        gameCtx.textAlign = 'center';
        gameCtx.textBaseline = 'middle';
        gameCtx.fillText(monster.emoji, 0, 0);
        gameCtx.restore();
    });
}

// 瞄准线已移除，不再显示

function hitMonster(monster, index) {
    const now = Date.now();
    
    if (now - gameState.lastHitTime < CONFIG.comboTimeout) {
        gameState.combo++;
    } else {
        gameState.combo = 1;
    }
    gameState.lastHitTime = now;
    
    const multiplier = Math.pow(CONFIG.comboMultiplier, gameState.combo - 1);
    const points = Math.floor(monster.points * multiplier);
    gameState.score += points;
    
    showScorePopup(monster.x, monster.y, points);
    
    if (gameState.combo > 1) {
        showCombo(gameState.combo);
    }
    
    createHitEffect(monster.x, monster.y);
    
    gameState.monsters.splice(index, 1);
    
    updateScoreDisplay();
}

function showScorePopup(x, y, points) {
    const popup = document.createElement('div');
    popup.className = 'score-popup';
    popup.textContent = `+${points}`;
    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;
    document.body.appendChild(popup);
    
    setTimeout(() => popup.remove(), 1000);
}

function showCombo(combo) {
    elements.combo.textContent = `x${combo}`;
    elements.comboDisplay.classList.remove('hidden');
    
    setTimeout(() => {
        elements.comboDisplay.classList.add('hidden');
    }, 500);
}

function createHitEffect(x, y) {
    // 创建蛛蛛网罩住动画
    const webEffect = document.createElement('div');
    webEffect.className = 'web-catch-effect';
    webEffect.style.left = `${x}px`;
    webEffect.style.top = `${y}px`;
    webEffect.innerHTML = `
        <svg width="100" height="100" viewBox="-50 -50 100 100">
            <circle cx="0" cy="0" r="45" fill="none" stroke="white" stroke-width="2" opacity="0.8"/>
            <circle cx="0" cy="0" r="30" fill="none" stroke="white" stroke-width="1.5" opacity="0.6"/>
            <circle cx="0" cy="0" r="15" fill="none" stroke="white" stroke-width="1" opacity="0.4"/>
            <line x1="0" y1="-45" x2="0" y2="45" stroke="white" stroke-width="1.5" opacity="0.7"/>
            <line x1="-45" y1="0" x2="45" y2="0" stroke="white" stroke-width="1.5" opacity="0.7"/>
            <line x1="-32" y1="-32" x2="32" y2="32" stroke="white" stroke-width="1.5" opacity="0.7"/>
            <line x1="32" y1="-32" x2="-32" y2="32" stroke="white" stroke-width="1.5" opacity="0.7"/>
            <line x1="-22" y1="-40" x2="22" y2="40" stroke="white" stroke-width="1" opacity="0.5"/>
            <line x1="22" y1="-40" x2="-22" y2="40" stroke="white" stroke-width="1" opacity="0.5"/>
            <line x1="-40" y1="-22" x2="40" y2="22" stroke="white" stroke-width="1" opacity="0.5"/>
            <line x1="-40" y1="22" x2="40" y2="-22" stroke="white" stroke-width="1" opacity="0.5"/>
        </svg>
    `;
    document.body.appendChild(webEffect);
    
    setTimeout(() => webEffect.remove(), 600);
}

// ========== 游戏控制 ==========
async function startGame() {
    // 清理旧的定时器和动画帧
    if (gameLoopId) cancelAnimationFrame(gameLoopId);
    if (timerInterval) clearInterval(timerInterval);
    if (spawnerInterval) clearInterval(spawnerInterval);
    
    elements.startScreen.classList.add('hidden');
    elements.endScreen.classList.add('hidden');
    elements.gameScreen.classList.remove('hidden');
    
    gameState.isPlaying = true;
    gameState.score = 0;
    gameState.timeLeft = CONFIG.gameDuration;
    gameState.combo = 0;
    gameState.monsters = [];
    gameState.webEffects = [];
    
    updateScoreDisplay();
    updateTimeDisplay();
    
    // 立即开始游戏循环和怪物生成
    startGameLoop();
    startTimer();
    startMonsterSpawner();
    
    // 立即生成几个怪物
    for (let i = 0; i < 3; i++) {
        setTimeout(() => spawnMonster(), i * 300);
    }
    
    // 异步初始化摄像头
    if (!camera) {
        setupMediaPipe();
    }
    
    // 启动MediaPipe看门狗
    startHandWatchdog();
}

function startGameLoop() {
    lastFrameTime = performance.now();
    
    function gameLoop(currentTime) {
        if (!gameState.isPlaying) {
            gameLoopId = null;
            return;
        }
        
        // 计算deltaTime（毫秒转秒，限制最大值防止卡顿后跳帧）
        const deltaTime = Math.min((currentTime - lastFrameTime) / 1000, 0.1);
        lastFrameTime = currentTime;
        
        gameCtx.clearRect(0, 0, canvasWidth, canvasHeight);
        
        updateMonsters(deltaTime);
        updateWebEffects();
        
        drawMonsters();
        drawWebEffects();
        
        gameLoopId = requestAnimationFrame(gameLoop);
    }
    
    gameLoopId = requestAnimationFrame(gameLoop);
}

function startTimer() {
    timerInterval = setInterval(() => {
        if (!gameState.isPlaying) {
            clearInterval(timerInterval);
            timerInterval = null;
            return;
        }
        
        gameState.timeLeft--;
        updateTimeDisplay();
        
        if (gameState.timeLeft <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            endGame();
        }
    }, 1000);
}

function startMonsterSpawner() {
    spawnerInterval = setInterval(() => {
        if (!gameState.isPlaying) {
            clearInterval(spawnerInterval);
            spawnerInterval = null;
            return;
        }
        
        spawnMonster();
        
        if (gameState.timeLeft < 30) {
            spawnMonster();
        }
    }, CONFIG.monsterSpawnInterval);
}

function endGame() {
    gameState.isPlaying = false;
    
    // 停止看门狗
    if (handWatchdogInterval) {
        clearInterval(handWatchdogInterval);
        handWatchdogInterval = null;
    }
    
    if (gameState.score > gameState.highScore) {
        gameState.highScore = gameState.score;
        localStorage.setItem('spiderHighScore', gameState.highScore);
    }
    
    elements.finalScore.textContent = gameState.score;
    elements.highScoreDisplay.textContent = gameState.highScore;
    
    elements.gameScreen.classList.add('hidden');
    elements.endScreen.classList.remove('hidden');
}

function updateScoreDisplay() {
    elements.scoreDisplay.textContent = gameState.score;
}

function updateTimeDisplay() {
    elements.timeDisplay.textContent = gameState.timeLeft;
}

// ========== MediaPipe看门狗 ==========
let watchdogRetryCount = 0;

function startHandWatchdog() {
    if (handWatchdogInterval) {
        clearInterval(handWatchdogInterval);
    }
    
    lastHandUpdateTime = Date.now();
    watchdogRetryCount = 0;
    
    handWatchdogInterval = setInterval(async () => {
        if (!gameState.isPlaying) return;
        
        const timeSinceLastUpdate = Date.now() - lastHandUpdateTime;
        
        // 如果超过2秒没有收到手势更新，尝试重启
        if (timeSinceLastUpdate > 2000 && camera) {
            watchdogRetryCount++;
            console.warn(`MediaPipe无响应，尝试重启 (${watchdogRetryCount})...`);
            
            if (watchdogRetryCount <= 3) {
                elements.gestureText.textContent = `重新连接中...(${watchdogRetryCount}/3)`;
                
                try {
                    camera.stop();
                    await new Promise(r => setTimeout(r, 300));
                    await camera.start();
                    console.log('MediaPipe重启成功');
                    elements.gestureText.textContent = '已恢复';
                    lastHandUpdateTime = Date.now();
                    watchdogRetryCount = 0;
                } catch (err) {
                    console.error('MediaPipe重启失败:', err);
                }
            } else {
                // 多次重试失败，提示用户刷新页面
                elements.gestureText.textContent = '请刷新页面重试';
                clearInterval(handWatchdogInterval);
                handWatchdogInterval = null;
            }
        } else if (timeSinceLastUpdate < 1000) {
            // 正常工作时重置重试计数
            watchdogRetryCount = 0;
        }
    }, 1500);
}

// ========== 启动游戏 ==========
init();
