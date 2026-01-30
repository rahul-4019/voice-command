const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/state', async (req, res) => {
  try {
    const userId = (req.query.userId || 'default').toString();
    const state = await db.getState(userId);
    res.json(state);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get state' });
  }
});

app.post('/api/state', async (req, res) => {
  try {
    const userId = (req.query.userId || 'default').toString();
    const { items, history } = req.body || {};
    await db.setState(userId, items, history);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save state' });
  }
});

async function start() {
  await db.connect();
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
