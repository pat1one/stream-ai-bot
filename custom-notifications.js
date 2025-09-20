const logger = require('./logger');
const { validateNotificationTemplate, validateParameterValues } = require('./validation');
const db = require('./db');
const TemplateProcessor = require('./template-processor');

class CustomNotificationManager {
    constructor(notificationManager) {
        this.notificationManager = notificationManager;
        this.templateProcessor = new TemplateProcessor();
    }

    validateNotificationTemplate(template) {
        return validateNotificationTemplate(template);
    }

    // Сохранение шаблона уведомления
    async saveTemplate(template) {
        try {
            const validationResult = this.validateNotificationTemplate(template);
            if (!validationResult.valid) {
                throw new Error(`Invalid template: ${validationResult.errors.join(', ')}`);
            }

            const query = `
                INSERT INTO notification_templates (name, title, message, parameters, important, category, priority, tags)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (name) DO UPDATE
                SET title = $2, message = $3, parameters = $4, important = $5, category = $6, priority = $7, tags = $8
                RETURNING *
            `;

            const result = await db.query(query, [
                template.name,
                template.title,
                template.message,
                JSON.stringify(template.parameters || []),
                template.important || false,
                template.category || null,
                template.priority || null,
                template.tags || null
            ]);

            logger.logWithContext('info', 'Notification template saved', {
                event: 'notification_template_saved',
                templateName: template.name
            });

            return result.rows[0];
        } catch (error) {
            logger.logError(error, { event: 'notification_template_save_error' });
            throw error;
        }
    }

    // Создание уведомления из шаблона
    async getTemplate(name) {
        try {
            const result = await db.query(
                'SELECT * FROM notification_templates WHERE name = $1',
                [name]
            );

            if (result.rows.length === 0) {
                throw new Error(`Template ${name} not found`);
            }

            return result.rows[0];
        } catch (error) {
            logger.logError(error, { event: 'notification_template_get_error' });
            throw error;
        }
    }

    async listTemplates() {
        try {
            const result = await db.query('SELECT * FROM notification_templates ORDER BY name');
            return result.rows;
        } catch (error) {
            logger.logError(error, { event: 'notification_template_list_error' });
            throw error;
        }
    }

    async deleteTemplate(name) {
        try {
            const result = await db.query(
                'DELETE FROM notification_templates WHERE name = $1 RETURNING name',
                [name]
            );

            if (result.rows.length === 0) {
                throw new Error(`Template ${name} not found`);
            }

            logger.logWithContext('info', 'Notification template deleted', {
                event: 'notification_template_deleted',
                templateName: name
            });

            return result.rows[0];
        } catch (error) {
            logger.logError(error, { event: 'notification_template_delete_error' });
            throw error;
        }
    }


    async createFromTemplate(templateName, userId, parameters = {}, options = {}) {
        try {
            const template = await this.getTemplate(templateName);
            // Валидируем значения параметров
            const validationResult = validateParameterValues(template, parameters);
            if (!validationResult.valid) {
                throw new Error(`Invalid parameters: ${validationResult.errors.join(', ')}`);
            }

            // Формируем данные для шаблона
            const data = { ...parameters };
            // Рендерим шаблон с помощью TemplateProcessor
            const message = await this.templateProcessor.processTemplate(template, data, { format: options.format || 'text', locale: options.locale || 'ru' });
            const title = await this.templateProcessor.processTemplate({ ...template, message: template.title }, data, { format: 'text', locale: options.locale || 'ru' });

            // Отправляем уведомление
            return await this.notificationManager.sendNotification(userId, {
                title,
                message,
                important: template.important
            });
        } catch (error) {
            logger.logError(error, {
                event: 'notification_template_create_error',
                templateName,
                userId
            });
            throw error;
        }
    }

    // Замена параметров в тексте
    _replaceParameters(text, parameters) {
        return text.replace(/\${([^}]+)}/g, (_, key) => {
            return parameters.hasOwnProperty(key) ? parameters[key] : '${' + key + '}';
        });
    }
}

module.exports = CustomNotificationManager;