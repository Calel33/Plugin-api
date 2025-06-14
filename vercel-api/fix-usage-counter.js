// Fix usage counter mismatch
import { turso } from './db/connection.js';

async function fixUsageCounters() {
    try {
        console.log('🔧 Fixing usage counter mismatches...\n');
        
        // Get all pro keys with their actual usage counts
        const result = await turso.execute(`
            SELECT 
                pk.id,
                pk.usage_count as stored_count,
                pk.notes,
                COUNT(ku.id) as actual_count
            FROM pro_keys pk
            LEFT JOIN key_usage ku ON pk.id = ku.pro_key_id
            GROUP BY pk.id, pk.usage_count, pk.notes
            ORDER BY pk.id
        `);
        
        console.log('📊 Current usage counter status:');
        let mismatches = 0;
        
        for (const row of result.rows) {
            const mismatch = row.stored_count !== row.actual_count;
            const status = mismatch ? '⚠️  MISMATCH' : '✅ OK';
            
            console.log(`${status} Key ID ${row.id}: Stored=${row.stored_count}, Actual=${row.actual_count} | ${row.notes?.substring(0, 30)}...`);
            
            if (mismatch) {
                mismatches++;
                
                // Fix the mismatch
                await turso.execute({
                    sql: 'UPDATE pro_keys SET usage_count = ? WHERE id = ?',
                    args: [row.actual_count, row.id]
                });
                
                console.log(`  🔧 Fixed: Updated stored count from ${row.stored_count} to ${row.actual_count}`);
            }
        }
        
        if (mismatches === 0) {
            console.log('\n✅ All usage counters are accurate!');
        } else {
            console.log(`\n🔧 Fixed ${mismatches} usage counter mismatch(es)`);
        }
        
        // Verify the fix
        console.log('\n🔍 Verification after fix:');
        const verifyResult = await turso.execute(`
            SELECT 
                pk.id,
                pk.usage_count as stored_count,
                COUNT(ku.id) as actual_count,
                pk.notes
            FROM pro_keys pk
            LEFT JOIN key_usage ku ON pk.id = ku.pro_key_id
            GROUP BY pk.id, pk.usage_count, pk.notes
            HAVING pk.usage_count != COUNT(ku.id)
            ORDER BY pk.id
        `);
        
        if (verifyResult.rows.length === 0) {
            console.log('✅ All counters are now synchronized!');
        } else {
            console.log('❌ Some mismatches still exist:');
            verifyResult.rows.forEach(row => {
                console.log(`  Key ID ${row.id}: Stored=${row.stored_count}, Actual=${row.actual_count}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error fixing usage counters:', error);
    }
}

fixUsageCounters(); 