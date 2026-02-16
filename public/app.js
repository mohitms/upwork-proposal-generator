/**
 * Upwork Proposal Generator - Dashboard JavaScript
 * Mobile-friendly admin interface
 */

// API Base URL
const API_BASE = '';

// State
let currentTab = 'prompts';
let lastGeneratedParams = null;

// ============================================
// Initialization
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
  const authenticated = await ensureAuthenticated();
  if (!authenticated) {
    return;
  }

  initTabs();
  loadPrompts();
  loadStats();
  loadKeys();
  checkHealth();
  
  // Event Listeners
  document.getElementById('save-prompts').addEventListener('click', savePrompts);
  document.getElementById('generate-btn').addEventListener('click', generateProposal);
  document.getElementById('regenerate-btn').addEventListener('click', regenerateProposal);
  document.getElementById('copy-btn').addEventListener('click', copyProposal);
  document.getElementById('refresh-logs').addEventListener('click', loadLogs);
  document.getElementById('update-key').addEventListener('click', updateApiKey);
  document.getElementById('log-filter').addEventListener('change', loadLogs);
  document.getElementById('logout-btn').addEventListener('click', logout);
});

// ============================================
// Tab Navigation
// ============================================

function initTabs() {
  const navBtns = document.querySelectorAll('.nav-btn');
  
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
    });
  });
}

function switchTab(tab) {
  // Update nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  
  // Update tab content
  document.querySelectorAll('.tab').forEach(tabEl => {
    tabEl.classList.toggle('active', tabEl.id === `tab-${tab}`);
  });
  
  currentTab = tab;
  
  // Load data for specific tabs
  if (tab === 'logs') {
    loadLogs();
  } else if (tab === 'settings') {
    loadKeys();
  }
}

// ============================================
// API Client
// ============================================

async function apiGet(endpoint) {
  const response = await fetch(`${API_BASE}${endpoint}`);
  return parseApiResponse(response);
}

async function apiPost(endpoint, data) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return parseApiResponse(response);
}

async function apiPut(endpoint, data) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return parseApiResponse(response);
}

async function parseApiResponse(response) {
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`);
    error.status = response.status;
    if (response.status === 401) {
      window.location.href = '/login';
    }
    throw error;
  }

  return data;
}

async function ensureAuthenticated() {
  try {
    const session = await apiGet('/auth/session');
    if (!session.authenticated) {
      window.location.href = '/login';
      return false;
    }

    const userBadge = document.getElementById('auth-user');
    if (userBadge) {
      userBadge.textContent = session.username || 'admin';
    }

    return true;
  } catch (error) {
    window.location.href = '/login';
    return false;
  }
}

async function logout() {
  try {
    await apiPost('/auth/logout', {});
  } catch (error) {
    console.error('Logout failed:', error);
  } finally {
    window.location.href = '/login';
  }
}

// ============================================
// Prompts Tab
// ============================================

async function loadPrompts() {
  try {
    const result = await apiGet('/admin/api/prompts');
    
    if (result.success && result.data) {
      result.data.forEach(prompt => {
        if (prompt.type === 'system') {
          document.getElementById('system-prompt').value = prompt.content;
        } else if (prompt.type === 'user') {
          document.getElementById('user-prompt').value = prompt.content;
        }
      });
    }
  } catch (error) {
    console.error('Error loading prompts:', error);
    showToast('Failed to load prompts', 'error');
  }
}

async function savePrompts() {
  const btn = document.getElementById('save-prompts');
  const status = document.getElementById('prompts-status');
  
  const systemPrompt = document.getElementById('system-prompt').value.trim();
  const userPrompt = document.getElementById('user-prompt').value.trim();
  
  if (!systemPrompt || !userPrompt) {
    showToast('Both prompts are required', 'error');
    return;
  }
  
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Saving...';
  
  try {
    const result = await apiPut('/admin/api/prompts', {
      promptList: [
        { type: 'system', content: systemPrompt },
        { type: 'user', content: userPrompt }
      ]
    });
    
    if (result.success) {
      showToast('Prompts saved successfully', 'success');
      status.textContent = 'Saved!';
      status.className = 'status success';
      setTimeout(() => { status.textContent = ''; }, 3000);
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    showToast('Failed to save prompts: ' + error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Prompts';
  }
}

// ============================================
// Test Generator Tab
// ============================================

async function generateProposal() {
  const title = document.getElementById('test-title').value.trim();
  const description = document.getElementById('test-description').value.trim();
  const budget = document.getElementById('test-budget').value.trim();
  const skills = document.getElementById('test-skills').value.trim();
  
  if (!title || !description) {
    showToast('Title and description are required', 'error');
    return;
  }
  
  const btn = document.getElementById('generate-btn');
  const regenBtn = document.getElementById('regenerate-btn');
  const resultContainer = document.getElementById('result-container');
  const errorContainer = document.getElementById('error-container');
  
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Generating...';
  errorContainer.classList.add('hidden');
  resultContainer.classList.add('hidden');
  
  lastGeneratedParams = { title, description, budget, skills };
  
  try {
    const result = await apiPost('/api/generate-proposal', lastGeneratedParams);
    
    if (result.success) {
      document.getElementById('generated-proposal').textContent = result.proposal;
      document.getElementById('model-used').textContent = result.model_used || 'glm-5';
      resultContainer.classList.remove('hidden');
      regenBtn.disabled = false;
    } else {
      throw new Error(result.error || 'Unknown error');
    }
  } catch (error) {
    document.getElementById('error-message').textContent = error.message;
    errorContainer.classList.remove('hidden');
    regenBtn.disabled = true;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate Proposal';
  }
}

async function regenerateProposal() {
  if (!lastGeneratedParams) return;
  
  document.getElementById('test-title').value = lastGeneratedParams.title;
  document.getElementById('test-description').value = lastGeneratedParams.description;
  document.getElementById('test-budget').value = lastGeneratedParams.budget;
  document.getElementById('test-skills').value = lastGeneratedParams.skills;
  
  generateProposal();
}

async function copyProposal() {
  const proposal = document.getElementById('generated-proposal').textContent;
  
  try {
    await navigator.clipboard.writeText(proposal);
    showToast('Copied to clipboard!', 'success');
  } catch (error) {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = proposal;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('Copied!', 'success');
  }
}

// ============================================
// Logs Tab
// ============================================

async function loadLogs() {
  const container = document.getElementById('logs-container');
  container.innerHTML = '<p class="loading">Loading logs...</p>';
  
  const filter = document.getElementById('log-filter').value;
  
  let endpoint = '/admin/api/logs?limit=50';
  if (filter === 'success') {
    endpoint += '&success=true';
  } else if (filter === 'failed') {
    endpoint += '&success=false';
  }
  
  try {
    const result = await apiGet(endpoint);
    
    if (result.success && result.data) {
      if (result.data.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <p>No logs found</p>
          </div>
        `;
        return;
      }
      
      container.innerHTML = result.data.map(log => `
        <div class="log-item ${log.success ? 'success' : 'failed'}" data-id="${log.id}">
          <div class="log-title">${escapeHtml(log.project_title || 'Untitled')}</div>
          <div class="log-meta">
            <span>${formatDate(log.created_at)}</span>
            <span>${log.success ? '✅ Success' : '❌ Failed'}</span>
            <span>${log.ai_model || 'N/A'}</span>
          </div>
        </div>
      `).join('');
      
      // Add click handlers
      container.querySelectorAll('.log-item').forEach(item => {
        item.addEventListener('click', () => showLogDetail(item.dataset.id));
      });
      
      // Update stats
      loadStats();
    }
  } catch (error) {
    console.error('Error loading logs:', error);
    container.innerHTML = '<p class="loading">Failed to load logs</p>';
  }
}

async function loadStats() {
  try {
    const result = await apiGet('/admin/api/stats');
    
    if (result.success && result.data) {
      document.getElementById('stat-total').textContent = result.data.total_requests || 0;
      document.getElementById('stat-success').textContent = result.data.successful_requests || 0;
      document.getElementById('stat-failed').textContent = result.data.failed_requests || 0;
    }
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

async function showLogDetail(logId) {
  try {
    const result = await apiGet(`/admin/api/logs/${logId}`);
    
    if (result.success && result.data) {
      const log = result.data;
      
      const modal = document.createElement('div');
      modal.className = 'log-modal';
      modal.innerHTML = `
        <div class="log-modal-content">
          <div class="log-modal-header">
            <h3>${escapeHtml(log.project_title || 'Untitled')}</h3>
            <button class="log-modal-close">&times;</button>
          </div>
          <div class="log-modal-body">
            <h4>Description</h4>
            <pre>${escapeHtml(log.description || 'N/A')}</pre>
            
            <p><strong>Budget:</strong> ${escapeHtml(log.budget || 'N/A')}</p>
            <p><strong>Skills:</strong> ${escapeHtml(log.skills || 'N/A')}</p>
            <p><strong>Model:</strong> ${escapeHtml(log.ai_model || 'N/A')}</p>
            <p><strong>Status:</strong> ${log.success ? '✅ Success' : '❌ Failed'}</p>
            <p><strong>Date:</strong> ${formatDate(log.created_at)}</p>
            
            ${log.generated_proposal ? `
              <h4>Generated Proposal</h4>
              <pre>${escapeHtml(log.generated_proposal)}</pre>
            ` : ''}
            
            ${log.error ? `
              <h4>Error</h4>
              <pre style="color: var(--danger)">${escapeHtml(log.error)}</pre>
            ` : ''}
          </div>
        </div>
      `;
      
      modal.querySelector('.log-modal-close').addEventListener('click', () => modal.remove());
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
      });
      
      document.body.appendChild(modal);
    }
  } catch (error) {
    showToast('Failed to load log details', 'error');
  }
}

// ============================================
// Settings Tab
// ============================================

async function loadKeys() {
  const container = document.getElementById('keys-container');
  
  try {
    const result = await apiGet('/admin/api/keys');
    
    if (result.success && result.data) {
      if (result.data.length === 0) {
        container.innerHTML = '<p>No API keys configured</p>';
        return;
      }
      
      container.innerHTML = result.data.map(key => `
        <div class="key-item">
          <div>
            <strong>${escapeHtml(key.provider)}</strong>
            <br><small>${key.key_masked || 'No key'}</small>
          </div>
          <span class="key-status ${key.is_active ? 'active' : 'inactive'}">
            ${key.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      `).join('');
    }
  } catch (error) {
    console.error('Error loading keys:', error);
    container.innerHTML = '<p>Failed to load API keys</p>';
  }
}

async function updateApiKey() {
  const keyInput = document.getElementById('new-key');
  const key = keyInput.value.trim();
  const status = document.getElementById('settings-status');
  
  if (!key) {
    showToast('Please enter an API key', 'error');
    return;
  }
  
  try {
    const result = await apiPost('/admin/api/keys', {
      provider: 'glm',
      key: key
    });
    
    if (result.success) {
      showToast('API key updated successfully', 'success');
      keyInput.value = '';
      status.textContent = 'Updated!';
      status.className = 'status success';
      setTimeout(() => { status.textContent = ''; }, 3000);
      loadKeys();
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    showToast('Failed to update key: ' + error.message, 'error');
  }
}

async function checkHealth() {
  try {
    const result = await apiGet('/api/health');
    
    if (result.status === 'ok') {
      document.getElementById('server-status').textContent = '✅ Running';
      document.getElementById('server-port').textContent = window.location.port || '443/80';
    } else {
      document.getElementById('server-status').textContent = '⚠️ Issues detected';
    }
  } catch (error) {
    document.getElementById('server-status').textContent = '❌ Offline';
  }
}

// ============================================
// Utilities
// ============================================

function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;
  
  // Clear any existing timeout
  if (toast.timeout) {
    clearTimeout(toast.timeout);
  }
  
  toast.timeout = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}
