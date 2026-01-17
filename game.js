// ========== 游戏配置 ==========
const CONFIG = {
    gameDuration: 60,
    monsterSpawnInterval: 2000,
    monsterSpeed: 1.0,
    webRadius: 52,
    maxMonsters: 15,
    maxWebEffects: 5,        // 蛛蛛网击中范围
    baseScore: 100,
    comboMultiplier: 1.5,
    comboTimeout: 2000
};

// ========== 关卡配置 ==========
const LEVELS = [
    { level: 1, star1: 800, star2: 1500, star3: 2500, bombRate: 0.08, speedMultiplier: 1.0 },
    { level: 2, star1: 1200, star2: 2000, star3: 3200, bombRate: 0.12, speedMultiplier: 1.15 },
    { level: 3, star1: 1600, star2: 2800, star3: 4200, bombRate: 0.16, speedMultiplier: 1.3 },
    { level: 4, star1: 2000, star2: 3500, star3: 5000, bombRate: 0.20, speedMultiplier: 1.45 },
    { level: 5, star1: 2500, star2: 4200, star3: 6000, bombRate: 0.25, speedMultiplier: 1.6 }
];

// ========== 模拟排行榜数据 ==========
const FAKE_LEADERBOARD = [
    { name: '蜘蛛侠Peter', score: 0 },
    { name: '闪电小子', score: 0 },
    { name: '暗夜猎手', score: 0 },
    { name: '星际战士', score: 0 },
    { name: '雷霆之怒', score: 0 },
    { name: '疾风剑客', score: 0 },
    { name: '烈焰法师', score: 0 },
    { name: '冰霜女王', score: 0 }
];

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
    ],
    // 关卡系统
    currentLevel: 1,
    bombHits: 0,
    stars: 0,
    gameOverReason: '', // 'time' 或 'bomb'
    // 解锁状态
    isUnlocked: false
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
    combo: document.getElementById('combo'),
    // 解锁界面元素
    unlockView: document.getElementById('unlock-view'),
    unlockVideo: document.getElementById('unlock-video'),
    unlockCanvas: document.getElementById('unlock-canvas'),
    unlockStatus: document.getElementById('unlock-status')
};

// ========== Canvas 上下文 ==========
let gameCtx, handCtx;
let canvasWidth, canvasHeight;

// ========== MediaPipe Hands ==========
let hands, camera;
let unlockHands, unlockCamera;
let unlockCanvasCtx;

// ========== Shared Camera Stream (avoid repeated permission prompts) ==========
let sharedStream = null;
let cameraLoopId = null;

// ========== 定时器引用（用于清理） ==========
let gameLoopId = null;
let timerInterval = null;
let spawnerInterval = null;
let lastFrameTime = 0;
let lastHandUpdateTime = 0;
let handWatchdogInterval = null;
const SHOOT_COOLDOWN = 250; // 全局射击冷却时间(ms)，双手共享
let lastGlobalShootTime = 0;
let webStyleIndex = 0; // 蛛蛛网样式索引，轮换使用
let lastProcessTime = 0;
const PROCESS_INTERVAL = 50; // 处理间隔(ms)，限制处理频率为20fps

// ========== 怪物类型 ==========
const MONSTER_TYPES = [
    { emoji: '👾', points: 100, size: 60, isBomb: false },
    { emoji: '👻', points: 150, size: 55, isBomb: false },
    { emoji: '🤖', points: 120, size: 65, isBomb: false },
    { emoji: '👹', points: 200, size: 70, isBomb: false },
    { emoji: '💀', points: 180, size: 50, isBomb: false },
    { emoji: '🦇', points: 130, size: 45, isBomb: false },
    { emoji: '🐙', points: 160, size: 60, isBomb: false },
    { emoji: '👽', points: 140, size: 55, isBomb: false }
];

// ========== 炸弹类型 ==========
const BOMB_TYPE = { emoji: '💣', points: 0, size: 55, isBomb: true };

// ========== 初始化 ==========
function init() {
    setupCanvas();
    setupEventListeners();
    elements.highScoreDisplay.textContent = gameState.highScore;
    
    // 启动解锁界面的手势检测
    setupUnlockMediaPipe();
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
    
    // 解锁界面canvas
    if (elements.unlockCanvas) {
        elements.unlockCanvas.width = canvasWidth;
        elements.unlockCanvas.height = canvasHeight;
        unlockCanvasCtx = elements.unlockCanvas.getContext('2d');
    }
}

// ========== 解锁界面 MediaPipe ==========
async function setupUnlockMediaPipe() {
    try {
        console.log('正在初始化解锁界面 MediaPipe...');

        await ensureCameraStream();
        
        unlockHands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });
        
        unlockHands.setOptions({
            maxNumHands: 1,
            modelComplexity: 0,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.4
        });
        
        unlockHands.onResults(onUnlockHandResults);

        startCameraProcessingLoop();
        console.log('解锁摄像头启动成功！');
        updateUnlockStatus('等待手势...', false);
    } catch (error) {
        console.error('解锁MediaPipe初始化失败:', error);
        updateUnlockStatus('摄像头启动失败', false);
    }
}

// 解锁手势检测结果
function onUnlockHandResults(results) {
    if (gameState.isUnlocked) return;
    
    if (unlockCanvasCtx) {
        unlockCanvasCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    }
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        
        // 绘制手部关键点
        drawUnlockHandLandmarks(landmarks);
        
        // 检测蛛蛛侠手势
        const isShootGesture = detectShootGesture(landmarks);
        
        if (isShootGesture) {
            updateUnlockStatus('✅ 手势识别成功！', true);
            // 延迟解锁，让用户看到反馈
            setTimeout(() => {
                unlockGame();
            }, 800);
        } else {
            updateUnlockStatus('继续保持手势...', false);
        }
    } else {
        updateUnlockStatus('等待手势...', false);
    }
}

// 绘制解锁界面手部关键点
function drawUnlockHandLandmarks(landmarks) {
    if (!unlockCanvasCtx) return;
    
    unlockCanvasCtx.fillStyle = 'rgba(230, 57, 70, 0.8)';
    unlockCanvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    unlockCanvasCtx.lineWidth = 2;
    
    for (let i = 0; i < landmarks.length; i++) {
        const x = (1 - landmarks[i].x) * canvasWidth;
        const y = landmarks[i].y * canvasHeight;
        
        unlockCanvasCtx.beginPath();
        unlockCanvasCtx.arc(x, y, 4, 0, 2 * Math.PI);
        unlockCanvasCtx.fill();
    }
}

// 更新解锁状态显示
function updateUnlockStatus(text, detected) {
    const statusText = elements.unlockStatus?.querySelector('.status-text');
    if (statusText) {
        statusText.textContent = text;
    }
    if (elements.unlockStatus) {
        if (detected) {
            elements.unlockStatus.classList.add('detected');
        } else {
            elements.unlockStatus.classList.remove('detected');
        }
    }
}

// 解锁游戏 - 直接开始游戏
function unlockGame() {
    if (gameState.isUnlocked) return; // 防止重复触发
    gameState.isUnlocked = true;
    
    // 复用解锁的Hands实例，切换为双手模式
    if (unlockHands) {
        unlockHands.setOptions({
            maxNumHands: 2,
            modelComplexity: 0,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.4
        });
        unlockHands.onResults(onHandResults);
        hands = unlockHands;
    }
    
    // 复用同一个摄像头流，切换展示目标到游戏 video
    if (sharedStream) {
        elements.video.srcObject = sharedStream;
    }
    startCameraProcessingLoop();
    
    // 直接开始游戏（默认第1关）
    gameState.currentLevel = 1;
    startGame();
}

function setupEventListeners() {
    if (elements.startBtn) {
        elements.startBtn.addEventListener('click', startGame);
    }
    elements.restartBtn.addEventListener('click', startGame);
    window.addEventListener('resize', setupCanvas);
}

// ========== MediaPipe 手势识别 ==========
async function setupMediaPipe() {
    try {
        console.log('正在初始化 MediaPipe...');

        await ensureCameraStream();
        
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

        startCameraProcessingLoop();
        console.log('摄像头启动成功！');
        elements.gestureText.textContent = '摄像头已启动';
    } catch (error) {
        console.error('MediaPipe 初始化失败:', error);
        elements.gestureText.textContent = '摄像头启动失败，请刷新重试';
    }
}

async function ensureCameraStream() {
    if (sharedStream) {
        if (elements.unlockVideo && elements.unlockVideo.srcObject !== sharedStream) {
            elements.unlockVideo.srcObject = sharedStream;
        }
        if (elements.video && elements.video.srcObject !== sharedStream) {
            elements.video.srcObject = sharedStream;
        }
        return sharedStream;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
    });
    sharedStream = stream;

    if (elements.unlockVideo) {
        elements.unlockVideo.srcObject = sharedStream;
        await elements.unlockVideo.play().catch(() => {});
    }
    if (elements.video) {
        elements.video.srcObject = sharedStream;
        await elements.video.play().catch(() => {});
    }

    return sharedStream;
}

function startCameraProcessingLoop() {
    if (cameraLoopId) return;

    const loop = async () => {
        try {
            if (!gameState.isUnlocked) {
                if (unlockHands && elements.unlockVideo) {
                    await unlockHands.send({ image: elements.unlockVideo });
                }
            } else {
                if (hands && gameState.isPlaying && elements.video) {
                    await hands.send({ image: elements.video });
                }
            }
        } catch (err) {
            console.error('摄像头处理循环错误:', err);
        }

        cameraLoopId = requestAnimationFrame(loop);
    };

    cameraLoopId = requestAnimationFrame(loop);
}

function onHandResults(results) {
    lastHandUpdateTime = Date.now();
    
    try {
        // 节流绘制（但不节流手势状态更新，避免错过“松开手势”的那一帧）
        const now = Date.now();
        const shouldDraw = now - lastProcessTime >= PROCESS_INTERVAL;
        if (shouldDraw) {
            lastProcessTime = now;
            handCtx.clearRect(0, 0, canvasWidth, canvasHeight);
        }
        
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
            
            if (shouldDraw) {
                drawHandLandmarks(landmarks);
            }
            
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

// 生成不规则多边形顶点
function generateIrregularPolygon(r, sides, irregularity) {
    const points = [];
    for (let i = 0; i < sides; i++) {
        const baseAngle = (i / sides) * Math.PI * 2;
        const angleOffset = (Math.random() - 0.5) * irregularity;
        const radiusOffset = 0.7 + Math.random() * 0.3;
        const x = Math.cos(baseAngle + angleOffset) * r * radiusOffset;
        const y = Math.sin(baseAngle + angleOffset) * r * radiusOffset;
        points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return points.join(' ');
}

function generateRegularPolygonVertices(r, sides, rotation = -Math.PI / 2) {
    const vertices = [];
    for (let i = 0; i < sides; i++) {
        const angle = rotation + (i / sides) * Math.PI * 2;
        vertices.push({
            x: Math.cos(angle) * r,
            y: Math.sin(angle) * r
        });
    }
    return vertices;
}

function verticesToPoints(vertices) {
    return vertices.map(v => `${v.x.toFixed(1)},${v.y.toFixed(1)}`).join(' ');
}

function generateSpokes(vertices, sw, opacity) {
    return vertices.map(v => (
        `<line x1="0" y1="0" x2="${v.x.toFixed(1)}" y2="${v.y.toFixed(1)}" stroke="white" stroke-width="${sw}" opacity="${opacity}"/>`
    )).join('');
}

// 6种不规则多边形蜘蛛网样式
function getWebSVG(radius, styleIndex) {
    const r = radius;
    const sw = 5; // 线条粗细
    
    const styles = [
        // 样式0: 规则六边形蛛网（带辐条）
        (() => {
            const outer = generateRegularPolygonVertices(r * 0.9, 6);
            const mid = generateRegularPolygonVertices(r * 0.55, 6);
            const inner = generateRegularPolygonVertices(r * 0.25, 6);
            return `
                <polygon points="${verticesToPoints(outer)}" fill="none" stroke="white" stroke-width="${sw}" opacity="0.95"/>
                <polygon points="${verticesToPoints(mid)}" fill="none" stroke="white" stroke-width="${sw - 1}" opacity="0.8"/>
                <polygon points="${verticesToPoints(inner)}" fill="none" stroke="white" stroke-width="${sw - 2}" opacity="0.6"/>
                ${generateSpokes(outer, sw - 2, 0.65)}
            `;
        })(),

        // 样式1: 规则五边形蛛网（带辐条）
        (() => {
            const outer = generateRegularPolygonVertices(r * 0.92, 5);
            const mid = generateRegularPolygonVertices(r * 0.6, 5);
            const inner = generateRegularPolygonVertices(r * 0.32, 5);
            return `
                <polygon points="${verticesToPoints(outer)}" fill="none" stroke="white" stroke-width="${sw}" opacity="0.95"/>
                <polygon points="${verticesToPoints(mid)}" fill="none" stroke="white" stroke-width="${sw - 1}" opacity="0.8"/>
                <polygon points="${verticesToPoints(inner)}" fill="none" stroke="white" stroke-width="${sw - 2}" opacity="0.6"/>
                ${generateSpokes(outer, sw - 2, 0.65)}
            `;
        })(),

        // 样式1: 不规则五边形蛛网
        `<polygon points="${generateIrregularPolygon(r * 0.9, 5, 0.4)}" fill="none" stroke="white" stroke-width="${sw}" opacity="0.95"/>
         <polygon points="${generateIrregularPolygon(r * 0.55, 5, 0.5)}" fill="none" stroke="white" stroke-width="${sw - 1}" opacity="0.8"/>
         <polygon points="${generateIrregularPolygon(r * 0.25, 5, 0.3)}" fill="none" stroke="white" stroke-width="${sw - 1}" opacity="0.6"/>`,
        
        // 样式2: 不规则六边形蛛网
        `<polygon points="${generateIrregularPolygon(r * 0.9, 6, 0.35)}" fill="none" stroke="white" stroke-width="${sw}" opacity="0.95"/>
         <polygon points="${generateIrregularPolygon(r * 0.5, 6, 0.4)}" fill="none" stroke="white" stroke-width="${sw - 1}" opacity="0.75"/>`,
        
        // 样式3: 不规则七边形蛛网
        `<polygon points="${generateIrregularPolygon(r * 0.85, 7, 0.45)}" fill="none" stroke="white" stroke-width="${sw}" opacity="0.9"/>
         <polygon points="${generateIrregularPolygon(r * 0.45, 7, 0.5)}" fill="none" stroke="white" stroke-width="${sw - 1}" opacity="0.7"/>`,
        
        // 样式4: 不规则八边形蛛网
        `<polygon points="${generateIrregularPolygon(r * 0.9, 8, 0.3)}" fill="none" stroke="white" stroke-width="${sw}" opacity="0.95"/>
         <polygon points="${generateIrregularPolygon(r * 0.55, 8, 0.4)}" fill="none" stroke="white" stroke-width="${sw - 1}" opacity="0.8"/>
         <polygon points="${generateIrregularPolygon(r * 0.25, 8, 0.35)}" fill="none" stroke="white" stroke-width="${sw - 2}" opacity="0.6"/>`,
        
        // 样式5: 不规则四边形蛛网（菱形变体）
        `<polygon points="${generateIrregularPolygon(r * 0.9, 4, 0.5)}" fill="none" stroke="white" stroke-width="${sw}" opacity="0.95"/>
         <polygon points="${generateIrregularPolygon(r * 0.5, 4, 0.6)}" fill="none" stroke="white" stroke-width="${sw - 1}" opacity="0.75"/>`,
        
        // 样式6: 不规则九边形蛛网
        `<polygon points="${generateIrregularPolygon(r * 0.85, 9, 0.4)}" fill="none" stroke="white" stroke-width="${sw}" opacity="0.9"/>
         <polygon points="${generateIrregularPolygon(r * 0.45, 9, 0.45)}" fill="none" stroke="white" stroke-width="${sw - 1}" opacity="0.7"/>`
    ];
    
    return styles[styleIndex % styles.length];
}

// 创建蜘蛛网动效
function createWebEffect(x, y, radius) {
    // 限制动效数量
    if (gameState.webEffects.length >= CONFIG.maxWebEffects) {
        gameState.webEffects.shift();
    }
    
    const currentStyle = webStyleIndex;
    webStyleIndex = (webStyleIndex + 1) % 8; // 轮换到下一个样式
    
    const webEffect = {
        x: x,
        y: y,
        radius: radius,
        startTime: Date.now(),
        duration: 400,
        style: currentStyle
    };
    gameState.webEffects.push(webEffect);
    
    // 创建DOM蜘蛛网动画
    const webDiv = document.createElement('div');
    webDiv.className = 'web-catch-effect';
    webDiv.style.left = `${x}px`;
    webDiv.style.top = `${y}px`;
    webDiv.innerHTML = `
        <svg width="${radius * 2}" height="${radius * 2}" viewBox="-${radius} -${radius} ${radius * 2} ${radius * 2}">
            ${getWebSVG(radius, currentStyle)}
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
    
    // 获取当前关卡配置
    const levelConfig = LEVELS[gameState.currentLevel - 1] || LEVELS[0];
    
    // 根据关卡炸弹概率决定是否生成炸弹
    const isBomb = Math.random() < levelConfig.bombRate;
    const type = isBomb ? BOMB_TYPE : MONSTER_TYPES[Math.floor(Math.random() * MONSTER_TYPES.length)];
    
    // 捕鱼达人风格：从屏幕边缘进入，穿过屏幕到对面
    let x, y, targetX, targetY;
    // 根据关卡调整速度
    const speed = (CONFIG.monsterSpeed + Math.random() * 0.5) * levelConfig.speedMultiplier;
    
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
    // 检查是否击中炸弹
    if (monster.isBomb) {
        gameState.bombHits++;
        createBombEffect(monster.x, monster.y);
        gameState.monsters.splice(index, 1);
        updateBombDisplay();
        
        // 击中2次炸弹则游戏失败
        if (gameState.bombHits >= 2) {
            gameState.gameOverReason = 'bomb';
            endGame();
        }
        return;
    }
    
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

// 炸弹爆炸特效
function createBombEffect(x, y) {
    const bombDiv = document.createElement('div');
    bombDiv.className = 'bomb-effect';
    bombDiv.style.left = `${x}px`;
    bombDiv.style.top = `${y}px`;
    bombDiv.innerHTML = '💥';
    document.body.appendChild(bombDiv);
    setTimeout(() => bombDiv.remove(), 800);
}

// 更新炸弹击中显示
function updateBombDisplay() {
    const bombDisplay = document.getElementById('bomb-display');
    if (bombDisplay) {
        const hearts = bombDisplay.querySelectorAll('.bomb-heart');
        if (hearts[gameState.bombHits - 1]) {
            hearts[gameState.bombHits - 1].classList.add('lost');
        }
    }
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
    // 创建蛛蛛网罩住动画 - 使用不规则多边形
    const webEffect = document.createElement('div');
    webEffect.className = 'web-catch-effect';
    webEffect.style.left = `${x}px`;
    webEffect.style.top = `${y}px`;
    const r = 50;
    webEffect.innerHTML = `
        <svg width="100" height="100" viewBox="-50 -50 100 100">
            <polygon points="${generateIrregularPolygon(r * 0.9, 6, 0.4)}" fill="none" stroke="white" stroke-width="5" opacity="0.9"/>
            <polygon points="${generateIrregularPolygon(r * 0.5, 6, 0.45)}" fill="none" stroke="white" stroke-width="4" opacity="0.7"/>
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
    gameState.bombHits = 0;
    gameState.stars = 0;
    gameState.gameOverReason = '';
    
    // 重置炸弹显示
    resetBombDisplay();
    
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
    
    // 如果摄像头还未初始化（从结束界面重新开始时）
    if (!hands && !gameState.isUnlocked) {
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
            gameState.gameOverReason = 'time';
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
    
    // 计算星级
    calculateStars();
    
    // 显示结束界面
    elements.finalScore.textContent = gameState.score;
    elements.highScoreDisplay.textContent = gameState.highScore;
    
    // 更新星级显示
    updateStarsDisplay();
    
    // 显示失败原因
    updateGameOverReason();
    
    // 生成模拟排行榜
    generateLeaderboard();

    // 达成 1★ 则自动进入下一关（最后一关除外）
    const canAdvance = gameState.stars >= 1 && gameState.currentLevel < LEVELS.length;
    if (elements.restartBtn) {
        elements.restartBtn.textContent = canAdvance ? '下一关' : '再来一局';
    }
    if (canAdvance) {
        gameState.currentLevel += 1;
    }
    
    elements.gameScreen.classList.add('hidden');
    elements.endScreen.classList.remove('hidden');
}

// 计算星级
function calculateStars() {
    const levelConfig = LEVELS[gameState.currentLevel - 1] || LEVELS[0];
    const score = gameState.score;
    
    if (score >= levelConfig.star3) {
        gameState.stars = 3;
    } else if (score >= levelConfig.star2) {
        gameState.stars = 2;
    } else if (score >= levelConfig.star1) {
        gameState.stars = 1;
    } else {
        gameState.stars = 0;
    }
}

// 更新星级显示
function updateStarsDisplay() {
    const starsContainer = document.getElementById('stars-display');
    if (starsContainer) {
        const levelConfig = LEVELS[gameState.currentLevel - 1] || LEVELS[0];
        let starsHTML = '';
        for (let i = 1; i <= 3; i++) {
            if (i <= gameState.stars) {
                starsHTML += '<span class="star filled">⭐</span>';
            } else {
                starsHTML += '<span class="star empty">☆</span>';
            }
        }
        starsContainer.innerHTML = starsHTML;
        
        // 显示分数要求
        const reqDisplay = document.getElementById('score-requirements');
        if (reqDisplay) {
            reqDisplay.innerHTML = `
                <span class="req ${gameState.score >= levelConfig.star1 ? 'achieved' : ''}">1★: ${levelConfig.star1}</span>
                <span class="req ${gameState.score >= levelConfig.star2 ? 'achieved' : ''}">2★: ${levelConfig.star2}</span>
                <span class="req ${gameState.score >= levelConfig.star3 ? 'achieved' : ''}">3★: ${levelConfig.star3}</span>
            `;
        }
    }
}

// 显示失败原因
function updateGameOverReason() {
    const reasonDisplay = document.getElementById('game-over-reason');
    if (reasonDisplay) {
        if (gameState.gameOverReason === 'bomb') {
            reasonDisplay.textContent = '💣 炸弹爆炸！游戏失败';
            reasonDisplay.className = 'game-over-reason bomb';
        } else {
            reasonDisplay.textContent = '⏰ 时间到！';
            reasonDisplay.className = 'game-over-reason time';
        }
    }
}

// 生成模拟排行榜
function generateLeaderboard() {
    const leaderboardContainer = document.getElementById('leaderboard');
    if (!leaderboardContainer) return;
    
    // 生成模拟分数（基于当前关卡的分数范围）
    const levelConfig = LEVELS[gameState.currentLevel - 1] || LEVELS[0];
    const baseScore = levelConfig.star1;
    const maxScore = levelConfig.star3 * 1.3;
    
    const fakeScores = FAKE_LEADERBOARD.map(player => ({
        name: player.name,
        score: Math.floor(baseScore + Math.random() * (maxScore - baseScore))
    }));
    
    // 加入玩家分数
    fakeScores.push({ name: '🎮 你', score: gameState.score, isPlayer: true });
    
    // 排序
    fakeScores.sort((a, b) => b.score - a.score);
    
    // 只取前8名
    const top8 = fakeScores.slice(0, 8);
    
    // 生成HTML
    let html = '<div class="leaderboard-title">🏆 排行榜</div>';
    top8.forEach((player, index) => {
        const rankIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`;
        const playerClass = player.isPlayer ? 'player-row' : '';
        html += `
            <div class="leaderboard-row ${playerClass}">
                <span class="rank">${rankIcon}</span>
                <span class="name">${player.name}</span>
                <span class="lb-score">${player.score}</span>
            </div>
        `;
    });
    
    leaderboardContainer.innerHTML = html;
}

// 重置炸弹显示
function resetBombDisplay() {
    const bombDisplay = document.getElementById('bomb-display');
    if (bombDisplay) {
        const hearts = bombDisplay.querySelectorAll('.bomb-heart');
        hearts.forEach(heart => heart.classList.remove('lost'));
    }
}

// 关卡选择
function selectLevel(level) {
    if (level >= 1 && level <= LEVELS.length) {
        gameState.currentLevel = level;
        updateLevelDisplay();
    }
}

// 更新关卡显示
function updateLevelDisplay() {
    const levelDisplay = document.getElementById('current-level');
    if (levelDisplay) {
        levelDisplay.textContent = `第 ${gameState.currentLevel} 关`;
    }
    
    // 更新关卡选择按钮状态
    const levelBtns = document.querySelectorAll('.level-btn');
    levelBtns.forEach((btn, index) => {
        if (index + 1 === gameState.currentLevel) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
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
        
        // 如果超过2秒没有收到手势更新，尝试重启（不重启摄像头，避免重复权限弹窗）
        if (timeSinceLastUpdate > 2000 && hands) {
            watchdogRetryCount++;
            console.warn(`MediaPipe无响应，尝试重启 (${watchdogRetryCount})...`);
            
            if (watchdogRetryCount <= 3) {
                elements.gestureText.textContent = `重新连接中...(${watchdogRetryCount}/3)`;
                
                try {
                    await setupMediaPipe();
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
