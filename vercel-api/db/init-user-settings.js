// Initialize User Integration Settings Database
// Creates the user_integration_settings table and related structures

import { turso } from './connection.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Initialize user integration settings database schema
 * @returns {Promise<Object>} - Initialization result
 */
export async function initUserSettings() {
    try {
        console.log('🔧 Initializing user integration settings database...');

        // Read schema SQL file (using fixed version)
        const schemaPath = join(__dirname, 'schema-user-settings-fixed.sql');
        const schemaSql = readFileSync(schemaPath, 'utf8');

        // Split SQL statements (SQLite doesn't support multiple statements in one execute)
        const statements = schemaSql
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0);

        console.log(`📝 Executing ${statements.length} SQL statements...`);

        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            if (statement) {
                try {
                    await turso.execute(statement);
                    console.log(`✅ Statement ${i + 1}/${statements.length} executed successfully`);
                } catch (error) {
                    // Skip already exists errors
                    if (error.message.includes('already exists')) {
                        console.log(`⚠️ Statement ${i + 1}/${statements.length} skipped (already exists)`);
                    } else {
                        throw error;
                    }
                }
            }
        }

        // Verify table creation
        const tableCheck = await turso.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='user_integration_settings'"
        );

        if (tableCheck.rows.length === 0) {
            throw new Error('user_integration_settings table was not created');
        }

        console.log('✅ User integration settings database initialized successfully');

        return {
            success: true,
            message: 'Database initialization completed',
            tablesCreated: ['user_integration_settings'],
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('❌ Error initializing user settings database:', error);
        throw error;
    }
}

/**
 * Check if user integration settings table exists
 * @returns {Promise<boolean>} - True if table exists
 */
export async function checkUserSettingsTable() {
    try {
        const result = await turso.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='user_integration_settings'"
        );
        return result.rows.length > 0;
    } catch (error) {
        console.error('Error checking user settings table:', error);
        return false;
    }
}

/**
 * Get table schema information
 * @returns {Promise<Array>} - Table schema details
 */
export async function getUserSettingsSchema() {
    try {
        const result = await turso.execute("PRAGMA table_info(user_integration_settings)");
        return result.rows;
    } catch (error) {
        console.error('Error getting table schema:', error);
        return [];
    }
}

// Run initialization if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log('🚀 Running user settings database initialization...');
    initUserSettings()
        .then(result => {
            console.log('🎉 Initialization completed:', result);
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Initialization failed:', error);
            process.exit(1);
        });
} 