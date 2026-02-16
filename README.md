# Upwork Proposal Generator

AI-powered proposal generator for Upwork freelancers using GLM 5 (Z.AI).

## Features

- 🤖 AI-powered proposal generation using GLM 5
- 📊 Admin dashboard for managing prompts and viewing logs
- 🧪 Built-in test UI for generating proposals
- 📱 Mobile-friendly interface
- 🔐 Secure API key management

## Tech Stack

- **Backend**: Node.js + Express
- **Database**: SQLite (better-sqlite3)
- **AI**: GLM 5 via Z.AI API
- **Frontend**: Vanilla HTML/CSS/JS

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API key

# Start server
npm start
```

## API Endpoints

### Public API
- `GET /api/health` - Health check
- `POST /api/generate-proposal` - Generate a proposal

### Admin API
- `GET /admin/api/prompts` - Get all prompts
- `PUT /admin/api/prompts` - Update prompts
- `GET /admin/api/logs` - Get request logs
- `GET /admin/api/keys` - Get API key status
- `POST /admin/api/keys` - Update API key
- `GET /admin/api/stats` - Get usage statistics

## Project Structure

```
upwork-proposal-generator/
├── backend/
│   ├── server.js          # Express server
│   ├── database.js        # SQLite helpers
│   └── src/
│       └── services/
│           └── ai.js      # GLM 5 integration
├── public/
│   ├── index.html         # Admin dashboard
│   ├── style.css          # Styles
│   └── app.js             # Dashboard logic
├── extension/             # Browser extension (future)
├── package.json
├── .env.example
└── README.md
```

## Deployment

Deployed on Hetzner CX23 (2 vCPU, 4GB RAM).

**Live Dashboard:** https://upwork.webxhosts.in

**Admin Tabs:**
- **Prompts** - Edit system and user prompts
- **Logs** - View all generated proposals
- **Settings** - Manage API keys
- **Test Generator** - Try it out!

## Production Setup

```bash
# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Auto-start on reboot
pm2 startup
```

## Chrome Extension (Coming Soon)

The Chrome extension will allow you to:
- Scrape Upwork project pages
- Generate proposals with one click
- Copy proposals directly to clipboard

## License

MIT
