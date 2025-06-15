// Clean Rate Limiting Test - With Proper Window Resets
const API_URL = 'https://plugin-api-4m2r.onrender.com/api/validate-key';

async function makeRequest(testKey, customHeaders = {}) {
    const startTime = Date.now();
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...customHeaders
            },
            body: JSON.stringify({
                key: testKey,
                action: 'validate'
            })
        });
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        const result = await response.json();
        
        return {
            status: response.status,
            responseTime,
            rateLimited: result.rateLimited || false,
            message: result.message,
            retryAfter: result.retryAfter,
            success: result.success
        };
    } catch (error) {
        return {
            error: error.message
        };
    }
}

async function testRateLimitingClean() {
    console.log('🧪 Clean Rate Limiting Test\n');
    
    // Wait 15 seconds to ensure clean slate
    console.log('⏳ Waiting 15 seconds to ensure clean rate limit state...\n');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    console.log('🚀 Test 1: Rapid Requests (Should trigger rate limiting)');
    
    const results = [];
    
    for (let i = 1; i <= 5; i++) {
        console.log(`Making request ${i}...`);
        const result = await makeRequest(`test-clean-${i}`);
        results.push(result);
        
        console.log(`  Status: ${result.status}`);
        console.log(`  Rate Limited: ${result.rateLimited}`);
        console.log(`  Message: ${result.message}`);
        
        if (result.rateLimited) {
            console.log(`  ⏰ Retry After: ${result.retryAfter} seconds`);
        }
        
        console.log('');
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Analyze results
    const rateLimitedCount = results.filter(r => r.rateLimited).length;
    const successfulCount = results.filter(r => r.status === 200 && !r.rateLimited).length;
    const errorCount = results.filter(r => r.status === 500).length;
    
    console.log('📊 Results Summary:');
    console.log(`  Total Requests: ${results.length}`);
    console.log(`  Successful: ${successfulCount}`);
    console.log(`  Rate Limited: ${rateLimitedCount}`);
    console.log(`  Server Errors: ${errorCount}`);
    console.log('');
    
    // Test with different IP after window reset
    console.log('⏳ Waiting 12 seconds for rate limit window to reset...\n');
    await new Promise(resolve => setTimeout(resolve, 12000));
    
    console.log('🚀 Test 2: After Window Reset (Should work again)');
    
    for (let i = 1; i <= 3; i++) {
        console.log(`Making request ${i} after reset...`);
        const result = await makeRequest(`test-reset-${i}`);
        
        console.log(`  Status: ${result.status}`);
        console.log(`  Rate Limited: ${result.rateLimited}`);
        console.log(`  Message: ${result.message}`);
        console.log('');
        
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('✅ Rate Limiting Test Complete!');
    console.log('\n🎯 Expected Behavior:');
    console.log('- First 3 requests should succeed');
    console.log('- Requests 4-5 should be rate limited (429 status)');
    console.log('- After window reset, requests should work again');
}

testRateLimitingClean(); 