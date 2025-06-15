// Test Database Connection and Queries
import { validateKey, logKeyUsage, checkDatabaseHealth } from './db/queries.js';

async function testDatabaseConnection() {
    console.log('🔍 Testing Database Connection and Queries\n');
    
    try {
        // Test 1: Database health check
        console.log('Test 1: Database Health Check');
        const health = await checkDatabaseHealth();
        console.log('Health Status:', health);
        console.log('');
        
        // Test 2: Test validateKey function with a test key
        console.log('Test 2: Testing validateKey function');
        const testKey = 'e534c24e';
        console.log(`Testing key: ${testKey}`);
        
        const result = await validateKey(testKey);
        console.log('Validation Result:', result);
        console.log('');
        
        // Test 3: Test with another key
        console.log('Test 3: Testing with another key');
        const testKey2 = '582fb1a9';
        console.log(`Testing key: ${testKey2}`);
        
        const result2 = await validateKey(testKey2);
        console.log('Validation Result:', result2);
        console.log('');
        
        // Test 4: Test logKeyUsage (only if we have a valid key)
        if (result.isValid) {
            console.log('Test 4: Testing logKeyUsage');
            try {
                const logResult = await logKeyUsage(
                    result.keyData.id,
                    '192.168.1.100',
                    'Test User Agent',
                    'validate'
                );
                console.log('Log Result:', logResult);
            } catch (logError) {
                console.error('❌ logKeyUsage failed:', logError.message);
            }
        } else {
            console.log('Test 4: Skipping logKeyUsage (no valid key)');
        }
        
        console.log('\n✅ Database tests completed successfully');
        
    } catch (error) {
        console.error('❌ Database test failed:', error);
        console.error('Error details:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

testDatabaseConnection(); 