# Voice Command Shopping Assistant

A full-stack voice-based shopping list app with smart suggestions. All frontend code lives in **client/** and all backend code in **server/**.

## Structure

```
VoiceCommand/
├── client/          # React + TypeScript + Vite frontend
│   ├── src/
│   ├── public/
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── server/          # Node.js + Express API
│   ├── index.js
│   └── package.json
├── package.json     # Root scripts to run client or server
└── README.md
```

## Run locally

1. **Install dependencies** (from repo root):

   ```bash
   npm run install:all
   ```
   Or install each app:
   ```bash
   npm install --prefix client
   npm install --prefix server
   ```

2. **Start the API** (terminal 1):

   ```bash
   npm run dev:server
   ```
   Server runs at `http://localhost:4000`.

3. **Start the frontend** (terminal 2):

   ```bash
   npm run dev:client
   ```
   Open the URL shown (e.g. `http://localhost:5173`). Use Chrome for best voice support.

## Scripts (from root)

| Script           | Description                |
|------------------|----------------------------|
| `npm run dev:client`  | Start Vite dev server (client) |
| `npm run dev:server`  | Start Express server          |
| `npm run build:client`| Build client for production   |
| `npm run start:server`| Run server (production)       |
| `npm run install:all` | Install root, client, server  |

## Tech

- **Client:** React 19, TypeScript, Vite. Voice via Web Speech API; list and suggestions in UI.
- **Server:** Express, CORS. In-memory store for list/history; `GET/POST /api/state?userId=default`.
