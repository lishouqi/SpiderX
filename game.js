// ========== 游戏配置 ==========
const CONFIG = {
    gameDuration: 60,
    monsterSpawnInterval: 1500,
    monsterLifetime: 4000,
    webSpeed: 20,
    baseScore: 100,
    comboMultiplier: 1.5,
    comboTimeout: 2000,
    aimLineLength: 1500,
    aimHitRadius: 60,
    shootCooldown: 300,
    hitProbability: 0.85
};

// ========== 游戏状态 ==========
const gameState = {
    isPlaying: false,
    score: 0,
    highScore: parseInt(localStorage.getItem('spiderHighScore')) || 0,
    timeLeft: CONFIG.gameDuration,
    combo: 0,
    lastHitTime: 0,
    lastShootTime: 0,
    monsters: [],
    webs: [],
    handPosition: null,
    handLandmarks: null,
    isSpiderGesture: false,
    aimDirection: null,
    targetedMonster: null
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
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });
        
        hands.onResults(onHandResults);
        
        camera = new Camera(elements.video, {
            onFrame: async () => {
                await hands.send({ image: elements.video });
            },
            width: 1280,
            height: 720
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
    handCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        
        drawHandLandmarks(landmarks);
        
        // 计算瞄准方向并检测目标
        updateAimDirection(landmarks);
        
        const isSpiderGesture = detectSpiderManGesture(landmarks);
        
        const wrist = landmarks[0];
        gameState.handPosition = {
            x: (1 - wrist.x) * canvasWidth,
            y: wrist.y * canvasHeight
        };
        gameState.handLandmarks = landmarks;
        
        // 捕鱼达人风格：保持手势时连续发射（带冷却）
        const now = Date.now();
        if (isSpiderGesture && gameState.isPlaying && 
            now - gameState.lastShootTime > CONFIG.shootCooldown) {
            shootAtTarget(landmarks);
            gameState.lastShootTime = now;
        }
        
        gameState.isSpiderGesture = isSpiderGesture;
        updateGestureStatus(isSpiderGesture, gameState.targetedMonster);
    } else {
        gameState.handPosition = null;
        gameState.handLandmarks = null;
        gameState.aimDirection = null;
        gameState.targetedMonster = null;
        gameState.isSpiderGesture = false;
        updateGestureStatus(false, null);
    }
}

// 计算瞄准方向并检测目标怪物（从手腕发射，指向食指尖）
function updateAimDirection(landmarks) {
    const wrist = landmarks[0];      // 手腕
    const indexTip = landmarks[8];   // 食指尖
    
    // 转换为屏幕坐标（镜像翻转）
    const wristX = (1 - wrist.x) * canvasWidth;
    const wristY = wrist.y * canvasHeight;
    const tipX = (1 - indexTip.x) * canvasWidth;
    const tipY = indexTip.y * canvasHeight;
    
    // 计算方向向量：从手腕指向食指尖
    const dirX = tipX - wristX;
    const dirY = tipY - wristY;
    const length = Math.sqrt(dirX * dirX + dirY * dirY);
    
    if (length > 0) {
        gameState.aimDirection = {
            startX: wristX,   // 从手腕发射
            startY: wristY,
            dirX: dirX / length,
            dirY: dirY / length
        };
        
        // 检测瞄准线上的怪物
        gameState.targetedMonster = findTargetOnAimLine();
    }
}

// 查找瞄准线上的怪物（返回最近的一个）
function findTargetOnAimLine() {
    if (!gameState.aimDirection) return null;
    
    const aim = gameState.aimDirection;
    let closestMonster = null;
    let closestDistance = Infinity;
    
    for (const monster of gameState.monsters) {
        // 计算怪物到瞄准线的距离（点到直线的距离）
        const dx = monster.x - aim.startX;
        const dy = monster.y - aim.startY;
        
        // 投影到瞄准方向上的距离
        const projectionLength = dx * aim.dirX + dy * aim.dirY;
        
        // 只考虑前方的怪物
        if (projectionLength < 0) continue;
        
        // 计算垂直距离（怪物到瞄准线的最短距离）
        const perpX = dx - projectionLength * aim.dirX;
        const perpY = dy - projectionLength * aim.dirY;
        const perpDistance = Math.sqrt(perpX * perpX + perpY * perpY);
        
        // 检查是否在命中范围内
        const hitRadius = CONFIG.aimHitRadius + monster.size / 2;
        
        if (perpDistance < hitRadius && projectionLength < closestDistance) {
            closestDistance = projectionLength;
            closestMonster = monster;
        }
    }
    
    return closestMonster;
}

function drawHandLandmarks(landmarks) {
    handCtx.fillStyle = '#e63946';
    handCtx.strokeStyle = '#ffffff';
    handCtx.lineWidth = 2;
    
    for (let i = 0; i < landmarks.length; i++) {
        const x = (1 - landmarks[i].x) * canvasWidth;
        const y = landmarks[i].y * canvasHeight;
        
        handCtx.beginPath();
        handCtx.arc(x, y, 5, 0, 2 * Math.PI);
        handCtx.fill();
    }
    
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

function detectSpiderManGesture(landmarks) {
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    
    const indexMcp = landmarks[5];
    const middleMcp = landmarks[9];
    const ringMcp = landmarks[13];
    const pinkyMcp = landmarks[17];
    const wrist = landmarks[0];
    
    const indexExtended = indexTip.y < indexMcp.y - 0.05;
    const pinkyExtended = pinkyTip.y < pinkyMcp.y - 0.05;
    
    const middleBent = middleTip.y > middleMcp.y - 0.03;
    const ringBent = ringTip.y > ringMcp.y - 0.03;
    
    const thumbOut = Math.abs(thumbTip.x - wrist.x) > 0.08;
    
    return indexExtended && pinkyExtended && middleBent && ringBent && thumbOut;
}

function updateGestureStatus(isActive, targetedMonster) {
    if (isActive) {
        elements.gestureStatus.classList.add('active');
        elements.gestureIcon.textContent = '🤟';
        elements.gestureText.textContent = targetedMonster ? '击中！' : '发射！';
    } else if (targetedMonster) {
        elements.gestureStatus.classList.remove('active');
        elements.gestureStatus.classList.add('targeting');
        elements.gestureIcon.textContent = '🎯';
        elements.gestureText.textContent = '已瞄准目标';
    } else {
        elements.gestureStatus.classList.remove('active');
        elements.gestureStatus.classList.remove('targeting');
        elements.gestureIcon.textContent = '✋';
        elements.gestureText.textContent = '移动手指瞄准...';
    }
}

// ========== 蜘蛛丝系统 ==========
function shootAtTarget(landmarks) {
    if (!landmarks || !gameState.aimDirection) return;
    
    const aim = gameState.aimDirection;
    const target = gameState.targetedMonster;
    
    // 创建蜘蛛丝
    const web = {
        startX: aim.startX,
        startY: aim.startY,
        currentX: aim.startX,
        currentY: aim.startY,
        dirX: aim.dirX,
        dirY: aim.dirY,
        speed: CONFIG.webSpeed,
        maxDistance: 800,
        traveledDistance: 0,
        targetMonster: target
    };
    
    gameState.webs.push(web);
}

function updateWebs() {
    for (let i = gameState.webs.length - 1; i >= 0; i--) {
        const web = gameState.webs[i];
        
        // 沿方向移动
        web.currentX += web.dirX * web.speed;
        web.currentY += web.dirY * web.speed;
        web.traveledDistance += web.speed;
        
        // 捕鱼达人风格：检测路径上碰到的任何怪物
        let hitMonsterIndex = -1;
        for (let j = 0; j < gameState.monsters.length; j++) {
            const monster = gameState.monsters[j];
            const dx = web.currentX - monster.x;
            const dy = web.currentY - monster.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // 碰撞半径
            const hitRadius = monster.size / 2 + 12;
            
            if (distance < hitRadius) {
                hitMonsterIndex = j;
                break;
            }
        }
        
        // 碰到怪物时，概率击中
        if (hitMonsterIndex !== -1) {
            const monster = gameState.monsters[hitMonsterIndex];
            // 概率判定是否击中
            if (Math.random() < CONFIG.hitProbability) {
                hitMonster(monster, hitMonsterIndex);
            } else {
                // 未击中，显示Miss效果
                showMissEffect(monster.x, monster.y);
            }
            gameState.webs.splice(i, 1);
            continue;
        }
        
        // 检查是否超出屏幕或达到最大距离
        const outOfBounds = 
            web.currentX < -50 || web.currentX > canvasWidth + 50 ||
            web.currentY < -50 || web.currentY > canvasHeight + 50;
        
        if (outOfBounds || web.traveledDistance > web.maxDistance) {
            gameState.webs.splice(i, 1);
        }
    }
}

// Miss效果
function showMissEffect(x, y) {
    const popup = document.createElement('div');
    popup.className = 'score-popup miss';
    popup.textContent = 'MISS';
    popup.style.left = `${x}px`;
    popup.style.top = `${y}px`;
    popup.style.color = '#ff6666';
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 800);
}

function drawWebs() {
    gameState.webs.forEach(web => {
        gameCtx.strokeStyle = '#ffffff';
        gameCtx.lineWidth = 3;
        gameCtx.setLineDash([5, 5]);
        
        gameCtx.beginPath();
        gameCtx.moveTo(web.startX, web.startY);
        gameCtx.lineTo(web.currentX, web.currentY);
        gameCtx.stroke();
        
        gameCtx.setLineDash([]);
        
        gameCtx.fillStyle = '#ffffff';
        gameCtx.beginPath();
        gameCtx.arc(web.currentX, web.currentY, 8, 0, 2 * Math.PI);
        gameCtx.fill();
        
        drawWebPattern(web.currentX, web.currentY);
    });
}

function drawWebPattern(x, y) {
    gameCtx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    gameCtx.lineWidth = 1;
    
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2;
        const endX = x + Math.cos(angle) * 15;
        const endY = y + Math.sin(angle) * 15;
        
        gameCtx.beginPath();
        gameCtx.moveTo(x, y);
        gameCtx.lineTo(endX, endY);
        gameCtx.stroke();
    }
}

// ========== 怪物系统 ==========
function spawnMonster() {
    if (!gameState.isPlaying) return;
    
    const type = MONSTER_TYPES[Math.floor(Math.random() * MONSTER_TYPES.length)];
    const side = Math.floor(Math.random() * 4);
    
    let x, y, vx, vy;
    const speed = 1 + Math.random() * 2;
    
    switch (side) {
        case 0:
            x = Math.random() * canvasWidth;
            y = -type.size;
            vx = (Math.random() - 0.5) * speed;
            vy = speed;
            break;
        case 1:
            x = canvasWidth + type.size;
            y = Math.random() * canvasHeight;
            vx = -speed;
            vy = (Math.random() - 0.5) * speed;
            break;
        case 2:
            x = Math.random() * canvasWidth;
            y = canvasHeight + type.size;
            vx = (Math.random() - 0.5) * speed;
            vy = -speed;
            break;
        case 3:
            x = -type.size;
            y = Math.random() * canvasHeight;
            vx = speed;
            vy = (Math.random() - 0.5) * speed;
            break;
    }
    
    const monster = {
        ...type,
        x, y, vx, vy,
        spawnTime: Date.now(),
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 0.1
    };
    
    gameState.monsters.push(monster);
}

function updateMonsters() {
    const now = Date.now();
    
    for (let i = gameState.monsters.length - 1; i >= 0; i--) {
        const monster = gameState.monsters[i];
        
        monster.x += monster.vx;
        monster.y += monster.vy;
        monster.rotation += monster.rotationSpeed;
        
        const outOfBounds = 
            monster.x < -100 || monster.x > canvasWidth + 100 ||
            monster.y < -100 || monster.y > canvasHeight + 100;
        
        const expired = now - monster.spawnTime > CONFIG.monsterLifetime;
        
        if (outOfBounds || expired) {
            gameState.monsters.splice(i, 1);
        }
    }
}

function drawMonsters() {
    gameState.monsters.forEach(monster => {
        gameCtx.save();
        gameCtx.translate(monster.x, monster.y);
        gameCtx.rotate(monster.rotation);
        
        // 如果是被瞄准的怪物，添加高亮效果
        const isTargeted = monster === gameState.targetedMonster;
        if (isTargeted) {
            // 绘制发光圈
            const gradient = gameCtx.createRadialGradient(0, 0, monster.size / 2, 0, 0, monster.size);
            gradient.addColorStop(0, 'rgba(255, 0, 0, 0.6)');
            gradient.addColorStop(0.5, 'rgba(255, 100, 0, 0.3)');
            gradient.addColorStop(1, 'rgba(255, 200, 0, 0)');
            gameCtx.fillStyle = gradient;
            gameCtx.beginPath();
            gameCtx.arc(0, 0, monster.size, 0, 2 * Math.PI);
            gameCtx.fill();
            
            // 绘制瞄准框
            gameCtx.strokeStyle = '#ff0000';
            gameCtx.lineWidth = 3;
            gameCtx.setLineDash([5, 3]);
            gameCtx.beginPath();
            gameCtx.arc(0, 0, monster.size / 2 + 10, 0, 2 * Math.PI);
            gameCtx.stroke();
            gameCtx.setLineDash([]);
        }
        
        gameCtx.font = `${monster.size}px Arial`;
        gameCtx.textAlign = 'center';
        gameCtx.textBaseline = 'middle';
        gameCtx.fillText(monster.emoji, 0, 0);
        gameCtx.restore();
    });
}

// 绘制瞄准线
function drawAimLine() {
    if (!gameState.aimDirection || !gameState.isPlaying) return;
    
    const aim = gameState.aimDirection;
    const hasTarget = gameState.targetedMonster !== null;
    
    // 计算瞄准线终点
    const endX = aim.startX + aim.dirX * CONFIG.aimLineLength;
    const endY = aim.startY + aim.dirY * CONFIG.aimLineLength;
    
    // 绘制瞄准线
    gameCtx.save();
    
    if (hasTarget) {
        // 有目标时显示红色
        gameCtx.strokeStyle = 'rgba(255, 50, 50, 0.8)';
        gameCtx.lineWidth = 2;
    } else {
        // 无目标时显示白色虚线
        gameCtx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        gameCtx.lineWidth = 1;
    }
    
    gameCtx.setLineDash([10, 10]);
    gameCtx.beginPath();
    gameCtx.moveTo(aim.startX, aim.startY);
    gameCtx.lineTo(endX, endY);
    gameCtx.stroke();
    gameCtx.setLineDash([]);
    
    // 绘制瞄准点（手指位置）
    gameCtx.fillStyle = hasTarget ? '#ff3333' : '#ffffff';
    gameCtx.beginPath();
    gameCtx.arc(aim.startX, aim.startY, 8, 0, 2 * Math.PI);
    gameCtx.fill();
    
    gameCtx.restore();
}

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
    gameCtx.save();
    
    const gradient = gameCtx.createRadialGradient(x, y, 0, x, y, 50);
    gradient.addColorStop(0, 'rgba(255, 215, 0, 0.8)');
    gradient.addColorStop(0.5, 'rgba(255, 100, 0, 0.5)');
    gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
    
    gameCtx.fillStyle = gradient;
    gameCtx.beginPath();
    gameCtx.arc(x, y, 50, 0, 2 * Math.PI);
    gameCtx.fill();
    
    gameCtx.restore();
}

// ========== 游戏控制 ==========
async function startGame() {
    elements.startScreen.classList.add('hidden');
    elements.endScreen.classList.add('hidden');
    elements.gameScreen.classList.remove('hidden');
    
    gameState.isPlaying = true;
    gameState.score = 0;
    gameState.timeLeft = CONFIG.gameDuration;
    gameState.combo = 0;
    gameState.monsters = [];
    gameState.webs = [];
    
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
}

function startGameLoop() {
    function gameLoop() {
        if (!gameState.isPlaying) return;
        
        gameCtx.clearRect(0, 0, canvasWidth, canvasHeight);
        
        updateMonsters();
        updateWebs();
        
        drawAimLine();
        drawMonsters();
        drawWebs();
        
        requestAnimationFrame(gameLoop);
    }
    
    gameLoop();
}

function startTimer() {
    const timerInterval = setInterval(() => {
        if (!gameState.isPlaying) {
            clearInterval(timerInterval);
            return;
        }
        
        gameState.timeLeft--;
        updateTimeDisplay();
        
        if (gameState.timeLeft <= 0) {
            clearInterval(timerInterval);
            endGame();
        }
    }, 1000);
}

function startMonsterSpawner() {
    const spawnerInterval = setInterval(() => {
        if (!gameState.isPlaying) {
            clearInterval(spawnerInterval);
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

// ========== 启动游戏 ==========
init();
