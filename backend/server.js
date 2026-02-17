/**
 * Express Server for Upwork Proposal Generator
 * Lightweight setup for Hetzner CX23
 */

require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const path = require('path');
const { version: APP_VERSION } = require('../package.json');
const db = require('./database');
const ai = require('./src/services/ai');
const scraper = require('./src/services/scraper');

const app = express();
const PORT = Number.parseInt(process.env.PORT, 10) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const SESSION_COOKIE_NAME = 'upwork_admin_session';
const SESSION_TTL_MS = Number.parseInt(process.env.SESSION_TTL_MS, 10) || 24 * 60 * 60 * 1000;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const TRUST_PROXY = process.env.TRUST_PROXY;

const RATE_LIMIT_WINDOW_MS = Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 20;
const SCRAPER_RATE_LIMIT_WINDOW_MS = Number.parseInt(process.env.SCRAPER_RATE_LIMIT_WINDOW_MS, 10) || 60 * 1000;
const SCRAPER_RATE_LIMIT_MAX_REQUESTS = Number.parseInt(process.env.SCRAPER_RATE_LIMIT_MAX_REQUESTS, 10) || 10;
const AUTH_RATE_LIMIT_WINDOW_MS = Number.parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 10) || 10 * 60 * 1000;
const AUTH_RATE_LIMIT_MAX_ATTEMPTS = Number.parseInt(process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS, 10) || 12;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const sessions = new Map();
const proposalRequestBuckets = new Map();
const scrapeRequestBuckets = new Map();
const authAttemptBuckets = new Map();

app.disable('x-powered-by');
if (TRUST_PROXY === 'true') {
  app.set('trust proxy', true);
} else if (TRUST_PROXY === 'false') {
  app.set('trust proxy', false);
} else if (TRUST_PROXY) {
  app.set('trust proxy', TRUST_PROXY);
} else if (IS_PRODUCTION) {
  app.set('trust proxy', 1);
}

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

app.use((req, res, next) => {
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

// Middleware
app.use(cors({
  origin(origin, callback) {
    // Same-origin or server-side requests do not need CORS checks.
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.length === 0) {
      return callback(null, false);
    }

    return callback(null, allowedOrigins.includes(origin));
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) {
    return {};
  }

  return header.split(';').reduce((cookies, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (!key) {
      return cookies;
    }

    const rawValue = rest.join('=');
    try {
      cookies[key] = decodeURIComponent(rawValue);
    } catch {
      cookies[key] = rawValue;
    }

    return cookies;
  }, {});
}

function pruneExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) {
      sessions.delete(token);
    }
  }
}

function getSessionFromRequest(req) {
  pruneExpiredSessions();
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) {
    return null;
  }

  const session = sessions.get(token);
  if (!session) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }

  return { token, ...session };
}

function setSessionCookie(res, token) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
    'HttpOnly',
    'SameSite=Lax'
  ];

  if (IS_PRODUCTION) {
    parts.push('Secure');
  }

  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res) {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax'
  ];

  if (IS_PRODUCTION) {
    parts.push('Secure');
  }

  res.setHeader('Set-Cookie', parts.join('; '));
}

function requireAdminAuth(req, res, next) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  req.adminSession = session;
  return next();
}

function requireDashboardAuth(req, res, next) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.redirect('/login');
  }

  req.adminSession = session;
  return next();
}

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function secureStringEquals(expected, provided) {
  const expectedBuffer = Buffer.from(String(expected ?? ''));
  const providedBuffer = Buffer.from(String(provided ?? ''));

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}

function pruneProposalRateLimitBuckets() {
  const now = Date.now();
  for (const [ip, bucket] of proposalRequestBuckets.entries()) {
    if (now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
      proposalRequestBuckets.delete(ip);
    }
  }
}

function proposalRateLimit(req, res, next) {
  pruneProposalRateLimitBuckets();

  const now = Date.now();
  const ip = getClientIp(req);
  const bucket = proposalRequestBuckets.get(ip);

  if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
    proposalRequestBuckets.set(ip, { count: 1, windowStart: now });
    return next();
  }

  bucket.count += 1;
  if (bucket.count > RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded. Please try again later.'
    });
  }

  return next();
}

function pruneScrapeRateLimitBuckets() {
  const now = Date.now();
  for (const [ip, bucket] of scrapeRequestBuckets.entries()) {
    if (now - bucket.windowStart > SCRAPER_RATE_LIMIT_WINDOW_MS) {
      scrapeRequestBuckets.delete(ip);
    }
  }
}

function scrapeRateLimit(req, res, next) {
  pruneScrapeRateLimitBuckets();

  const now = Date.now();
  const ip = getClientIp(req);
  const sessionToken = req.adminSession?.token || 'anonymous';
  const bucketKey = `${sessionToken}:${ip}`;
  const bucket = scrapeRequestBuckets.get(bucketKey);

  if (!bucket || now - bucket.windowStart > SCRAPER_RATE_LIMIT_WINDOW_MS) {
    scrapeRequestBuckets.set(bucketKey, { count: 1, windowStart: now });
    return next();
  }

  bucket.count += 1;
  if (bucket.count > SCRAPER_RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      success: false,
      error: 'Too many URL scrape requests. Please try again in a minute.',
      code: scraper.SCRAPE_ERROR_CODES.SCRAPE_FAILED
    });
  }

  return next();
}

function pruneAuthRateLimitBuckets() {
  const now = Date.now();
  for (const [ip, bucket] of authAttemptBuckets.entries()) {
    if (now - bucket.windowStart > AUTH_RATE_LIMIT_WINDOW_MS) {
      authAttemptBuckets.delete(ip);
    }
  }
}

function authLoginRateLimit(req, res, next) {
  pruneAuthRateLimitBuckets();

  const now = Date.now();
  const ip = getClientIp(req);
  const bucket = authAttemptBuckets.get(ip);

  if (!bucket || now - bucket.windowStart > AUTH_RATE_LIMIT_WINDOW_MS) {
    authAttemptBuckets.set(ip, { count: 1, windowStart: now });
    return next();
  }

  bucket.count += 1;
  if (bucket.count > AUTH_RATE_LIMIT_MAX_ATTEMPTS) {
    return res.status(429).json({
      success: false,
      error: 'Too many login attempts. Please try again later.'
    });
  }

  return next();
}

function getClientErrorMessage(error, fallbackMessage) {
  if (!IS_PRODUCTION && error?.message) {
    return error.message;
  }

  return fallbackMessage;
}

function getApiKeyForProvider(provider) {
  if (process.env.GLM_API_KEY) {
    return process.env.GLM_API_KEY;
  }

  const activeKey = db.apiKeys.getActive(provider);
  if (activeKey?.key) {
    return activeKey.key;
  }

  return null;
}

function maskApiKey(key) {
  if (!key) {
    return null;
  }

  if (key.length <= 8) {
    return `${key[0]}***${key[key.length - 1]}`;
  }

  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

function sendDashboardOrLogin(req, res) {
  if (getSessionFromRequest(req)) {
    return res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  }

  return res.sendFile(path.join(PUBLIC_DIR, 'login.html'));
}

// ============================================
// AUTH ROUTES
// ============================================

app.get('/auth/session', (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.json({ authenticated: false });
  }

  return res.json({
    authenticated: true,
    username: session.username,
    expiresAt: session.expiresAt
  });
});

app.post('/auth/login', authLoginRateLimit, (req, res) => {
  const { username, password } = req.body || {};
  const normalizedUsername = String(username || '').trim();

  if (
    !secureStringEquals(ADMIN_USERNAME, normalizedUsername) ||
    !secureStringEquals(ADMIN_PASSWORD, password || '')
  ) {
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  authAttemptBuckets.delete(getClientIp(req));

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_TTL_MS;

  sessions.set(token, {
    username: ADMIN_USERNAME,
    expiresAt
  });

  setSessionCookie(res, token);

  return res.json({
    success: true,
    username: ADMIN_USERNAME,
    expiresAt
  });
});

app.post('/auth/logout', (req, res) => {
  const session = getSessionFromRequest(req);
  if (session?.token) {
    sessions.delete(session.token);
  }

  clearSessionCookie(res);
  return res.json({ success: true });
});

// ============================================
// PUBLIC API ROUTES
// ============================================

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: APP_VERSION
  });
});

/**
 * Scrape Upwork job details from URL
 */
app.post('/api/scrape-job-url', requireAdminAuth, scrapeRateLimit, async (req, res) => {
  const { url } = req.body || {};

  if (!url || typeof url !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'A URL is required',
      code: scraper.SCRAPE_ERROR_CODES.INVALID_URL
    });
  }

  console.log('URL scrape attempt', { url });

  try {
    const data = await scraper.scrapeJobUrl(url);
    console.log('URL scrape success', {
      mode: data.mode,
      warnings: Array.isArray(data.warnings) ? data.warnings.length : 0
    });
    return res.json({ success: true, data });
  } catch (error) {
    const normalizedError = scraper.normalizeScrapeError(error);
    const code = normalizedError.code || scraper.SCRAPE_ERROR_CODES.SCRAPE_FAILED;

    const statusCodeByError = {
      [scraper.SCRAPE_ERROR_CODES.INVALID_URL]: 400,
      [scraper.SCRAPE_ERROR_CODES.UNSUPPORTED_DOMAIN]: 400,
      [scraper.SCRAPE_ERROR_CODES.SCRAPE_BLOCKED_CLOUDFLARE]: 422,
      [scraper.SCRAPE_ERROR_CODES.SCRAPE_FAILED]: 500
    };

    const fallbackMessageByError = {
      [scraper.SCRAPE_ERROR_CODES.INVALID_URL]: 'Please provide a valid Upwork URL',
      [scraper.SCRAPE_ERROR_CODES.UNSUPPORTED_DOMAIN]: 'Only Upwork job URLs are supported in this version',
      [scraper.SCRAPE_ERROR_CODES.SCRAPE_BLOCKED_CLOUDFLARE]: 'Could not fetch this URL due to page protection. Please fill fields manually and continue.',
      [scraper.SCRAPE_ERROR_CODES.SCRAPE_FAILED]: 'Failed to fetch job details from this URL'
    };

    const status = statusCodeByError[code] || 500;
    const clientError = getClientErrorMessage(
      normalizedError,
      fallbackMessageByError[code] || 'Failed to scrape URL'
    );

    console.error('URL scrape failed:', {
      code,
      message: normalizedError.message
    });

    return res.status(status).json({
      success: false,
      error: clientError,
      code
    });
  }
});

/**
 * Generate proposal endpoint
 */
app.post('/api/generate-proposal', requireAdminAuth, proposalRateLimit, async (req, res) => {
  try {
    const { title, description, budget, skills } = req.body || {};

    // Validate required fields
    if (!title || !description) {
      return res.status(400).json({
        success: false,
        error: 'title and description are required'
      });
    }

    // Get prompts from database
    const systemPrompt = db.prompts.get('system');
    const userPromptTemplate = db.prompts.get('user');

    if (!systemPrompt || !userPromptTemplate) {
      return res.status(500).json({
        success: false,
        error: 'Prompts not configured'
      });
    }

    const apiKey = getApiKeyForProvider('glm');
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'GLM API key is not configured'
      });
    }

    // Generate proposal
    const result = await ai.generateProposal({
      title,
      description,
      budget: budget || 'Not specified',
      skills: skills || 'Not specified',
      systemPrompt: systemPrompt.content,
      userPromptTemplate: userPromptTemplate.content,
      apiKey
    });

    // Log successful request
    db.logs.create({
      project_title: title,
      description,
      budget: budget ?? null,
      skills: skills ?? null,
      generated_proposal: result.proposal,
      ai_model: result.model,
      success: true,
      error: null
    });

    return res.json({
      success: true,
      proposal: result.proposal,
      model_used: result.model,
      usage: result.usage
    });
  } catch (error) {
    console.error('Error generating proposal:', error);

    // Log failed request
    try {
      db.logs.create({
        project_title: req.body?.title ?? null,
        description: req.body?.description ?? null,
        budget: req.body?.budget ?? null,
        skills: req.body?.skills ?? null,
        generated_proposal: null,
        ai_model: ai.GLM_MODEL,
        success: false,
        error: error?.message || 'Unknown error'
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return res.status(500).json({
      success: false,
      error: getClientErrorMessage(error, 'Failed to generate proposal')
    });
  }
});

// ============================================
// ADMIN API ROUTES
// ============================================

app.use('/admin/api', requireAdminAuth);

/**
 * Get all prompts
 */
app.get('/admin/api/prompts', (req, res) => {
  try {
    const allPrompts = db.prompts.getAll();
    res.json({ success: true, data: allPrompts });
  } catch (error) {
    console.error('Error fetching prompts:', error);
    res.status(500).json({ success: false, error: getClientErrorMessage(error, 'Failed to fetch prompts') });
  }
});

/**
 * Update prompts
 */
app.put('/admin/api/prompts', (req, res) => {
  try {
    const { promptList } = req.body || {};

    if (!Array.isArray(promptList)) {
      return res.status(400).json({ success: false, error: 'promptList must be an array' });
    }

    db.prompts.bulkUpsert(promptList);
    return res.json({ success: true, message: 'Prompts updated successfully' });
  } catch (error) {
    console.error('Error updating prompts:', error);
    return res.status(500).json({ success: false, error: getClientErrorMessage(error, 'Failed to update prompts') });
  }
});

/**
 * Get request logs
 */
app.get('/admin/api/logs', (req, res) => {
  try {
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const options = {
      limit: Number.isNaN(parsedLimit) ? 100 : Math.min(Math.max(parsedLimit, 1), 500),
      success: req.query.success !== undefined ? req.query.success === 'true' : undefined,
      date: req.query.date || undefined
    };

    const allLogs = db.logs.getAll(options);
    return res.json({ success: true, data: allLogs });
  } catch (error) {
    console.error('Error fetching logs:', error);
    return res.status(500).json({ success: false, error: getClientErrorMessage(error, 'Failed to fetch logs') });
  }
});

/**
 * Get single log by ID
 */
app.get('/admin/api/logs/:id', (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid log id' });
    }

    const log = db.logs.getById(id);
    if (!log) {
      return res.status(404).json({ success: false, error: 'Log not found' });
    }

    return res.json({ success: true, data: log });
  } catch (error) {
    console.error('Error fetching log:', error);
    return res.status(500).json({ success: false, error: getClientErrorMessage(error, 'Failed to fetch log') });
  }
});

/**
 * Delete a log
 */
app.delete('/admin/api/logs/:id', (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid log id' });
    }

    const log = db.logs.getById(id);
    if (!log) {
      return res.status(404).json({ success: false, error: 'Log not found' });
    }

    db.logs.deleteById(id);
    return res.json({ success: true, message: 'Log deleted successfully' });
  } catch (error) {
    console.error('Error deleting log:', error);
    return res.status(500).json({ success: false, error: getClientErrorMessage(error, 'Failed to delete log') });
  }
});

/**
 * Get API keys (masked)
 */
app.get('/admin/api/keys', (req, res) => {
  try {
    const keys = db.apiKeys.getAll();
    const maskedKeys = keys.map((keyRecord) => ({
      ...keyRecord,
      key_masked: maskApiKey(keyRecord.key),
      key: undefined
    }));

    return res.json({ success: true, data: maskedKeys });
  } catch (error) {
    console.error('Error fetching keys:', error);
    return res.status(500).json({ success: false, error: getClientErrorMessage(error, 'Failed to fetch API keys') });
  }
});

/**
 * Update API key
 */
app.post('/admin/api/keys', (req, res) => {
  try {
    const { provider, key } = req.body || {};

    if (provider !== 'glm' || typeof key !== 'string' || !key.trim()) {
      return res.status(400).json({ success: false, error: 'Only provider \"glm\" with a non-empty key is supported' });
    }

    db.apiKeys.upsert(provider, key.trim());
    return res.json({ success: true, message: 'API key updated successfully' });
  } catch (error) {
    console.error('Error updating key:', error);
    return res.status(500).json({ success: false, error: getClientErrorMessage(error, 'Failed to update API key') });
  }
});

/**
 * Get usage statistics
 */
app.get('/admin/api/stats', (req, res) => {
  try {
    const stats = db.logs.getStats();
    return res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return res.status(500).json({ success: false, error: getClientErrorMessage(error, 'Failed to fetch stats') });
  }
});

// ============================================
// PAGE ROUTES
// ============================================

app.get('/', (req, res) => {
  return sendDashboardOrLogin(req, res);
});

app.get('/login', (req, res) => {
  return res.sendFile(path.join(PUBLIC_DIR, 'login.html'));
});

app.get('/index.html', requireDashboardAuth, (req, res) => {
  return res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.get('/dashboard', requireDashboardAuth, (req, res) => {
  return res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use(express.static(PUBLIC_DIR, { index: false }));

// ============================================
// CATCH-ALL ROUTE (for SPA)
// ============================================

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/admin/api/') || req.path.startsWith('/auth/')) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }

  return sendDashboardOrLogin(req, res);
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: getClientErrorMessage(err, 'Internal server error')
  });
});

// ============================================
// START SERVER
// ============================================

async function startServer() {
  try {
    // Initialize database first
    await db.initDatabase();

    if (!ADMIN_PASSWORD) {
      throw new Error('ADMIN_PASSWORD is required. Refusing to start without explicit admin credentials.');
    }

    if (ADMIN_PASSWORD === 'change_this_to_strong_password') {
      throw new Error('ADMIN_PASSWORD is using a default placeholder. Set a strong unique password before starting.');
    }

    if (allowedOrigins.length === 0) {
      console.warn('⚠️ ALLOWED_ORIGINS is empty. Cross-origin browser requests are blocked by CORS.');
    }

    app.listen(PORT, () => {
      console.log(`🚀 Upwork Proposal Generator running on port ${PORT}`);
      console.log(`📊 Dashboard: http://localhost:${PORT}`);
      console.log(`🔑 Health Check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
module.exports.startServer = startServer;
