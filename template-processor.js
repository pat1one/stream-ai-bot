const { marked } = require('marked');
const Handlebars = require('handlebars');
const i18next = require('i18next');
const logger = require('./logger');

class TemplateProcessor {
    constructor() {
        // Настраиваем Handlebars для безопасного HTML
        Handlebars.registerHelper('safe', function(text) {
            return new Handlebars.SafeString(text);
        });

        // Условные блоки
        Handlebars.registerHelper('when', function(condition, options) {
            return condition ? options.fn(this) : options.inverse(this);
        });

        // Форматирование дат
        Handlebars.registerHelper('formatDate', function(date, format) {
            if (!date) return '';
            const d = new Date(date);
            // Простой формат по умолчанию
            if (!format) return d.toLocaleString();
            
            // TODO: Добавить поддержку сложных форматов
            return d.toLocaleString();
        });

        // Локализация
        Handlebars.registerHelper('t', function(key, options) {
            return i18next.t(key, options.hash);
        });

        // Плюрализация
        Handlebars.registerHelper('plural', function(count, options) {
            const forms = options.hash;
            if (!forms) return count;

            // Простая русская плюрализация
            const cases = [2, 0, 1, 1, 1, 2];
            const form = count % 100 > 4 && count % 100 < 20 ? 2 : cases[Math.min(count % 10, 5)];
            
            switch(form) {
                case 0: return forms.one || count;
                case 1: return forms.few || count;
                case 2: return forms.many || count;
                default: return count;
            }
        });

        // Математические операции
        Handlebars.registerHelper('math', function(a, operator, b) {
            switch(operator) {
                case '+': return a + b;
                case '-': return a - b;
                case '*': return a * b;
                case '/': return a / b;
                default: return a;
            }
        });

        // Инициализируем хранилище шаблонов
        this.templateCache = new Map();
    }

    /**
     * Регистрация частичного шаблона для переиспользования
     */
    registerPartial(name, template) {
        try {
            Handlebars.registerPartial(name, template);
            logger.logWithContext('info', 'Partial template registered', {
                event: 'template_partial_registered',
                name
            });
        } catch (error) {
            logger.logError(error, {
                event: 'template_partial_register_error',
                name
            });
            throw error;
        }
    }

    /**
     * Компиляция и кэширование шаблона
     */
    compileTemplate(template) {
        const cacheKey = template.name;
        
        try {
            if (!this.templateCache.has(cacheKey)) {
                // Создаем шаблон с поддержкой Markdown
                const compiledTemplate = Handlebars.compile(template.message);
                
                // Оборачиваем в функцию для пост-обработки
                const processedTemplate = (data, options = {}) => {
                    // Применяем шаблонизатор
                    const result = compiledTemplate(data);
                    
                    // Если нужен HTML, конвертируем Markdown
                    if (options.format === 'html') {
                        return marked(result);
                    }
                    
                    return result;
                };

                this.templateCache.set(cacheKey, processedTemplate);
                
                logger.logWithContext('info', 'Template compiled and cached', {
                    event: 'template_compiled',
                    name: template.name
                });
            }
            
            return this.templateCache.get(cacheKey);
        } catch (error) {
            logger.logError(error, {
                event: 'template_compile_error',
                name: template.name
            });
            throw error;
        }
    }

    /**
     * Обработка шаблона с учетом локализации и форматирования
     */
    async processTemplate(template, data, options = {}) {
        try {
            // Получаем или компилируем шаблон
            const compiledTemplate = this.compileTemplate(template);

            // Добавляем вспомогательные данные
            const contextData = {
                ...data,
                _meta: {
                    timestamp: new Date(),
                    locale: options.locale || 'ru',
                    format: options.format || 'text'
                }
            };

            // Применяем шаблон
            const processed = await compiledTemplate(contextData, options);

            logger.logWithContext('info', 'Template processed', {
                event: 'template_processed',
                name: template.name,
                format: options.format
            });

            return processed;
        } catch (error) {
            logger.logError(error, {
                event: 'template_process_error',
                name: template.name
            });
            throw error;
        }
    }

    /**
     * Очистка кэша шаблонов
     */
    clearCache() {
        this.templateCache.clear();
        logger.logWithContext('info', 'Template cache cleared', {
            event: 'template_cache_cleared'
        });
    }
}

module.exports = TemplateProcessor;