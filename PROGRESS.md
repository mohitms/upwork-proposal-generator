# Upwork Proposal Generator - Progress Tracker

## Project Overview
- **Tech Stack**: Node.js, Express, SQLite, GLM 5 (Z.AI)
- **Target**: Hetzner CX23 (2 vCPU, 4GB RAM)
- **Repo**: github.com/mohitms/upwork-proposal-generator

---

## PHASE 1: Backend Foundation
**Status**: 🔄 In Progress

- [x] Initialize Git repository
- [ ] Create project structure
- [ ] Set up Node.js with Express
- [ ] Create SQLite database schema
- [ ] Create database helper functions
- [ ] Basic Express server with /api/health
- [ ] Push to GitHub
- [ ] Update PROGRESS.md

---

## PHASE 2: AI Integration (GLM 5 Only)
**Status**: ⏳ Pending

- [ ] Install axios for API calls
- [ ] Create src/services/ai.js
- [ ] Load system/user prompts from database
- [ ] Create /api/generate-proposal endpoint
- [ ] Add error handling
- [ ] Test endpoint
- [ ] Push to GitHub
- [ ] Update PROGRESS.md

---

## PHASE 3: Admin Dashboard + Test UI
**Status**: ⏳ Pending

- [ ] Create public/ folder with dashboard files
- [ ] Build Prompts tab
- [ ] Build Logs tab
- [ ] Build Settings tab
- [ ] Build Test Generator tab
- [ ] Create admin API routes
- [ ] Test all functionality
- [ ] Push to GitHub
- [ ] Update PROGRESS.md

---

## PHASE 4: Deployment to Hetzner
**Status**: ⏳ Pending

- [ ] Create .env file
- [ ] Set up PM2
- [ ] Configure Nginx
- [ ] Set up SSL (if domain)
- [ ] Test external access
- [ ] Update README with URL
- [ ] Push final version
- [ ] Update PROGRESS.md

---

## Notes
- API key source: ~/.openclaw/agents/main/agent/auth-profiles.json (zai:default)
- Keep lightweight for Hetzner CX23
- Dashboard must be mobile-friendly
