-- Таблица для хранения шаблонов уведомлений
CREATE TABLE IF NOT EXISTS notification_templates (
    name TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    parameters JSONB DEFAULT '[]'::jsonb,
    important BOOLEAN DEFAULT false,
    category TEXT,
    priority TEXT,
    tags TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблица для хранения истории отправленных уведомлений
CREATE TABLE IF NOT EXISTS notification_history (
    id SERIAL PRIMARY KEY,
    template_name TEXT REFERENCES notification_templates(name),
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    parameters JSONB,
    important BOOLEAN DEFAULT false,
    category TEXT,
    priority TEXT,
    tags TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'sent',
    platforms JSONB DEFAULT '[]'::jsonb -- список платформ, куда было отправлено
);

-- Функция для обновления timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггер для обновления timestamp при изменении шаблона
CREATE TRIGGER update_notification_template_updated_at
    BEFORE UPDATE ON notification_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();