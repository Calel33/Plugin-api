// Debug Rate Limiting - Check IP Detection and Logic
const API_URL = 'https://plugin-api-4m2r.onrender.com/api/validate-key';

async function debugRateLimit() {
    console.log('🔍 Debugging Rate Limiting Implementation\n');
    
    // Test 1: Check what IP is being detected
    console.log('Test 1: Checking IP Detection');
    console.log('Making a request to see server logs...\n');
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Debug': 'true'
            },
            body: JSON.stringify({
                key: 'debug-test-key',
                action: 'validate'
            })
        });
        
        const result = await response.json();
        console.log('Response:', result);
        console.log('Status:', response.status);
        console.log('Headers:', Object.fromEntries(response.headers.entries()));
        
    } catch (error) {
        console.error('Error:', error);
    }
    
    console.log('\n' + '-'.repeat(50) + '\n');
    
    // Test 2: Make rapid requests with explicit IP headers
    console.log('Test 2: Rapid Requests with Explicit IP Headers');
    
    const testIP = '192.168.1.100';
    
    for (let i = 1; i <= 5; i++) {
        console.log(`Making request ${i} with IP: ${testIP}`);
        
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Forwarded-For': testIP,
                    'X-Real-IP': testIP
                },
                body: JSON.stringify({
                    key: `debug-test-key-${i}`,
                    action: 'validate'
                })
            });
            
            const result = await response.json();
            
            console.log(`  Status: ${response.status}`);
            console.log(`  Rate Limited: ${result.rateLimited || false}`);
            console.log(`  Message: ${result.message}`);
            
            if (result.rateLimited) {
                console.log(`  Retry After: ${result.retryAfter} seconds`);
            }
            
            console.log('');
            
            // Small delay
            await new Promise(resolve => setTimeout(resolve, 100));
            
        } catch (error) {
            console.error(`Request ${i} failed:`, error.message);
        }
    }
    
    console.log('\n' + '-'.repeat(50) + '\n');
    
    // Test 3: Check if the server is actually running our code
    console.log('Test 3: Checking Server Response Format');
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                key: 'test-response-format',
                action: 'validate'
            })
        });
        
        const result = await response.json();
        
        console.log('Full Response Object:');
        console.log(JSON.stringify(result, null, 2));
        
        console.log('\nResponse Headers:');
        for (const [key, value] of response.headers.entries()) {
            console.log(`  ${key}: ${value}`);
        }
        
    } catch (error) {
        console.error('Error checking response format:', error);
    }
}

debugRateLimit(); 