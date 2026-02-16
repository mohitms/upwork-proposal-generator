/**
 * Login page script
 */

async function checkExistingSession() {
  try {
    const response = await fetch('/auth/session');
    if (!response.ok) {
      return;
    }

    const session = await response.json();
    if (session.authenticated) {
      window.location.href = '/';
    }
  } catch (error) {
    console.error('Session check failed:', error);
  }
}

function showError(message) {
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', async () => {
  await checkExistingSession();

  const form = document.getElementById('login-form');
  const loginBtn = document.getElementById('login-btn');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
      showError('Username and password are required');
      return;
    }

    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="spinner"></span> Signing in...';

    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Invalid credentials');
      }

      window.location.href = '/';
    } catch (error) {
      showError(error.message || 'Login failed');
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Login';
    }
  });
});
