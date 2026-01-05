// Background script for Obelos
// Manages remoteStorage instance and handles sync coordination

(function() {
  'use strict';

  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

  let remoteStorageInstance = null;
  let obelosClient = null;
  let isConnected = false;
  let syncInProgress = false;

  // Helper to convert URL to a safe storage path
  function urlToPath(url) {
    return encodeURIComponent(url)
      .replace(/\./g, '%2E')
      .replace(/~/g, '%7E');
  }

  function pathToUrl(path) {
    return decodeURIComponent(path.replace(/%2E/g, '.').replace(/%7E/g, '~'));
  }

  // Initialize remoteStorage
  function initRemoteStorage() {
    if (typeof RemoteStorage === 'undefined') {
      console.error('[Obelos Background] RemoteStorage not loaded');
      return;
    }

    remoteStorageInstance = new RemoteStorage({
      changeEvents: {
        local: true,
        window: true,
        remote: true,
        conflicts: true
      },
      cache: true,
      logging: false
    });

    // Claim access to the obelos scope
    remoteStorageInstance.access.claim('obelos', 'rw');

    // Get a scoped client for obelos data
    obelosClient = remoteStorageInstance.scope('/obelos/');

    // Set up event handlers
    remoteStorageInstance.on('connected', () => {
      console.log('[Obelos Background] Connected to remote storage');
      isConnected = true;
      notifyAllTabs({ type: 'rs-connected' });
      // Trigger initial sync
      syncAllData();
    });

    remoteStorageInstance.on('disconnected', () => {
      console.log('[Obelos Background] Disconnected from remote storage');
      isConnected = false;
      notifyAllTabs({ type: 'rs-disconnected' });
    });

    remoteStorageInstance.on('error', (err) => {
      console.error('[Obelos Background] Remote storage error:', err);
    });

    remoteStorageInstance.on('sync-done', () => {
      console.log('[Obelos Background] Sync completed');
      syncInProgress = false;
      notifyAllTabs({ type: 'rs-sync-done' });
    });

    remoteStorageInstance.on('sync-req-done', () => {
      console.log('[Obelos Background] Sync request completed');
    });

    // Listen for changes from remote
    obelosClient.on('change', (event) => {
      console.log('[Obelos Background] Remote change detected:', event.relativePath);
      notifyAllTabs({
        type: 'rs-change',
        path: event.relativePath,
        newValue: event.newValue,
        oldValue: event.oldValue
      });
    });

    console.log('[Obelos Background] RemoteStorage initialized');
  }

  // Sync all data
  async function syncAllData() {
    if (!remoteStorageInstance || !isConnected || syncInProgress) {
      return;
    }

    syncInProgress = true;
    console.log('[Obelos Background] Starting full sync...');

    try {
      // Enable caching for the root path to get all changes
      if (obelosClient) {
        obelosClient.cache('');
      }
    } catch (err) {
      console.error('[Obelos Background] Sync error:', err);
    }

    syncInProgress = false;
  }

  // Notify all tabs about an event
  async function notifyAllTabs(message) {
    try {
      const tabs = await browserAPI.tabs.query({});
      for (const tab of tabs) {
        try {
          await browserAPI.tabs.sendMessage(tab.id, message);
        } catch (e) {
          // Tab might not have content script loaded
        }
      }
    } catch (err) {
      console.error('[Obelos Background] Error notifying tabs:', err);
    }
  }

  // Handle messages from content scripts and popup
  browserAPI.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender).then(sendResponse);
    return true; // Keep the message channel open for async response
  });

  async function handleMessage(message, sender) {
    const type = message.type;

    switch (type) {
      case 'rs-load':
        return await handleLoad(message.pageKey);

      case 'rs-save':
        return await handleSave(message.pageKey, message.data);

      case 'rs-clear':
        return await handleClear(message.pageKey);

      case 'rs-get-all-keys':
        return await handleGetAllKeys();

      case 'rs-get-all':
        return await handleGetAll();

      case 'rs-status':
        return {
          success: true,
          connected: isConnected,
          syncing: syncInProgress
        };

      case 'rs-sync':
        syncAllData();
        return { success: true };

      case 'rs-connect':
        // The widget handles connection, but we can provide the instance
        return {
          success: true,
          connected: isConnected
        };

      case 'rs-disconnect':
        if (remoteStorageInstance) {
          remoteStorageInstance.disconnect();
        }
        return { success: true };

      case 'rs-get-instance':
        // Can't send the instance, but can send status
        return {
          success: true,
          connected: isConnected,
          initialized: !!remoteStorageInstance
        };

      default:
        return { success: false, error: 'Unknown message type' };
    }
  }

  async function handleLoad(pageKey) {
    if (!obelosClient) {
      return { success: false, error: 'RemoteStorage not initialized' };
    }

    try {
      const path = urlToPath(pageKey);
      const data = await obelosClient.getObject(path);
      return { success: true, data: data || { highlights: [], anchors: [], visible: true } };
    } catch (err) {
      console.error('[Obelos Background] Load error:', err);
      return { success: false, error: err.message };
    }
  }

  async function handleSave(pageKey, data) {
    if (!obelosClient) {
      return { success: false, error: 'RemoteStorage not initialized' };
    }

    try {
      const path = urlToPath(pageKey);
      await obelosClient.storeObject('obelos-page', path, data);
      return { success: true };
    } catch (err) {
      console.error('[Obelos Background] Save error:', err);
      return { success: false, error: err.message };
    }
  }

  async function handleClear(pageKey) {
    if (!obelosClient) {
      return { success: false, error: 'RemoteStorage not initialized' };
    }

    try {
      const path = urlToPath(pageKey);
      await obelosClient.remove(path);
      return { success: true };
    } catch (err) {
      console.error('[Obelos Background] Clear error:', err);
      return { success: false, error: err.message };
    }
  }

  async function handleGetAllKeys() {
    if (!obelosClient) {
      return { success: false, error: 'RemoteStorage not initialized' };
    }

    try {
      const listing = await obelosClient.getListing('');
      const keys = Object.keys(listing || {}).map(name => {
        const cleanName = name.replace(/\/$/, '');
        return pathToUrl(cleanName);
      });
      return { success: true, keys: keys };
    } catch (err) {
      console.error('[Obelos Background] GetAllKeys error:', err);
      return { success: false, error: err.message };
    }
  }

  async function handleGetAll() {
    if (!obelosClient) {
      return { success: false, error: 'RemoteStorage not initialized' };
    }

    try {
      const listing = await obelosClient.getListing('');
      const data = {};
      for (const name of Object.keys(listing || {})) {
        const cleanName = name.replace(/\/$/, '');
        const pageKey = pathToUrl(cleanName);
        data[pageKey] = await obelosClient.getObject(cleanName);
      }
      return { success: true, data: data };
    } catch (err) {
      console.error('[Obelos Background] GetAll error:', err);
      return { success: false, error: err.message };
    }
  }

  // Expose for options page access
  if (typeof window !== 'undefined') {
    window.getRemoteStorageInstance = () => remoteStorageInstance;
    window.isRemoteStorageConnected = () => isConnected;
  }

  // Initialize on load
  initRemoteStorage();

})();
