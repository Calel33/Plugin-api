// Enhanced Pro Key Validation API with Turso Database
// Supports membership tracking with expiration dates, tiers, and usage
// Works with hashed keys for security and real database storage

import crypto from 'crypto';
import { validateKey, logKeyUsage } from '../db/queries.js';

// Salt for hashing (should match your extension's salt)
const PRO_SALT = 'AgentHustle2024ProSalt!@#$%^&*()_+SecureKey';

// Rate limiting mechanism
const rateLimitMap = new Map(); // Track requests by IP
const RATE_LIMIT_WINDOW = 10000; // 10 seconds
const MAX_REQUESTS_PER_WINDOW = 3; // Max 3 requests per 10 seconds per IP

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
 * Check if request should be rate limited
 * @param {string} clientIP - Client IP address
 * @returns {boolean} - True if rate limited
 */
function isRateLimited(clientIP) {
    const now = Date.now();
    const key = clientIP;
    
    if (!rateLimitMap.has(key)) {
        rateLimitMap.set(key, { count: 1, firstRequest: now });
        return false;
    }
    
    const rateData = rateLimitMap.get(key);
    
    // Reset window if enough time has passed
    if (now - rateData.firstRequest > RATE_LIMIT_WINDOW) {
        rateLimitMap.set(key, { count: 1, firstRequest: now });
        return false;
    }
    
    // Check if limit exceeded
    if (rateData.count >= MAX_REQUESTS_PER_WINDOW) {
        console.log(`🚫 Rate limit exceeded for IP: ${clientIP} (${rateData.count} requests)`);
        return true;
    }
    
    // Increment counter
    rateData.count++;
    return false;
}

/**
 * Get client IP address from request headers
 * @param {Request} req - Express request object
 * @returns {string} - Client IP address
 */
function getClientIP(req) {
    // Check various headers for the real IP (considering proxies/CDNs)
    const forwarded = req.headers['x-forwarded-for'];
    const realIP = req.headers['x-real-ip'];
    const cfConnectingIP = req.headers['cf-connecting-ip']; // Cloudflare
    
    if (forwarded) {
        // x-forwarded-for can contain multiple IPs, take the first one
        return forwarded.split(',')[0].trim();
    }
    
    return realIP || cfConnectingIP || req.connection?.remoteAddress || req.ip || 'unknown';
}

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Only allow POST requests for validation
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed. Use POST.'
        });
    }
    
    try {
        // Get client IP and check rate limiting
        const clientIP = getClientIP(req);
        
        if (isRateLimited(clientIP)) {
            return res.status(429).json({
                success: false,
                message: 'Rate limit exceeded. Please wait before making another request.',
                rateLimited: true,
                retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000) // seconds
            });
        }
        
        console.log(`🔍 Validation request from IP: ${clientIP}`);
        
        const { key, action } = req.body;
        
        if (!key) {
            return res.status(400).json({
                success: false,
                message: 'Pro key is required'
            });
        }
        
        if (!action || action !== 'validate') {
            return res.status(400).json({
                success: false,
                message: 'Invalid action. Use "validate".'
            });
        }
        
        // Validate the key against database
        const result = await validateKey(key);
        
        if (result.isValid) {
            // Try to log successful usage, but don't fail if logging fails
            try {
                await logKeyUsage(
                    result.keyData.id,
                    clientIP,
                    req.headers['user-agent'] || 'Unknown',
                    'validate'
                );
            } catch (loggingError) {
                console.warn('⚠️ Usage logging failed, but continuing with validation:', loggingError.message);
            }
            
            console.log(`✅ Valid key used: ${result.keyData.notes?.substring(0, 30)}... (Usage: ${result.keyData.usage_count + 1})`);
            
            // Calculate expiration details
            const now = new Date();
            const expiresAt = result.keyData.expires_at ? new Date(result.keyData.expires_at) : null;
            const isExpired = expiresAt ? now > expiresAt : false;
            const daysRemaining = expiresAt ? Math.max(0, Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24))) : null;
            
            return res.status(200).json({
                success: true,
                isPro: true,
                message: 'Valid pro key',
                membershipDetails: {
                    status: isExpired ? 'expired' : 'active',
                    tier: result.keyData.tier || 'pro',
                    usageCount: result.keyData.usage_count + 1,
                    lastUsed: new Date().toISOString(),
                    createdAt: result.keyData.created_at || null,
                    expiresAt: result.keyData.expires_at || null,
                    daysRemaining: daysRemaining,
                    isExpired: isExpired,
                    notes: result.keyData.notes
                }
            });
        } else {
            console.log(`❌ Invalid key attempt from IP: ${clientIP}`);
            
            return res.status(200).json({
                success: true,
                isPro: false,
                message: 'Invalid pro key'
            });
        }
        
    } catch (error) {
        console.error('❌ Validation error:', error);
        
        return res.status(500).json({
            success: false,
            message: 'Internal server error during validation'
        });
    }
}

// Clean up old rate limit entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of rateLimitMap.entries()) {
        if (now - data.firstRequest > RATE_LIMIT_WINDOW * 2) {
            rateLimitMap.delete(key);
        }
    }
}, RATE_LIMIT_WINDOW); 