// Enhanced Pro Key Validation API with Turso Database
// Supports membership tracking with expiration dates, tiers, and usage
// Works with hashed keys for security and real database storage

import crypto from 'crypto';
import { findProKeyByHash, updateKeyUsage } from '../db/queries.js';

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

export default async function handler(req, res) {
    // Enable CORS for Chrome extension
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    
    try {
        const { key, action = 'validate' } = req.body;
        
        if (!key) {
            res.status(400).json({ error: 'Pro key is required' });
            return;
        }
        
        // Hash the incoming key for security
        const hashedKey = hashKey(key);
        
        // Get client IP and user agent for tracking
        const clientIP = req.headers['x-forwarded-for'] || 
                        req.headers['x-real-ip'] || 
                        req.connection.remoteAddress || 
                        req.socket.remoteAddress ||
                        (req.connection.socket ? req.connection.socket.remoteAddress : null);
        const userAgent = req.headers['user-agent'];
        
        // Query database for the hashed key
        const keyData = await findProKeyByHash(hashedKey);
        
        if (!keyData) {
            // Key not found
            res.json({
                success: true,
                isPro: false,
                message: 'Invalid pro key',
                legacy: false,
                expired: false,
                hasKey: true
            });
            return;
        }
        
        // Calculate days remaining
        const now = new Date();
        const expirationDate = new Date(keyData.expires_at);
        const daysRemaining = Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24));
        const isExpired = daysRemaining <= 0;
        
        // Handle different actions and update usage tracking
        if (action === 'updateUsage' || action === 'validate') {
            // Update usage count in database
            await updateKeyUsage(keyData.id, clientIP, userAgent);
        }
        
        // Determine if key is valid
        const isPro = keyData.status === 'active' && !isExpired;
        
        // Build response (maintaining exact same format for backward compatibility)
        const response = {
            success: true,
            isPro: isPro,
            message: isPro 
                ? `Valid ${keyData.tier} membership (${daysRemaining} days remaining)`
                : isExpired 
                    ? 'Pro membership has expired'
                    : keyData.status === 'suspended'
                        ? 'Pro membership is suspended'
                        : 'Pro membership is inactive',
            legacy: false,
            expired: isExpired,
            hasKey: true,
            membershipDetails: {
                status: keyData.status,
                tier: keyData.tier,
                expiresAt: keyData.expires_at,
                daysRemaining: Math.max(0, daysRemaining),
                usageCount: keyData.usage_count || 0,
                lastUsed: keyData.last_used,
                notes: keyData.notes || '',
                customerName: keyData.customer_name || null,
                customerEmail: keyData.customer_email || null
            }
        };
        
        res.json(response);
        
    } catch (error) {
        console.error('Validation error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Internal server error',
            message: 'Validation service temporarily unavailable'
        });
    }
} 