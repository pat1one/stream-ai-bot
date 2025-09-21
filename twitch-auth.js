const fs = require('fs');
const path = require('path');
const axios = require('axios');

const configPath = path.join(__dirname, 'config.json');
let config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

async function refreshAccessToken() {
  const url = 'https://id.twitch.tv/oauth2/token';
  try {
    const response = await axios.post(url, null, {
      params: {
        grant_type: 'refresh_token',
        refresh_token: config.refresh_token,
        client_id: config.client_id,
        client_secret: config.client_secret
      }
    });
    config.access_token = response.data.access_token;
    config.refresh_token = response.data.refresh_token || config.refresh_token;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return config.access_token;
  } catch (err) {
    console.error('Ошибка обновления Twitch токена:', err.response?.data || err.message);
    return null;
  }
}

function getAccessToken() {
  return config.access_token;
}

module.exports = {
  refreshAccessToken,
  getAccessToken
};
