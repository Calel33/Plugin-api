// User Integration Settings API Endpoints
// Handles Discord and Telegram settings management for pro key users

import { 
    getUserIntegrationSettings, 
    saveUserIntegrationSettings, 
    deleteUserIntegrationSettings,
    getAllUserIntegrationSettings,
    validateKey 
} from '../db/queries.js';

/**
 * Get client IP address from request headers
 */
function getClientIP(req) {
    const forwarded = req.headers['x-forwarded-for'];
    const realIP = req.headers['x-real-ip'];
    const cfConnectingIP = req.headers['cf-connecting-ip'];

    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }

    return realIP || cfConnectingIP || req.connection?.remoteAddress || req.ip || 'unknown';
}

/**
 * Validate pro key and get user data
 */
async function validateProKey(key) {
    if (!key) {
        throw new Error('Pro key is required');
    }

    const result = await validateKey(key);
    if (!result.isValid) {
        throw new Error('Invalid or expired pro key');
    }

    return result.keyData;
}

/**
 * Validate Discord webhook URL
 * @param {string} webhookUrl - Discord webhook URL
 * @returns {boolean} - True if valid
 */
function isValidDiscordWebhook(webhookUrl) {
    if (!webhookUrl || typeof webhookUrl !== 'string') {
        return false;
    }
    
    // Basic Discord webhook URL validation
    const discordWebhookRegex = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/;
    return discordWebhookRegex.test(webhookUrl);
}

/**
 * Validate Telegram settings
 * @param {Object} settings - Telegram settings object
 * @returns {boolean} - True if valid
 */
function isValidTelegramSettings(settings) {
    if (!settings || typeof settings !== 'object') {
        return false;
    }
    
    const { botToken, chatId } = settings;
    
    // Basic Telegram bot token validation (format: 123456789:XXXXXXX...)
    const botTokenRegex = /^\d+:[A-Za-z0-9_-]+$/;
    if (!botToken || !botTokenRegex.test(botToken)) {
        return false;
    }
    
    // Chat ID can be positive/negative number or string starting with @
    if (!chatId || (typeof chatId !== 'string' && typeof chatId !== 'number')) {
        return false;
    }
    
    return true;
}

/**
 * Get user integration settings
 * GET /api/user-settings/:proKey/:integrationType
 */
export async function getUserSettings(req, res) {
    try {
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
        
        const { proKey, integrationType } = req.params;
        const clientIP = getClientIP(req);
        
        console.log(`🔍 Getting ${integrationType} settings request from IP: ${clientIP}`);

        // Validate integration type
        if (!['discord', 'telegram'].includes(integrationType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid integration type. Must be "discord" or "telegram"'
            });
        }

        // Validate pro key
        const userData = await validateProKey(proKey);

        // Get integration settings
        const settings = await getUserIntegrationSettings(userData.id, integrationType);

        if (!settings) {
            return res.status(404).json({
                success: false,
                message: `No ${integrationType} settings found`,
                hasSettings: false
            });
        }

        // Remove sensitive data from response
        const responseSettings = { ...settings };
        if (integrationType === 'telegram' && responseSettings.settings.botToken) {
            // Mask bot token for security
            responseSettings.settings.botToken = responseSettings.settings.botToken.substring(0, 10) + '...';
        }

        return res.status(200).json({
            success: true,
            data: responseSettings,
            hasSettings: true
        });

    } catch (error) {
        console.error('❌ Error getting user settings:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to get integration settings',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

/**
 * Save user integration settings
 * POST /api/user-settings/:proKey/:integrationType
 */
export async function saveUserSettings(req, res) {
    try {
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
        
        const { proKey, integrationType } = req.params;
        const settings = req.body;
        const clientIP = getClientIP(req);
        
        console.log(`💾 Saving ${integrationType} settings request from IP: ${clientIP}`);

        // Validate integration type
        if (!['discord', 'telegram'].includes(integrationType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid integration type. Must be "discord" or "telegram"'
            });
        }

        // Validate pro key
        const userData = await validateProKey(proKey);

        // Validate settings based on integration type
        if (integrationType === 'discord') {
            if (!settings.webhookUrl || !isValidDiscordWebhook(settings.webhookUrl)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid Discord webhook URL format'
                });
            }
        } else if (integrationType === 'telegram') {
            if (!isValidTelegramSettings(settings)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid Telegram settings. Bot token and chat ID are required'
                });
            }
        }

        // Save settings
        const result = await saveUserIntegrationSettings(userData.id, integrationType, settings);

        console.log(`✅ ${integrationType} settings ${result.action} for pro key ID: ${userData.id}`);

        return res.status(result.action === 'created' ? 201 : 200).json({
            success: true,
            data: result,
            message: `${integrationType} settings ${result.action} successfully`
        });

    } catch (error) {
        console.error('❌ Error saving user settings:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to save integration settings',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

/**
 * Delete user integration settings
 * DELETE /api/user-settings/:proKey/:integrationType
 */
export async function deleteUserSettings(req, res) {
    try {
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
        
        const { proKey, integrationType } = req.params;
        const clientIP = getClientIP(req);
        
        console.log(`🗑️ Deleting ${integrationType} settings request from IP: ${clientIP}`);

        // Validate integration type
        if (!['discord', 'telegram'].includes(integrationType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid integration type. Must be "discord" or "telegram"'
            });
        }

        // Validate pro key
        const userData = await validateProKey(proKey);

        // Delete settings
        const deleted = await deleteUserIntegrationSettings(userData.id, integrationType);

        if (deleted) {
            console.log(`✅ ${integrationType} settings deleted for pro key ID: ${userData.id}`);
            
            return res.status(200).json({
                success: true,
                message: `${integrationType} settings deleted successfully`
            });
        } else {
            return res.status(404).json({
                success: false,
                message: `No ${integrationType} settings found to delete`
            });
        }

    } catch (error) {
        console.error('❌ Error deleting user settings:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to delete integration settings',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

/**
 * Get all user integration settings
 * GET /api/user-settings/:proKey
 */
export async function getAllUserSettings(req, res) {
    try {
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
        
        const { proKey } = req.params;
        const clientIP = getClientIP(req);
        
        console.log(`📋 Getting all integration settings request from IP: ${clientIP}`);

        // Validate pro key
        const userData = await validateProKey(proKey);

        // Get all integration settings
        const allSettings = await getAllUserIntegrationSettings(userData.id);

        // Mask sensitive data for response
        const maskedSettings = allSettings.map(setting => {
            const masked = { ...setting };
            if (setting.integration_type === 'telegram' && setting.settings.botToken) {
                masked.settings.botToken = setting.settings.botToken.substring(0, 10) + '...';
            }
            return masked;
        });

        return res.status(200).json({
            success: true,
            data: maskedSettings,
            count: maskedSettings.length
        });

    } catch (error) {
        console.error('❌ Error getting all user settings:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to get integration settings',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

/**
 * Test integration settings
 * POST /api/user-settings/:proKey/:integrationType/test
 */
export async function testUserSettings(req, res) {
    try {
        // Set CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
        
        const { proKey, integrationType } = req.params;
        const clientIP = getClientIP(req);
        
        console.log(`🧪 Testing ${integrationType} settings request from IP: ${clientIP}`);

        // Validate integration type
        if (!['discord', 'telegram'].includes(integrationType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid integration type. Must be "discord" or "telegram"'
            });
        }

        // Validate pro key
        const userData = await validateProKey(proKey);

        // Get integration settings
        const settings = await getUserIntegrationSettings(userData.id, integrationType);

        if (!settings) {
            return res.status(404).json({
                success: false,
                message: `No ${integrationType} settings found to test`
            });
        }

        // Test the integration
        let testResult;
        
        if (integrationType === 'discord') {
            testResult = await testDiscordWebhook(settings.settings.webhookUrl);
        } else if (integrationType === 'telegram') {
            testResult = await testTelegramBot(settings.settings.botToken, settings.settings.chatId);
        }

        return res.status(200).json({
            success: testResult.success,
            message: testResult.message,
            data: testResult
        });

    } catch (error) {
        console.error('❌ Error testing user settings:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to test integration settings',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

/**
 * Test Discord webhook
 * @param {string} webhookUrl - Discord webhook URL
 * @returns {Promise<Object>} - Test result
 */
async function testDiscordWebhook(webhookUrl) {
    try {
        const testPayload = {
            content: "🧪 **Test Message from Agent Hustle Pro**",
            embeds: [{
                title: "Integration Test",
                description: "If you're seeing this, your Discord integration is working correctly!",
                color: 0x00ff00,
                timestamp: new Date().toISOString(),
                footer: {
                    text: "Agent Hustle Pro - Integration Test"
                }
            }]
        };

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testPayload)
        });

        if (response.ok) {
            return {
                success: true,
                message: 'Discord webhook test successful'
            };
        } else {
            return {
                success: false,
                message: `Discord webhook test failed: ${response.status}`
            };
        }
    } catch (error) {
        return {
            success: false,
            message: `Discord webhook test error: ${error.message}`
        };
    }
}

/**
 * Test Telegram bot
 * @param {string} botToken - Telegram bot token
 * @param {string} chatId - Telegram chat ID
 * @returns {Promise<Object>} - Test result
 */
async function testTelegramBot(botToken, chatId) {
    try {
        const testMessage = "🧪 <b>Test Message from Agent Hustle Pro</b>\n\nIf you're seeing this, your Telegram integration is working correctly!";
        
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const payload = {
            chat_id: chatId,
            text: testMessage,
            parse_mode: 'HTML'
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok && data.ok) {
            return {
                success: true,
                message: 'Telegram bot test successful',
                messageId: data.result.message_id
            };
        } else {
            return {
                success: false,
                message: `Telegram bot test failed: ${data.description || 'Unknown error'}`
            };
        }
    } catch (error) {
        return {
            success: false,
            message: `Telegram bot test error: ${error.message}`
        };
    }
}

/**
 * Handle OPTIONS requests for CORS
 */
export async function handleOptions(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    return res.status(200).end();
} 