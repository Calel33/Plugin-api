// PHASE 3: API Health Check Endpoint
// Provides quick health status and latency information for smart failover

import { turso } from '../db/connection.js';

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        // Quick database ping
        const start = Date.now();
        await turso.execute('SELECT 1 as health');
        const dbLatency = Date.now() - start;
        
        return res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            dbLatency: dbLatency,
            uptime: process.uptime()
        });
    } catch (error) {
        return res.status(503).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
} 