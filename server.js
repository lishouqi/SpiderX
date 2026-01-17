// ========== 蜘蛛侠捕怪大作战 - 融合版后端 ==========
const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = process.env.PORT || 3001;

// ========== API配置 ==========
// 请在此处填写您的API密钥
const ARK_API_KEY = process.env.ARK_API_KEY || 'eab1bb0c-9600-4342-9c6c-ca813cb6aef0';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'ms-d1685822-5f2b-42e3-8251-582399ad694c';

// ========== LLM城市池 ==========
const CITY_TEMPLATES = ['巴黎', '迪拜', '悉尼', '莫斯科', '开罗', '里约', '新加坡', '首尔', '曼谷', '阿姆斯特丹', '罗马', '柏林', '马德里', '维也纳', '布拉格'];

// ========== 城市图片Prompt模板 ==========
const CITY_PROMPTS = {
    'shanghai': '上海外滩夜景，黄浦江，东方明珠，霓虹闪烁，迷雾弥漫，悬疑氛围',
    'tokyo': '东京涩谷十字路口夜景，霓虹招牌，赛博朋克风格，数码故障效果',
    'london': '伦敦塔桥夜景，维多利亚风格，浓雾，哥特式建筑剪影，暗黑童话',
    'newyork': '纽约时代广场夜景，摩天大楼，科幻电影风格，UFO悬浮',
    'venice': '威尼斯大运河黄昏，贡多拉，神秘雾气，克苏鲁氛围',
    'hongkong': '香港旺角霓虹招牌，密集灯牌，诡异红光，港式恐怖风格'
};

// ========== MIME类型 ==========
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// ========== LLM生成城市内容 ==========
async function generateCityContent(usedCities = []) {
    const availableCities = CITY_TEMPLATES.filter(c => !usedCities.includes(c));
    const selectedCity = availableCities.length > 0 
        ? availableCities[Math.floor(Math.random() * availableCities.length)]
        : CITY_TEMPLATES[Math.floor(Math.random() * CITY_TEMPLATES.length)];
    
    const systemPrompt = `你是一个创意游戏文案作家，专门为蜘蛛侠主题游戏设计城市关卡内容。
请为指定城市生成游戏内容，包括：
1. 城市名称和主题（格式："城市名 · 主题名"，如"巴黎 · 暗影舞者"）
2. 一段简短的故事背景（50-80字，描述该城市遇到的怪物威胁）
3. 三个地标关卡，每个包含：
   - 地标名称（富有创意的中文名，如"铁塔幻影"）
   - 分数阈值（0, 1000, 2000）
   - 背景图生成提示词（英文，描述该地标的视觉场景，包含氛围和风格）`;

    const userPrompt = `请为城市"${selectedCity}"生成游戏内容。
请严格按照以下JSON格式返回，不要添加任何其他文字：
{
  "name": "城市名 · 主题名",
  "story": "故事背景文字...",
  "landmarks": [
    {"name": "地标1名称", "scoreThreshold": 0, "prompt": "English prompt for landmark 1 scene..."},
    {"name": "地标2名称", "scoreThreshold": 1000, "prompt": "English prompt for landmark 2 scene..."},
    {"name": "地标3名称", "scoreThreshold": 2000, "prompt": "English prompt for landmark 3 scene..."}
  ]
}`;

    try {
        const response = await callDeepSeekAPI(systemPrompt, userPrompt);
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const cityData = JSON.parse(jsonMatch[0]);
            console.log(`[LLM] 城市生成成功: ${cityData.name}`);
            return cityData;
        }
        throw new Error('无法解析LLM返回的JSON');
    } catch (error) {
        console.error('[LLM] 生成失败:', error.message);
        // 返回备用数据
        return {
            name: `${selectedCity} · 神秘冒险`,
            story: `${selectedCity}的街道上突然出现了神秘的暗影生物，它们正在吞噬城市的光芒。作为蜘蛛侠，你必须在这座城市中穿梭，击退这些入侵者！`,
            landmarks: [
                { name: '迷雾街区', scoreThreshold: 0, prompt: `${selectedCity} street at night, mysterious fog, neon lights, cinematic atmosphere` },
                { name: '暗影广场', scoreThreshold: 1000, prompt: `${selectedCity} famous landmark at dusk, dramatic lighting, superhero movie style` },
                { name: '决战之巅', scoreThreshold: 2000, prompt: `${selectedCity} skyline at night, epic battle scene, lightning, dramatic clouds` }
            ]
        };
    }
}

// ========== 调用DeepSeek API ==========
function callDeepSeekAPI(systemPrompt, userPrompt) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.8,
            max_tokens: 1000
        });

        const options = {
            hostname: 'api.deepseek.com',
            port: 443,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(body);
                    if (result.choices && result.choices[0]) {
                        resolve(result.choices[0].message.content);
                    } else {
                        reject(new Error('Invalid API response'));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

// ========== 调用火山引擎 Ark 图片生成API (豆包即梦) ==========
function generateImage(prompt) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            model: 'doubao-seedream-4-0-250828',
            prompt: prompt + ', high quality, 4k, cinematic lighting, game art style, 电影大片感',
            response_format: 'url',
            size: '1280x720',
            stream: false,
            watermark: false
        });

        const options = {
            hostname: 'ark.cn-beijing.volces.com',
            port: 443,
            path: '/api/v3/images/generations',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ARK_API_KEY}`
            }
        };

        console.log('[Image] 发送请求到 Ark API...');
        
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(body);
                    console.log('[Image] API响应:', JSON.stringify(result).substring(0, 200));
                    
                    if (result.data && result.data[0] && result.data[0].url) {
                        console.log('[Image] ✓ 获取图片成功');
                        resolve(result.data[0].url);
                    } else if (result.data && result.data[0] && result.data[0].b64_json) {
                        console.log('[Image] ✓ 获取Base64图片成功');
                        resolve(`data:image/png;base64,${result.data[0].b64_json}`);
                    } else if (result.error) {
                        console.error('[Image] API错误:', result.error.message || result.error);
                        resolve(getFallbackImage(prompt));
                    } else {
                        console.warn('[Image] API未返回图片，使用备用');
                        resolve(getFallbackImage(prompt));
                    }
                } catch (e) {
                    console.error('[Image] 解析失败:', e.message);
                    console.error('[Image] 原始响应:', body.substring(0, 500));
                    resolve(getFallbackImage(prompt));
                }
            });
        });

        req.on('error', (e) => {
            console.error('[Image] 请求失败:', e.message);
            resolve(getFallbackImage(prompt));
        });

        req.write(data);
        req.end();
    });
}

// ========== 备用图片（渐变色背景） ==========
function getFallbackImage(prompt) {
    // 根据prompt生成不同的渐变色
    const colors = [
        ['#1a1a2e', '#16213e', '#0f3460'],
        ['#2d132c', '#801336', '#c72c41'],
        ['#1b262c', '#0f4c75', '#3282b8'],
        ['#1a1a2e', '#4a1942', '#6a2c70'],
        ['#0a192f', '#172a45', '#203a43']
    ];
    const colorSet = colors[Math.floor(Math.random() * colors.length)];
    
    // 创建SVG渐变背景
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
    </svg>`;
    
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

// ========== HTTP请求处理 ==========
const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    
    // API路由
    if (url.pathname === '/api/generate-image' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { prompt } = JSON.parse(body);
                console.log(`[API] 生成图片: ${prompt.substring(0, 50)}...`);
                const imageUrl = await generateImage(prompt);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, url: imageUrl }));
            } catch (error) {
                console.error('[API] 图片生成错误:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }
    
    if (url.pathname === '/api/generate-city' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { usedCities } = JSON.parse(body);
                console.log(`[API] 生成城市，已使用: ${usedCities}`);
                const cityData = await generateCityContent(usedCities || []);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, data: cityData }));
            } catch (error) {
                console.error('[API] 城市生成错误:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
        return;
    }
    
    if (url.pathname === '/api/cities' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ cities: Object.keys(CITY_PROMPTS) }));
        return;
    }
    
    // 静态文件服务
    let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
    filePath = path.join(__dirname, filePath);
    
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    
    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

server.listen(PORT, () => {
    console.log('');
    console.log('========================================');
    console.log('  蜘蛛侠捕怪大作战 - 融合版');
    console.log('========================================');
    console.log(`  服务已启动: http://localhost:${PORT}`);
    console.log('');
    console.log('  功能特性:');
    console.log('  ✓ AI城市故事生成 (LLM)');
    console.log('  ✓ AI背景图生成');
    console.log('  ✓ 蜘蛛侠模式 + 钢铁侠模式');
    console.log('  ✓ 炸弹惩罚系统');
    console.log('  ✓ 星级评分 + 排行榜');
    console.log('');
    console.log('  请在浏览器中打开上述地址');
    console.log('========================================');
    console.log('');
});
