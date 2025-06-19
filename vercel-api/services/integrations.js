// Server-side Integration Services
// Discord and Telegram integration for automated scheduled prompts

/**
 * Send analysis results to Discord via webhook
 * @param {Object} analysisData - The analysis data to send
 * @param {string} webhookUrl - Discord webhook URL
 * @returns {Promise<Object>} - Result of the send operation
 */
export async function sendAnalysisToDiscord(analysisData, webhookUrl) {
    try {
        if (!webhookUrl) {
            throw new Error('Discord webhook URL is required');
        }

        const embed = formatAnalysisAsDiscordEmbed(analysisData);

        const payload = {
            content: "🤖 **Agent Hustle Pro Analyzer - Scheduled Analysis Results**",
            embeds: [embed]
        };

        console.log(`🎮 Sending Discord webhook to: ${webhookUrl.substring(0, 50)}...`);

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Discord webhook failed: ${response.status} - ${errorText}`);
        }

        return {
            success: true,
            message: 'Successfully sent to Discord'
        };

    } catch (error) {
        console.error('Error sending to Discord:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Send analysis results to Telegram
 * @param {Object} analysisData - The analysis data to send
 * @param {string} botToken - Telegram bot token
 * @param {string} chatId - Telegram chat ID
 * @returns {Promise<Object>} - Result of the send operation
 */
export async function sendAnalysisToTelegram(analysisData, botToken, chatId) {
    try {
        if (!botToken || !chatId) {
            throw new Error('Bot token and chat ID are required');
        }

        const message = formatAnalysisAsMarkdown(analysisData);

        // Split message if too long (Telegram limit is 4096 characters)
        const messages = splitLongMessage(message);

        const results = [];
        for (const msg of messages) {
            const result = await sendTelegramMessage(botToken, chatId, msg);
            results.push(result);

            // Small delay between messages to avoid rate limiting
            if (messages.length > 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        return {
            success: true,
            messageCount: results.length,
            results: results
        };

    } catch (error) {
        console.error('Error sending to Telegram:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Send a message to Telegram using Bot API
 * @param {string} botToken - Bot token
 * @param {string} chatId - Chat ID
 * @param {string} message - Message text
 * @returns {Promise<Object>} - API response
 */
async function sendTelegramMessage(botToken, chatId, message) {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    const payload = {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.description || `HTTP ${response.status}`);
    }

    return {
        success: true,
        messageId: data.result.message_id
    };
}

/**
 * Format analysis data as Discord embed
 * @param {Object} analysisData - Analysis data object
 * @returns {Object} - Discord embed object
 */
function formatAnalysisAsDiscordEmbed(analysisData) {
    const { analysisType, result, date } = analysisData;

    const embed = {
        title: `📊 ${analysisType || 'Analysis Report'}`,
        description: result.summary || 'Automated analysis completed',
        color: 0x667eea, // Purple color
        timestamp: new Date(date || new Date()).toISOString(),
        footer: {
            text: "Agent Hustle Pro Analyzer - Scheduled Execution",
            icon_url: "https://example.com/icon.png" // You can replace with actual icon URL
        }
    };

    // Add main content
    if (result.content) {
        const content = result.content.length > 1000 
            ? result.content.substring(0, 1000) + '...' 
            : result.content;
        
        embed.fields = embed.fields || [];
        embed.fields.push({
            name: "📝 Analysis Results",
            value: content,
            inline: false
        });
    }

    // Add key points
    if (result.keyPoints && Array.isArray(result.keyPoints) && result.keyPoints.length > 0) {
        embed.fields = embed.fields || [];
        embed.fields.push({
            name: "🔑 Key Points",
            value: result.keyPoints.map((point, index) => `${index + 1}. ${point}`).join('\n'),
            inline: false
        });
    }

    return embed;
}

/**
 * Format analysis data as HTML for Telegram
 * @param {Object} analysisData - Analysis data object
 * @returns {string} - Formatted HTML message
 */
function formatAnalysisAsMarkdown(analysisData) {
    const { analysisType, result, date } = analysisData;

    let message = `🤖 <b>Agent Hustle Analysis Report</b>\n\n`;

    // Add analysis type and date
    message += `📊 <b>Analysis Type:</b> ${analysisType || 'General Analysis'}\n`;
    message += `📅 <b>Generated:</b> ${formatDate(date || new Date())}\n`;
    message += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    // Add executive summary if available
    if (result.summary && result.summary.trim()) {
        message += `📋 <b>Executive Summary</b>\n`;
        message += `${cleanHtmlForTelegram(result.summary.trim())}\n\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    }

    // Add main analysis content
    if (result.content && result.content.trim()) {
        message += `📝 <b>Detailed Analysis</b>\n`;
        const cleanContent = cleanAnalysisContent(result.content);
        message += `${cleanHtmlForTelegram(cleanContent)}\n\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    }

    // Add key points if available
    if (result.keyPoints && Array.isArray(result.keyPoints) && result.keyPoints.length > 0) {
        message += `🔑 <b>Key Insights</b>\n`;
        result.keyPoints.forEach((point, index) => {
            const cleanPoint = point.trim();
            if (cleanPoint) {
                message += `${index + 1}. ${cleanHtmlForTelegram(cleanPoint)}\n`;
            }
        });
        message += '\n';
        message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    }

    // Add footer with branding
    message += `🚀 <b>Powered by Agent Hustle Pro</b>\n`;
    message += `<i>Professional AI Analysis at Your Fingertips</i>`;

    return message;
}

/**
 * Clean and format analysis content for better readability
 * @param {string} content - Raw analysis content
 * @returns {string} - Cleaned content
 */
function cleanAnalysisContent(content) {
    if (!content || typeof content !== 'string') {
        return '';
    }

    let cleaned = content.trim();

    // Remove excessive whitespace and normalize line breaks
    cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');
    cleaned = cleaned.replace(/[ \t]+/g, ' ');

    // Clean up any HTML tags that might be present
    cleaned = cleaned.replace(/<[^>]*>/g, '');

    // Use more of Telegram's 4096 character limit (leave buffer for headers/footers)
    if (cleaned.length > 4000) {
        cleaned = cleaned.substring(0, 4000) + '...\n\n_[Content truncated - message too long for Telegram]_';
    }

    return cleaned.trim();
}

/**
 * Clean HTML for Telegram while preserving readability
 * @param {string} text - Text to clean
 * @returns {string} - Cleaned text
 */
function cleanHtmlForTelegram(text) {
    if (!text || typeof text !== 'string') {
        return '';
    }

    // Escape HTML special characters for Telegram
    return text
        .replace(/&/g, '&amp;')   // Escape ampersands first
        .replace(/</g, '&lt;')    // Escape less than
        .replace(/>/g, '&gt;')    // Escape greater than
        .replace(/"/g, '&quot;')  // Escape quotes
        .replace(/'/g, '&#x27;'); // Escape single quotes
}

/**
 * Split long messages into chunks
 * @param {string} message - Message to split
 * @returns {Array<string>} - Array of message chunks
 */
function splitLongMessage(message) {
    const MAX_MESSAGE_LENGTH = 4096;
    
    if (message.length <= MAX_MESSAGE_LENGTH) {
        return [message];
    }
    
    const chunks = [];
    let currentChunk = '';
    const lines = message.split('\n');

    for (const line of lines) {
        const testChunk = currentChunk + (currentChunk ? '\n' : '') + line;

        if (testChunk.length <= MAX_MESSAGE_LENGTH - 50) { // Leave some buffer
            currentChunk = testChunk;
        } else {
            if (currentChunk) {
                chunks.push(currentChunk);
                currentChunk = line;
            } else {
                // Line itself is too long, split it
                chunks.push(line.substring(0, MAX_MESSAGE_LENGTH - 50) + '...');
                currentChunk = '...' + line.substring(MAX_MESSAGE_LENGTH - 50);
            }
        }
    }

    if (currentChunk) {
        chunks.push(currentChunk);
    }

    return chunks;
}

/**
 * Format date for display
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date string
 */
function formatDate(date) {
    return new Date(date).toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
} 