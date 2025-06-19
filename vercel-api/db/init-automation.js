// Database Initialization for Automation System
// Creates the necessary tables and triggers for scheduled prompts

import { turso } from './connection.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Initialize automation database tables
 */
export async function initializeAutomationDatabase() {
    try {
        console.log('🔧 Initializing automation database tables...');

        // Read the schema file
        const schemaPath = path.join(__dirname, 'schema-automation.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        // Split into individual statements
        const statements = schema
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0);

        // Execute each statement
        for (const statement of statements) {
            try {
                await turso.execute(statement);
                console.log(`✅ Executed: ${statement.substring(0, 50)}...`);
            } catch (error) {
                // Ignore "already exists" errors
                if (error.message.includes('already exists')) {
                    console.log(`⚠️ Already exists: ${statement.substring(0, 50)}...`);
                } else {
                    console.error(`❌ Error executing statement: ${statement.substring(0, 50)}...`);
                    console.error('Error:', error.message);
                }
            }
        }

        console.log('✅ Automation database initialization completed');
        return true;

    } catch (error) {
        console.error('❌ Failed to initialize automation database:', error);
        return false;
    }
}

/**
 * Check if automation tables exist
 */
export async function checkAutomationTables() {
    try {
        const result = await turso.execute(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name IN ('scheduled_prompts', 'automation_logs')
        `);

        return result.rows.length === 2;

    } catch (error) {
        console.error('Error checking automation tables:', error);
        return false;
    }
} 