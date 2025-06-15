// Debug Real Key Validation - Test with actual key format
const API_URL = 'https://plugin-api-4m2r.onrender.com/api/validate-key';

async function testRealKeyValidation() {
    console.log('🔍 Testing Real Key Validation (like extension does)\n');
    
    // Test with the actual key format from your extension logs
    const testKey = 'e534c24e'; // From your error logs
    
    console.log(`Testing key: ${testKey}`);
    console.log('Making request exactly like the extension...\n');
    
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
        
        console.log(`Response Status: ${response.status}`);
        console.log(`Response Status Text: ${response.statusText}`);
        
        // Try to get response body even if it's an error
        let responseText;
        try {
            responseText = await response.text();
            console.log(`Raw Response: ${responseText}`);
            
            // Try to parse as JSON
            const result = JSON.parse(responseText);
            console.log('Parsed Response:', result);
            
        } catch (parseError) {
            console.log(`Response Text: ${responseText}`);
            console.log(`Parse Error: ${parseError.message}`);
        }
        
        // Check response headers for clues
        console.log('\nResponse Headers:');
        for (const [key, value] of response.headers.entries()) {
            console.log(`  ${key}: ${value}`);
        }
        
    } catch (error) {
        console.error('Request failed:', error);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('🔍 Testing with another key format...\n');
    
    // Test with another key from your logs
    const testKey2 = '582fb1a9';
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ 
                key: testKey2,
                action: 'validate'
            })
        });
        
        console.log(`Key ${testKey2} - Status: ${response.status}`);
        
        const responseText = await response.text();
        console.log(`Response: ${responseText}`);
        
    } catch (error) {
        console.error(`Key ${testKey2} failed:`, error.message);
    }
}

testRealKeyValidation(); 