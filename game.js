// ========== 蜘蛛侠捕怪大作战 - 融合版 ==========
// 融合: SpiderX城市系统 + SpiderX_final炸弹/钢铁侠/星级系统

// ========== 游戏配置 ==========
const CONFIG = {
    gameDuration: 60,
    monsterSpawnInterval: 2000,
    monsterSpeed: 1.0,
    webRadius: 52,
    maxMonsters: 15,
    maxWebEffects: 5,
    baseScore: 50,
    comboMultiplier: 1.5,
    comboTimeout: 2000,
    // 钢铁侠模式配置
    laserSpeed: 15,
    laserLength: 80,
    laserWidth: 6,
    maxLasers: 20,
    modeSwitchCooldown: 1500,
    // 炸弹配置
    bombRate: 0.12
};

// ========== 星级配置 ==========
const STAR_THRESHOLDS = {
    star1: 1500,
    star2: 2500,
    star3: 4000
};

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

// ========== LLM城市池 ==========
const CITY_TEMPLATES = ['巴黎', '迪拜', '悉尼', '莫斯科', '开罗', '里约', '新加坡', '首尔', '曼谷', '阿姆斯特丹'];

// ========== 动态城市数据 ==========
let dynamicCityData = null;
let nextCityData = null;
let usedCities = [];

// ========== 预设城市模板 ==========
const PRESET_CITIES = {
    shanghai: { 
        name: '上海 · 迷雾幻影', 
        story: '黄浦江上升起诡异浓雾，雾中藏着吞噬光源的"影魔"。穿透迷雾，击退暗影军团！',
        landmarks: [
            { name: '南京路迷途', scoreThreshold: 0, prompt: '上海南京路步行街，浓雾弥漫，霓虹穿透迷雾，神秘悬疑氛围' },
            { name: '外滩暗涌', scoreThreshold: 1500, prompt: '上海外滩黄浦江夜景，雾气翻涌，灯光若隐若现，悬疑电影风格' },
            { name: '明珠破雾', scoreThreshold: 4000, prompt: '上海东方明珠塔冲破浓雾，光芒四射，未来都市，史诗感' }
        ]
    },
    tokyo: { 
        name: '东京 · 数码妖灵', 
        story: '电子屏幕中爬出了"数码妖灵"，它们吞噬信号让城市陷入混乱。重启东京的数字心脏！',
        landmarks: [
            { name: '涩谷信号战', scoreThreshold: 0, prompt: '东京涩谷十字路口，屏幕闪烁故障，数码噪点，赛博朋克故障风' },
            { name: '新宿电子迷宫', scoreThreshold: 1500, prompt: '东京新宿歌舞伎町，霓虹招牌密集，电子雨，矩阵风格' },
            { name: '秋叶原觉醒', scoreThreshold: 4000, prompt: '东京秋叶原夜景，巨型机甲投影，科幻动漫风格，未来感' }
        ]
    },
    london: { 
        name: '伦敦 · 暗夜蝠影', 
        story: '古老城堡中飞出成群的"暗夜蝠魔"，它们让整座城市陷入黑暗。驱散蝠影，唤醒黎明！',
        landmarks: [
            { name: '贝克街悬案', scoreThreshold: 0, prompt: '伦敦贝克街雾夜，维多利亚路灯，哥特式阴影，侦探电影风格' },
            { name: '塔桥暗影', scoreThreshold: 1500, prompt: '伦敦塔桥夜景，蝙蝠剪影飞过，月光倒映泰晤士河，暗黑童话' },
            { name: '大本钟午夜', scoreThreshold: 4000, prompt: '伦敦大本钟午夜，月圆之夜，哥特式尖塔剪影，史诗暗黑风格' }
        ]
    },
    newyork: { 
        name: '纽约 · 外星降临', 
        story: '一道绿光划过天际，"外星异形"开始入侵曼哈顿！拿起武器，保卫地球最后防线！',
        landmarks: [
            { name: '时代广场沦陷', scoreThreshold: 0, prompt: '纽约时代广场，UFO悬浮，外星人入侵，科幻电影大片风格' },
            { name: '大桥激战', scoreThreshold: 1500, prompt: '纽约布鲁克林大桥夜景，激光束交错，星际大战风格' },
            { name: '帝国反击', scoreThreshold: 4000, prompt: '纽约帝国大厦顶端，能量护盾，城市天际线，复仇者联盟风格' }
        ]
    },
    venice: { 
        name: '威尼斯 · 深渊海妖', 
        story: '运河深处传来诡异歌声，"深渊海妖"正在召唤风暴。在水城中航行，封印远古之恶！',
        landmarks: [
            { name: '里亚托低语', scoreThreshold: 0, prompt: '威尼斯里亚托桥黄昏，水面涟漪，神秘雾气升起，奇幻电影风格' },
            { name: '运河暗流', scoreThreshold: 1500, prompt: '威尼斯大运河夜景，水下幽光闪烁，贡多拉剪影，克苏鲁氛围' },
            { name: '圣马可封印', scoreThreshold: 4000, prompt: '威尼斯圣马可广场暴风雨夜，闪电照亮穹顶，史诗魔幻风格' }
        ]
    },
    hongkong: { 
        name: '香港 · 霓虹恶灵', 
        story: '午夜的霓虹招牌开始诡异闪烁，"霓虹恶灵"从光影中苏醒。在天台间跃动，净化都市！',
        landmarks: [
            { name: '旺角鬼影', scoreThreshold: 0, prompt: '香港旺角霓虹招牌，诡异红光闪烁，密集灯牌，港式恐怖氛围' },
            { name: '维港妖氛', scoreThreshold: 1500, prompt: '香港维多利亚港夜景，幽绿光芒倒映水面，灵异都市风格' },
            { name: '中环驱魔', scoreThreshold: 4000, prompt: '香港中环摩天楼夜景，雷电交加，天台决战，史诗动作片风格' }
        ]
    }
};

// ========== 背景图管理 ==========
const backgroundManager = {
    cache: {},
    loading: {},
    currentBgUrl: null,
    
    _getKey(landmarkIndex) {
        return `dynamic_${landmarkIndex}`;
    },
    
    async generateLandmarkBackground(landmarkIndex) {
        if (!dynamicCityData) return null;
        
        const key = this._getKey(landmarkIndex);
        const landmark = dynamicCityData.landmarks[landmarkIndex];
        
        if (!landmark) return null;
        
        if (this.cache[key]) {
            console.log(`[BG] 使用缓存: ${key}`);
            return this.cache[key];
        }
        
        if (this.loading[key]) {
            console.log(`[BG] 等待加载中: ${key}`);
            return this.loading[key];
        }
        
        console.log(`[BG] 开始生成: ${landmark.name}`);
        this.loading[key] = this._fetchBackground(landmark.prompt);
        
        try {
            const url = await this.loading[key];
            if (url) {
                this.cache[key] = url;
            }
            delete this.loading[key];
            return url || this._getFallbackBackground();
        } catch (error) {
            delete this.loading[key];
            console.error(`[BG] 生成失败: ${key}`, error);
            return this._getFallbackBackground();
        }
    },
    
    async _fetchBackground(prompt) {
        try {
            const response = await fetch('/api/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });
            
            const data = await response.json();
            if (data.success && data.url) {
                await this._preloadImage(data.url);
                return data.url;
            }
            throw new Error(data.error || 'Failed to generate background');
        } catch (error) {
            console.warn('[BG] API请求失败，使用备用背景:', error.message);
            // 返回备用SVG渐变背景
            return this._getFallbackBackground();
        }
    },
    
    _getFallbackBackground() {
        const colors = [
            ['#1a1a2e', '#16213e', '#0f3460'],
            ['#2d132c', '#801336', '#c72c41'],
            ['#1b262c', '#0f4c75', '#3282b8'],
            ['#1a1a2e', '#4a1942', '#6a2c70'],
            ['#0a192f', '#172a45', '#203a43']
        ];
        const colorSet = colors[Math.floor(Math.random() * colors.length)];
        
        const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">
            <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:${colorSet[0]};stop-opacity:1" />
                    <stop offset="50%" style="stop-color:${colorSet[1]};stop-opacity:1" />
                    <stop offset="100%" style="stop-color:${colorSet[2]};stop-opacity:1" />
                </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#grad)"/>
            <text x="640" y="360" text-anchor="middle" fill="rgba(255,255,255,0.1)" font-size="60" font-family="Arial">SPIDERX</text>
        </svg>`;
        
        return `data:image/svg+xml;base64,${btoa(svg)}`;
    },
    
    _preloadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(url);
            img.onerror = reject;
            img.src = url;
        });
    },
    
    preloadNextLandmark(currentLandmarkIndex) {
        if (!dynamicCityData) return;
        const nextIndex = currentLandmarkIndex + 1;
        if (nextIndex < dynamicCityData.landmarks.length) {
            console.log(`[BG] 预加载下一个地标: ${dynamicCityData.landmarks[nextIndex].name}`);
            this.generateLandmarkBackground(nextIndex);
        } else {
            // 当前是最后一个地标，预加载下一个城市
            console.log(`[BG] 当前为最后一关，开始预加载下一城市...`);
            this.preloadNextCity();
        }
    },
    
    async preloadNextCity() {
        if (nextCityData) {
            console.log(`[BG] 下一城市已缓存: ${nextCityData.name}`);
            return;
        }
        
        try {
            const response = await fetch('/api/generate-city', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usedCities })
            });
            const data = await response.json();
            if (data.success && data.data) {
                nextCityData = data.data;
                console.log(`[BG] 预加载城市成功: ${nextCityData.name}`);
                // 预加载第一个地标的背景
                if (nextCityData.landmarks && nextCityData.landmarks[0]) {
                    const prompt = nextCityData.landmarks[0].prompt;
                    this._fetchBackground(prompt).then(url => {
                        if (url) {
                            this.cache['next_city_0'] = url;
                            console.log(`[BG] 预加载下一城市首个背景完成`);
                        }
                    });
                }
            }
        } catch (error) {
            console.warn(`[BG] 预加载下一城市失败:`, error.message);
        }
    },
    
    clearCache() {
        this.cache = {};
        this.loading = {};
        this.currentBgUrl = null;
    }
};

// ========== 游戏状态 ==========
const gameState = {
    // 城市进度
    totalScore: 0,
    cityCount: 1,
    isFirstCity: true,
    currentLandmarkIndex: 0,
    
    // 游戏核心状态
    isPlaying: false,
    isUnlocked: false,
    score: 0,
    highScore: parseInt(localStorage.getItem('spiderHighScore')) || 0,
    timeLeft: CONFIG.gameDuration,
    combo: 0,
    lastHitTime: 0,
    monsters: [],
    webEffects: [],
    lasers: [],
    
    // 炸弹系统
    bombHits: 0,
    gameOverReason: '',
    stars: 0,
    
    // 钢铁侠模式
    isIronManMode: false,
    lastModeSwitchTime: 0,
    
    // 双手状态
    hands: [
        { landmarks: null, isShootGesture: false, palmCenter: null, isFist: false, isPalm: false, palmDirection: null },
        { landmarks: null, isShootGesture: false, palmCenter: null, isFist: false, isPalm: false, palmDirection: null }
    ],
    cameraReady: false
};

// ========== DOM 元素 ==========
const elements = {
    startScreen: document.getElementById('start-screen'),
    storyScreen: document.getElementById('story-screen'),
    gameScreen: document.getElementById('game-screen'),
    endScreen: document.getElementById('end-screen'),
    
    // 解锁界面
    unlockView: document.getElementById('unlock-view'),
    unlockVideo: document.getElementById('unlock-video'),
    unlockCanvas: document.getElementById('unlock-canvas'),
    unlockStatus: document.getElementById('unlock-status'),
    
    // 故事界面
    storyCityName: document.getElementById('story-city-name'),
    storyText: document.getElementById('story-text'),
    storyLandmarkName: document.getElementById('story-landmark-name'),
    storyLoading: document.getElementById('story-loading'),
    storyCountdown: document.getElementById('story-countdown'),
    countdownNumber: document.getElementById('countdown-number'),
    
    // 游戏界面
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
    
    // AI背景
    aiBackground: document.getElementById('ai-background'),
    aiBgImage: document.getElementById('ai-bg-image'),
    bgLoadingIndicator: document.getElementById('bg-loading-indicator'),
    
    // 地标UI
    landmarkName: document.getElementById('landmark-name'),
    landmarkProgress: document.getElementById('landmark-progress')
};

// ========== Canvas 上下文 ==========
let gameCtx, handCtx, unlockCanvasCtx;
let canvasWidth, canvasHeight;

// ========== MediaPipe Hands ==========
let hands, unlockHands;
let sharedStream = null;
let cameraLoopId = null;

// ========== 定时器引用 ==========
let gameLoopId = null;
let timerInterval = null;
let spawnerInterval = null;
let lastFrameTime = 0;
let lastHandUpdateTime = 0;
let handWatchdogInterval = null;

const SHOOT_COOLDOWN = 250;
let lastGlobalShootTime = 0;
let webStyleIndex = 0;
let lastProcessTime = 0;
const PROCESS_INTERVAL = 50;

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

const BOMB_TYPE = { emoji: '💣', points: 0, size: 55, isBomb: true };

// ========== 初始化 ==========
function init() {
    setupCanvas();
    setupEventListeners();
    elements.highScoreDisplay.textContent = gameState.highScore;
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
    
    if (elements.unlockCanvas) {
        elements.unlockCanvas.width = canvasWidth;
        elements.unlockCanvas.height = canvasHeight;
        unlockCanvasCtx = elements.unlockCanvas.getContext('2d');
    }
}

function setupEventListeners() {
    elements.restartBtn.addEventListener('click', startNextCity);
    window.addEventListener('resize', setupCanvas);
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

    console.log('[Camera] 请求摄像头权限...');
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: 'user',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        });
        sharedStream = stream;
        console.log('[Camera] 摄像头权限获取成功');

        if (elements.unlockVideo) {
            elements.unlockVideo.srcObject = sharedStream;
            // 等待视频元数据加载完成
            await new Promise((resolve, reject) => {
                elements.unlockVideo.onloadedmetadata = () => {
                    console.log('[Camera] 解锁视频元数据加载完成');
                    resolve();
                };
                elements.unlockVideo.onerror = (e) => {
                    console.error('[Camera] 解锁视频加载错误:', e);
                    reject(e);
                };
                // 超时保护
                setTimeout(resolve, 3000);
            });
            await elements.unlockVideo.play();
            console.log('[Camera] 解锁视频播放成功');
        }
        
        if (elements.video) {
            elements.video.srcObject = sharedStream;
            await new Promise((resolve) => {
                elements.video.onloadedmetadata = resolve;
                setTimeout(resolve, 3000);
            });
            await elements.video.play().catch(e => console.warn('[Camera] 游戏视频播放延迟:', e));
        }

        return sharedStream;
    } catch (error) {
        console.error('[Camera] 摄像头获取失败:', error);
        updateUnlockStatus('摄像头权限被拒绝，请刷新页面重试', false);
        throw error;
    }
}

function startCameraProcessingLoop() {
    if (cameraLoopId) return;

    console.log('[Camera] 启动摄像头处理循环');
    
    const loop = async () => {
        try {
            if (!gameState.isUnlocked) {
                // 确保视频已就绪
                if (unlockHands && elements.unlockVideo && elements.unlockVideo.readyState >= 2) {
                    await unlockHands.send({ image: elements.unlockVideo });
                }
            } else {
                if (hands && gameState.isPlaying && elements.video && elements.video.readyState >= 2) {
                    await hands.send({ image: elements.video });
                }
            }
        } catch (err) {
            // 忽略常见的 MediaPipe 初始化错误
            if (!err.message?.includes('initialized')) {
                console.error('摄像头处理循环错误:', err);
            }
        }
        cameraLoopId = requestAnimationFrame(loop);
    };
    cameraLoopId = requestAnimationFrame(loop);
}

function onUnlockHandResults(results) {
    if (gameState.isUnlocked) return;
    
    if (unlockCanvasCtx) {
        unlockCanvasCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    }
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        drawUnlockHandLandmarks(landmarks);
        const isShootGesture = detectShootGesture(landmarks);
        
        if (isShootGesture) {
            updateUnlockStatus('✅ 手势识别成功！', true);
            setTimeout(() => unlockGame(), 800);
        } else {
            updateUnlockStatus('继续保持手势...', false);
        }
    } else {
        updateUnlockStatus('等待手势...', false);
    }
}

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

function updateUnlockStatus(text, detected) {
    const statusText = elements.unlockStatus?.querySelector('.status-text');
    if (statusText) statusText.textContent = text;
    if (elements.unlockStatus) {
        if (detected) {
            elements.unlockStatus.classList.add('detected');
        } else {
            elements.unlockStatus.classList.remove('detected');
        }
    }
}

// ========== 解锁并开始游戏流程 ==========
async function unlockGame() {
    if (gameState.isUnlocked) return;
    gameState.isUnlocked = true;
    
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
    
    if (sharedStream) {
        elements.video.srcObject = sharedStream;
    }
    startCameraProcessingLoop();
    
    // 初始化第一个城市
    const presetKeys = Object.keys(PRESET_CITIES);
    const randomKey = presetKeys[Math.floor(Math.random() * presetKeys.length)];
    dynamicCityData = PRESET_CITIES[randomKey];
    gameState.isFirstCity = true;
    gameState.totalScore = 0;
    gameState.cityCount = 1;
    
    const keyToChinese = { shanghai: '上海', tokyo: '东京', london: '伦敦', newyork: '纽约', venice: '威尼斯', hongkong: '香港' };
    usedCities = [keyToChinese[randomKey]];
    
    console.log(`[Game] 第一个城市: ${dynamicCityData.name}`);
    backgroundManager.clearCache();
    showStoryScreen();
    preloadNextCity();
}

// ========== LLM 生成城市 ==========
async function generateCityWithLLM() {
    console.log(`[LLM] 请求生成随机城市，已使用: ${usedCities}`);
    const response = await fetch('/api/generate-city', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usedCities: usedCities })
    });
    const result = await response.json();
    if (result.success && result.data) {
        console.log(`[LLM] 城市内容生成成功:`, result.data.name);
        const cityName = result.data.name.split('·')[0].trim();
        usedCities.push(cityName);
        return result.data;
    }
    throw new Error(result.error || 'Failed to generate city');
}

async function preloadNextCity() {
    try {
        console.log(`[LLM] 后台预生成下一个城市...`);
        nextCityData = await generateCityWithLLM();
    } catch (error) {
        console.warn('[LLM] 预生成失败');
        nextCityData = null;
    }
}

async function startNextCity() {
    if (nextCityData) {
        dynamicCityData = nextCityData;
        nextCityData = null;
    } else {
        try {
            dynamicCityData = await generateCityWithLLM();
        } catch (error) {
            const fallbackKeys = Object.keys(PRESET_CITIES);
            const fallbackKey = fallbackKeys[Math.floor(Math.random() * fallbackKeys.length)];
            dynamicCityData = PRESET_CITIES[fallbackKey];
        }
    }
    
    gameState.isFirstCity = false;
    gameState.cityCount++;
    backgroundManager.clearCache();
    showStoryScreen();
    preloadNextCity();
}

// ========== 故事界面 ==========
async function showStoryScreen() {
    if (!dynamicCityData) return;
    
    hideAllScreens();
    elements.storyScreen.classList.remove('hidden');
    
    elements.storyCityName.textContent = dynamicCityData.name;
    elements.storyText.textContent = '';
    elements.storyLandmarkName.textContent = dynamicCityData.landmarks[0].name;
    
    elements.storyLoading.classList.remove('hidden');
    elements.storyCountdown.classList.add('hidden');
    
    typeWriter(elements.storyText, dynamicCityData.story, 50);
    
    try {
        const bgUrl = await backgroundManager.generateLandmarkBackground(0);
        if (bgUrl) {
            elements.aiBgImage.src = bgUrl;
            elements.aiBgImage.classList.remove('loaded');
            await new Promise((resolve) => {
                elements.aiBgImage.onload = resolve;
                elements.aiBgImage.onerror = resolve;
            });
            elements.aiBgImage.classList.add('loaded');
            elements.bgLoadingIndicator.classList.add('hidden');
            backgroundManager.preloadNextLandmark(0);
        }
    } catch (error) {
        console.error('[Story] 背景加载失败:', error);
    }
    
    setTimeout(() => {
        elements.storyLoading.classList.add('hidden');
        startCountdown();
    }, 500);
}

function typeWriter(element, text, speed = 50) {
    let index = 0;
    element.textContent = '';
    function type() {
        if (index < text.length) {
            element.textContent += text.charAt(index);
            index++;
            setTimeout(type, speed);
        }
    }
    type();
}

function startCountdown() {
    elements.storyCountdown.classList.remove('hidden');
    let count = 3;
    elements.countdownNumber.textContent = count;
    
    const countdownInterval = setInterval(() => {
        count--;
        if (count > 0) {
            elements.countdownNumber.textContent = count;
            elements.countdownNumber.style.animation = 'none';
            elements.countdownNumber.offsetHeight;
            elements.countdownNumber.style.animation = 'countdownPulse 1s ease-in-out';
        } else {
            clearInterval(countdownInterval);
            elements.countdownNumber.textContent = 'GO!';
            setTimeout(() => startGame(), 500);
        }
    }, 1000);
}

function hideAllScreens() {
    elements.startScreen.classList.add('hidden');
    elements.storyScreen.classList.add('hidden');
    elements.gameScreen.classList.add('hidden');
    elements.endScreen.classList.add('hidden');
}

// ========== 游戏主逻辑 ==========
async function startGame() {
    if (gameLoopId) cancelAnimationFrame(gameLoopId);
    if (timerInterval) clearInterval(timerInterval);
    if (spawnerInterval) clearInterval(spawnerInterval);
    
    hideAllScreens();
    elements.gameScreen.classList.remove('hidden');
    
    gameState.isPlaying = true;
    gameState.score = 0;
    gameState.timeLeft = CONFIG.gameDuration;
    gameState.combo = 0;
    gameState.monsters = [];
    gameState.webEffects = [];
    gameState.lasers = [];
    gameState.isIronManMode = false;
    gameState.lastModeSwitchTime = 0;
    gameState.bombHits = 0;
    gameState.stars = 0;
    gameState.gameOverReason = '';
    gameState.currentLandmarkIndex = 0;
    
    resetBombDisplay();
    updateScoreDisplay();
    updateTimeDisplay();
    updateLandmarkUI();
    updateGestureStatusForMode();
    
    elements.bgLoadingIndicator.classList.add('hidden');
    
    startGameLoop();
    startTimer();
    startMonsterSpawner();
    
    for (let i = 0; i < 3; i++) {
        setTimeout(() => spawnMonster(), i * 300);
    }
    
    startHandWatchdog();
}

// ========== 地标进度系统 ==========
function checkLandmarkProgress() {
    if (!dynamicCityData) return;
    
    const landmarks = dynamicCityData.landmarks;
    let newIndex = 0;
    
    for (let i = landmarks.length - 1; i >= 0; i--) {
        if (gameState.score >= landmarks[i].scoreThreshold) {
            newIndex = i;
            break;
        }
    }
    
    if (newIndex !== gameState.currentLandmarkIndex) {
        gameState.currentLandmarkIndex = newIndex;
        switchLandmark(newIndex);
    }
}

async function switchLandmark(landmarkIndex) {
    if (!dynamicCityData) return;
    
    const landmark = dynamicCityData.landmarks[landmarkIndex];
    if (!landmark) return;
    
    console.log(`[Landmark] 切换到: ${landmark.name}`);
    elements.landmarkName.textContent = landmark.name;
    elements.landmarkName.style.animation = 'none';
    elements.landmarkName.offsetHeight;
    elements.landmarkName.style.animation = 'landmarkPulse 0.5s ease-out';
    
    updateLandmarkUI();
    
    elements.bgLoadingIndicator.classList.remove('hidden');
    try {
        const bgUrl = await backgroundManager.generateLandmarkBackground(landmarkIndex);
        if (bgUrl) {
            elements.aiBgImage.src = bgUrl;
            elements.aiBgImage.classList.remove('loaded');
            await new Promise((resolve) => {
                elements.aiBgImage.onload = resolve;
                elements.aiBgImage.onerror = resolve;
            });
            elements.aiBgImage.classList.add('loaded');
            backgroundManager.preloadNextLandmark(landmarkIndex);
        }
    } catch (error) {
        console.error('[Landmark] 背景切换失败:', error);
    }
    elements.bgLoadingIndicator.classList.add('hidden');
}

function updateLandmarkUI() {
    if (!dynamicCityData) return;
    
    const landmark = dynamicCityData.landmarks[gameState.currentLandmarkIndex];
    if (landmark) {
        elements.landmarkName.textContent = landmark.name;
    }
    
    const dots = elements.landmarkProgress.querySelectorAll('.dot');
    dots.forEach((dot, i) => {
        dot.classList.remove('active', 'completed');
        if (i < gameState.currentLandmarkIndex) {
            dot.classList.add('completed');
        } else if (i === gameState.currentLandmarkIndex) {
            dot.classList.add('active');
        }
    });
}

// ========== MediaPipe 手势检测 ==========
function onHandResults(results) {
    if (!gameState.isPlaying) return;
    
    lastHandUpdateTime = Date.now();
    handCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    gameState.hands.forEach(h => {
        h.landmarks = null;
        h.palmCenter = null;
        h.isShootGesture = false;
        h.isFist = false;
        h.isPalm = false;
        h.palmDirection = null;
    });
    
    let anyGesture = false;
    let bothFists = false;
    
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const fistStates = [];
        
        for (let handIdx = 0; handIdx < results.multiHandLandmarks.length && handIdx < 2; handIdx++) {
            const landmarks = results.multiHandLandmarks[handIdx];
            const handState = gameState.hands[handIdx];
            
            drawHandLandmarks(landmarks, handIdx);
            
            const wristPos = getWristPosition(landmarks);
            const isFist = detectFistGesture(landmarks);
            const isPalm = detectPalmGesture(landmarks);
            const isShootGesture = detectShootGesture(landmarks);
            
            // 保存之前的状态用于边缘检测
            const wasShootGesture = handState.isShootGesture;
            const wasPalm = handState.isPalm;
            
            fistStates.push(isFist);
            
            // 更新状态
            handState.landmarks = landmarks;
            handState.palmCenter = wristPos;
            handState.isFist = isFist;
            handState.isPalm = isPalm;
            handState.isShootGesture = isShootGesture;
            
            if (gameState.isIronManMode) {
                // 钢铁侠模式：张开手掌发射激光
                if (isPalm) {
                    const palmDirection = getPalmDirection(landmarks);
                    handState.palmDirection = palmDirection;
                    
                    const now = Date.now();
                    if (now - lastGlobalShootTime > SHOOT_COOLDOWN) {
                        shootLaser(palmDirection);
                        lastGlobalShootTime = now;
                        anyGesture = true;
                    }
                }
            } else {
                // 蜘蛛侠模式：做出蜘蛛侠手势发射蛛网
                const now = Date.now();
                // 使用保存的之前状态进行边缘检测，或者只要保持手势就持续发射
                if (isShootGesture && now - lastGlobalShootTime > SHOOT_COOLDOWN) {
                    shootWebAtPosition(wristPos.x, wristPos.y);
                    lastGlobalShootTime = now;
                }
                if (isShootGesture) anyGesture = true;
            }
        }
        
        // 严格要求：必须检测到2只手，且两只手都是握拳状态
        bothFists = (results.multiHandLandmarks.length === 2) && (fistStates.length === 2) && fistStates[0] && fistStates[1];
    }
    
    const now = Date.now();
    if (bothFists && now - gameState.lastModeSwitchTime > CONFIG.modeSwitchCooldown) {
        gameState.isIronManMode = !gameState.isIronManMode;
        gameState.lastModeSwitchTime = now;
        showModeSwitchEffect(gameState.isIronManMode);
        updateGestureStatusForMode();
    }
    
    updateGestureStatus(anyGesture);
}

function getWristPosition(landmarks) {
    const wrist = landmarks[0];
    return {
        x: (1 - wrist.x) * canvasWidth,
        y: wrist.y * canvasHeight
    };
}

function getPalmDirection(landmarks) {
    const wrist = landmarks[0];
    const middleMcp = landmarks[9];
    
    const dx = middleMcp.x - wrist.x;
    const dy = middleMcp.y - wrist.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    
    const palmX = (1 - wrist.x) * canvasWidth;
    const palmY = wrist.y * canvasHeight;
    
    return {
        x: palmX,
        y: palmY,
        dx: -dx / len,
        dy: dy / len,
        angle: Math.atan2(dy, -dx)
    };
}

// ========== 手势检测函数 ==========
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
    
    const dist = (p1, p2) => Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
    
    const indexExtended = dist(indexTip, wrist) > dist(indexPip, wrist) * 1.1;
    const pinkyExtended = dist(pinkyTip, wrist) > dist(pinkyPip, wrist) * 1.1;
    const middleBent = dist(middleTip, wrist) < dist(middleMcp, wrist) * 1.3;
    const ringBent = dist(ringTip, wrist) < dist(ringMcp, wrist) * 1.3;
    const thumbOut = dist(thumbTip, indexMcp) > 0.08;
    
    return indexExtended && pinkyExtended && middleBent && ringBent && thumbOut;
}

function detectFistGesture(landmarks) {
    const wrist = landmarks[0];
    const tips = [landmarks[4], landmarks[8], landmarks[12], landmarks[16], landmarks[20]];
    const mcps = [landmarks[2], landmarks[5], landmarks[9], landmarks[13], landmarks[17]];
    
    const dist = (p1, p2) => Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
    
    let closedCount = 0;
    for (let i = 1; i < 5; i++) {
        if (dist(tips[i], wrist) < dist(mcps[i], wrist) * 1.2) {
            closedCount++;
        }
    }
    return closedCount >= 4;
}

function detectPalmGesture(landmarks) {
    const wrist = landmarks[0];
    const tips = [landmarks[8], landmarks[12], landmarks[16], landmarks[20]];
    const pips = [landmarks[6], landmarks[10], landmarks[14], landmarks[18]];
    
    const dist = (p1, p2) => Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
    
    let extendedCount = 0;
    for (let i = 0; i < 4; i++) {
        if (dist(tips[i], wrist) > dist(pips[i], wrist) * 1.1) {
            extendedCount++;
        }
    }
    return extendedCount >= 3;
}

// ========== 绘制函数 ==========
const HAND_COLORS = [
    { fill: '#e63946', stroke: 'rgba(255, 100, 100, 0.6)' },
    { fill: '#4361ee', stroke: 'rgba(100, 150, 255, 0.6)' }
];

function drawHandLandmarks(landmarks, handIndex = 0) {
    const colors = HAND_COLORS[handIndex % 2];
    handCtx.fillStyle = colors.fill;
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
    
    handCtx.strokeStyle = colors.stroke;
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

function updateGestureStatus(isActive) {
    if (gameState.isIronManMode) {
        if (isActive) {
            elements.gestureStatus.classList.add('active');
            elements.gestureIcon.textContent = '⚡';
            elements.gestureText.textContent = '发射激光！';
        } else {
            elements.gestureStatus.classList.remove('active');
            elements.gestureIcon.textContent = '🖐️';
            elements.gestureText.textContent = '张开手掌发射';
        }
    } else {
        if (isActive) {
            elements.gestureStatus.classList.add('active');
            elements.gestureIcon.textContent = '🕸️';
            elements.gestureText.textContent = '发射蛛网！';
        } else {
            elements.gestureStatus.classList.remove('active');
            elements.gestureIcon.textContent = '🤟';
            elements.gestureText.textContent = '做出蜘蛛侠手势';
        }
    }
}

function updateGestureStatusForMode() {
    if (gameState.isIronManMode) {
        elements.gestureStatus.classList.add('iron-man-mode');
        elements.gestureIcon.textContent = '🖐️';
        elements.gestureText.textContent = '张开手掌发射';
    } else {
        elements.gestureStatus.classList.remove('iron-man-mode');
        elements.gestureIcon.textContent = '🤟';
        elements.gestureText.textContent = '做出蜘蛛侠手势';
    }
}

// ========== 蜘蛛网系统 ==========
function shootWebAtPosition(x, y) {
    if (x === undefined || y === undefined) return;
    
    const radius = CONFIG.webRadius;
    createWebEffect(x, y, radius);
    
    let closestMonster = null;
    let closestIndex = -1;
    let closestDistance = Infinity;
    
    for (let i = 0; i < gameState.monsters.length; i++) {
        const monster = gameState.monsters[i];
        if (monster.hit) continue;
        
        const dx = monster.x - x;
        const dy = monster.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < radius + monster.size / 2 && distance < closestDistance) {
            closestDistance = distance;
            closestMonster = monster;
            closestIndex = i;
        }
    }
    
    if (closestMonster && !closestMonster.hit) {
        closestMonster.hit = true;
        hitMonster(closestMonster, closestIndex);
    } else {
        showMissEffect(x, y);
    }
}

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

function createWebEffect(x, y, radius) {
    if (gameState.webEffects.length >= CONFIG.maxWebEffects) {
        gameState.webEffects.shift();
    }
    
    gameState.webEffects.push({
        x, y, radius,
        startTime: Date.now(),
        duration: 400
    });
    
    const webDiv = document.createElement('div');
    webDiv.className = 'web-catch-effect';
    webDiv.style.left = `${x}px`;
    webDiv.style.top = `${y}px`;
    webDiv.innerHTML = `
        <svg width="${radius * 2}" height="${radius * 2}" viewBox="-${radius} -${radius} ${radius * 2} ${radius * 2}">
            <polygon points="${generateIrregularPolygon(radius * 0.9, 6, 0.4)}" fill="none" stroke="white" stroke-width="5" opacity="0.9"/>
            <polygon points="${generateIrregularPolygon(radius * 0.5, 6, 0.45)}" fill="none" stroke="white" stroke-width="4" opacity="0.7"/>
        </svg>
    `;
    document.body.appendChild(webDiv);
    setTimeout(() => webDiv.remove(), 500);
}

function updateWebEffects() {
    const now = Date.now();
    for (let i = gameState.webEffects.length - 1; i >= 0; i--) {
        if (now - gameState.webEffects[i].startTime > gameState.webEffects[i].duration) {
            gameState.webEffects.splice(i, 1);
        }
    }
}

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
        
        gameCtx.strokeStyle = '#ffffff';
        gameCtx.lineWidth = 3;
        gameCtx.beginPath();
        gameCtx.arc(0, 0, effect.radius * 0.9, 0, 2 * Math.PI);
        gameCtx.stroke();
        
        gameCtx.lineWidth = 2;
        gameCtx.beginPath();
        gameCtx.arc(0, 0, effect.radius * 0.6, 0, 2 * Math.PI);
        gameCtx.stroke();
        
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

// ========== 钢铁侠激光系统 ==========
function shootLaser(palmDirection) {
    if (!palmDirection) return;
    
    if (gameState.lasers.length >= CONFIG.maxLasers) {
        gameState.lasers.shift();
    }
    
    gameState.lasers.push({
        id: Date.now() + Math.random(),
        x: palmDirection.x,
        y: palmDirection.y,
        dx: palmDirection.dx,
        dy: palmDirection.dy,
        angle: palmDirection.angle,
        speed: CONFIG.laserSpeed,
        length: CONFIG.laserLength,
        width: CONFIG.laserWidth,
        startTime: Date.now(),
        hit: false
    });
    
    createLaserShootEffect(palmDirection.x, palmDirection.y);
}

function createLaserShootEffect(x, y) {
    const effectDiv = document.createElement('div');
    effectDiv.className = 'laser-shoot-effect';
    effectDiv.style.left = `${x}px`;
    effectDiv.style.top = `${y}px`;
    document.body.appendChild(effectDiv);
    setTimeout(() => effectDiv.remove(), 300);
}

function updateLasers(deltaTime) {
    const speedFactor = deltaTime * 60;
    
    for (let i = gameState.lasers.length - 1; i >= 0; i--) {
        const laser = gameState.lasers[i];
        
        laser.x += laser.dx * laser.speed * speedFactor;
        laser.y += laser.dy * laser.speed * speedFactor;
        
        checkLaserCollision(laser, i);
        
        const outOfBounds = 
            laser.x < -100 || laser.x > canvasWidth + 100 ||
            laser.y < -100 || laser.y > canvasHeight + 100;
        
        if (outOfBounds || laser.hit) {
            gameState.lasers.splice(i, 1);
        }
    }
}

function checkLaserCollision(laser, laserIndex) {
    for (let i = 0; i < gameState.monsters.length; i++) {
        const monster = gameState.monsters[i];
        if (monster.hit) continue;
        
        const laserHeadX = laser.x + laser.dx * laser.length / 2;
        const laserHeadY = laser.y + laser.dy * laser.length / 2;
        
        const dx = monster.x - laserHeadX;
        const dy = monster.y - laserHeadY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const dx2 = monster.x - laser.x;
        const dy2 = monster.y - laser.y;
        const distance2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
        
        const hitRadius = monster.size / 2 + laser.width;
        
        if (distance < hitRadius || distance2 < hitRadius) {
            laser.hit = true;
            monster.hit = true;
            createLaserHitEffect(monster.x, monster.y);
            hitMonster(monster, i);
            break;
        }
    }
}

function drawLasers() {
    gameState.lasers.forEach(laser => {
        gameCtx.save();
        gameCtx.translate(laser.x, laser.y);
        gameCtx.rotate(laser.angle);
        
        const gradient = gameCtx.createLinearGradient(-laser.length / 2, 0, laser.length / 2, 0);
        gradient.addColorStop(0, 'rgba(0, 150, 255, 0)');
        gradient.addColorStop(0.3, 'rgba(0, 200, 255, 0.8)');
        gradient.addColorStop(0.5, 'rgba(100, 220, 255, 1)');
        gradient.addColorStop(0.7, 'rgba(0, 200, 255, 0.8)');
        gradient.addColorStop(1, 'rgba(0, 150, 255, 0)');
        
        gameCtx.fillStyle = 'rgba(0, 150, 255, 0.3)';
        gameCtx.beginPath();
        gameCtx.ellipse(0, 0, laser.length / 2, laser.width * 2, 0, 0, Math.PI * 2);
        gameCtx.fill();
        
        gameCtx.fillStyle = gradient;
        gameCtx.beginPath();
        gameCtx.ellipse(0, 0, laser.length / 2, laser.width, 0, 0, Math.PI * 2);
        gameCtx.fill();
        
        gameCtx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        gameCtx.lineWidth = 2;
        gameCtx.beginPath();
        gameCtx.moveTo(-laser.length / 2 + 10, 0);
        gameCtx.lineTo(laser.length / 2 - 5, 0);
        gameCtx.stroke();
        
        gameCtx.restore();
    });
}

function createLaserHitEffect(x, y) {
    const effectDiv = document.createElement('div');
    effectDiv.className = 'laser-hit-effect';
    effectDiv.style.left = `${x}px`;
    effectDiv.style.top = `${y}px`;
    effectDiv.innerHTML = '💥';
    document.body.appendChild(effectDiv);
    setTimeout(() => effectDiv.remove(), 400);
}

function showModeSwitchEffect(isIronManMode) {
    const effectDiv = document.createElement('div');
    effectDiv.className = 'mode-switch-effect';
    effectDiv.innerHTML = isIronManMode 
        ? '<div class="mode-text iron-man">🦾 钢铁侠模式</div>' 
        : '<div class="mode-text spider-man">🕷️ 蜘蛛侠模式</div>';
    document.body.appendChild(effectDiv);
    setTimeout(() => effectDiv.remove(), 1500);
}

// ========== 怪物系统 ==========
function spawnMonster() {
    if (!gameState.isPlaying) return;
    if (gameState.monsters.length >= CONFIG.maxMonsters) return;
    
    const isBomb = Math.random() < CONFIG.bombRate;
    const type = isBomb ? BOMB_TYPE : MONSTER_TYPES[Math.floor(Math.random() * MONSTER_TYPES.length)];
    
    let x, y, targetX, targetY;
    const speed = CONFIG.monsterSpeed + Math.random() * 0.5;
    const fromLeft = Math.random() > 0.5;
    
    if (fromLeft) {
        x = -type.size;
        y = 100 + Math.random() * (canvasHeight - 200);
        targetX = canvasWidth + type.size + 200;
        targetY = 100 + Math.random() * (canvasHeight - 200);
    } else {
        x = canvasWidth + type.size;
        y = 100 + Math.random() * (canvasHeight - 200);
        targetX = -type.size - 200;
        targetY = 100 + Math.random() * (canvasHeight - 200);
    }
    
    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const vx = (dx / dist) * speed;
    const vy = (dy / dist) * speed;
    
    gameState.monsters.push({
        ...type,
        id: Date.now() + Math.random(),
        x, y, vx, vy,
        rotation: 0,
        rotationSpeed: (Math.random() - 0.5) * 0.05,
        hit: false
    });
}

function updateMonsters(deltaTime) {
    const speedFactor = deltaTime * 60;
    
    for (let i = gameState.monsters.length - 1; i >= 0; i--) {
        const monster = gameState.monsters[i];
        
        monster.x += monster.vx * speedFactor;
        monster.y += monster.vy * speedFactor;
        monster.rotation += monster.rotationSpeed * speedFactor;
        
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

function hitMonster(monster, index) {
    if (monster.isBomb) {
        gameState.bombHits++;
        createBombEffect(monster.x, monster.y);
        gameState.monsters.splice(index, 1);
        updateBombDisplay();
        
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
    checkLandmarkProgress();
}

function createBombEffect(x, y) {
    const bombDiv = document.createElement('div');
    bombDiv.className = 'bomb-effect';
    bombDiv.style.left = `${x}px`;
    bombDiv.style.top = `${y}px`;
    bombDiv.innerHTML = '💥';
    document.body.appendChild(bombDiv);
    setTimeout(() => bombDiv.remove(), 800);
}

function createHitEffect(x, y) {
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
    setTimeout(() => elements.comboDisplay.classList.add('hidden'), 500);
}

function updateBombDisplay() {
    const bombDisplay = document.getElementById('bomb-display');
    if (bombDisplay) {
        const hearts = bombDisplay.querySelectorAll('.bomb-heart');
        if (hearts[gameState.bombHits - 1]) {
            hearts[gameState.bombHits - 1].classList.add('lost');
        }
    }
}

function resetBombDisplay() {
    const bombDisplay = document.getElementById('bomb-display');
    if (bombDisplay) {
        const hearts = bombDisplay.querySelectorAll('.bomb-heart');
        hearts.forEach(heart => heart.classList.remove('lost'));
    }
}

// ========== 游戏循环 ==========
function startGameLoop() {
    lastFrameTime = performance.now();
    
    function gameLoop(currentTime) {
        if (!gameState.isPlaying) {
            gameLoopId = null;
            return;
        }
        
        const deltaTime = Math.min((currentTime - lastFrameTime) / 1000, 0.1);
        lastFrameTime = currentTime;
        
        gameCtx.clearRect(0, 0, canvasWidth, canvasHeight);
        
        updateMonsters(deltaTime);
        updateWebEffects();
        updateLasers(deltaTime);
        
        drawMonsters();
        drawWebEffects();
        drawLasers();
        
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

function updateScoreDisplay() {
    elements.scoreDisplay.textContent = gameState.score;
}

function updateTimeDisplay() {
    elements.timeDisplay.textContent = gameState.timeLeft;
}

// ========== 游戏结束 ==========
function endGame() {
    gameState.isPlaying = false;
    
    if (handWatchdogInterval) {
        clearInterval(handWatchdogInterval);
        handWatchdogInterval = null;
    }
    
    gameState.totalScore += gameState.score;
    
    if (gameState.score > gameState.highScore) {
        gameState.highScore = gameState.score;
        localStorage.setItem('spiderHighScore', gameState.highScore);
    }
    
    calculateStars();
    
    elements.finalScore.textContent = gameState.score;
    elements.highScoreDisplay.textContent = gameState.highScore;
    
    updateStarsDisplay();
    updateGameOverReason();
    updateCityCompleteInfo();
    generateLeaderboard();
    
    elements.restartBtn.textContent = '探索下一个城市';
    
    elements.gameScreen.classList.add('hidden');
    elements.endScreen.classList.remove('hidden');
}

function calculateStars() {
    const score = gameState.score;
    
    if (score >= STAR_THRESHOLDS.star3) {
        gameState.stars = 3;
    } else if (score >= STAR_THRESHOLDS.star2) {
        gameState.stars = 2;
    } else if (score >= STAR_THRESHOLDS.star1) {
        gameState.stars = 1;
    } else {
        gameState.stars = 0;
    }
}

function updateStarsDisplay() {
    const starsContainer = document.getElementById('stars-display');
    if (starsContainer) {
        let starsHTML = '';
        for (let i = 1; i <= 3; i++) {
            if (i <= gameState.stars) {
                starsHTML += '<span class="star filled">⭐</span>';
            } else {
                starsHTML += '<span class="star empty">☆</span>';
            }
        }
        starsContainer.innerHTML = starsHTML;
        
        const reqDisplay = document.getElementById('score-requirements');
        if (reqDisplay) {
            reqDisplay.innerHTML = `
                <span class="req ${gameState.score >= STAR_THRESHOLDS.star1 ? 'achieved' : ''}">1★: ${STAR_THRESHOLDS.star1}</span>
                <span class="req ${gameState.score >= STAR_THRESHOLDS.star2 ? 'achieved' : ''}">2★: ${STAR_THRESHOLDS.star2}</span>
                <span class="req ${gameState.score >= STAR_THRESHOLDS.star3 ? 'achieved' : ''}">3★: ${STAR_THRESHOLDS.star3}</span>
            `;
        }
    }
}

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

function updateCityCompleteInfo() {
    const cityNameEl = document.getElementById('completed-city-name');
    const cityCountEl = document.getElementById('city-count');
    
    if (cityNameEl && dynamicCityData) {
        cityNameEl.textContent = dynamicCityData.name;
    }
    if (cityCountEl) {
        cityCountEl.textContent = `已完成 ${gameState.cityCount} 个城市`;
    }
}

function generateLeaderboard() {
    const leaderboardContainer = document.getElementById('leaderboard');
    if (!leaderboardContainer) return;
    
    const baseScore = STAR_THRESHOLDS.star1;
    const maxScore = STAR_THRESHOLDS.star3 * 1.3;
    
    const fakeScores = FAKE_LEADERBOARD.map(player => ({
        name: player.name,
        score: Math.floor(baseScore + Math.random() * (maxScore - baseScore))
    }));
    
    fakeScores.push({ name: '🎮 你', score: gameState.score, isPlayer: true });
    fakeScores.sort((a, b) => b.score - a.score);
    
    const top8 = fakeScores.slice(0, 8);
    
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
        
        if (timeSinceLastUpdate > 2000 && hands) {
            watchdogRetryCount++;
            console.warn(`MediaPipe无响应，尝试重启 (${watchdogRetryCount})...`);
            
            if (watchdogRetryCount <= 3) {
                elements.gestureText.textContent = `重新连接中...(${watchdogRetryCount}/3)`;
                lastHandUpdateTime = Date.now();
            } else {
                elements.gestureText.textContent = '请刷新页面重试';
                clearInterval(handWatchdogInterval);
                handWatchdogInterval = null;
            }
        } else if (timeSinceLastUpdate < 1000) {
            watchdogRetryCount = 0;
        }
    }, 1500);
}

// ========== 启动游戏 ==========
init();
