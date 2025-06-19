-- User Integration Settings Database Schema (Fixed Version)
-- Stores Discord and Telegram settings for pro key users

-- Table for storing user integration settings (Discord, Telegram)
CREATE TABLE IF NOT EXISTS user_integration_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pro_key_id INTEGER NOT NULL,
    integration_type TEXT NOT NULL,
    settings TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pro_key_id) REFERENCES pro_keys (id) ON DELETE CASCADE,
    UNIQUE(pro_key_id, integration_type)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_user_integration_pro_key ON user_integration_settings(pro_key_id);

CREATE INDEX IF NOT EXISTS idx_user_integration_type ON user_integration_settings(integration_type);

CREATE INDEX IF NOT EXISTS idx_user_integration_active ON user_integration_settings(is_active);

-- View for getting active integration settings with user details
CREATE VIEW IF NOT EXISTS active_user_integrations AS
SELECT 
    uis.id,
    uis.pro_key_id,
    uis.integration_type,
    uis.settings,
    uis.created_at,
    uis.updated_at,
    pk.status as key_status,
    pk.tier as user_tier,
    pk.notes as key_notes,
    c.name as customer_name,
    c.email as customer_email
FROM user_integration_settings uis
LEFT JOIN pro_keys pk ON uis.pro_key_id = pk.id
LEFT JOIN customers c ON pk.id = c.pro_key_id
WHERE uis.is_active = TRUE AND pk.status = 'active'; 