// remoteStorage module definition for Obelos
// This module is loaded by the background script

(function() {
  'use strict';

  // Define the Obelos module for remoteStorage
  // This follows the remoteStorage module pattern
  if (typeof RemoteStorage !== 'undefined') {
    RemoteStorage.defineModule('obelos', function(privateClient) {
      // Declare the data types we'll store
      privateClient.declareType('PageData', {
        type: 'object',
        properties: {
          highlights: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                text: { type: 'string' },
                color: { type: 'string' },
                annotation: { type: 'string' },
                timestamp: { type: 'number' },
                startOffset: { type: 'number' },
                endOffset: { type: 'number' },
                startXPath: { type: 'string' },
                endXPath: { type: 'string' }
              }
            }
          },
          anchors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                label: { type: 'string' },
                timestamp: { type: 'number' },
                xpath: { type: 'string' }
              }
            }
          },
          visible: { type: 'boolean' }
        }
      });

      // Helper to convert URL to a safe storage path
      function urlToPath(url) {
        // Encode the URL to be safe for storage paths
        // Replace special characters that aren't allowed in paths
        return encodeURIComponent(url)
          .replace(/\./g, '%2E')
          .replace(/~/g, '%7E');
      }

      function pathToUrl(path) {
        return decodeURIComponent(path.replace(/%2E/g, '.').replace(/%7E/g, '~'));
      }

      return {
        exports: {
          // Get data for a specific page
          async getPage(pageKey) {
            const path = urlToPath(pageKey);
            try {
              const data = await privateClient.getObject(path);
              return data || { highlights: [], anchors: [], visible: true };
            } catch (err) {
              console.error('[Obelos RS Module] Error getting page:', err);
              return { highlights: [], anchors: [], visible: true };
            }
          },

          // Save data for a specific page
          async savePage(pageKey, data) {
            const path = urlToPath(pageKey);
            try {
              await privateClient.storeObject('PageData', path, data);
              return true;
            } catch (err) {
              console.error('[Obelos RS Module] Error saving page:', err);
              return false;
            }
          },

          // Clear data for a specific page
          async clearPage(pageKey) {
            const path = urlToPath(pageKey);
            try {
              await privateClient.remove(path);
              return true;
            } catch (err) {
              console.error('[Obelos RS Module] Error clearing page:', err);
              return false;
            }
          },

          // Get all page keys
          async getAllKeys() {
            try {
              const listing = await privateClient.getListing('');
              const keys = [];
              for (const name of Object.keys(listing || {})) {
                // Remove trailing slash if present
                const cleanName = name.replace(/\/$/, '');
                keys.push(pathToUrl(cleanName));
              }
              return keys;
            } catch (err) {
              console.error('[Obelos RS Module] Error getting keys:', err);
              return [];
            }
          },

          // Get all data
          async getAll() {
            try {
              const keys = await this.getAllKeys();
              const data = {};
              for (const key of keys) {
                data[key] = await this.getPage(key);
              }
              return data;
            } catch (err) {
              console.error('[Obelos RS Module] Error getting all:', err);
              return {};
            }
          },

          // Subscribe to changes
          onChange(callback) {
            privateClient.on('change', callback);
          },

          // Get client for direct access if needed
          getClient() {
            return privateClient;
          }
        }
      };
    });
  }

})();
