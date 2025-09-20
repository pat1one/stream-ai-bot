// API endpoint for dashboard to get last N log lines (for monitoring UI)
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const LOG_FILE = path.join(__dirname, 'logs', 'combined.log');

// GET /api/logs?limit=100
router.get('/', (req, res) => {
  const limit = Math.max(10, Math.min(1000, parseInt(req.query.limit) || 100));
  fs.readFile(LOG_FILE, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Log file not found' });
    const lines = data.trim().split('\n');
    res.json({ logs: lines.slice(-limit) });
  });
});

module.exports = router;
