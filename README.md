# Upwork Proposal Generator

AI-powered proposal generator for Upwork freelancers using GLM 5 (Z.AI).

## Features

- 🤖 AI-powered proposal generation using GLM 5
- 📊 Admin dashboard for managing prompts and viewing logs
- 🔐 Login-protected dashboard and admin APIs
- 🧪 Built-in test UI for generating proposals
- 📱 Mobile-friendly interface
- 🔐 Secure API key management

## Tech Stack

- **Backend**: Node.js + Express
- **Database**: SQLite (sql.js)
- **AI**: GLM 5 via Z.AI API
- **Frontend**: Vanilla HTML/CSS/JS

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API key + admin credentials
# Ensure ADMIN_PASSWORD is a strong unique value (required at startup)
# Optional: set GLM_MODEL to glm-4.7 or glm-5

# Start server
npm start
```

## API Endpoints

### Public API
- `GET /api/health` - Health check
- `POST /api/generate-proposal` - Generate a proposal (requires authenticated session)
- `POST /api/scrape-job-url` - Extract Upwork job details from URL (requires authenticated session)

### Auth API
- `GET /auth/session` - Get current session state
- `POST /auth/login` - Login with admin username/password
- `POST /auth/logout` - Logout current session

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
│           ├── ai.js      # GLM integration
│           └── scraper.js # Upwork URL extractor
├── public/
│   ├── login.html         # Login page
│   ├── index.html         # Admin dashboard
│   ├── style.css          # Styles
│   ├── app.js             # Dashboard logic
│   └── login.js           # Login logic
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
# Install Chromium for Playwright scraping
npx playwright install chromium

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Auto-start on reboot
pm2 startup
```

## Production Env Notes

- Set `ADMIN_PASSWORD` explicitly; the server will refuse to boot without it.
- Set `TRUST_PROXY=true` when running behind Nginx/Cloudflare so IP-based rate limits work correctly.
- Tune auth throttle with `AUTH_RATE_LIMIT_WINDOW_MS` and `AUTH_RATE_LIMIT_MAX_ATTEMPTS`.

## Chrome Extension (Coming Soon)

The Chrome extension will allow you to:
- Scrape Upwork project pages
- Generate proposals with one click
- Copy proposals directly to clipboard

## License

MIT
