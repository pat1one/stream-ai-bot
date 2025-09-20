// discord-bot.js — интеграция с Discord
const { Client, GatewayIntentBits } = require('discord.js');

class DiscordBot {
  constructor(token, channelId) {
    this.token = token;
    this.channelId = channelId;
    this.client = null;
  }

  async start() {
    if (this.client) return;
    this.client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
    this.client.once('ready', () => {
      console.log(`[discord-bot] Logged in as ${this.client.user.tag}`);
    });
    await this.client.login(this.token);
  }

  async sendMessage(message) {
    if (!this.client) throw new Error('Discord client not started');
    const channel = await this.client.channels.fetch(this.channelId);
    if (!channel) throw new Error('Discord channel not found');
    await channel.send(message);
  }
}

module.exports = DiscordBot;
