# Upwork Proposal Generator - Progress Tracker

## Project Overview
- **Tech Stack**: Node.js, Express, SQLite, GLM 5 (Z.AI)
- **Target**: Hetzner CX23 (2 vCPU, 4GB RAM)
- **Repo**: github.com/mohitms/upwork-proposal-generator

---

## PHASE 1: Backend Foundation
**Status**: ✅ Complete (2026-02-16)

- [x] Initialize Git repository
- [x] Create project structure
- [x] Set up Node.js with Express
- [x] Create SQLite database schema
- [x] Create database helper functions
- [x] Basic Express server with /api/health
- [x] Push to GitHub
- [x] Update PROGRESS.md

---

## PHASE 2: AI Integration (GLM 5 Only)
**Status**: 🔄 In Progress

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
