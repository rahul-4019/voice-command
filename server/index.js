const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// In-memory store keyed by a simple userId (for demo)
const store = {
  default: {
    items: [],
    history: [],
  },
};

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/state', (req, res) => {
  const userId = (req.query.userId || 'default').toString();
  if (!store[userId]) {
    store[userId] = { items: [], history: [] };
  }
  res.json(store[userId]);
});

app.post('/api/state', (req, res) => {
  const userId = (req.query.userId || 'default').toString();
  const { items, history } = req.body || {};
  store[userId] = {
    items: Array.isArray(items) ? items : [],
    history: Array.isArray(history) ? history : [],
  };
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Backend server listening on http://localhost:${PORT}`);
});

