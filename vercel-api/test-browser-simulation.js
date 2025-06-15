// Simulate Browser Extension Behavior - Rapid Requests
const API_URL = 'https://plugin-api-4m2r.onrender.com/api/validate-key';

async function simulateExtensionBehavior() {
    console.log('🔍 Simulating Extension Behavior - Rapid Key Validation\n');
    
    const testKey = 'e534c24e'; // From your logs
    
    console.log('Scenario 1: Multiple rapid requests (like extension might do)');
    console.log('Making 5 rapid requests with same key...\n');
    
    // Make multiple rapid requests like the extension might
    const promises = [];
    for (let i = 1; i <= 5; i++) {
        promises.push(
            fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                body: JSON.stringify({ 
                    key: testKey,
                    action: 'validate'
                })
            }).then(async response => {
                const text = await response.text();
                return {
                    request: i,
                    status: response.status,
                    statusText: response.statusText,
                    body: text,
                    timestamp: new Date().toISOString()
                };
            }).catch(error => ({
                request: i,
                error: error.message,
                timestamp: new Date().toISOString()
            }))
        );
    }
    
    try {
        const results = await Promise.all(promises);
        
        results.forEach(result => {
            console.log(`Request ${result.request}:`);
            if (result.error) {
                console.log(`  ❌ Error: ${result.error}`);
            } else {
                console.log(`  Status: ${result.status} ${result.statusText}`);
                console.log(`  Body: ${result.body}`);
            }
            console.log(`  Time: ${result.timestamp}`);
            console.log('');
        });
        
        // Check for 500 errors
        const errors500 = results.filter(r => r.status === 500);
        const rateLimited = results.filter(r => r.status === 429);
        
        console.log('📊 Results Summary:');
        console.log(`  500 Errors: ${errors500.length}`);
        console.log(`  Rate Limited (429): ${rateLimited.length}`);
        console.log(`  Successful: ${results.filter(r => r.status === 200).length}`);
        
        if (errors500.length > 0) {
            console.log('\n❌ Found 500 errors! This matches your issue.');
            console.log('500 Error Details:');
            errors500.forEach(err => {
                console.log(`  Request ${err.request}: ${err.body}`);
            });
        }
        
    } catch (error) {
        console.error('Test failed:', error);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('Scenario 2: Testing after cooldown period...\n');
    
    // Wait a bit and try again
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ 
                key: testKey,
                action: 'validate'
            })
        });
        
        const text = await response.text();
        console.log(`After cooldown - Status: ${response.status}`);
        console.log(`Response: ${text}`);
        
    } catch (error) {
        console.error('Cooldown test failed:', error.message);
    }
}

simulateExtensionBehavior(); 