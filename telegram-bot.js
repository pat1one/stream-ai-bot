const TelegramBot = require('node-telegram-bot-api');
const logger = require('./logger');

class TelegramNotificationBot {
    constructor(token, chatId) {
        if (!token) throw new Error('Telegram bot token is required');
        if (!chatId) throw new Error('Telegram chat ID is required');
        
        this.token = token;
        this.chatId = chatId;
        this.bot = new TelegramBot(token, { polling: false });
    }

    async start() {
        try {
            // Проверяем валидность токена и доступ к чату
            const me = await this.bot.getMe();
            logger.logWithContext('info', 'Telegram bot initialized', { 
                botName: me.username,
                event: 'telegram_bot_init'
            });
            
            return true;
        } catch (error) {
            logger.logError(error, { event: 'telegram_bot_init_error' });
            throw error;
        }
    }

    async sendMessage(message) {
        try {
            const result = await this.bot.sendMessage(this.chatId, message, {
                parse_mode: 'HTML',
                disable_web_page_preview: true
            });
            
            logger.logWithContext('info', 'Telegram message sent', {
                messageId: result.message_id,
                event: 'telegram_message_sent'
            });
            
            return result;
        } catch (error) {
            logger.logError(error, { event: 'telegram_message_error' });
            throw error;
        }
    }
}

module.exports = TelegramNotificationBot;