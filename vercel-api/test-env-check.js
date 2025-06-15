// Test Environment Variables on Deployed Server
const API_URL = 'https://plugin-api-4m2r.onrender.com';

async function testEnvironmentVariables() {
    console.log('🔍 Testing Environment Variables on Deployed Server\n');
    
    // Test if we can create a simple endpoint to check env vars
    console.log('Testing basic API connectivity...');
    
    try {
        // Test the health endpoint if it exists
        const healthResponse = await fetch(`${API_URL}/health`);
        console.log(`Health endpoint status: ${healthResponse.status}`);
        
        if (healthResponse.ok) {
            const healthData = await healthResponse.text();
            console.log('Health response:', healthData);
        }
    } catch (error) {
        console.log('Health endpoint not available:', error.message);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('Testing validate-key endpoint with detailed error info...\n');
    
    try {
        const response = await fetch(`${API_URL}/api/validate-key`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ 
                key: 'test-env-check',
                action: 'validate'
            })
        });
        
        console.log(`Status: ${response.status} ${response.statusText}`);
        
        // Get all response headers
        console.log('\nResponse Headers:');
        for (const [key, value] of response.headers.entries()) {
            console.log(`  ${key}: ${value}`);
        }
        
        // Get response body
        const responseText = await response.text();
        console.log('\nResponse Body:');
        console.log(responseText);
        
        // If it's a 500 error, the server logs might show the real issue
        if (response.status === 500) {
            console.log('\n❌ 500 Error detected!');
            console.log('This is likely due to missing environment variables on Render.');
            console.log('Check your Render dashboard for TURSO_DATABASE_URL and TURSO_AUTH_TOKEN');
        }
        
    } catch (error) {
        console.error('Request failed:', error.message);
    }
}

testEnvironmentVariables(); 