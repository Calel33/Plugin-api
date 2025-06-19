// Scheduled Prompts API Endpoints
// Handles automation scheduling for custom prompts with user timezone support

import {
    createScheduledPrompt,
    checkUserScheduleLimit,
    getDueScheduledPrompts,
    updateScheduledPromptStatus,
    logAutomationExecution
} from '../db/automation-queries.js';
import { validateKey } from '../db/queries.js';

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
 * Format datetime for user's timezone display
 */
function formatDisplayTime(scheduledTime, userTimezone) {
    try {
        const date = new Date(scheduledTime);
        return date.toLocaleString('en-US', {
            timeZone: userTimezone,
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        });
    } catch (error) {
        console.warn('Error formatting display time:', error);
        return new Date(scheduledTime).toLocaleString();
    }
}

/**
 * Create a new scheduled prompt
 * POST /api/scheduled-prompts
 */
export async function createSchedule(req, res) {
    try {
        const clientIP = getClientIP(req);
        console.log(`📅 Schedule creation request from IP: ${clientIP}`);

        const {
            proKey,
            promptId,
            promptTitle,
            promptContent,
            scheduledTime,
            userTimezone,
            integrations
        } = req.body;

        // Validate required fields
        if (!proKey || !promptTitle || !promptContent || !scheduledTime || !userTimezone) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: proKey, promptTitle, promptContent, scheduledTime, userTimezone'
            });
        }

        // Validate pro key
        const userData = await validateProKey(proKey);

        // Validate scheduled time is in the future
        const scheduleDate = new Date(scheduledTime);
        const now = new Date();
        
        if (scheduleDate <= now) {
            return res.status(400).json({
                success: false,
                message: 'Scheduled time must be in the future'
            });
        }

        // Format display time
        const displayTime = formatDisplayTime(scheduledTime, userTimezone);

        // Create the scheduled prompt
        const scheduleData = {
            proKeyId: userData.id,
            promptId: promptId || null,
            promptTitle: promptTitle.trim(),
            promptContent: promptContent.trim(),
            scheduledTime: scheduleDate.toISOString(),
            userTimezone: userTimezone,
            displayTime: displayTime,
            integrations: integrations || { telegram: false, discord: false }
        };

        const result = await createScheduledPrompt(scheduleData);

        console.log(`✅ Schedule created successfully: ID ${result.scheduleId} for ${displayTime}`);

        return res.status(201).json({
            success: true,
            data: result,
            message: `Prompt scheduled for ${displayTime}`
        });

    } catch (error) {
        console.error('❌ Error creating schedule:', error);

        if (error.message.includes('Schedule limit reached')) {
            return res.status(400).json({
                success: false,
                message: error.message,
                code: 'SCHEDULE_LIMIT_EXCEEDED'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to create scheduled prompt',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

/**
 * Get user's schedule limit status
 * GET /api/scheduled-prompts/limit/:proKey
 */
export async function getScheduleLimit(req, res) {
    try {
        const { proKey } = req.params;
        
        // Validate pro key
        const userData = await validateProKey(proKey);
        
        // Get limit status
        const limitStatus = await checkUserScheduleLimit(userData.id);
        
        return res.status(200).json({
            success: true,
            data: limitStatus
        });

    } catch (error) {
        console.error('❌ Error getting schedule limit:', error);
        
        return res.status(500).json({
            success: false,
            message: 'Failed to get schedule limit',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

/**
 * Execute due scheduled prompts (called by cron job)
 * This function processes all pending schedules that are due for execution
 */
export async function executeScheduledPrompts() {
    try {
        console.log('🔍 Checking for due scheduled prompts...');
        
        const duePrompts = await getDueScheduledPrompts();
        
        if (duePrompts.length === 0) {
            console.log('📭 No scheduled prompts due for execution');
            return { executed: 0, failed: 0 };
        }

        console.log(`⏰ Found ${duePrompts.length} scheduled prompts due for execution`);

        let executed = 0;
        let failed = 0;

        // Process each due prompt
        for (const prompt of duePrompts) {
            try {
                const startTime = Date.now();
                
                console.log(`🚀 Executing scheduled prompt: ${prompt.prompt_title} (ID: ${prompt.id})`);
                
                // Simulate analysis execution
                const analysisResult = `Analysis completed for: ${prompt.prompt_title}\n\nPrompt: ${prompt.prompt_content}\n\nExecuted at: ${new Date().toISOString()}`;
                
                const executionDuration = Date.now() - startTime;
                
                // Log successful execution
                await logAutomationExecution({
                    scheduledPromptId: prompt.id,
                    status: 'success',
                    analysisResult: analysisResult,
                    integrationResults: { telegram: false, discord: false },
                    executionDuration: executionDuration
                });
                
                // Update prompt status to completed
                await updateScheduledPromptStatus(prompt.id, 'completed');
                
                console.log(`✅ Successfully executed scheduled prompt: ${prompt.prompt_title}`);
                executed++;

            } catch (executionError) {
                console.error(`❌ Failed to execute scheduled prompt ${prompt.id}:`, executionError);
                
                // Log failed execution
                await logAutomationExecution({
                    scheduledPromptId: prompt.id,
                    status: 'failed',
                    errorMessage: executionError.message,
                    executionDuration: 0
                });
                
                // Update prompt status to failed
                await updateScheduledPromptStatus(prompt.id, 'failed');
                
                failed++;
            }
        }

        console.log(`📊 Execution summary: ${executed} successful, ${failed} failed`);
        return { executed, failed };

    } catch (error) {
        console.error('❌ Error in executeScheduledPrompts:', error);
        throw error;
    }
}

/**
 * Manual execution endpoint for testing
 * POST /api/scheduled-prompts/execute
 */
export async function manualExecute(req, res) {
    try {
        const result = await executeScheduledPrompts();
        
        return res.status(200).json({
            success: true,
            data: result,
            message: `Executed ${result.executed} prompts, ${result.failed} failed`
        });

    } catch (error) {
        console.error('❌ Error in manual execution:', error);
        
        return res.status(500).json({
            success: false,
            message: 'Failed to execute scheduled prompts',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

/**
 * Health check for automation system
 * GET /api/scheduled-prompts/health
 */
export async function healthCheck(req, res) {
    try {
        const duePrompts = await getDueScheduledPrompts();
        
        return res.status(200).json({
            success: true,
            data: {
                status: 'healthy',
                duePrompts: duePrompts.length,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Automation health check failed:', error);
        
        return res.status(500).json({
            success: false,
            message: 'Automation system health check failed',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
} 