// Quick Rate Limiting Verification Test
const API_URL = 'https://plugin-api-4m2r.onrender.com/api/validate-key';

async function quickRateLimitTest() {
    console.log('⚡ Quick Rate Limiting Verification\n');
    
    // Use a unique IP to avoid interference from previous tests
    const testIP = `192.168.1.${Math.floor(Math.random() * 255)}`;
    console.log(`Using test IP: ${testIP}\n`);
    
    const results = [];
    
    for (let i = 1; i <= 6; i++) {
        console.log(`Request ${i}:`);
        
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Forwarded-For': testIP,
                    'X-Real-IP': testIP
                },
                body: JSON.stringify({
                    key: `quick-test-${i}`,
                    action: 'validate'
                })
            });
            
            const result = await response.json();
            results.push({
                request: i,
                status: response.status,
                rateLimited: result.rateLimited || false,
                message: result.message
            });
            
            console.log(`  Status: ${response.status}`);
            console.log(`  Rate Limited: ${result.rateLimited || false}`);
            console.log(`  Message: ${result.message}`);
            
            if (result.rateLimited) {
                console.log(`  ⏰ Retry After: ${result.retryAfter} seconds`);
            }
            
        } catch (error) {
            console.log(`  ❌ Error: ${error.message}`);
            results.push({
                request: i,
                error: error.message
            });
        }
        
        console.log('');
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Analysis
    const successful = results.filter(r => r.status === 200 && !r.rateLimited).length;
    const rateLimited = results.filter(r => r.rateLimited).length;
    const errors = results.filter(r => r.status === 500).length;
    
    console.log('📊 Quick Test Results:');
    console.log(`  Successful Requests: ${successful}`);
    console.log(`  Rate Limited Requests: ${rateLimited}`);
    console.log(`  Server Errors: ${errors}`);
    console.log('');
    
    if (rateLimited > 0) {
        console.log('✅ Rate Limiting is WORKING!');
        console.log(`   - First ${successful} requests succeeded`);
        console.log(`   - Next ${rateLimited} requests were rate limited`);
    } else if (errors > 0) {
        console.log('⚠️  Rate limiting present but server has errors');
    } else {
        console.log('❌ Rate limiting may not be working properly');
    }
    
    console.log('\n🎯 Expected: First 3 requests succeed, rest get rate limited (429)');
}

quickRateLimitTest(); 