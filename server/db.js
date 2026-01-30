const mongoose = require('mongoose');

const userStateSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  items: { type: mongoose.Schema.Types.Mixed, default: [] },
  history: { type: [String], default: [] },
}, { timestamps: true });

const UserState = mongoose.model('UserState', userStateSchema);

async function connect() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/voicecommand';
  await mongoose.connect(uri);
}

async function getState(userId) {
  const doc = await UserState.findOne({ userId }).lean();
  if (!doc) {
    return { items: [], history: [] };
  }
  return {
    items: Array.isArray(doc.items) ? doc.items : [],
    history: Array.isArray(doc.history) ? doc.history : [],
  };
}

async function setState(userId, items, history) {
  await UserState.findOneAndUpdate(
    { userId },
    { items: items || [], history: history || [] },
    { upsert: true, new: true }
  );
}

module.exports = { connect, getState, setState };
