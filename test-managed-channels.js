// Тестирование хранения и управления каналами
const db = require('./db');

function loadManagedChannels() {
  try {
    const rows = db.prepare('SELECT name FROM managed_channels').all();
    return rows.map(r => r.name);
  } catch(e) { return []; }
}
function addChannel(name) {
  try { db.prepare('INSERT OR IGNORE INTO managed_channels (name) VALUES (?)').run(name); } catch(e) {}
}
function removeChannel(name) {
  try { db.prepare('DELETE FROM managed_channels WHERE name = ?').run(name); } catch(e) {}
}

console.log('--- Тест: начальный список ---');
console.log(loadManagedChannels());

console.log('--- Добавление test_channel ---');
addChannel('test_channel');
console.log(loadManagedChannels());

console.log('--- Удаление test_channel ---');
removeChannel('test_channel');
console.log(loadManagedChannels());

console.log('--- Добавление channel1, channel2 ---');
addChannel('channel1');
addChannel('channel2');
console.log(loadManagedChannels());

console.log('--- Очистка ---');
removeChannel('channel1');
removeChannel('channel2');
console.log(loadManagedChannels());
