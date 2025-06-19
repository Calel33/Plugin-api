// Database Initialization for Automation System
// Creates the necessary tables and triggers for scheduled prompts

import { turso } from './connection.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Parse SQL statements from schema, properly handling triggers and complex blocks
 * @param {string} sql - The SQL schema content
 * @returns {Array<string>} - Array of individual SQL statements
 */
function parseSQLStatements(sql) {
    const statements = [];
    let currentStatement = '';
    let inTrigger = false;
    let triggerDepth = 0;
    
    // Split by lines to handle trigger blocks properly
    const lines = sql.split('\n');
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Skip empty lines and comments
        if (!trimmedLine || trimmedLine.startsWith('--')) {
            continue;
        }
        
        currentStatement += (currentStatement ? '\n' : '') + line;
        
        // Check for trigger start
        if (trimmedLine.toUpperCase().includes('CREATE TRIGGER')) {
            inTrigger = true;
        }
        
        // Track BEGIN/END blocks in triggers
        if (inTrigger) {
            if (trimmedLine.toUpperCase() === 'BEGIN') {
                triggerDepth++;
            } else if (trimmedLine.toUpperCase() === 'END;') {
                triggerDepth--;
                if (triggerDepth === 0) {
                    inTrigger = false;
                    statements.push(currentStatement.trim());
                    currentStatement = '';
                    continue;
                }
            }
        }
        
        // For non-trigger statements, split on semicolon
        if (!inTrigger && trimmedLine.endsWith(';')) {
            statements.push(currentStatement.trim());
            currentStatement = '';
        }
    }
    
    // Add any remaining statement
    if (currentStatement.trim()) {
        statements.push(currentStatement.trim());
    }
    
    return statements.filter(stmt => stmt.length > 0);
}

/**
 * Initialize automation database tables
 */
export async function initializeAutomationDatabase() {
    try {
        console.log('🔧 Initializing automation database tables...');

        // Read the schema file
        const schemaPath = path.join(__dirname, 'schema-automation.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        // Parse SQL statements properly (handle triggers and complex statements)
        const statements = parseSQLStatements(schema);

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
                    // Don't throw, continue with other statements
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