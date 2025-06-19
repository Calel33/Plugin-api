// Automation Scheduler Service
// Handles cron-based execution of scheduled prompts

import { executeScheduledPrompts } from '../api/scheduled-prompts.js';

/**
 * Simple scheduler that checks for due prompts every minute
 * Alternative to node-cron for better compatibility with Render
 */
class AutomationScheduler {
    constructor() {
        this.isRunning = false;
        this.intervalId = null;
        this.checkInterval = 60000; // 1 minute in milliseconds
    }

    /**
     * Start the scheduler
     */
    start() {
        if (this.isRunning) {
            console.log('⚠️ Scheduler is already running');
            return;
        }

        console.log('🚀 Starting automation scheduler (checking every minute)...');
        this.isRunning = true;

        // Run immediately once
        this.checkAndExecute();

        // Then run every minute
        this.intervalId = setInterval(() => {
            this.checkAndExecute();
        }, this.checkInterval);

        console.log('✅ Automation scheduler started successfully');
    }

    /**
     * Stop the scheduler
     */
    stop() {
        if (!this.isRunning) {
            console.log('⚠️ Scheduler is not running');
            return;
        }

        console.log('🛑 Stopping automation scheduler...');
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        this.isRunning = false;
        console.log('✅ Automation scheduler stopped');
    }

    /**
     * Check for due prompts and execute them
     */
    async checkAndExecute() {
        try {
            const timestamp = new Date().toISOString();
            console.log(`🕐 [${timestamp}] Checking for scheduled prompts...`);

            const result = await executeScheduledPrompts();

            if (result.executed > 0 || result.failed > 0) {
                console.log(`📊 [${timestamp}] Execution summary: ${result.executed} successful, ${result.failed} failed`);
            }

        } catch (error) {
            console.error('❌ Error in scheduler check:', error);
        }
    }

    /**
     * Get scheduler status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            checkInterval: this.checkInterval,
            nextCheck: this.intervalId ? new Date(Date.now() + this.checkInterval) : null
        };
    }
}

// Create and export scheduler instance
export const automationScheduler = new AutomationScheduler();

/**
 * Initialize scheduler on module load
 */
export function initializeScheduler() {
    console.log('🔧 Initializing automation scheduler...');
    
    // Start the scheduler
    automationScheduler.start();

    // Handle graceful shutdown
    process.on('SIGTERM', () => {
        console.log('📡 SIGTERM received, stopping scheduler...');
        automationScheduler.stop();
    });

    process.on('SIGINT', () => {
        console.log('📡 SIGINT received, stopping scheduler...');
        automationScheduler.stop();
    });

    return automationScheduler;
}

/**
 * Manual trigger for testing
 */
export async function triggerManualCheck() {
    console.log('🔧 Manual scheduler trigger requested...');
    return await automationScheduler.checkAndExecute();
} 