-- HustlePlug Automation System Database Schema
-- Scheduled Custom Prompt Automation with User Timezone Support

-- Table for storing scheduled prompt automations
CREATE TABLE IF NOT EXISTS scheduled_prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pro_key_id INTEGER NOT NULL,
    prompt_id TEXT, -- Reference to saved prompt (optional)
    prompt_title TEXT NOT NULL,
    prompt_content TEXT NOT NULL,
    scheduled_time DATETIME NOT NULL, -- UTC timestamp
    user_timezone TEXT NOT NULL, -- User's local timezone (e.g., 'America/New_York')
    display_time TEXT NOT NULL, -- Human-readable time in user's timezone
    status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'cancelled'
    integrations TEXT DEFAULT '{}', -- JSON: {"telegram": true, "discord": false}
    execution_count INTEGER DEFAULT 0,
    last_execution DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pro_key_id) REFERENCES pro_keys (id)
);

-- Table for automation execution logs (2-day retention)
CREATE TABLE IF NOT EXISTS automation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scheduled_prompt_id INTEGER NOT NULL,
    execution_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL, -- 'success', 'failed', 'timeout'
    analysis_result TEXT, -- The generated analysis content
    integration_results TEXT, -- JSON: results from Telegram/Discord sends
    error_message TEXT,
    execution_duration INTEGER, -- milliseconds
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (scheduled_prompt_id) REFERENCES scheduled_prompts (id)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_scheduled_prompts_time ON scheduled_prompts(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_scheduled_prompts_status ON scheduled_prompts(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_prompts_pro_key ON scheduled_prompts(pro_key_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_scheduled_id ON automation_logs(scheduled_prompt_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created_at ON automation_logs(created_at);

-- Trigger to automatically clean up logs older than 2 days
CREATE TRIGGER IF NOT EXISTS cleanup_old_automation_logs
AFTER INSERT ON automation_logs
BEGIN
    DELETE FROM automation_logs 
    WHERE created_at < datetime('now', '-2 days');
END;

-- View for getting user's scheduled prompts with readable formatting
CREATE VIEW IF NOT EXISTS user_scheduled_prompts AS
SELECT 
    sp.*,
    pk.status as key_status,
    pk.tier as user_tier,
    COUNT(al.id) as total_executions,
    MAX(al.created_at) as last_log_entry
FROM scheduled_prompts sp
LEFT JOIN pro_keys pk ON sp.pro_key_id = pk.id
LEFT JOIN automation_logs al ON sp.id = al.scheduled_prompt_id
GROUP BY sp.id;

-- Function to check user's schedule limit (10 max)
CREATE VIEW IF NOT EXISTS user_schedule_counts AS
SELECT 
    pro_key_id,
    COUNT(*) as active_schedules
FROM scheduled_prompts 
WHERE status IN ('pending', 'completed')
GROUP BY pro_key_id; 