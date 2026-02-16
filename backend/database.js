/**
 * SQLite Database Helper Functions
 * Using sql.js (pure JavaScript SQLite)
 */

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'proposals.db');
const dataDir = path.dirname(DB_PATH);

const LEGACY_SYSTEM_PROMPT = `You are an expert Upwork proposal writer. Your task is to create compelling, personalized proposals that help freelancers win jobs. 

Key principles:
- Be concise but impactful
- Address the client's specific needs
- Highlight relevant experience
- Include a clear call to action
- Avoid generic templates
- Match the client's tone and communication style`;

const LEGACY_USER_PROMPT = `Write a winning Upwork proposal for the following job:

Title: {{title}}

Description:
{{description}}

Budget: {{budget}}

Required Skills: {{skills}}

Create a professional, personalized proposal that stands out. Keep it under 300 words.`;

const DEFAULT_SYSTEM_PROMPT = `You write Upwork proposals for Khushi Agrawal from Tridhya Tech.

Follow these rules in every response:
Start with "Hi!".
Never start with "Ah.".
Use plain, simple English.
Avoid jargon and complicated words.
Keep it short and engaging (about 120 to 190 words).
Do not use bullet points, numbered lists, or markdown.
Add light personality and subtle humor only when it feels natural.
Focus on what the client cares about: clear outcomes and practical results.
Explain the approach clearly in a few short sentences.
End with one relevant question to continue the conversation.
Do not invent facts, fake case studies, fake metrics, or unrealistic guarantees.
Avoid generic lines like "Hope you are doing well" and avoid partnership pitch tone.
Do not use em dash characters.`;

const DEFAULT_USER_PROMPT = `Write one strong Upwork proposal using the details below.

Sender identity:
Name: Khushi Agrawal
Role: Business Development Executive
Company: Tridhya Tech

Job title:
{{title}}

Job description:
{{description}}

Budget:
{{budget}}

Required skills:
{{skills}}

Output requirements:
Write one clean paragraph-based proposal only.
No bullet points.
No headings.
No markdown.
Start with "Hi!" and end with one specific question tied to this job.
Keep it specific to this client request and focus on business results.`;

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let db = null;
let SQL = null;

// Initialize database
async function initDatabase() {
  SQL = await initSqlJs();
  
  // Try to load existing database
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  
  initSchema();
  console.log('✅ Database initialized (sql.js)');
}

// Save database to disk
function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// Initialize schema
function initSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL UNIQUE,
      key TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS prompts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS request_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_title TEXT,
      description TEXT,
      budget TEXT,
      skills TEXT,
      generated_proposal TEXT,
      ai_model TEXT,
      success INTEGER DEFAULT 1,
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert default prompts if not exist
  const existingPrompts = db.exec("SELECT COUNT(*) as count FROM prompts WHERE type IN ('system', 'user')");
  if (existingPrompts[0]?.values[0]?.[0] < 2) {
    db.run(`INSERT OR IGNORE INTO prompts (type, content) VALUES (?, ?)`, [
      'system',
      DEFAULT_SYSTEM_PROMPT
    ]);

    db.run(`INSERT OR IGNORE INTO prompts (type, content) VALUES (?, ?)`, [
      'user',
      DEFAULT_USER_PROMPT
    ]);
  }

  const migrated = migrateLegacyPromptDefaults();
  if (existingPrompts[0]?.values[0]?.[0] < 2 || migrated) {
    saveDatabase();
  }
}

function migrateLegacyPromptDefaults() {
  let hasUpdates = false;

  const systemPrompt = queryOne('SELECT id, content FROM prompts WHERE type = ?', ['system']);
  if (systemPrompt && systemPrompt.content === LEGACY_SYSTEM_PROMPT) {
    db.run('UPDATE prompts SET content = ?, updated_at = datetime("now") WHERE id = ?', [
      DEFAULT_SYSTEM_PROMPT,
      systemPrompt.id
    ]);
    hasUpdates = true;
  }

  const userPrompt = queryOne('SELECT id, content FROM prompts WHERE type = ?', ['user']);
  if (userPrompt && userPrompt.content === LEGACY_USER_PROMPT) {
    db.run('UPDATE prompts SET content = ?, updated_at = datetime("now") WHERE id = ?', [
      DEFAULT_USER_PROMPT,
      userPrompt.id
    ]);
    hasUpdates = true;
  }

  return hasUpdates;
}

// Helper to run queries and get results
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  const normalizedParams = normalizeParams(params);
  if (normalizedParams.length > 0) {
    stmt.bind(normalizedParams);
  }
  
  const results = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row);
  }
  stmt.free();
  return results;
}

function queryOne(sql, params = []) {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

function normalizeParams(params = []) {
  return params.map((value) => (value === undefined ? null : value));
}

function runSql(sql, params = []) {
  db.run(sql, normalizeParams(params));
  saveDatabase();
  return { changes: db.getRowsModified() };
}

// API Keys helpers
const apiKeys = {
  get: (provider) => {
    return queryOne('SELECT * FROM api_keys WHERE provider = ?', [provider]);
  },

  getActive: (provider) => {
    return queryOne('SELECT * FROM api_keys WHERE provider = ? AND is_active = 1', [provider]);
  },
  
  getAll: () => {
    return queryAll('SELECT id, provider, key, is_active, created_at, updated_at FROM api_keys');
  },
  
  upsert: (provider, key) => {
    const existing = queryOne('SELECT id FROM api_keys WHERE provider = ?', [provider]);
    if (existing) {
      runSql('UPDATE api_keys SET key = ?, updated_at = datetime("now") WHERE provider = ?', [key, provider]);
    } else {
      runSql('INSERT INTO api_keys (provider, key, is_active) VALUES (?, ?, 1)', [provider, key]);
    }
    return { changes: 1 };
  },
  
  setActive: (provider, isActive) => {
    return runSql('UPDATE api_keys SET is_active = ?, updated_at = datetime("now") WHERE provider = ?', 
      [isActive ? 1 : 0, provider]);
  }
};

// Prompts helpers
const prompts = {
  getAll: () => {
    return queryAll('SELECT * FROM prompts ORDER BY type');
  },
  
  get: (type) => {
    return queryOne('SELECT * FROM prompts WHERE type = ?', [type]);
  },
  
  upsert: (type, content) => {
    const existing = queryOne('SELECT id FROM prompts WHERE type = ?', [type]);
    if (existing) {
      runSql('UPDATE prompts SET content = ?, updated_at = datetime("now") WHERE type = ?', [content, type]);
    } else {
      runSql('INSERT INTO prompts (type, content) VALUES (?, ?)', [type, content]);
    }
    return { changes: 1 };
  },
  
  bulkUpsert: (promptList) => {
    for (const item of promptList) {
      const existing = queryOne('SELECT id FROM prompts WHERE type = ?', [item.type]);
      if (existing) {
        runSql('UPDATE prompts SET content = ?, updated_at = datetime("now") WHERE type = ?', [item.content, item.type]);
      } else {
        runSql('INSERT INTO prompts (type, content) VALUES (?, ?)', [item.type, item.content]);
      }
    }
  }
};

// Request Logs helpers
const logs = {
  create: (data) => {
    return runSql(`
      INSERT INTO request_logs (project_title, description, budget, skills, generated_proposal, ai_model, success, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.project_title ?? null,
      data.description ?? null,
      data.budget ?? null,
      data.skills ?? null,
      data.generated_proposal ?? null,
      data.ai_model ?? null,
      data.success ? 1 : 0,
      data.error || null
    ]);
  },
  
  getAll: (options = {}) => {
    let sql = 'SELECT * FROM request_logs';
    const params = [];
    const conditions = [];
    
    if (options.success !== undefined) {
      conditions.push('success = ?');
      params.push(options.success ? 1 : 0);
    }
    
    if (options.date) {
      conditions.push('date(created_at) = ?');
      params.push(options.date);
    }
    
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' ORDER BY created_at DESC';
    
    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }
    
    return queryAll(sql, params);
  },
  
  getById: (id) => {
    return queryOne('SELECT * FROM request_logs WHERE id = ?', [id]);
  },

  deleteById: (id) => {
    return runSql('DELETE FROM request_logs WHERE id = ?', [id]);
  },
  
  getStats: () => {
    const result = queryOne(`
      SELECT 
        COUNT(*) as total_requests,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_requests,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_requests
      FROM request_logs
    `);
    return result || { total_requests: 0, successful_requests: 0, failed_requests: 0 };
  }
};

// Settings helpers
const settings = {
  get: (key) => {
    return queryOne('SELECT * FROM settings WHERE key = ?', [key]);
  },
  
  getAll: () => {
    return queryAll('SELECT * FROM settings');
  },
  
  upsert: (key, value) => {
    const existing = queryOne('SELECT key FROM settings WHERE key = ?', [key]);
    if (existing) {
      runSql('UPDATE settings SET value = ?, updated_at = datetime("now") WHERE key = ?', [value, key]);
    } else {
      runSql('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value]);
    }
    return { changes: 1 };
  }
};

module.exports = {
  initDatabase,
  saveDatabase,
  apiKeys,
  prompts,
  logs,
  settings
};
