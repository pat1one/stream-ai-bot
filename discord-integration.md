# Интеграция с Discord

1. Получите токен Discord-бота и ID канала (см. https://discord.com/developers/applications)
2. Укажите их в переменных окружения:
   - DISCORD_BOT_TOKEN
   - DISCORD_CHANNEL_ID
3. Бот автоматически подключится и сможет отправлять сообщения в указанный канал.
4. Для отправки сообщений используйте DiscordBot.sendMessage(text)

Пример использования:
```js
const DiscordBot = require('./discord-bot');
const bot = new DiscordBot(process.env.DISCORD_BOT_TOKEN, process.env.DISCORD_CHANNEL_ID);
bot.start().then(() => bot.sendMessage('Stream AI Bot запущен!'));
```
