// Test rate limiting functionality
const API_URL = 'https://plugin-api-4m2r.onrender.com/api/validate-key';

async function testRateLimit() {
    console.log('🧪 Testing Rate Limiting Mechanism\n');
    
    const testKey = 'test-key-for-rate-limiting';
    
    console.log('📡 Making 5 rapid requests to test rate limiting...\n');
    
    for (let i = 1; i <= 5; i++) {
        try {
            const startTime = Date.now();
            
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    key: testKey,
                    action: 'validate'
                })
            });
            
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            const result = await response.json();
            
            console.log(`Request ${i}:`);
            console.log(`  Status: ${response.status}`);
            console.log(`  Response Time: ${responseTime}ms`);
            console.log(`  Rate Limited: ${result.rateLimited || false}`);
            console.log(`  Message: ${result.message}`);
            
            if (result.rateLimited) {
                console.log(`  ⏰ Retry After: ${result.retryAfter} seconds`);
            }
            
            console.log('');
            
            // Small delay between requests to see the pattern
            await new Promise(resolve => setTimeout(resolve, 100));
            
        } catch (error) {
            console.error(`Request ${i} failed:`, error.message);
        }
    }
    
    console.log('✅ Rate limiting test completed');
    console.log('Expected: First 3 requests should succeed, 4th and 5th should be rate limited');
}

testRateLimit(); 