// Investigate unusual usage patterns
import { turso } from './db/connection.js';

async function investigateUsagePattern() {
    try {
        console.log('🔍 INVESTIGATING UNUSUAL USAGE PATTERNS\n');
        
        // 1. Check recent usage activity
        console.log('📊 Recent API calls (last 24 hours):');
        const recentUsage = await turso.execute(`
            SELECT 
                ku.used_at,
                ku.ip_address,
                ku.user_agent,
                ku.action,
                pk.notes
            FROM key_usage ku
            JOIN pro_keys pk ON ku.pro_key_id = pk.id
            WHERE ku.used_at >= datetime('now', '-1 day')
            ORDER BY ku.used_at DESC
            LIMIT 20
        `);
        
        if (recentUsage.rows.length > 0) {
            recentUsage.rows.forEach((row, index) => {
                console.log(`${index + 1}. ${row.used_at} | IP: ${row.ip_address} | Action: ${row.action}`);
                console.log(`   User Agent: ${row.user_agent?.substring(0, 80)}...`);
                console.log(`   Key: ${row.notes?.substring(0, 30)}...\n`);
            });
        } else {
            console.log('No recent usage found');
        }
        
        // 2. Check for rapid-fire calls (same IP, short time span)
        console.log('⚡ Checking for rapid-fire API calls:');
        const rapidCalls = await turso.execute(`
            SELECT 
                ip_address,
                COUNT(*) as call_count,
                MIN(used_at) as first_call,
                MAX(used_at) as last_call,
                (julianday(MAX(used_at)) - julianday(MIN(used_at))) * 24 * 60 as minutes_span
            FROM key_usage 
            WHERE used_at >= datetime('now', '-1 hour')
            GROUP BY ip_address
            HAVING call_count > 1
            ORDER BY call_count DESC
        `);
        
        if (rapidCalls.rows.length > 0) {
            rapidCalls.rows.forEach(row => {
                console.log(`🚨 IP ${row.ip_address}: ${row.call_count} calls in ${row.minutes_span?.toFixed(2)} minutes`);
                console.log(`   From: ${row.first_call} To: ${row.last_call}`);
            });
        } else {
            console.log('✅ No rapid-fire calls detected');
        }
        
        // 3. Check current usage counts
        console.log('\n📈 Current usage counts by key:');
        const usageCounts = await turso.execute(`
            SELECT 
                pk.usage_count,
                pk.last_used,
                pk.notes,
                COUNT(ku.id) as actual_logged_calls
            FROM pro_keys pk
            LEFT JOIN key_usage ku ON pk.id = ku.pro_key_id
            GROUP BY pk.id, pk.usage_count, pk.last_used, pk.notes
            ORDER BY pk.usage_count DESC
        `);
        
        usageCounts.rows.forEach(row => {
            const mismatch = row.usage_count !== row.actual_logged_calls;
            console.log(`${mismatch ? '⚠️ ' : '✅ '} Usage Count: ${row.usage_count} | Logged Calls: ${row.actual_logged_calls} | ${row.notes?.substring(0, 30)}...`);
            if (mismatch) {
                console.log(`   🔍 MISMATCH DETECTED - Counter: ${row.usage_count}, Actual: ${row.actual_logged_calls}`);
            }
        });
        
        // 4. Check for duplicate calls in short timeframe
        console.log('\n🔄 Checking for duplicate calls (same key, within 5 seconds):');
        const duplicates = await turso.execute(`
            SELECT 
                ku1.used_at as call1_time,
                ku2.used_at as call2_time,
                ku1.ip_address,
                pk.notes,
                (julianday(ku2.used_at) - julianday(ku1.used_at)) * 24 * 60 * 60 as seconds_apart
            FROM key_usage ku1
            JOIN key_usage ku2 ON ku1.pro_key_id = ku2.pro_key_id 
                AND ku1.id < ku2.id
                AND (julianday(ku2.used_at) - julianday(ku1.used_at)) * 24 * 60 * 60 < 5
            JOIN pro_keys pk ON ku1.pro_key_id = pk.id
            WHERE ku1.used_at >= datetime('now', '-1 day')
            ORDER BY ku1.used_at DESC
        `);
        
        if (duplicates.rows.length > 0) {
            console.log('🚨 DUPLICATE CALLS FOUND:');
            duplicates.rows.forEach(row => {
                console.log(`   ${row.call1_time} → ${row.call2_time} (${row.seconds_apart?.toFixed(1)}s apart)`);
                console.log(`   IP: ${row.ip_address} | Key: ${row.notes?.substring(0, 30)}...`);
            });
        } else {
            console.log('✅ No duplicate calls found');
        }
        
    } catch (error) {
        console.error('❌ Error investigating usage:', error);
    }
}

investigateUsagePattern(); 