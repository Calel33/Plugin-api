// Database Queries Module
// Contains all SQL queries for pro key validation and management

import { turso } from './connection.js';

/**
 * Find a pro key by its hash
 * @param {string} keyHash - The hashed pro key
 * @returns {Promise<Object|null>} - Pro key data or null if not found
 */
export async function findProKeyByHash(keyHash) {
    try {
        const result = await turso.execute({
            sql: `SELECT 
                    pk.id,
                    pk.key_hash,
                    pk.status,
                    pk.tier,
                    pk.expires_at,
                    pk.usage_count,
                    pk.last_used,
                    pk.notes,
                    c.name as customer_name,
                    c.email as customer_email
                  FROM pro_keys pk
                  LEFT JOIN customers c ON c.pro_key_id = pk.id
                  WHERE pk.key_hash = ?`,
            args: [keyHash]
        });

        return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
        console.error('Error finding pro key:', error);
        throw error;
    }
}

/**
 * Update key usage count and last used timestamp
 * @param {number} keyId - The pro key ID
 * @param {string} ipAddress - Client IP address (optional)
 * @param {string} userAgent - Client user agent (optional)
 * @returns {Promise<boolean>} - Success status
 */
export async function updateKeyUsage(keyId, ipAddress = null, userAgent = null) {
    try {
        // Update the pro_keys table
        await turso.execute({
            sql: `UPDATE pro_keys 
                  SET usage_count = usage_count + 1, 
                      last_used = datetime('now'),
                      updated_at = datetime('now')
                  WHERE id = ?`,
            args: [keyId]
        });

        // Log the usage in key_usage table
        await turso.execute({
            sql: `INSERT INTO key_usage (pro_key_id, ip_address, user_agent, action)
                  VALUES (?, ?, ?, 'validate')`,
            args: [keyId, ipAddress, userAgent]
        });

        return true;
    } catch (error) {
        console.error('Error updating key usage:', error);
        throw error;
    }
}

/**
 * Get usage statistics for a pro key
 * @param {number} keyId - The pro key ID
 * @param {number} days - Number of days to look back (default: 30)
 * @returns {Promise<Object>} - Usage statistics
 */
export async function getKeyUsageStats(keyId, days = 30) {
    try {
        const result = await turso.execute({
            sql: `SELECT 
                    COUNT(*) as total_uses,
                    COUNT(DISTINCT DATE(used_at)) as active_days,
                    MIN(used_at) as first_use,
                    MAX(used_at) as last_use
                  FROM key_usage 
                  WHERE pro_key_id = ? 
                    AND used_at >= datetime('now', '-' || ? || ' days')`,
            args: [keyId, days]
        });

        return result.rows[0] || {
            total_uses: 0,
            active_days: 0,
            first_use: null,
            last_use: null
        };
    } catch (error) {
        console.error('Error getting usage stats:', error);
        throw error;
    }
}

/**
 * Get all active pro keys (for admin purposes)
 * @returns {Promise<Array>} - List of active pro keys
 */
export async function getAllActiveKeys() {
    try {
        const result = await turso.execute({
            sql: `SELECT 
                    pk.id,
                    pk.key_hash,
                    pk.status,
                    pk.tier,
                    pk.expires_at,
                    pk.usage_count,
                    pk.last_used,
                    pk.notes,
                    c.name as customer_name,
                    c.email as customer_email,
                    pk.created_at
                  FROM pro_keys pk
                  LEFT JOIN customers c ON c.pro_key_id = pk.id
                  WHERE pk.status = 'active'
                  ORDER BY pk.created_at DESC`
        });

        return result.rows;
    } catch (error) {
        console.error('Error getting active keys:', error);
        throw error;
    }
}

/**
 * Check database health
 * @returns {Promise<Object>} - Database health status
 */
export async function checkDatabaseHealth() {
    try {
        const [keysCount, customersCount, usageCount] = await Promise.all([
            turso.execute('SELECT COUNT(*) as count FROM pro_keys'),
            turso.execute('SELECT COUNT(*) as count FROM customers'),
            turso.execute('SELECT COUNT(*) as count FROM key_usage WHERE used_at >= datetime("now", "-24 hours")')
        ]);

        return {
            status: 'healthy',
            total_keys: keysCount.rows[0].count,
            total_customers: customersCount.rows[0].count,
            usage_last_24h: usageCount.rows[0].count,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('Database health check failed:', error);
        return {
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
} 