// Storage abstraction layer for Obelos
// Supports both browser.storage.local (default) and remoteStorage

(function() {
  'use strict';

  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

  // Storage provider interface
  // All providers must implement: load(pageKey), save(pageKey, data), clear(pageKey)

  // Local Storage Provider - uses browser.storage.local
  const LocalStorageProvider = {
    name: 'local',

    async load(pageKey) {
      try {
        const result = await browserAPI.storage.local.get([pageKey]);
        if (result[pageKey]) {
          return {
            highlights: result[pageKey].highlights || [],
            anchors: result[pageKey].anchors || [],
            visible: result[pageKey].visible !== false
          };
        }
        return { highlights: [], anchors: [], visible: true };
      } catch (err) {
        console.error('[Obelos Storage] Error loading from local:', err);
        return { highlights: [], anchors: [], visible: true };
      }
    },

    async save(pageKey, data) {
      try {
        await browserAPI.storage.local.set({ [pageKey]: data });
        console.log('[Obelos Storage] Saved to local storage');
        return true;
      } catch (err) {
        console.error('[Obelos Storage] Error saving to local:', err);
        return false;
      }
    },

    async clear(pageKey) {
      try {
        await browserAPI.storage.local.remove([pageKey]);
        return true;
      } catch (err) {
        console.error('[Obelos Storage] Error clearing local:', err);
        return false;
      }
    },

    async getAllKeys() {
      try {
        const result = await browserAPI.storage.local.get(null);
        return Object.keys(result).filter(key =>
          key.startsWith('http://') || key.startsWith('https://')
        );
      } catch (err) {
        console.error('[Obelos Storage] Error getting keys:', err);
        return [];
      }
    },

    async getAll() {
      try {
        const result = await browserAPI.storage.local.get(null);
        const data = {};
        for (const key of Object.keys(result)) {
          if (key.startsWith('http://') || key.startsWith('https://')) {
            data[key] = result[key];
          }
        }
        return data;
      } catch (err) {
        console.error('[Obelos Storage] Error getting all data:', err);
        return {};
      }
    }
  };

  // Remote Storage Provider - uses local storage as primary, syncs to remote
  // This ensures fast reads and offline support while enabling cross-device sync
  const RemoteStorageProvider = {
    name: 'remoteStorage',

    async load(pageKey) {
      // Always load from local storage first (fast, reliable, works offline)
      const localData = await LocalStorageProvider.load(pageKey);
      console.log('[Obelos Storage] Loaded from local:', localData.highlights.length, 'highlights');

      // Trigger background sync check (non-blocking)
      this._checkRemoteForUpdates(pageKey).catch(err => {
        console.warn('[Obelos Storage] Background sync check failed:', err);
      });

      return localData;
    },

    // Non-blocking check for remote updates
    async _checkRemoteForUpdates(pageKey) {
      try {
        const response = await browserAPI.runtime.sendMessage({
          type: 'rs-load',
          pageKey: pageKey
        });
        if (response && response.success && response.data) {
          // If remote has data, we could merge or update local
          // For now, just log - full sync happens in options page
          console.log('[Obelos Storage] Remote has data for this page');
        }
      } catch (err) {
        // Silently ignore - remote might not be connected
      }
    },

    async save(pageKey, data) {
      // Always save to local first (critical for persistence)
      await LocalStorageProvider.save(pageKey, data);
      console.log('[Obelos Storage] Saved to local storage');

      // Then try to sync to remote (non-blocking for better UX)
      this._syncToRemote(pageKey, data).catch(err => {
        console.warn('[Obelos Storage] Remote sync failed:', err);
      });

      return true;
    },

    // Non-blocking sync to remote
    async _syncToRemote(pageKey, data) {
      try {
        const response = await browserAPI.runtime.sendMessage({
          type: 'rs-save',
          pageKey: pageKey,
          data: data
        });
        if (response && response.success) {
          console.log('[Obelos Storage] Synced to remote storage');
        }
      } catch (err) {
        // Silently ignore - will sync later when connected
      }
    },

    async clear(pageKey) {
      try {
        await LocalStorageProvider.clear(pageKey);
        await browserAPI.runtime.sendMessage({
          type: 'rs-clear',
          pageKey: pageKey
        });
        return true;
      } catch (err) {
        console.error('[Obelos Storage] Error clearing remote:', err);
        return false;
      }
    },

    async getAllKeys() {
      try {
        const response = await browserAPI.runtime.sendMessage({
          type: 'rs-get-all-keys'
        });
        if (response && response.success) {
          return response.keys || [];
        }
        return await LocalStorageProvider.getAllKeys();
      } catch (err) {
        return await LocalStorageProvider.getAllKeys();
      }
    },

    async getAll() {
      try {
        const response = await browserAPI.runtime.sendMessage({
          type: 'rs-get-all'
        });
        if (response && response.success) {
          return response.data || {};
        }
        return await LocalStorageProvider.getAll();
      } catch (err) {
        return await LocalStorageProvider.getAll();
      }
    }
  };

  // Storage Manager - handles provider selection and switching
  const StorageManager = {
    _currentProvider: LocalStorageProvider,
    _settingsKey: 'obelos-settings',

    async init() {
      const settings = await this.getSettings();
      if (settings.storageProvider === 'remoteStorage') {
        this._currentProvider = RemoteStorageProvider;
      }
      console.log('[Obelos Storage] Initialized with provider:', this._currentProvider.name);
    },

    async getSettings() {
      try {
        const result = await browserAPI.storage.local.get([this._settingsKey]);
        return result[this._settingsKey] || { storageProvider: 'local' };
      } catch (err) {
        return { storageProvider: 'local' };
      }
    },

    async saveSettings(settings) {
      try {
        await browserAPI.storage.local.set({ [this._settingsKey]: settings });
        return true;
      } catch (err) {
        console.error('[Obelos Storage] Error saving settings:', err);
        return false;
      }
    },

    async setProvider(providerName) {
      if (providerName === 'remoteStorage') {
        this._currentProvider = RemoteStorageProvider;
      } else {
        this._currentProvider = LocalStorageProvider;
      }
      await this.saveSettings({ storageProvider: providerName });
      console.log('[Obelos Storage] Switched to provider:', providerName);
    },

    getProvider() {
      return this._currentProvider;
    },

    getProviderName() {
      return this._currentProvider.name;
    },

    async load(pageKey) {
      return await this._currentProvider.load(pageKey);
    },

    async save(pageKey, data) {
      return await this._currentProvider.save(pageKey, data);
    },

    async clear(pageKey) {
      return await this._currentProvider.clear(pageKey);
    },

    async getAllKeys() {
      return await this._currentProvider.getAllKeys();
    },

    async getAll() {
      return await this._currentProvider.getAll();
    },

    // Migration helpers
    async migrateToRemote() {
      console.log('[Obelos Storage] Migrating data to remote storage...');
      const localData = await LocalStorageProvider.getAll();
      const keys = Object.keys(localData);
      let migrated = 0;

      for (const key of keys) {
        try {
          await browserAPI.runtime.sendMessage({
            type: 'rs-save',
            pageKey: key,
            data: localData[key]
          });
          migrated++;
        } catch (err) {
          console.error('[Obelos Storage] Failed to migrate:', key, err);
        }
      }

      console.log('[Obelos Storage] Migration complete:', migrated, '/', keys.length);
      return { total: keys.length, migrated: migrated };
    },

    async migrateToLocal() {
      console.log('[Obelos Storage] Migrating data to local storage...');
      try {
        const response = await browserAPI.runtime.sendMessage({
          type: 'rs-get-all'
        });

        if (response && response.success && response.data) {
          const keys = Object.keys(response.data);
          for (const key of keys) {
            await LocalStorageProvider.save(key, response.data[key]);
          }
          console.log('[Obelos Storage] Migration complete:', keys.length, 'pages');
          return { total: keys.length, migrated: keys.length };
        }
        return { total: 0, migrated: 0 };
      } catch (err) {
        console.error('[Obelos Storage] Migration failed:', err);
        return { total: 0, migrated: 0 };
      }
    }
  };

  // Export for use in other scripts
  if (typeof window !== 'undefined') {
    window.ObelosStorage = StorageManager;
    window.ObelosLocalStorage = LocalStorageProvider;
    window.ObelosRemoteStorage = RemoteStorageProvider;
  }

})();
