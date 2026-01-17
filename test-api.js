// 测试修复后的 Ark API
const https = require('https');

const ARK_API_KEY = 'eab1bb0c-9600-4342-9c6c-ca813cb6aef0';

console.log('========== 测试 Ark 图片生成API (豆包即梦) ==========\n');

const data = JSON.stringify({
    model: 'doubao-seedream-4-0-250828',
    prompt: 'Shanghai city at night, neon lights, cinematic, high quality, 上海外滩夜景',
    response_format: 'url',
    size: '1280x720',
    stream: false,
    watermark: false
});

console.log('请求参数:');
console.log('- Host: ark.cn-beijing.volces.com');
console.log('- Path: /api/v3/images/generations');
console.log('- Model: doubao-seedream-4-0-250828');
console.log('- Size: 1280x720');
console.log('');

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

console.log('发送请求...\n');

const req = https.request(options, (res) => {
    console.log('响应状态码:', res.statusCode);
    
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        console.log('\n========== 响应内容 ==========');
        try {
            const result = JSON.parse(body);
            console.log(JSON.stringify(result, null, 2));
            
            if (result.data && result.data[0] && result.data[0].url) {
                console.log('\n✅ API调用成功!');
                console.log('图片URL:', result.data[0].url);
            } else if (result.error) {
                console.log('\n❌ API错误:', result.error.message || JSON.stringify(result.error));
            } else {
                console.log('\n⚠️ 未知响应格式');
            }
        } catch (e) {
            console.log('原始响应:', body);
        }
    });
});

req.on('error', (e) => {
    console.log('❌ 请求失败:', e.message);
});

req.write(data);
req.end();
