// Automation Database Queries
// Handles scheduled prompt automation with user timezone support

import { turso } from './connection.js';

/**
 * Create a new scheduled prompt
 * @param {Object} scheduleData - Schedule configuration
 * @returns {Promise<Object>} - Created schedule with ID
 */
export async function createScheduledPrompt(scheduleData) {
    const {
        proKeyId,
        promptId = null,
        promptTitle,
        promptContent,
        scheduledTime, // UTC ISO string
        userTimezone,
        displayTime, // Human-readable time in user's timezone
        integrations = {}
    } = scheduleData;

    try {
        // First check if user has reached the 10 schedule limit
        const limitCheck = await checkUserScheduleLimit(proKeyId);
        if (!limitCheck.canSchedule) {
            throw new Error(`Schedule limit reached. Maximum 10 schedules per user. Current: ${limitCheck.currentCount}`);
        }

        const result = await turso.execute({
            sql: `INSERT INTO scheduled_prompts 
                  (pro_key_id, prompt_id, prompt_title, prompt_content, 
                   scheduled_time, user_timezone, display_time, integrations)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
                proKeyId,
                promptId,
                promptTitle,
                promptContent,
                scheduledTime,
                userTimezone,
                displayTime,
                JSON.stringify(integrations)
            ]
        });

        console.log(`📅 Scheduled prompt created: ID ${result.lastInsertRowid} for ${displayTime}`);

        return {
            success: true,
            scheduleId: Number(result.lastInsertRowid),
            scheduledTime: scheduledTime,
            displayTime: displayTime,
            message: `Prompt scheduled for ${displayTime}`
        };

    } catch (error) {
        console.error('❌ Error creating scheduled prompt:', error);
        throw error;
    }
}

/**
 * Check if user can schedule more prompts (10 max limit)
 * @param {number} proKeyId - Pro key ID
 * @returns {Promise<Object>} - Limit check result
 */
export async function checkUserScheduleLimit(proKeyId) {
    try {
        const result = await turso.execute({
            sql: `SELECT COUNT(*) as current_count 
                  FROM scheduled_prompts 
                  WHERE pro_key_id = ? AND status IN ('pending', 'completed')`,
            args: [proKeyId]
        });

        const currentCount = Number(result.rows[0]?.current_count || 0);
        const maxSchedules = 10;

        return {
            canSchedule: currentCount < maxSchedules,
            currentCount: currentCount,
            maxSchedules: maxSchedules,
            remaining: Math.max(0, maxSchedules - currentCount)
        };

    } catch (error) {
        console.error('❌ Error checking schedule limit:', error);
        throw error;
    }
}

/**
 * Get user's scheduled prompts
 * @param {number} proKeyId - Pro key ID
 * @param {string} status - Filter by status (optional)
 * @returns {Promise<Array>} - List of scheduled prompts
 */
export async function getUserScheduledPrompts(proKeyId, status = null) {
    try {
        let sql = `SELECT sp.*, 
                          COUNT(al.id) as total_executions,
                          MAX(al.created_at) as last_execution_log
                   FROM scheduled_prompts sp
                   LEFT JOIN automation_logs al ON sp.id = al.scheduled_prompt_id
                   WHERE sp.pro_key_id = ?`;
        
        const args = [proKeyId];

        if (status) {
            sql += ' AND sp.status = ?';
            args.push(status);
        }

        sql += ' GROUP BY sp.id ORDER BY sp.scheduled_time ASC';

        const result = await turso.execute({ sql, args });

        return result.rows.map(row => ({
            ...row,
            integrations: JSON.parse(row.integrations || '{}'),
            scheduledTime: new Date(row.scheduled_time),
            displayTime: row.display_time,
            userTimezone: row.user_timezone
        }));

    } catch (error) {
        console.error('❌ Error getting user scheduled prompts:', error);
        throw error;
    }
}

/**
 * Get due scheduled prompts for execution
 * @returns {Promise<Array>} - Prompts ready for execution
 */
export async function getDueScheduledPrompts() {
    try {
        // Debug: Check current time and any scheduled prompts
        const debugResult = await turso.execute({
            sql: `SELECT COUNT(*) as total_pending, 
                         MIN(scheduled_time) as earliest_schedule,
                         datetime('now') as current_time
                  FROM scheduled_prompts 
                  WHERE status = 'pending'`,
            args: []
        });
        
        const debug = debugResult.rows[0];
        console.log(`🔍 Debug: ${debug.total_pending} pending schedules, earliest: ${debug.earliest_schedule}, current: ${debug.current_time}`);

        const result = await turso.execute({
            sql: `SELECT sp.*, pk.key_hash, pk.status as key_status
                  FROM scheduled_prompts sp
                  JOIN pro_keys pk ON sp.pro_key_id = pk.id
                  WHERE sp.status = 'pending'
                    AND datetime(sp.scheduled_time) <= datetime('now')
                    AND pk.status = 'active'
                  ORDER BY sp.scheduled_time ASC`,
            args: []
        });

        console.log(`🔍 Found ${result.rows.length} due prompts after query`);

        return result.rows.map(row => ({
            ...row,
            integrations: JSON.parse(row.integrations || '{}')
        }));

    } catch (error) {
        console.error('❌ Error getting due scheduled prompts:', error);
        throw error;
    }
}

/**
 * Update scheduled prompt status
 * @param {number} scheduleId - Schedule ID
 * @param {string} status - New status
 * @returns {Promise<boolean>} - Success status
 */
export async function updateScheduledPromptStatus(scheduleId, status) {
    try {
        const result = await turso.execute({
            sql: `UPDATE scheduled_prompts 
                  SET status = ?, updated_at = datetime('now'), execution_count = execution_count + 1
                  WHERE id = ?`,
            args: [status, scheduleId]
        });

        return result.rowsAffected > 0;

    } catch (error) {
        console.error('❌ Error updating scheduled prompt status:', error);
        throw error;
    }
}

/**
 * Delete a scheduled prompt
 * @param {number} scheduleId - Schedule ID
 * @param {number} proKeyId - Pro key ID (for security)
 * @returns {Promise<boolean>} - Success status
 */
export async function deleteScheduledPrompt(scheduleId, proKeyId) {
    try {
        const result = await turso.execute({
            sql: `DELETE FROM scheduled_prompts 
                  WHERE id = ? AND pro_key_id = ?`,
            args: [scheduleId, proKeyId]
        });

        if (result.rowsAffected > 0) {
            console.log(`🗑️ Deleted scheduled prompt: ID ${scheduleId}`);
            return true;
        }

        return false;

    } catch (error) {
        console.error('❌ Error deleting scheduled prompt:', error);
        throw error;
    }
}

/**
 * Log automation execution
 * @param {Object} logData - Execution log data
 * @returns {Promise<Object>} - Log entry result
 */
export async function logAutomationExecution(logData) {
    const {
        scheduledPromptId,
        status,
        analysisResult = null,
        integrationResults = null,
        errorMessage = null,
        executionDuration = null
    } = logData;

    try {
        const result = await turso.execute({
            sql: `INSERT INTO automation_logs 
                  (scheduled_prompt_id, status, analysis_result, 
                   integration_results, error_message, execution_duration)
                  VALUES (?, ?, ?, ?, ?, ?)`,
            args: [
                scheduledPromptId,
                status,
                analysisResult,
                JSON.stringify(integrationResults),
                errorMessage,
                executionDuration
            ]
        });

        console.log(`📊 Automation execution logged: Schedule ${scheduledPromptId}, Status: ${status}`);

        return {
            success: true,
            logId: Number(result.lastInsertRowid)
        };

    } catch (error) {
        console.error('❌ Error logging automation execution:', error);
        throw error;
    }
}

/**
 * Get automation execution history for a scheduled prompt
 * @param {number} scheduledPromptId - Schedule ID
 * @param {number} limit - Number of logs to return
 * @returns {Promise<Array>} - Execution history
 */
export async function getAutomationExecutionHistory(scheduledPromptId, limit = 50) {
    try {
        const result = await turso.execute({
            sql: `SELECT * FROM automation_logs 
                  WHERE scheduled_prompt_id = ?
                  ORDER BY created_at DESC
                  LIMIT ?`,
            args: [scheduledPromptId, limit]
        });

        return result.rows.map(row => ({
            ...row,
            integrationResults: JSON.parse(row.integration_results || '{}'),
            executionTime: new Date(row.execution_time),
            createdAt: new Date(row.created_at)
        }));

    } catch (error) {
        console.error('❌ Error getting automation execution history:', error);
        throw error;
    }
}

/**
 * Clean up old automation logs (called by trigger, but can be manual)
 * @returns {Promise<number>} - Number of logs deleted
 */
export async function cleanupOldAutomationLogs() {
    try {
        const result = await turso.execute({
            sql: `DELETE FROM automation_logs 
                  WHERE created_at < datetime('now', '-2 days')`,
            args: []
        });

        if (result.rowsAffected > 0) {
            console.log(`🧹 Cleaned up ${result.rowsAffected} old automation logs`);
        }

        return result.rowsAffected;

    } catch (error) {
        console.error('❌ Error cleaning up old automation logs:', error);
        throw error;
    }
}

/**
 * Get automation statistics for a user
 * @param {number} proKeyId - Pro key ID
 * @returns {Promise<Object>} - Usage statistics
 */
export async function getAutomationStats(proKeyId) {
    try {
        const [scheduleStats, executionStats] = await Promise.all([
            // Schedule statistics
            turso.execute({
                sql: `SELECT 
                        COUNT(*) as total_schedules,
                        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
                      FROM scheduled_prompts 
                      WHERE pro_key_id = ?`,
                args: [proKeyId]
            }),
            // Execution statistics (last 7 days)
            turso.execute({
                sql: `SELECT 
                        COUNT(*) as total_executions,
                        COUNT(CASE WHEN al.status = 'success' THEN 1 END) as successful,
                        COUNT(CASE WHEN al.status = 'failed' THEN 1 END) as failed,
                        AVG(al.execution_duration) as avg_duration
                      FROM automation_logs al
                      JOIN scheduled_prompts sp ON al.scheduled_prompt_id = sp.id
                      WHERE sp.pro_key_id = ? 
                        AND al.created_at >= datetime('now', '-7 days')`,
                args: [proKeyId]
            })
        ]);

        const scheduleData = scheduleStats.rows[0] || {};
        const executionData = executionStats.rows[0] || {};

        return {
            schedules: {
                total: scheduleData.total_schedules || 0,
                pending: scheduleData.pending || 0,
                completed: scheduleData.completed || 0,
                failed: scheduleData.failed || 0,
                remaining: Math.max(0, 10 - (scheduleData.total_schedules || 0))
            },
            executions: {
                total: executionData.total_executions || 0,
                successful: executionData.successful || 0,
                failed: executionData.failed || 0,
                successRate: executionData.total_executions > 0 
                    ? ((executionData.successful || 0) / executionData.total_executions * 100).toFixed(1)
                    : 0,
                avgDuration: executionData.avg_duration ? Math.round(executionData.avg_duration) : 0
            }
        };

    } catch (error) {
        console.error('❌ Error getting automation statistics:', error);
        throw error;
    }
} 