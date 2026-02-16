/**
 * Express Server for Upwork Proposal Generator
 * Lightweight setup for Hetzner CX23
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
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
    version: '1.0.0'
  });
});

// ============================================
// ADMIN API ROUTES
// ============================================

/**
 * Get all prompts
 */
app.get('/admin/api/prompts', (req, res) => {
  try {
    const allPrompts = db.prompts.getAll();
    res.json({ success: true, data: allPrompts });
  } catch (error) {
    console.error('Error fetching prompts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update prompts
 */
app.put('/admin/api/prompts', (req, res) => {
  try {
    const { promptList } = req.body;
    
    if (!Array.isArray(promptList)) {
      return res.status(400).json({ success: false, error: 'promptList must be an array' });
    }
    
    db.prompts.bulkUpsert(promptList);
    res.json({ success: true, message: 'Prompts updated successfully' });
  } catch (error) {
    console.error('Error updating prompts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get request logs
 */
app.get('/admin/api/logs', (req, res) => {
  try {
    const options = {
      limit: parseInt(req.query.limit) || 100,
      success: req.query.success !== undefined ? req.query.success === 'true' : undefined,
      date: req.query.date || undefined
    };
    
    const allLogs = db.logs.getAll(options);
    res.json({ success: true, data: allLogs });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get single log by ID
 */
app.get('/admin/api/logs/:id', (req, res) => {
  try {
    const log = db.logs.getById(parseInt(req.params.id));
    if (!log) {
      return res.status(404).json({ success: false, error: 'Log not found' });
    }
    res.json({ success: true, data: log });
  } catch (error) {
    console.error('Error fetching log:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get API keys (masked)
 */
app.get('/admin/api/keys', (req, res) => {
  try {
    const keys = db.apiKeys.getAll();
    // Mask the actual keys
    const maskedKeys = keys.map(k => ({
      ...k,
      key_masked: k.key ? `${k.key.substring(0, 8)}...${k.key.substring(k.key.length - 4)}` : null,
      key: undefined
    }));
    res.json({ success: true, data: maskedKeys });
  } catch (error) {
    console.error('Error fetching keys:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update API key
 */
app.post('/admin/api/keys', (req, res) => {
  try {
    const { provider, key } = req.body;
    
    if (!provider || !key) {
      return res.status(400).json({ success: false, error: 'provider and key are required' });
    }
    
    db.apiKeys.upsert(provider, key);
    res.json({ success: true, message: 'API key updated successfully' });
  } catch (error) {
    console.error('Error updating key:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get usage statistics
 */
app.get('/admin/api/stats', (req, res) => {
  try {
    const stats = db.logs.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CATCH-ALL ROUTE (for SPA)
// ============================================

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    success: false, 
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message 
  });
});

// ============================================
// START SERVER
// ============================================

async function startServer() {
  try {
    // Initialize database first
    await db.initDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 Upwork Proposal Generator running on port ${PORT}`);
      console.log(`📊 Admin Dashboard: http://localhost:${PORT}`);
      console.log(`🔑 Health Check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
