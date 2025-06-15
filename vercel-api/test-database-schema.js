// Test Database Schema - Check what fields actually exist
import { turso } from './db/connection.js';

async function testDatabaseSchema() {
    console.log('🔍 Testing Database Schema\n');
    
    try {
        // Check pro_keys table schema
        console.log('1. Checking pro_keys table schema:');
        const schemaResult = await turso.execute("PRAGMA table_info(pro_keys)");
        
        console.log('pro_keys columns:');
        schemaResult.rows.forEach(row => {
            console.log(`  - ${row.name} (${row.type}) ${row.notnull ? 'NOT NULL' : ''} ${row.dflt_value ? `DEFAULT ${row.dflt_value}` : ''}`);
        });
        
        console.log('\n2. Checking if we have any actual data:');
        const dataResult = await turso.execute("SELECT * FROM pro_keys LIMIT 3");
        
        if (dataResult.rows.length > 0) {
            console.log('Sample data:');
            dataResult.rows.forEach((row, index) => {
                console.log(`Row ${index + 1}:`, row);
            });
        } else {
            console.log('No data found in pro_keys table');
        }
        
        console.log('\n3. Checking key_usage table:');
        const usageSchemaResult = await turso.execute("PRAGMA table_info(key_usage)");
        
        console.log('key_usage columns:');
        usageSchemaResult.rows.forEach(row => {
            console.log(`  - ${row.name} (${row.type}) ${row.notnull ? 'NOT NULL' : ''}`);
        });
        
        console.log('\n4. Checking customers table:');
        const customersSchemaResult = await turso.execute("PRAGMA table_info(customers)");
        
        console.log('customers columns:');
        customersSchemaResult.rows.forEach(row => {
            console.log(`  - ${row.name} (${row.type}) ${row.notnull ? 'NOT NULL' : ''}`);
        });
        
    } catch (error) {
        console.error('❌ Schema test failed:', error);
    }
}

testDatabaseSchema(); 