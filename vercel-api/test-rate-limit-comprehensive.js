// Comprehensive Rate Limiting Test Suite
const API_URL = 'https://plugin-api-4m2r.onrender.com/api/validate-key';

class RateLimitTester {
    constructor() {
        this.testResults = [];
    }

    async makeRequest(testKey, requestNumber, customHeaders = {}) {
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
                requestNumber,
                status: response.status,
                responseTime,
                rateLimited: result.rateLimited || false,
                message: result.message,
                retryAfter: result.retryAfter,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                requestNumber,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async testRapidRequests() {
        console.log('🧪 Test 1: Rapid Requests from Same IP');
        console.log('Making 6 rapid requests with minimal delay...\n');
        
        const testKey = 'test-key-rapid-requests';
        const results = [];
        
        for (let i = 1; i <= 6; i++) {
            const result = await this.makeRequest(testKey, i);
            results.push(result);
            
            console.log(`Request ${i}:`);
            console.log(`  Status: ${result.status}`);
            console.log(`  Response Time: ${result.responseTime}ms`);
            console.log(`  Rate Limited: ${result.rateLimited}`);
            console.log(`  Message: ${result.message}`);
            
            if (result.rateLimited) {
                console.log(`  ⏰ Retry After: ${result.retryAfter} seconds`);
            }
            console.log('');
            
            // Very small delay to simulate rapid requests
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        this.testResults.push({
            testName: 'Rapid Requests',
            results,
            rateLimitedCount: results.filter(r => r.rateLimited).length
        });
        
        return results;
    }

    async testWithDelay() {
        console.log('🧪 Test 2: Requests with 2-second delays');
        console.log('Making 5 requests with 2-second delays...\n');
        
        const testKey = 'test-key-with-delay';
        const results = [];
        
        for (let i = 1; i <= 5; i++) {
            const result = await this.makeRequest(testKey, i);
            results.push(result);
            
            console.log(`Request ${i}:`);
            console.log(`  Status: ${result.status}`);
            console.log(`  Rate Limited: ${result.rateLimited}`);
            console.log(`  Message: ${result.message}`);
            console.log('');
            
            if (i < 5) {
                console.log('  ⏳ Waiting 2 seconds...\n');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        this.testResults.push({
            testName: 'Delayed Requests',
            results,
            rateLimitedCount: results.filter(r => r.rateLimited).length
        });
        
        return results;
    }

    async testDifferentIPs() {
        console.log('🧪 Test 3: Simulating Different IP Addresses');
        console.log('Making requests with different X-Forwarded-For headers...\n');
        
        const testKey = 'test-key-different-ips';
        const results = [];
        const fakeIPs = ['192.168.1.1', '10.0.0.1', '172.16.0.1', '203.0.113.1'];
        
        for (let i = 0; i < fakeIPs.length; i++) {
            const result = await this.makeRequest(testKey, i + 1, {
                'X-Forwarded-For': fakeIPs[i]
            });
            results.push(result);
            
            console.log(`Request ${i + 1} (IP: ${fakeIPs[i]}):`);
            console.log(`  Status: ${result.status}`);
            console.log(`  Rate Limited: ${result.rateLimited}`);
            console.log(`  Message: ${result.message}`);
            console.log('');
            
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        this.testResults.push({
            testName: 'Different IPs',
            results,
            rateLimitedCount: results.filter(r => r.rateLimited).length
        });
        
        return results;
    }

    async testWindowReset() {
        console.log('🧪 Test 4: Rate Limit Window Reset');
        console.log('Making 4 rapid requests, waiting 11 seconds, then 2 more...\n');
        
        const testKey = 'test-key-window-reset';
        const results = [];
        
        // First batch - should trigger rate limiting
        console.log('Phase 1: Making 4 rapid requests...');
        for (let i = 1; i <= 4; i++) {
            const result = await this.makeRequest(testKey, i);
            results.push(result);
            
            console.log(`Request ${i}: Rate Limited = ${result.rateLimited}`);
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        console.log('\n⏳ Waiting 11 seconds for rate limit window to reset...\n');
        await new Promise(resolve => setTimeout(resolve, 11000));
        
        // Second batch - should work again
        console.log('Phase 2: Making 2 more requests after window reset...');
        for (let i = 5; i <= 6; i++) {
            const result = await this.makeRequest(testKey, i);
            results.push(result);
            
            console.log(`Request ${i}: Rate Limited = ${result.rateLimited}`);
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        this.testResults.push({
            testName: 'Window Reset',
            results,
            rateLimitedCount: results.filter(r => r.rateLimited).length
        });
        
        return results;
    }

    printSummary() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 RATE LIMITING TEST SUMMARY');
        console.log('='.repeat(60));
        
        this.testResults.forEach(test => {
            console.log(`\n${test.testName}:`);
            console.log(`  Total Requests: ${test.results.length}`);
            console.log(`  Rate Limited: ${test.rateLimitedCount}`);
            console.log(`  Success Rate: ${((test.results.length - test.rateLimitedCount) / test.results.length * 100).toFixed(1)}%`);
        });
        
        console.log('\n' + '='.repeat(60));
        console.log('🎯 EXPECTED BEHAVIOR:');
        console.log('- Rapid Requests: Should have 3+ rate limited requests');
        console.log('- Delayed Requests: Should have 0 rate limited requests');
        console.log('- Different IPs: Should have 0 rate limited requests');
        console.log('- Window Reset: Should have rate limiting in phase 1, none in phase 2');
        console.log('='.repeat(60));
    }

    async runAllTests() {
        console.log('🚀 Starting Comprehensive Rate Limiting Tests\n');
        
        await this.testRapidRequests();
        console.log('\n' + '-'.repeat(50) + '\n');
        
        await this.testWithDelay();
        console.log('\n' + '-'.repeat(50) + '\n');
        
        await this.testDifferentIPs();
        console.log('\n' + '-'.repeat(50) + '\n');
        
        await this.testWindowReset();
        
        this.printSummary();
    }
}

// Run the tests
const tester = new RateLimitTester();
tester.runAllTests().catch(console.error); 