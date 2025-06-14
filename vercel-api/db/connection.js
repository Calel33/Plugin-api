// Turso Database Connection Module
// Handles libSQL client setup and connection management

import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars.join(', '));
    console.error('Please check your .env file and ensure all Turso credentials are set.');
    process.exit(1);
}

// Create Turso client
export const turso = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

// Test database connection
export async function testConnection() {
    try {
        const result = await turso.execute('SELECT 1 as test');
        console.log('✅ Turso database connection successful');
        return true;
    } catch (error) {
        console.error('❌ Turso database connection failed:', error.message);
        return false;
    }
}

// Graceful shutdown
export async function closeConnection() {
    try {
        await turso.close();
        console.log('✅ Turso database connection closed');
    } catch (error) {
        console.error('❌ Error closing Turso connection:', error.message);
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    console.log('\n🔄 Gracefully shutting down...');
    await closeConnection();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🔄 Gracefully shutting down...');
    await closeConnection();
    process.exit(0);
}); 