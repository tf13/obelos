// Obelos Options Page Script

(function() {
  'use strict';

  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
  const SETTINGS_KEY = 'obelos-settings';
  const RS_CREDENTIALS_KEY = 'obelos-rs-credentials';

  let remoteStorageInstance = null;
  let obelosClient = null;

  // Helper to convert URL to a safe storage path
  function urlToPath(url) {
    return encodeURIComponent(url)
      .replace(/\./g, '%2E')
      .replace(/~/g, '%7E');
  }

  function pathToUrl(path) {
    return decodeURIComponent(path.replace(/%2E/g, '.').replace(/%7E/g, '~'));
  }

  // DOM Elements
  const elements = {
    storageProviderRadios: document.querySelectorAll('input[name="storage-provider"]'),
    rsSection: document.getElementById('rs-section'),
    migrationSection: document.getElementById('migration-section'),
    rsStatus: document.getElementById('rs-status'),
    rsConnectForm: document.getElementById('rs-connect-form'),
    rsConnectedInfo: document.getElementById('rs-connected-info'),
    rsAddress: document.getElementById('rs-address'),
    rsConnectBtn: document.getElementById('rs-connect-btn'),
    rsDisconnectBtn: document.getElementById('rs-disconnect-btn'),
    rsUserAddress: document.getElementById('rs-user-address'),
    syncNowBtn: document.getElementById('sync-now'),
    exportBtn: document.getElementById('export-data'),
    importBtn: document.getElementById('import-data'),
    importFile: document.getElementById('import-file'),
    clearAllBtn: document.getElementById('clear-all-data'),
    migrateToRemoteBtn: document.getElementById('migrate-to-remote'),
    migrateToLocalBtn: document.getElementById('migrate-to-local'),
    migrationProgress: document.getElementById('migration-progress'),
    pagesCount: document.getElementById('pages-count'),
    highlightsCount: document.getElementById('highlights-count'),
    bookmarksCount: document.getElementById('bookmarks-count')
  };

  // Initialize
  async function init() {
    await loadSettings();
    await loadStats();
    await checkExistingConnection();
    setupEventListeners();
  }

  // Load settings from storage
  async function loadSettings() {
    try {
      const result = await browserAPI.storage.local.get([SETTINGS_KEY]);
      const settings = result[SETTINGS_KEY] || { storageProvider: 'local' };

      // Set radio button
      const radio = document.querySelector(`input[name="storage-provider"][value="${settings.storageProvider}"]`);
      if (radio) {
        radio.checked = true;
      }

      // Show/hide sections based on provider
      updateSectionVisibility(settings.storageProvider);
    } catch (err) {
      console.error('[Obelos Options] Error loading settings:', err);
    }
  }

  // Save settings
  async function saveSettings(settings) {
    try {
      await browserAPI.storage.local.set({ [SETTINGS_KEY]: settings });
    } catch (err) {
      console.error('[Obelos Options] Error saving settings:', err);
    }
  }

  // Load data statistics
  async function loadStats() {
    try {
      const result = await browserAPI.storage.local.get(null);
      let pages = 0;
      let highlights = 0;
      let bookmarks = 0;

      for (const key of Object.keys(result)) {
        if (key.startsWith('http://') || key.startsWith('https://')) {
          pages++;
          const pageData = result[key];
          highlights += (pageData.highlights || []).length;
          bookmarks += (pageData.anchors || []).length;
        }
      }

      elements.pagesCount.textContent = pages;
      elements.highlightsCount.textContent = highlights;
      elements.bookmarksCount.textContent = bookmarks;
    } catch (err) {
      console.error('[Obelos Options] Error loading stats:', err);
    }
  }

  // Update section visibility based on provider
  function updateSectionVisibility(provider) {
    if (provider === 'remoteStorage') {
      elements.rsSection.style.display = 'block';
      elements.migrationSection.style.display = 'block';
    } else {
      elements.rsSection.style.display = 'none';
      elements.migrationSection.style.display = 'none';
    }
  }

  // Check for existing remoteStorage connection
  async function checkExistingConnection() {
    try {
      const result = await browserAPI.storage.local.get([RS_CREDENTIALS_KEY]);
      const credentials = result[RS_CREDENTIALS_KEY];

      if (credentials && credentials.token && credentials.href) {
        console.log('[Obelos Options] Found existing credentials, reconnecting...');
        await connectWithCredentials(credentials);
      }
    } catch (err) {
      console.error('[Obelos Options] Error checking existing connection:', err);
    }
  }

  // Perform WebFinger lookup to get remoteStorage server info
  async function webfingerLookup(userAddress) {
    const [user, host] = userAddress.split('@');
    if (!user || !host) {
      throw new Error('Invalid remoteStorage address. Use format: user@provider.com');
    }

    const webfingerUrl = `https://${host}/.well-known/webfinger?resource=acct:${encodeURIComponent(userAddress)}`;

    console.log('[Obelos Options] WebFinger lookup:', webfingerUrl);

    const response = await fetch(webfingerUrl);
    if (!response.ok) {
      throw new Error(`WebFinger lookup failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Find the remoteStorage link
    const rsLink = data.links?.find(link =>
      link.rel === 'http://tools.ietf.org/id/draft-dejong-remotestorage' ||
      link.rel === 'remotestorage'
    );

    if (!rsLink) {
      throw new Error('No remoteStorage service found for this address');
    }

    return {
      href: rsLink.href,
      storageApi: rsLink.type || 'draft-dejong-remotestorage-05',
      authUrl: rsLink.properties?.['http://tools.ietf.org/html/rfc6749#section-4.2'] ||
               rsLink.properties?.['auth-endpoint'],
      properties: rsLink.properties
    };
  }

  // Connect using browser.identity OAuth flow
  async function connectWithOAuth(userAddress) {
    console.log('[Obelos Options] Starting OAuth for:', userAddress);

    // Get WebFinger info
    const rsInfo = await webfingerLookup(userAddress);
    console.log('[Obelos Options] remoteStorage info:', rsInfo);

    if (!rsInfo.authUrl) {
      throw new Error('No OAuth endpoint found for this remoteStorage provider');
    }

    // Get the redirect URL from browser.identity
    const redirectUrl = browserAPI.identity.getRedirectURL();
    console.log('[Obelos Options] Redirect URL:', redirectUrl);

    // Build OAuth authorization URL
    const scope = 'obelos:rw';
    const authParams = new URLSearchParams({
      client_id: redirectUrl,
      redirect_uri: redirectUrl,
      response_type: 'token',
      scope: scope
    });

    const authUrl = `${rsInfo.authUrl}?${authParams.toString()}`;
    console.log('[Obelos Options] Auth URL:', authUrl);

    // Launch OAuth flow
    const resultUrl = await browserAPI.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true
    });

    console.log('[Obelos Options] OAuth result URL:', resultUrl);

    // Parse access token from result URL
    const hashParams = new URLSearchParams(resultUrl.split('#')[1] || '');
    const accessToken = hashParams.get('access_token');

    if (!accessToken) {
      throw new Error('No access token received from OAuth flow');
    }

    // Store credentials
    const credentials = {
      userAddress: userAddress,
      href: rsInfo.href,
      token: accessToken,
      storageApi: rsInfo.storageApi
    };

    await browserAPI.storage.local.set({ [RS_CREDENTIALS_KEY]: credentials });

    // Connect remoteStorage with credentials
    await connectWithCredentials(credentials);

    return credentials;
  }

  // Connect remoteStorage with stored credentials
  async function connectWithCredentials(credentials) {
    console.log('[Obelos Options] Connecting with credentials...');

    if (typeof RemoteStorage === 'undefined') {
      console.error('[Obelos Options] RemoteStorage not loaded');
      throw new Error('RemoteStorage library not loaded');
    }

    try {
      // Create RemoteStorage instance
      remoteStorageInstance = new RemoteStorage({
        changeEvents: {
          local: true,
          window: true,
          remote: true,
          conflicts: true
        },
        cache: true,
        logging: true
      });

      // Claim access to the obelos scope
      remoteStorageInstance.access.claim('obelos', 'rw');

      // Configure the remote connection manually
      remoteStorageInstance.remote.configure({
        userAddress: credentials.userAddress,
        href: credentials.href,
        storageApi: credentials.storageApi,
        token: credentials.token
      });

      // Get a scoped client for obelos data
      obelosClient = remoteStorageInstance.scope('/obelos/');

      // Set up event handlers
      remoteStorageInstance.on('connected', () => {
        console.log('[Obelos Options] Connected event fired');
        showConnectedState(credentials.userAddress);
      });

      remoteStorageInstance.on('disconnected', () => {
        console.log('[Obelos Options] Disconnected event fired');
        showDisconnectedState();
      });

      remoteStorageInstance.on('error', (err) => {
        console.error('[Obelos Options] RemoteStorage error:', err);
      });

      remoteStorageInstance.on('sync-done', () => {
        console.log('[Obelos Options] Sync completed');
        updateSyncStatus('done');
      });

      // Trigger initial connection
      // The 'connected' event should fire after configure()
      // If remote.connected is already true, update UI directly
      if (remoteStorageInstance.remote.connected) {
        showConnectedState(credentials.userAddress);
      }

      console.log('[Obelos Options] RemoteStorage configured successfully');

    } catch (err) {
      console.error('[Obelos Options] Error connecting:', err);
      throw err;
    }
  }

  // Show connected state in UI
  function showConnectedState(userAddress) {
    elements.rsConnectForm.style.display = 'none';
    elements.rsConnectedInfo.style.display = 'block';
    elements.rsUserAddress.textContent = userAddress;
    elements.syncNowBtn.disabled = false;
    updateConnectionStatus(true);
  }

  // Show disconnected state in UI
  function showDisconnectedState() {
    elements.rsConnectForm.style.display = 'block';
    elements.rsConnectedInfo.style.display = 'none';
    elements.syncNowBtn.disabled = true;
    updateConnectionStatus(false);
  }

  // Disconnect from remoteStorage
  async function disconnect() {
    console.log('[Obelos Options] Disconnecting...');

    if (remoteStorageInstance) {
      remoteStorageInstance.disconnect();
      remoteStorageInstance = null;
      obelosClient = null;
    }

    // Clear stored credentials
    await browserAPI.storage.local.remove([RS_CREDENTIALS_KEY]);

    showDisconnectedState();
  }

  // Update connection status display
  function updateConnectionStatus(connected) {
    const indicator = elements.rsStatus.querySelector('.status-indicator');
    const text = elements.rsStatus.querySelector('.status-text');

    if (connected) {
      indicator.classList.remove('disconnected', 'syncing');
      indicator.classList.add('connected');
      text.textContent = 'Connected';
    } else {
      indicator.classList.remove('connected', 'syncing');
      indicator.classList.add('disconnected');
      text.textContent = 'Not connected';
    }
  }

  // Update sync status display
  function updateSyncStatus(status) {
    const indicator = elements.rsStatus.querySelector('.status-indicator');
    const text = elements.rsStatus.querySelector('.status-text');

    if (status === 'syncing') {
      indicator.classList.remove('connected', 'disconnected');
      indicator.classList.add('syncing');
      text.textContent = 'Syncing...';
    } else if (remoteStorageInstance && remoteStorageInstance.remote.connected) {
      indicator.classList.remove('disconnected', 'syncing');
      indicator.classList.add('connected');
      text.textContent = 'Connected';
    }
  }

  // Set up event listeners
  function setupEventListeners() {
    // Storage provider change
    elements.storageProviderRadios.forEach(radio => {
      radio.addEventListener('change', async (e) => {
        const provider = e.target.value;
        await saveSettings({ storageProvider: provider });
        updateSectionVisibility(provider);
      });
    });

    // Connect button
    elements.rsConnectBtn.addEventListener('click', async () => {
      const address = elements.rsAddress.value.trim();
      if (!address) {
        alert('Please enter your remoteStorage address');
        return;
      }

      elements.rsConnectBtn.disabled = true;
      elements.rsConnectBtn.textContent = 'Connecting...';

      try {
        await connectWithOAuth(address);
      } catch (err) {
        console.error('[Obelos Options] Connection failed:', err);
        alert('Connection failed: ' + err.message);
      } finally {
        elements.rsConnectBtn.disabled = false;
        elements.rsConnectBtn.textContent = 'Connect';
      }
    });

    // Disconnect button
    elements.rsDisconnectBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to disconnect from remoteStorage?')) {
        await disconnect();
      }
    });

    // Sync now
    elements.syncNowBtn.addEventListener('click', () => {
      if (remoteStorageInstance) {
        updateSyncStatus('syncing');
        remoteStorageInstance.startSync();
      }
    });

    // Export data
    elements.exportBtn.addEventListener('click', exportData);

    // Import data
    elements.importBtn.addEventListener('click', () => {
      elements.importFile.click();
    });

    elements.importFile.addEventListener('change', importData);

    // Clear all data
    elements.clearAllBtn.addEventListener('click', clearAllData);

    // Migrate to remote
    elements.migrateToRemoteBtn.addEventListener('click', migrateToRemote);

    // Migrate to local
    elements.migrateToLocalBtn.addEventListener('click', migrateToLocal);
  }

  // Export data as JSON
  async function exportData() {
    try {
      const result = await browserAPI.storage.local.get(null);
      const exportData = {};

      for (const key of Object.keys(result)) {
        if (key.startsWith('http://') || key.startsWith('https://')) {
          exportData[key] = result[key];
        }
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `obelos-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[Obelos Options] Export error:', err);
      alert('Error exporting data: ' + err.message);
    }
  }

  // Import data from JSON
  async function importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      let imported = 0;
      for (const key of Object.keys(data)) {
        if (key.startsWith('http://') || key.startsWith('https://')) {
          await browserAPI.storage.local.set({ [key]: data[key] });
          imported++;
        }
      }

      await loadStats();
      alert(`Successfully imported ${imported} pages of highlights.`);
    } catch (err) {
      console.error('[Obelos Options] Import error:', err);
      alert('Error importing data: ' + err.message);
    }

    // Reset file input
    e.target.value = '';
  }

  // Clear all data
  async function clearAllData() {
    if (!confirm('Are you sure you want to delete all highlights and bookmarks? This cannot be undone.')) {
      return;
    }

    try {
      const result = await browserAPI.storage.local.get(null);
      const keysToRemove = [];

      for (const key of Object.keys(result)) {
        if (key.startsWith('http://') || key.startsWith('https://')) {
          keysToRemove.push(key);
        }
      }

      await browserAPI.storage.local.remove(keysToRemove);
      await loadStats();
      alert('All data has been cleared.');
    } catch (err) {
      console.error('[Obelos Options] Clear error:', err);
      alert('Error clearing data: ' + err.message);
    }
  }

  // Migrate local data to remote
  async function migrateToRemote() {
    if (!remoteStorageInstance || !remoteStorageInstance.remote.connected) {
      alert('Please connect to remoteStorage first.');
      return;
    }

    if (!obelosClient) {
      alert('remoteStorage not initialized.');
      return;
    }

    elements.migrationProgress.style.display = 'block';
    const progressFill = elements.migrationProgress.querySelector('.progress-fill');
    const progressText = elements.migrationProgress.querySelector('.progress-text');

    try {
      const result = await browserAPI.storage.local.get(null);
      const keys = Object.keys(result).filter(k => k.startsWith('http://') || k.startsWith('https://'));
      let migrated = 0;

      for (const key of keys) {
        progressText.textContent = `Migrating ${migrated + 1} of ${keys.length}...`;
        progressFill.style.width = `${((migrated + 1) / keys.length) * 100}%`;

        const path = urlToPath(key);
        await obelosClient.storeObject('obelos-page', path, result[key]);
        migrated++;
      }

      progressText.textContent = `Migration complete! ${migrated} pages uploaded.`;
      setTimeout(() => {
        elements.migrationProgress.style.display = 'none';
      }, 3000);
    } catch (err) {
      console.error('[Obelos Options] Migration error:', err);
      progressText.textContent = 'Migration failed: ' + err.message;
    }
  }

  // Migrate remote data to local
  async function migrateToLocal() {
    if (!remoteStorageInstance || !remoteStorageInstance.remote.connected) {
      alert('Please connect to remoteStorage first.');
      return;
    }

    if (!obelosClient) {
      alert('remoteStorage not initialized.');
      return;
    }

    elements.migrationProgress.style.display = 'block';
    const progressFill = elements.migrationProgress.querySelector('.progress-fill');
    const progressText = elements.migrationProgress.querySelector('.progress-text');

    try {
      progressText.textContent = 'Fetching remote data...';
      const listing = await obelosClient.getListing('');
      const names = Object.keys(listing || {});
      let migrated = 0;

      for (const name of names) {
        progressText.textContent = `Downloading ${migrated + 1} of ${names.length}...`;
        progressFill.style.width = `${((migrated + 1) / names.length) * 100}%`;

        const cleanName = name.replace(/\/$/, '');
        const pageKey = pathToUrl(cleanName);
        const data = await obelosClient.getObject(cleanName);
        await browserAPI.storage.local.set({ [pageKey]: data });
        migrated++;
      }

      progressText.textContent = `Migration complete! ${migrated} pages downloaded.`;
      await loadStats();
      setTimeout(() => {
        elements.migrationProgress.style.display = 'none';
      }, 3000);
    } catch (err) {
      console.error('[Obelos Options] Migration error:', err);
      progressText.textContent = 'Migration failed: ' + err.message;
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
