async function fetchExtensionVersion() {
  const versionBadge = document.getElementById('version-badge');

  try {
    const response = await fetch('/extension/manifest.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not read manifest');

    const manifest = await response.json();
    const version = manifest?.version || 'Unknown';
    versionBadge.textContent = `Version: ${version}`;
  } catch (error) {
    versionBadge.textContent = 'Version: Unavailable';
  }
}

async function fetchChangelog() {
  const changelogEl = document.getElementById('changelog');

  try {
    const response = await fetch('/extension/CHANGELOG.md', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not fetch changelog');

    const markdown = await response.text();
    changelogEl.textContent = markdown;
  } catch (error) {
    changelogEl.textContent = 'Unable to load changelog right now.';
  }
}

function setupDownloadButton() {
  const button = document.getElementById('download-btn');
  const statusEl = document.getElementById('download-status');

  button.addEventListener('click', async () => {
    button.disabled = true;
    statusEl.className = 'status';
    statusEl.textContent = 'Preparing extension download...';

    try {
      const response = await fetch('/api/extension/download', {
        method: 'GET',
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error('Download request failed');
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;

      const header = response.headers.get('content-disposition') || '';
      const match = header.match(/filename="([^"]+)"/i);
      link.download = match?.[1] || 'upwork-proposal-generator-extension.zip';

      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);

      statusEl.className = 'status success';
      statusEl.textContent = 'Download started successfully.';
    } catch (error) {
      statusEl.className = 'status error';
      statusEl.textContent = 'Failed to download extension. Please try again.';
    } finally {
      button.disabled = false;
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  fetchExtensionVersion();
  fetchChangelog();
  setupDownloadButton();
});