# Obelos

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Obelos** is a Firefox browser extension that enables users to highlight text, add annotations, and create bookmarks on any webpage with persistent storage and shareable links via URL fragments.

## Development Workflow

This is a pure Firefox WebExtension with **no build process**:
1. Edit source files in `obelos/` directory
2. Load extension in Firefox via `about:debugging` → "This Firefox" → "Load Temporary Add-on"
3. Select any file in the `obelos/` folder
4. Reload extension and refresh browser tabs to see changes

## Architecture

### Component Structure

```
obelos/
├── manifest.json       # Extension config (manifest_version 2)
├── content.js          # Main logic - injected into all pages
├── content.css         # Highlight and marker styles
├── storage.js          # Storage abstraction layer (local-first with remote sync)
├── background.js       # Background script for remoteStorage sync
├── popup.html/js/css   # Browser action toolbar UI
├── options.html/js/css # Settings page with OAuth connection UI
└── lib/
    └── remotestorage.min.js    # remoteStorage.js library
```

### Data Flow

1. **Content Script** (`content.js`): Monolithic file handling all core logic
   - Text selection detection and toolbar positioning
   - Highlight creation, storage, and restoration
   - XPath-based position storage for persistence across page reloads
   - URL fragment navigation for shareable links

2. **Popup UI**: Communicates with content script via `browser.tabs.sendMessage()`

3. **Floating Toolbar**: Embedded as data URL iframe for DOM isolation from page scripts

### Storage System

Two storage backends available (configured in Settings):

1. **Local Storage** (default): Uses `browser.storage.local` API
2. **remoteStorage**: Cross-device sync via remoteStorage protocol

Data stored per-page with URL (without fragments) as key:
```javascript
{
  highlights: [{
    id: 'ha-[timestamp]-[random]',
    text: string,
    color: string,
    annotation: string,
    timestamp: number,
    startOffset, endOffset, startXPath, endXPath
  }],
  anchors: [{ id, label, timestamp, xpath }],
  visible: boolean
}
```

### remoteStorage Integration

- **Storage abstraction** (`storage.js`): `ObelosStorage` manager with `LocalStorageProvider` and `RemoteStorageProvider`
- **Local-first architecture**: Always reads/writes to local storage first, syncs to remote in background
- **Options page** (`options.js`): Custom OAuth flow using `browser.identity.launchWebAuthFlow()` for browser extension compatibility
- **Background script** (`background.js`): Handles remote storage operations via message passing

OAuth flow (options.js):
1. User enters remoteStorage address (e.g., `user@5apps.com`)
2. WebFinger lookup discovers OAuth endpoint
3. `browser.identity.launchWebAuthFlow()` handles OAuth popup
4. Credentials stored in `browser.storage.local` for reconnection

Communication flow:
```
content.js → ObelosStorage.save() → LocalStorageProvider.save() (immediate)
                                  → sendMessage('rs-save') → background.js (async sync)
```

Sync behavior:
- **Local-first**: All reads/writes go to local storage immediately
- **Background sync**: Remote sync happens asynchronously, non-blocking
- **Last-write-wins**: Simple conflict resolution
- **Offline support**: Works without network, syncs when connected

### Highlight Restoration Algorithm

3-tier text search for finding highlights on page reload:
1. Exact match within single text node
2. Cross-node concatenated text search
3. Normalized search (whitespace-insensitive)

## Code Conventions

- **IIFE Pattern**: Content script wrapped to avoid global namespace pollution
- **Browser API Compatibility**: `typeof browser !== 'undefined' ? browser : chrome`
- **CSS Class Prefix**: All classes use `ha-` prefix (legacy from "highlight-annotator")
- **ID Pattern**: `ha-[timestamp]-[random9chars]`
- **Logging**: All console output prefixed with `[Obelos]`

## Key Implementation Details

- Toolbar is an iframe with data URL to isolate from page scripts
- Uses `postMessage` API for iframe communication
- XPath generation stores highlight positions for persistence
- TreeWalker for efficient DOM traversal
- Handles cross-boundary text selections with fallback when `surroundContents()` fails
