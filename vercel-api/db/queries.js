// Database Queries Module
// Contains all SQL queries for pro key validation and management

import crypto from 'crypto';
import { turso } from './connection.js';

// Salt for hashing (should match your extension's salt)
const PRO_SALT = 'AgentHustle2024ProSalt!@#$%^&*()_+SecureKey';

/**
 * Hash a key using the same algorithm as the extension
 * @param {string} key - Plain text key
 * @param {string} salt - Salt for hashing
 * @returns {string} - Hashed key
 */
function hashKey(key, salt = PRO_SALT) {
    return crypto.createHash('sha256').update(key + salt).digest('hex');
}

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
            total_keys: Number(keysCount.rows[0].count),
            total_customers: Number(customersCount.rows[0].count),
            usage_last_24h: Number(usageCount.rows[0].count),
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

/**
 * Log key usage and update counter atomically
 * @param {number} proKeyId - Pro key ID
 * @param {string} ipAddress - Client IP address
 * @param {string} userAgent - User agent string
 * @param {string} action - Action performed
 * @returns {Promise<Object>} - Usage logging result
 */
export async function logKeyUsage(proKeyId, ipAddress, userAgent, action = 'validate') {
    try {
        // Use Turso's batch execution for atomicity instead of manual transactions
        const batch = [
            {
                sql: `INSERT INTO key_usage (pro_key_id, ip_address, user_agent, action, used_at) 
                      VALUES (?, ?, ?, ?, datetime('now'))`,
                args: [proKeyId, ipAddress, userAgent, action]
            },
            {
                sql: `UPDATE pro_keys 
                      SET usage_count = usage_count + 1, 
                          last_used = datetime('now') 
                      WHERE id = ?`,
                args: [proKeyId]
            }
        ];
        
        // Execute batch atomically
        const results = await turso.batch(batch);
        
        console.log(`📊 Usage logged: Key ID ${proKeyId}, Action: ${action}, IP: ${ipAddress.substring(0, 15)}...`);
        
        return {
            success: true,
            usageId: Number(results[0].lastInsertRowid),
            updated: results[1].rowsAffected > 0
        };
        
    } catch (error) {
        console.error('❌ Error logging key usage:', error);
        
        // If batch fails, try individual operations (fallback)
        try {
            console.log('🔄 Attempting fallback: individual operations...');
            
            // Just insert usage log without transaction
            const usageResult = await turso.execute({
                sql: `INSERT INTO key_usage (pro_key_id, ip_address, user_agent, action, used_at) 
                      VALUES (?, ?, ?, ?, datetime('now'))`,
                args: [proKeyId, ipAddress, userAgent, action]
            });
            
            // Update usage counter separately
            const updateResult = await turso.execute({
                sql: `UPDATE pro_keys 
                      SET usage_count = usage_count + 1, 
                          last_used = datetime('now') 
                      WHERE id = ?`,
                args: [proKeyId]
            });
            
            console.log(`📊 Usage logged (fallback): Key ID ${proKeyId}, Action: ${action}`);
            
            return {
                success: true,
                usageId: Number(usageResult.lastInsertRowid),
                updated: updateResult.rowsAffected > 0,
                fallback: true
            };
            
        } catch (fallbackError) {
            console.error('❌ Fallback also failed:', fallbackError);
            throw fallbackError;
        }
    }
}

/**
 * Validate a pro key and return key data
 * @param {string} plainKey - Plain text key to validate
 * @returns {Promise<Object>} - Validation result
 */
export async function validateKey(plainKey) {
    try {
        // Hash the key
        const hashedKey = hashKey(plainKey);
        
        // Find the key in database
        const result = await turso.execute({
            sql: `SELECT pk.*, c.name as customer_name, c.email as customer_email 
                  FROM pro_keys pk 
                  LEFT JOIN customers c ON pk.id = c.pro_key_id 
                  WHERE pk.key_hash = ? AND pk.status = 'active'`,
            args: [hashedKey]
        });
        
        if (result.rows.length === 0) {
            return {
                isValid: false,
                keyData: null,
                reason: 'Key not found or inactive'
            };
        }
        
        const keyData = result.rows[0];
        
        // Check expiration if expires_at is set
        if (keyData.expires_at) {
            const now = new Date();
            const expiresAt = new Date(keyData.expires_at);
            
            if (now > expiresAt) {
                return {
                    isValid: false,
                    keyData: keyData,
                    reason: 'Key expired'
                };
            }
        }
        
        return {
            isValid: true,
            keyData: keyData,
            reason: 'Valid key'
        };
        
    } catch (error) {
        console.error('❌ Error validating key:', error);
        throw error;
    }
}

// ============================================================================
// USER INTEGRATION SETTINGS FUNCTIONS
// ============================================================================

/**
 * Get user integration settings by pro key ID and integration type
 * @param {number} proKeyId - Pro key ID
 * @param {string} integrationType - 'discord' or 'telegram'
 * @returns {Promise<Object|null>} - Integration settings or null
 */
export async function getUserIntegrationSettings(proKeyId, integrationType) {
    try {
        const result = await turso.execute({
            sql: `SELECT id, pro_key_id, integration_type, settings, created_at, updated_at
                  FROM user_integration_settings 
                  WHERE pro_key_id = ? AND integration_type = ? AND is_active = TRUE`,
            args: [proKeyId, integrationType]
        });

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        
        // Parse JSON settings
        try {
            row.settings = JSON.parse(row.settings);
        } catch (parseError) {
            console.error('Error parsing integration settings JSON:', parseError);
            return null;
        }

        return row;
    } catch (error) {
        console.error('❌ Error getting user integration settings:', error);
        throw error;
    }
}

/**
 * Save or update user integration settings
 * @param {number} proKeyId - Pro key ID
 * @param {string} integrationType - 'discord' or 'telegram'
 * @param {Object} settings - Settings object (will be JSON stringified)
 * @returns {Promise<Object>} - Save result
 */
export async function saveUserIntegrationSettings(proKeyId, integrationType, settings) {
    try {
        // Validate integration type
        if (!['discord', 'telegram'].includes(integrationType)) {
            throw new Error('Invalid integration type. Must be "discord" or "telegram"');
        }

        // Convert settings to JSON string
        const settingsJson = JSON.stringify(settings);

        // Check if settings already exist
        const existing = await getUserIntegrationSettings(proKeyId, integrationType);

        if (existing) {
            // Update existing settings
            const result = await turso.execute({
                sql: `UPDATE user_integration_settings 
                      SET settings = ?, updated_at = datetime('now')
                      WHERE pro_key_id = ? AND integration_type = ?`,
                args: [settingsJson, proKeyId, integrationType]
            });

            return {
                success: true,
                action: 'updated',
                id: existing.id,
                rowsAffected: result.rowsAffected
            };
        } else {
            // Insert new settings
            const result = await turso.execute({
                sql: `INSERT INTO user_integration_settings (pro_key_id, integration_type, settings)
                      VALUES (?, ?, ?)`,
                args: [proKeyId, integrationType, settingsJson]
            });

            return {
                success: true,
                action: 'created',
                id: Number(result.lastInsertRowid),
                rowsAffected: result.rowsAffected
            };
        }
    } catch (error) {
        console.error('❌ Error saving user integration settings:', error);
        throw error;
    }
}

/**
 * Delete user integration settings
 * @param {number} proKeyId - Pro key ID
 * @param {string} integrationType - 'discord' or 'telegram'
 * @returns {Promise<boolean>} - True if deleted
 */
export async function deleteUserIntegrationSettings(proKeyId, integrationType) {
    try {
        const result = await turso.execute({
            sql: `UPDATE user_integration_settings 
                  SET is_active = FALSE, updated_at = datetime('now')
                  WHERE pro_key_id = ? AND integration_type = ?`,
            args: [proKeyId, integrationType]
        });

        return result.rowsAffected > 0;
    } catch (error) {
        console.error('❌ Error deleting user integration settings:', error);
        throw error;
    }
}

/**
 * Get all integration settings for a pro key
 * @param {number} proKeyId - Pro key ID
 * @returns {Promise<Array>} - Array of integration settings
 */
export async function getAllUserIntegrationSettings(proKeyId) {
    try {
        const result = await turso.execute({
            sql: `SELECT id, pro_key_id, integration_type, settings, created_at, updated_at
                  FROM user_integration_settings 
                  WHERE pro_key_id = ? AND is_active = TRUE
                  ORDER BY integration_type`,
            args: [proKeyId]
        });

        // Parse JSON settings for each row
        return result.rows.map(row => {
            try {
                row.settings = JSON.parse(row.settings);
            } catch (parseError) {
                console.error('Error parsing integration settings JSON:', parseError);
                row.settings = {};
            }
            return row;
        });
    } catch (error) {
        console.error('❌ Error getting all user integration settings:', error);
        throw error;
    }
} 