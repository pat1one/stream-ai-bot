# Расширенные шаблоны уведомлений: примеры и возможности

## Форматирование (Markdown/HTML)

**Пример шаблона:**
```
{
  "name": "welcome-markdown",
  "title": "Добро пожаловать, {{name}}!",
  "message": """
# Привет, {{name}}!

*Спасибо за регистрацию на нашем сервисе.*

- Ваш ID: **{{userId}}**
- Дата: {{formatDate _meta.timestamp}}
""",
  "parameters": [
    { "name": "name", "type": "string", "required": true },
    { "name": "userId", "type": "string", "required": true }
  ],
  "important": true
}
```

## Условные блоки

**Пример:**
```
"message": """
{{#when isPremium}}
  🎉 Спасибо за покупку Premium!
{{else}}
  Хотите больше возможностей? Оформите Premium!
{{/when}}
"""
```

## Вложенные шаблоны (partials)

**Пример:**
```
// partials/greeting.hbs
Привет, {{name}}!

// основной шаблон
"message": "{{> greeting}}\nВаш баланс: {{balance}} руб."
```

## Локализация

**Пример:**
```
"message": "{{t 'welcome_message' name=name}}"
```

Где в i18next:
```
{
  "welcome_message": "Добро пожаловать, {{name}}!"
}
```

## Плюрализация

**Пример:**
```
"message": "У вас {{count}} {{plural count one='сообщение' few='сообщения' many='сообщений'}}."
```

## Математические операции

**Пример:**
```
"message": "Скидка: {{math price '-' discount}} руб."
```

---

### Как использовать
- В поле message используйте Handlebars-синтаксис: `{{param}}`, `{{#when ...}}...{{/when}}`, `{{> partial}}`, `{{t ...}}` и др.
- Для Markdown-форматирования используйте многострочные строки и опцию format: 'html' при отправке.
- Для локализации определите ключи в i18next.
- Для частичных шаблонов используйте метод registerPartial.

**Внимание:**
- Все параметры должны быть определены в массиве parameters.
- Для предпросмотра используйте UI dashboard (будет добавлен).
