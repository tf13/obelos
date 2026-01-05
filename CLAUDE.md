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
├── storage.js          # Storage abstraction layer
├── background.js       # Background script for remoteStorage sync
├── rs-module.js        # remoteStorage module definition
├── popup.html/js/css   # Browser action toolbar UI
├── options.html/js/css # Settings page with remoteStorage widget
└── lib/
    ├── remotestorage.min.js    # remoteStorage.js library
    └── remotestorage-widget.js # Login widget
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
- **Background script** (`background.js`): Manages single remoteStorage instance, handles sync, broadcasts changes to tabs
- **Module** (`rs-module.js`): Defines `obelos` module with `PageData` schema, URL-to-path encoding
- **Options page**: remoteStorage widget for connecting to providers (5apps, self-hosted)

Communication flow:
```
content.js → ObelosStorage.save() → sendMessage('rs-save') → background.js → remoteStorage.obelos.savePage()
```

Sync behavior:
- Full dataset sync on startup
- Last-write-wins conflict resolution
- Offline-first: saves to local storage as fallback

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
