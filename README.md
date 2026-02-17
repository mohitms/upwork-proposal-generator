# Upwork Proposal Generator

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-339933.svg?logo=node.js&logoColor=white)
![Platform](https://img.shields.io/badge/platform-Node.js%20%2B%20Chrome%20Extension-4b8bbe.svg)
![PM2](https://img.shields.io/badge/process_manager-PM2-2b037a.svg)
![License](https://img.shields.io/badge/license-Internal%20Use%20Only-red.svg)
![Status](https://img.shields.io/badge/status-production%20internal-success.svg)

A complete **AI-powered Upwork proposal generation system** for internal operations, combining:

- 🖥️ **Admin Dashboard** (prompt management, logs, testing, settings)
- 🧩 **Chrome Extension** (one-click proposal generation from Upwork job pages)
- ⚙️ **Backend API** (GLM integration via Z.AI, logging, rate limiting, auth)

> ⚠️ **Internal Use Only**
> This system is intended only for **Mohit** and **Khushi**. Do not distribute publicly.

---

## Table of Contents

- [Live Environment](#live-environment)
- [Architecture Overview](#architecture-overview)
- [Repository Structure](#repository-structure)
- [Core Features](#core-features)
  - [Dashboard Features](#dashboard-features)
  - [Chrome Extension Features](#chrome-extension-features)
  - [Technical Features](#technical-features)
- [Screenshots (Placeholders)](#screenshots-placeholders)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
  - [1) Clone and Install Dependencies](#1-clone-and-install-dependencies)
  - [2) Configure Environment Variables](#2-configure-environment-variables)
  - [3) Start Backend + Dashboard](#3-start-backend--dashboard)
  - [4) Load Chrome Extension (Developer Mode)](#4-load-chrome-extension-developer-mode)
- [Configuration Reference](#configuration-reference)
- [Usage Guide](#usage-guide)
  - [Dashboard Workflow](#dashboard-workflow)
  - [Extension Workflow](#extension-workflow)
- [API Documentation](#api-documentation)
  - [Public Health Endpoint](#public-health-endpoint)
  - [Extension Proposal Endpoint](#extension-proposal-endpoint)
  - [Admin/Protected Endpoints (Session Required)](#adminprotected-endpoints-session-required)
- [Deployment Notes (Hetzner + PM2 + Caddy)](#deployment-notes-hetzner--pm2--caddy)
- [Security Notes](#security-notes)
- [Troubleshooting](#troubleshooting)
- [Roadmap / Next Improvements](#roadmap--next-improvements)
- [Credits](#credits)

---

## Live Environment

- 🌐 **Production URL:** https://upwork.webxhosts.in
- 🖥️ **Hosting:** Hetzner VPS
- 🔁 **Process Manager:** PM2
- 🔒 **Reverse Proxy & HTTPS:** Caddy

---

## Architecture Overview

```text
Upwork Job Page (Chrome)
        │
        ├── Content Script Scrapes Job + Client Data
        │
        ▼
Chrome Extension UI (Generate Proposal)
        │ POST /api/extension/generate
        ▼
Express Backend (Node.js)
        ├── Auth + Rate Limiting + Validation
        ├── Prompt Retrieval (SQLite/sql.js)
        ├── GLM API Call (Z.AI)
        └── Request Logging (SQLite)
        ▼
Generated Proposal → Returned to Extension / Dashboard
```

---

## Repository Structure

```bash
/root/upwork-proposal-generator/
├── backend/
│   ├── server.js           # Express server
│   ├── database.js         # SQLite database helper
│   └── src/services/
│       ├── ai.js           # AI service (GLM)
│       └── scraper.js      # URL scraper
├── public/
│   ├── index.html          # Dashboard HTML
│   ├── login.html          # Login page
│   ├── app.js              # Dashboard JS
│   └── style.css           # Styles (teal theme #1abc9c)
├── extension/
│   ├── manifest.json       # Chrome extension manifest
│   ├── content.js          # Content script (scrapes data)
│   ├── popup.html          # Proposal modal
│   ├── popup.js            # Modal logic
│   ├── popup.css           # Modal styles
│   ├── background.js       # Service worker
│   ├── updates.xml         # Auto-update config
│   └── icons/              # Extension icons
├── data/                   # SQLite database (created at runtime)
├── logs/                   # PM2 logs
├── ecosystem.config.js     # PM2 config
├── .env                    # Environment variables (NOT in git)
├── .env.example            # Example env file
└── package.json
```

---

## Core Features

### Dashboard Features

- ✅ Admin login with session-based authentication
- ✅ **Test Generator** tab for direct proposal testing
- ✅ **Prompts** tab to edit system/user prompt templates
- ✅ **Logs** tab to view proposal generations with metadata
- ✅ **Settings** tab to manage GLM API key entries
- ✅ Sidebar-based navigation with clean UI
- ✅ Branded teal theme (`#1abc9c`)

### Chrome Extension Features

- ✅ Floating **Generate Proposal** button on Upwork job detail pages
- ✅ Scrapes job data:
  - title
  - description
  - budget
  - skills
  - category
- ✅ Scrapes client data for future trust-scoring/enrichment
- ✅ One-click proposal generation
- ✅ Copy-to-clipboard support
- ✅ Loading, success, and error states in modal

### Technical Features

- ✅ Node.js + Express backend
- ✅ SQLite persistence via `sql.js`
- ✅ GLM integration using Z.AI API
- ✅ Rate limiting on API routes
- ✅ Session auth for admin routes
- ✅ CORS allowlist configuration
- ✅ PM2 process management with auto-restart
- ✅ Caddy reverse proxy with HTTPS

---

## Screenshots (Placeholders)

> Add screenshots here in the next documentation pass.

- [ ] Dashboard Login Screen
- [ ] Dashboard Test Generator Tab
- [ ] Dashboard Prompts Tab
- [ ] Dashboard Logs Tab
- [ ] Dashboard Settings Tab
- [ ] Upwork Page with Floating Button
- [ ] Extension Modal (Loading / Success / Error)

Example markdown for later:

```md
![Dashboard](./docs/screenshots/dashboard.png)
![Extension Modal](./docs/screenshots/extension-modal.png)
```

---

## Prerequisites

- Node.js **18+**
- npm (bundled with Node.js)
- Google Chrome (for extension)
- PM2 (for production process management)
- Caddy (for HTTPS reverse proxy)

Install PM2 globally (if needed):

```bash
npm install -g pm2
```

---

## Installation

### 1) Clone and Install Dependencies

```bash
git clone <repository-url> /root/upwork-proposal-generator
cd /root/upwork-proposal-generator
npm install
```

### 2) Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with secure values (do not commit this file).

### 3) Start Backend + Dashboard

**Development:**

```bash
npm run dev
```

**Production (PM2):**

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 status
```

Health check:

```bash
curl https://upwork.webxhosts.in/api/health
```

### 4) Load Chrome Extension (Developer Mode)

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `extension/` folder
5. Open an Upwork job detail page (`/jobs/...` or `/job/...`)
6. Click the floating **Generate Proposal** button

---

## Configuration Reference

Use `.env.example` as the source of truth.

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Admin Authentication
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<set-strong-password>
SESSION_TTL_MS=86400000
TRUST_PROXY=true

# GLM 5 API (Z.AI)
GLM_API_KEY=<your-glm-api-key>
GLM_MODEL=glm-4.7
GLM_API_URL=https://api.z.ai/api/paas/v4/chat/completions
GLM_THINKING_TYPE=enabled

# Security
ALLOWED_ORIGINS=https://upwork.webxhosts.in
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=20
SCRAPER_RATE_LIMIT_WINDOW_MS=60000
SCRAPER_RATE_LIMIT_MAX_REQUESTS=10
AUTH_RATE_LIMIT_WINDOW_MS=600000
AUTH_RATE_LIMIT_MAX_ATTEMPTS=12

# URL Scraper
SCRAPER_NAV_TIMEOUT_MS=30000
SCRAPER_CHALLENGE_WAIT_MS=7000
SCRAPER_ENABLE_PARSER_FALLBACK=true
SCRAPER_HEADLESS=true

# Database
DATABASE_PATH=./data/proposals.db
```

> 🔐 Never commit real API keys, credentials, or environment secrets.

---

## Usage Guide

### Dashboard Workflow

1. Open `https://upwork.webxhosts.in/login`
2. Sign in using admin credentials from `.env`
3. In **Prompts**, verify/update:
   - `system` prompt
   - `user` prompt template
4. In **Settings**, configure/update GLM API key (if required)
5. Use **Test Generator** to generate sample proposals
6. Review outputs and metadata in **Logs**

### Extension Workflow

1. Open a supported Upwork job detail page
2. Click **Generate Proposal** floating button
3. Extension scrapes job + client details automatically
4. Payload is sent to backend endpoint
5. AI-generated proposal appears in modal
6. Click **Copy** to place output in clipboard

---

## API Documentation

### Public Health Endpoint

#### `GET /api/health`

Returns server status and version.

**Response (200):**

```json
{
  "status": "ok",
  "timestamp": "2026-02-17T13:00:00.000Z",
  "version": "1.0.0"
}
```

---

### Extension Proposal Endpoint

#### `POST /api/extension/generate`

Used by Chrome extension to generate a proposal from scraped page data.

- **Auth:** Not session-protected (extension route)
- **Protection:** IP-based rate limiting
- **Content-Type:** `application/json`

**Request body (example):**

```json
{
  "job": {
    "title": "Build React Dashboard",
    "description": "Need a React developer for admin dashboard...",
    "budget": "$500",
    "budgetType": "fixed",
    "skills": ["React", "JavaScript", "API Integration"],
    "category": "Web Development",
    "projectLength": "1 to 3 months",
    "hoursPerWeek": "Less than 30 hrs/week",
    "postedDate": "Posted 2 hours ago",
    "proposalsCount": 10,
    "url": "https://www.upwork.com/jobs/..."
  },
  "client": {
    "name": "Client Name",
    "location": "United States",
    "paymentVerified": true,
    "hires": 12,
    "totalSpent": "$10K+",
    "rating": 4.8,
    "jobsPosted": 25,
    "hireRate": "60%",
    "memberSince": "2019"
  }
}
```

**Success response (200):**

```json
{
  "success": true,
  "proposal": "Hello, I reviewed your project...",
  "requestId": "lks82f"
}
```

**Error responses:**

- `400` → missing required `job.title` or `job.description`
- `429` → extension rate limit exceeded
- `500` → AI/config/server error

---

### Admin/Protected Endpoints (Session Required)

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/session`
- `POST /api/generate-proposal`
- `POST /api/scrape-job-url`
- `GET /admin/api/prompts`
- `PUT /admin/api/prompts`
- `GET /admin/api/logs`
- `GET /admin/api/logs/:id`
- `DELETE /admin/api/logs/:id`
- `GET /admin/api/keys`
- `POST /admin/api/keys`
- `GET /admin/api/stats`

---

## Deployment Notes (Hetzner + PM2 + Caddy)

### PM2

The project includes an `ecosystem.config.js` with:

- app name: `upwork-proposal-generator`
- script: `./backend/server.js`
- autorestart enabled
- memory restart threshold (`300M`)
- logs written under `./logs/`

Useful commands:

```bash
pm2 start ecosystem.config.js
pm2 restart upwork-proposal-generator
pm2 logs upwork-proposal-generator
pm2 status
pm2 save
```

### Caddy Reverse Proxy

Caddy should terminate HTTPS and proxy to local Node app (port `3000`).

High-level flow:

```text
Internet (HTTPS) -> Caddy -> localhost:3000 (Express)
```

Ensure:

- TLS certificate is active
- `ALLOWED_ORIGINS` includes production origin
- `TRUST_PROXY=true` is set behind reverse proxy

---

## Security Notes

- 🔐 **Admin auth required** for dashboard and admin APIs
- 🍪 Session cookie is `HttpOnly` and `SameSite=Lax` (`Secure` in production)
- 🚦 Multiple rate limit layers:
  - Auth attempts
  - Proposal generation
  - URL scraping
  - Extension endpoint
- 🌍 CORS restricted by `ALLOWED_ORIGINS`
- 🛡️ Security headers enabled (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`)
- 🔑 API keys are masked in admin API responses

**Operational best practices:**

- Use strong unique admin password
- Rotate API keys periodically
- Monitor logs regularly (`logs/`, PM2 logs)
- Keep Node dependencies updated

---

## Troubleshooting

### 1) `ADMIN_PASSWORD is required` on startup

Set a non-default `ADMIN_PASSWORD` in `.env`.

### 2) Dashboard opens but login fails

- Verify `ADMIN_USERNAME` and `ADMIN_PASSWORD`
- Check PM2/server logs for failed auth attempts
- Confirm system clock/session TTL are sane

### 3) Extension button not visible on Upwork page

- Confirm URL matches job detail pages (`/job/` or `/jobs/`)
- Reload extension from `chrome://extensions`
- Refresh Upwork tab

### 4) Extension shows API/network error

- Check backend is reachable at `https://upwork.webxhosts.in`
- Verify Caddy proxy and SSL status
- Inspect browser console + PM2 logs

### 5) `AI service not configured`

- Set `GLM_API_KEY` in `.env` or dashboard settings
- Confirm `GLM_API_URL` and model are correct

### 6) Rate limit errors (429)

- Wait for rate-limit window to reset
- Tune limits in `.env` if needed for internal traffic patterns

### 7) CORS blocked requests

- Ensure frontend/extension origin is in `ALLOWED_ORIGINS`
- Restart PM2 after changing `.env`

---

## Roadmap / Next Improvements

- Client trust scoring using scraped client metadata
- Better proposal personalization by job category
- Optional multi-provider AI fallback
- Enhanced dashboard analytics and filtering

---

## Credits

Built and maintained for internal operations by:

- **Tridhya Tech**
- **Khushi Agrawal**
- **Jarvis AI Assistant**

---

### Internal Notice

This repository and deployment are intended for private internal workflows only. Do not share source, extension package, credentials, or deployment details outside authorized team members.
