// HustlePlug Pro Validation API - Express.js Server
// Migrated from Vercel serverless to Express for Render deployment
// Maintains full backward compatibility with Chrome extension

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { testConnection } from './db/connection.js';
import { checkDatabaseHealth } from './db/queries.js';

// Load environment variables
dotenv.config();

// Import the validation handler (converted from serverless function)
import validateKeyHandler from './api/validate-key.js';

// Import automation handlers
import { 
    createSchedule, 
    manualExecute, 
    getScheduleLimit, 
    getUserSchedules, 
    deleteSchedule, 
    getAutomationStatistics 
} from './api/scheduled-prompts.js';
import { initializeScheduler } from './services/scheduler.js';
import { initializeAutomationDatabase } from './db/init-automation.js';
import { initUserSettings } from './db/init-user-settings.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration - maintain exact same headers as Vercel version
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.url;
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    
    console.log(`[${timestamp}] ${method} ${url} - ${ip}`);
    next();
});

// Health check endpoint for Render
app.get('/health', async (req, res) => {
    try {
        const dbHealth = await checkDatabaseHealth();
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: dbHealth,
            version: '2.0.0-turso'
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'HustlePlug Pro Validation API',
        version: '2.0.0-turso',
        status: 'running',
        endpoints: {
            validate: 'POST /api/validate-key',
            health: 'GET /health'
        },
        timestamp: new Date().toISOString()
    });
});

// Main validation endpoint - maintains exact same path as Vercel
app.post('/api/validate-key', async (req, res) => {
    try {
        // Convert Express req/res to match Vercel serverless function format
        await validateKeyHandler(req, res);
    } catch (error) {
        console.error('Validation endpoint error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: 'Validation service temporarily unavailable'
        });
    }
});

// Automation endpoints
app.post('/api/scheduled-prompts', createSchedule);
app.get('/api/scheduled-prompts/limit/:proKey', getScheduleLimit);
app.get('/api/scheduled-prompts/user/:proKey', getUserSchedules);
app.delete('/api/scheduled-prompts/:scheduleId/:proKey', deleteSchedule);
app.get('/api/scheduled-prompts/stats/:proKey', getAutomationStatistics);
app.post('/api/scheduled-prompts/execute', manualExecute);

// Handle preflight requests for CORS
app.options('*', (req, res) => {
    res.status(200).end();
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'The requested endpoint does not exist',
        availableEndpoints: [
            'POST /api/validate-key',
            'GET /health',
            'GET /'
        ]
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Global error handler:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Something went wrong on our end'
    });
});

// Start server
async function startServer() {
    try {
        // Test database connection before starting
        console.log('🔄 Testing Turso database connection...');
        const dbConnected = await testConnection();
        
        if (!dbConnected) {
            console.error('❌ Failed to connect to Turso database. Please check your credentials.');
            process.exit(1);
        }
        
        // Start the server
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 HustlePlug Pro Validation API running on port ${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
            console.log(`🔑 Validation endpoint: http://localhost:${PORT}/api/validate-key`);
            console.log(`⏰ Automation endpoint: http://localhost:${PORT}/api/scheduled-prompts`);
            console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
            
            // Initialize database tables
            initializeAutomationDatabase();
            initUserSettings();
            
            // Initialize automation scheduler
            initializeScheduler();
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('🔄 SIGTERM received, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🔄 SIGINT received, shutting down gracefully...');
    process.exit(0);
});

// Start the application
startServer(); 