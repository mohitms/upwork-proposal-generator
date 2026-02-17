/**
 * Upwork Proposal Generator - Dashboard JavaScript
 */

const API_BASE = '';
let currentTab = 'generator';
let lastGeneratedParams = null;
let selectedLogId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const authenticated = await ensureAuthenticated();
  if (!authenticated) return;

  initTabs();
  initMobileSidebar();
  initLogDetailPanel();
  initEnhancedInputs();
  initKeyboardShortcuts();

  loadPrompts();
  loadStats();
  loadKeys();
  checkHealth();

  document.getElementById('save-prompts').addEventListener('click', savePrompts);
  document.getElementById('fetch-url-btn').addEventListener('click', fetchJobDataFromUrl);
  document.getElementById('generate-btn').addEventListener('click', generateProposal);
  document.getElementById('regenerate-btn').addEventListener('click', regenerateProposal);
  document.getElementById('copy-btn').addEventListener('click', copyProposal);
  document.getElementById('refresh-logs').addEventListener('click', loadLogs);
  document.getElementById('update-key').addEventListener('click', updateApiKey);
  document.getElementById('log-filter').addEventListener('change', loadLogs);
  document.getElementById('logout-btn').addEventListener('click', logout);
});

function initTabs() {
  const navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tab) {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  document.querySelectorAll('.tab').forEach(tabEl => {
    tabEl.classList.toggle('active', tabEl.id === `tab-${tab}`);
  });

  currentTab = tab;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (window.innerWidth <= 980) {
    closeMobileSidebar();
  }

  if (tab === 'logs') {
    loadLogs();
  } else if (tab === 'settings') {
    loadKeys();
  }
}

function initMobileSidebar() {
  const toggleBtn = document.getElementById('sidebar-toggle');
  const backdrop = document.getElementById('mobile-backdrop');

  if (toggleBtn) toggleBtn.addEventListener('click', openMobileSidebar);
  if (backdrop) backdrop.addEventListener('click', closeMobileSidebar);
}

function openMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('mobile-backdrop');
  sidebar.classList.add('open');
  backdrop.classList.remove('hidden');
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('mobile-backdrop');
  sidebar.classList.remove('open');
  backdrop.classList.add('hidden');
}

function initLogDetailPanel() {
  document.getElementById('log-detail-close').addEventListener('click', closeLogDetail);
  document.getElementById('log-detail-backdrop').addEventListener('click', closeLogDetail);
}

function openLogDetail() {
  document.getElementById('log-detail-panel').classList.add('open');
  document.getElementById('log-detail-backdrop').classList.remove('hidden');
}

function closeLogDetail() {
  selectedLogId = null;
  document.getElementById('log-detail-panel').classList.remove('open');
  document.getElementById('log-detail-backdrop').classList.add('hidden');
}

function initEnhancedInputs() {
  document.querySelectorAll('textarea').forEach(textarea => {
    const resize = () => {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 420)}px`;
    };

    textarea.addEventListener('input', resize);
    resize();
  });
}

function initKeyboardShortcuts() {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeLogDetail();
      closeMobileSidebar();
    }
  });
}

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
  try { data = await response.json(); } catch { data = {}; }

  if (!response.ok) {
    const error = new Error(data.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.code = data.code;
    if (response.status === 401) window.location.href = '/login';
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
    if (userBadge) userBadge.textContent = session.username || 'admin';

    return true;
  } catch {
    window.location.href = '/login';
    return false;
  }
}

async function logout() {
  try { await apiPost('/auth/logout', {}); } catch (error) { console.error('Logout failed:', error); }
  finally { window.location.href = '/login'; }
}

async function loadPrompts() {
  try {
    const result = await apiGet('/admin/api/prompts');
    if (result.success && result.data) {
      result.data.forEach(prompt => {
        if (prompt.type === 'system') {
          const el = document.getElementById('system-prompt');
          el.value = prompt.content;
          el.dispatchEvent(new Event('input'));
        } else if (prompt.type === 'user') {
          const el = document.getElementById('user-prompt');
          el.value = prompt.content;
          el.dispatchEvent(new Event('input'));
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

    if (!result.success) throw new Error(result.error);

    showToast('Prompts saved successfully', 'success');
    status.textContent = 'Saved!';
    status.className = 'status success';
    setTimeout(() => { status.textContent = ''; }, 3000);
  } catch (error) {
    showToast('Failed to save prompts: ' + error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Prompts';
  }
}

function setUrlFetchStatus(message = '', type = '') {
  const status = document.getElementById('url-fetch-status');
  if (!status) return;
  status.textContent = message;
  status.className = `status${type ? ` ${type}` : ''}`;
}

async function fetchJobDataFromUrl() {
  const urlInput = document.getElementById('job-url');
  const fetchBtn = document.getElementById('fetch-url-btn');
  const url = urlInput.value.trim();

  if (!url) {
    showToast('Please enter an Upwork URL', 'error');
    setUrlFetchStatus('Paste an Upwork job URL first.', 'error');
    return;
  }

  fetchBtn.disabled = true;
  fetchBtn.innerHTML = '<span class="spinner"></span> Fetching...';
  setUrlFetchStatus('Fetching job details from URL...');

  try {
    const result = await apiPost('/api/scrape-job-url', { url });
    if (!result.success || !result.data) throw new Error(result.error || 'Failed to fetch URL data');

    const data = result.data;
    document.getElementById('test-title').value = data.title || '';
    const descriptionInput = document.getElementById('test-description');
    descriptionInput.value = data.description || '';
    descriptionInput.dispatchEvent(new Event('input'));
    document.getElementById('test-budget').value = data.budget || '';
    document.getElementById('test-skills').value = data.skills || '';

    lastGeneratedParams = null;
    document.getElementById('regenerate-btn').disabled = true;

    const modeLabel = data.mode === 'playwright' ? 'browser mode' : 'parser mode';
    const warningText = Array.isArray(data.warnings) && data.warnings.length > 0 ? ` (${data.warnings.join('; ')})` : '';

    setUrlFetchStatus(`Fetched via ${modeLabel}${warningText}`, data.warnings?.length ? 'warning' : 'success');
    showToast('Job details fetched and fields auto-filled', 'success');
  } catch (error) {
    const cloudflareMessage = "Couldn't fetch this URL due to page protection. Please fill fields manually and continue.";
    if (error.code === 'SCRAPE_BLOCKED_CLOUDFLARE') {
      setUrlFetchStatus(cloudflareMessage, 'warning');
      showToast(cloudflareMessage, 'error');
    } else {
      const message = error.message || 'Failed to fetch URL data';
      setUrlFetchStatus(message, 'error');
      showToast(message, 'error');
    }
  } finally {
    fetchBtn.disabled = false;
    fetchBtn.textContent = fetchBtn.dataset.defaultLabel || 'Fetch Data';
  }
}

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
    if (!result.success) throw new Error(result.error || 'Unknown error');

    document.getElementById('generated-proposal').textContent = result.proposal;
    document.getElementById('model-used').textContent = result.model_used || 'glm-5';
    resultContainer.classList.remove('hidden');
    regenBtn.disabled = false;
  } catch (error) {
    document.getElementById('error-message').textContent = error.message;
    errorContainer.classList.remove('hidden');
    regenBtn.disabled = true;
  } finally {
    btn.disabled = false;
    btn.textContent = btn.dataset.defaultLabel || 'Generate Proposal';
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
  await copyText(proposal, 'Copied to clipboard!');
}

async function loadLogs() {
  const container = document.getElementById('logs-container');
  container.innerHTML = '<p class="loading">Loading logs...</p>';

  const filter = document.getElementById('log-filter').value;
  let endpoint = '/admin/api/logs?limit=50';
  if (filter === 'success') endpoint += '&success=true';
  if (filter === 'failed') endpoint += '&success=false';

  try {
    const result = await apiGet(endpoint);
    if (!result.success || !result.data) throw new Error('Failed to load logs');

    if (result.data.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No logs found</p></div>';
      return;
    }

    container.innerHTML = `
      <table class="logs-table">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Job Title</th>
            <th>Model Used</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${result.data.map(log => `
            <tr class="logs-row" data-id="${log.id}">
              <td>${formatDate(log.created_at)}</td>
              <td><div class="logs-title" title="${escapeHtml(log.project_title || 'Untitled')}">${escapeHtml(log.project_title || 'Untitled')}</div></td>
              <td>${escapeHtml(log.ai_model || 'N/A')}</td>
              <td><span class="badge ${log.success ? 'success' : 'failed'}">${log.success ? 'Success' : 'Failed'}</span></td>
              <td><button class="action-btn" data-action="view" data-id="${log.id}">View</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    container.querySelectorAll('.logs-row').forEach(row => {
      row.addEventListener('click', (event) => {
        const id = event.currentTarget.dataset.id;
        showLogDetail(id);
      });
    });

    container.querySelectorAll('[data-action="view"]').forEach(btn => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        showLogDetail(event.currentTarget.dataset.id);
      });
    });

    loadStats();
  } catch (error) {
    console.error('Error loading logs:', error);
    container.innerHTML = '<p class="loading">Failed to load logs</p>';
  }
}

async function showLogDetail(logId) {
  selectedLogId = logId;

  const content = document.getElementById('log-detail-content');
  content.innerHTML = '<p class="loading">Loading details...</p>';
  openLogDetail();

  try {
    const result = await apiGet(`/admin/api/logs/${logId}`);
    if (!result.success || !result.data) throw new Error('Failed to load log detail');
    const log = result.data;

    const proposal = log.generated_proposal || '';
    const rawPayload = parseLogPayload(log.raw_input || log.payload || log.request_payload || null);

    content.innerHTML = `
      <div class="detail-block">
        <h4>Job Title</h4>
        <div class="detail-box">${escapeHtml(log.project_title || rawPayload.title || 'Untitled')}</div>
      </div>

      <div class="detail-block">
        <h4>Job URL</h4>
        <div class="detail-box">${escapeHtml(log.job_url || rawPayload.url || rawPayload.job_url || 'N/A')}</div>
      </div>

      <div class="detail-block">
        <h4>Proposal</h4>
        <div class="detail-box detail-proposal">${escapeHtml(proposal || 'No proposal generated')}</div>
        ${proposal ? '<button id="copy-log-proposal" class="btn btn-secondary btn-sm" style="margin-top:8px;">Copy Proposal</button>' : ''}
      </div>

      <div class="detail-block">
        <h4>Input Parameters</h4>
        <div class="detail-box">
          <strong>Title:</strong> ${escapeHtml(rawPayload.title || log.project_title || 'N/A')}\n
          <strong>Description:</strong> ${escapeHtml(rawPayload.description || log.description || 'N/A')}\n
          <strong>Budget:</strong> ${escapeHtml(rawPayload.budget || log.budget || 'N/A')}\n
          <strong>Skills:</strong> ${escapeHtml(rawPayload.skills || log.skills || 'N/A')}
        </div>
      </div>

      <div class="detail-block">
        <h4>Metadata</h4>
        <div class="detail-box">
          <strong>Model:</strong> ${escapeHtml(log.ai_model || 'N/A')}\n
          <strong>Timestamp:</strong> ${escapeHtml(formatDate(log.created_at))}\n
          <strong>Status:</strong> ${log.success ? 'Success' : 'Failed'}\n
          <strong>Token Usage:</strong> ${escapeHtml(String(log.token_usage ?? log.tokens_used ?? rawPayload.token_usage ?? 'N/A'))}
        </div>
      </div>

      ${log.error ? `<div class="detail-block"><h4>Error</h4><div class="detail-box" style="color:#dc3545;">${escapeHtml(log.error)}</div></div>` : ''}
    `;

    const copyBtn = document.getElementById('copy-log-proposal');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => copyText(proposal, 'Proposal copied'));
    }
  } catch (error) {
    content.innerHTML = '<p class="loading">Failed to load log details</p>';
  }
}

function parseLogPayload(payload) {
  if (!payload) return {};
  if (typeof payload === 'object') return payload;
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload);
    } catch {
      return {};
    }
  }
  return {};
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
          <span class="key-status ${key.is_active ? 'active' : 'inactive'}">${key.is_active ? 'Active' : 'Inactive'}</span>
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
    const result = await apiPost('/admin/api/keys', { provider: 'glm', key });
    if (!result.success) throw new Error(result.error);

    showToast('API key updated successfully', 'success');
    keyInput.value = '';
    status.textContent = 'Updated!';
    status.className = 'status success';
    setTimeout(() => { status.textContent = ''; }, 3000);
    loadKeys();
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
  } catch {
    document.getElementById('server-status').textContent = '❌ Offline';
  }
}

function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type}`;

  if (toast.timeout) clearTimeout(toast.timeout);
  toast.timeout = setTimeout(() => { toast.classList.add('hidden'); }, 3000);
}

async function copyText(value, successMessage) {
  try {
    await navigator.clipboard.writeText(value || '');
    showToast(successMessage, 'success');
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = value || '';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast(successMessage, 'success');
  }
}

function escapeHtml(text) {
  if (text === undefined || text === null) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
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
