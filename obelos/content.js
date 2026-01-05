// Content script for highlighting and annotation functionality

(function() {
  'use strict';

  // Browser API compatibility (Firefox and Chrome)
  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

  const COLORS = {
    yellow: '#FFEB3B',
    green: '#81C784',
    blue: '#64B5F6',
    pink: '#F48FB1',
    orange: '#FFB74D',
    purple: '#BA68C8'
  };

  let currentColor = 'yellow';
  let highlightsVisible = true;
  let highlights = [];
  let anchors = [];
  let toolbarIframe = null;
  let savedSelection = null;
  const pageKey = getPageKey();

  // Generate a unique key for this page
  function getPageKey() {
    return window.location.href.split('#')[0];
  }

  // Generate unique ID
  function generateId() {
    return 'ha-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }

  // Initialize the extension
  async function init() {
    console.log('[Obelos] Initializing extension...');

    // Make sure body exists before creating toolbar
    if (!document.body) {
      console.warn('[Obelos] Body not ready, waiting...');
      setTimeout(init, 100);
      return;
    }

    // Prevent double initialization
    if (document.getElementById('ha-toolbar-iframe')) {
      console.log('[Obelos] Already initialized');
      return;
    }

    // Initialize storage manager
    if (window.ObelosStorage) {
      await window.ObelosStorage.init();
    }

    createToolbar();
    attachEventListeners();
    checkForHashNavigation();

    // Load data and then restore - this is async
    loadData().then(() => {
      restoreHighlights();
      restoreAnchors();
      console.log('[Obelos] Extension initialized successfully');
    });
  }

  // Load data from storage - now returns a Promise
  async function loadData() {
    try {
      let data;
      if (window.ObelosStorage) {
        data = await window.ObelosStorage.load(pageKey);
      } else {
        // Fallback to direct storage access
        const result = await browserAPI.storage.local.get([pageKey]);
        data = result[pageKey] || {};
      }

      highlights = data.highlights || [];
      anchors = data.anchors || [];
      highlightsVisible = data.visible !== false;
      console.log('[Obelos] Loaded', highlights.length, 'highlights and', anchors.length, 'anchors');
    } catch (err) {
      console.error('[Obelos] Error loading data:', err);
    }
  }

  // Save data to storage
  async function saveData() {
    const data = {
      highlights: highlights,
      anchors: anchors,
      visible: highlightsVisible
    };
    console.log('[Obelos] Saving data:', highlights.length, 'highlights,', anchors.length, 'anchors');

    try {
      if (window.ObelosStorage) {
        await window.ObelosStorage.save(pageKey, data);
      } else {
        // Fallback to direct storage access
        await browserAPI.storage.local.set({ [pageKey]: data });
      }
      console.log('[Obelos] Data saved successfully');
    } catch (err) {
      console.error('[Obelos] Error saving data:', err);
    }
  }

  // Create floating toolbar using iframe for complete isolation
  function createToolbar() {
    console.log('[Obelos] Creating toolbar iframe...');
    
    // Create the HTML content for the toolbar - compact horizontal layout
    const toolbarHTML = `<!DOCTYPE html>
<html>
<head>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { 
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
  font-size: 13px;
  background: transparent;
  margin: 0;
  padding: 3px;
}
.ha-toolbar {
  background: white;
  border-radius: 6px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
  padding: 6px 8px;
  border: 1px solid #bbb;
  display: flex;
  align-items: center;
  gap: 6px;
}
.ha-colors { display: flex; gap: 3px; }
.ha-color-btn {
  width: 20px;
  height: 20px;
  border: 2px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  padding: 0;
}
.ha-color-btn:hover { transform: scale(1.15); }
.ha-color-btn.active { border-color: #333; }
.ha-divider { width: 1px; height: 20px; background: #ddd; }
.ha-actions { display: flex; gap: 2px; }
.ha-action-btn {
  background: #f0f0f0;
  border: 1px solid #ccc;
  padding: 3px 6px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}
.ha-action-btn:hover { background: #e0e0e0; }
.ha-close {
  background: none;
  border: none;
  font-size: 16px;
  color: #999;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
}
.ha-close:hover { color: #333; }
</style>
</head>
<body>
<div class="ha-toolbar">
  <div class="ha-colors">
    <button class="ha-color-btn active" data-color="yellow" style="background:#FFEB3B" title="Yellow"></button>
    <button class="ha-color-btn" data-color="green" style="background:#81C784" title="Green"></button>
    <button class="ha-color-btn" data-color="blue" style="background:#64B5F6" title="Blue"></button>
    <button class="ha-color-btn" data-color="pink" style="background:#F48FB1" title="Pink"></button>
    <button class="ha-color-btn" data-color="orange" style="background:#FFB74D" title="Orange"></button>
    <button class="ha-color-btn" data-color="purple" style="background:#BA68C8" title="Purple"></button>
  </div>
  <div class="ha-divider"></div>
  <div class="ha-actions">
    <button class="ha-action-btn" data-action="highlight" title="Highlight">✓</button>
    <button class="ha-action-btn" data-action="annotate" title="Add Note">📝</button>
    <button class="ha-action-btn" data-action="anchor" title="Bookmark">🔖</button>
  </div>
  <button class="ha-close" id="close-btn" title="Close">×</button>
</div>
<script>
  document.getElementById('close-btn').onclick = function() { parent.postMessage({type: 'ha-close'}, '*'); };
  document.querySelectorAll('.ha-color-btn').forEach(function(btn) {
    btn.onclick = function() {
      document.querySelectorAll('.ha-color-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      parent.postMessage({type: 'ha-color', color: btn.dataset.color}, '*');
    };
  });
  document.querySelectorAll('.ha-action-btn').forEach(function(btn) {
    btn.onclick = function() { parent.postMessage({type: 'ha-action', action: btn.dataset.action}, '*'); };
  });
</script>
</body>
</html>`;
    
    // Create iframe with data URL
    toolbarIframe = document.createElement('iframe');
    toolbarIframe.id = 'ha-toolbar-iframe';
    toolbarIframe.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(toolbarHTML);
    
    // Apply styles - compact size
    toolbarIframe.setAttribute('style', 
      'position: fixed !important; ' +
      'top: 100px !important; ' +
      'left: 100px !important; ' +
      'width: 320px !important; ' +
      'height: 45px !important; ' +
      'border: none !important; ' +
      'z-index: 2147483647 !important; ' +
      'display: none !important; ' +
      'background: transparent !important;'
    );
    toolbarIframe.setAttribute('allowtransparency', 'true');
    
    document.body.appendChild(toolbarIframe);
    
    // Listen for messages from iframe
    window.addEventListener('message', function(event) {
      if (!event.data || !event.data.type) return;
      
      if (event.data.type === 'ha-close') {
        hideToolbar();
      } else if (event.data.type === 'ha-color') {
        currentColor = event.data.color;
      } else if (event.data.type === 'ha-action') {
        if (event.data.action === 'highlight') {
          createHighlightFromSelection();
        } else if (event.data.action === 'annotate') {
          createHighlightFromSelection(true);
        } else if (event.data.action === 'anchor') {
          createAnchor();
        }
        hideToolbar();
      }
    });
    
    console.log('[Obelos] Toolbar iframe created with data URL');
    console.log('[Obelos] Iframe element:', toolbarIframe);
    console.log('[Obelos] Iframe in DOM:', document.body.contains(toolbarIframe));
  }
  
  // Set up event listeners inside the iframe - not needed with postMessage approach
  function setupIframeListeners() {
    // Listeners are now inside the iframe via postMessage
  }

  // Attach event listeners
  function attachEventListeners() {
    // Document-level interactions
    document.addEventListener('click', handleClick);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);

    // Message listener for popup commands
    browserAPI.runtime.onMessage.addListener(handleMessage);
  }

  // Handle keyboard events
  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      hideToolbar();
      savedSelection = null;
      window.getSelection().removeAllRanges();
    }
  }

  // Handle messages from popup
  function handleMessage(message) {
    if (message.action === 'toggleVisibility') {
      toggleVisibility();
    } else if (message.action === 'setColor') {
      currentColor = message.color;
    } else if (message.action === 'getState') {
      return Promise.resolve({
        highlightsCount: highlights.length,
        anchorsCount: anchors.length,
        visible: highlightsVisible,
        currentColor: currentColor
      });
    } else if (message.action === 'clearAll') {
      clearAllHighlights();
    }
  }

  // Handle mouse up to show toolbar
  function handleMouseUp(e) {
    // Don't show toolbar if clicking inside the iframe
    if (e.target === toolbarIframe) return;
    
    const selection = window.getSelection();
    const selectedText = selection ? selection.toString().trim() : '';
    
    if (selection && selectedText.length > 0) {
      // Save the selection before showing toolbar
      if (selection.rangeCount > 0) {
        savedSelection = selection.getRangeAt(0).cloneRange();
      }
      showToolbar(e.clientX, e.clientY);
    }
  }

  // Handle clicks
  function handleClick(e) {
    // Close toolbar if clicking outside
    if (toolbarIframe && e.target !== toolbarIframe) {
      // Don't close immediately on the same click that opened it
      setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.toString().trim().length === 0) {
          hideToolbar();
        }
      }, 100);
    }

    // Handle highlight/anchor clicks
    if (e.target.classList.contains('ha-highlight') || e.target.closest('.ha-highlight')) {
      const highlight = e.target.classList.contains('ha-highlight') ? e.target : e.target.closest('.ha-highlight');
      showHighlightMenu(highlight, e.clientX, e.clientY);
      e.stopPropagation();
    } else if (e.target.classList.contains('ha-anchor-marker')) {
      const anchor = e.target;
      showAnchorMenu(anchor, e.clientX, e.clientY);
      e.stopPropagation();
    }
  }

  // Show toolbar
  function showToolbar(x, y) {
    if (!toolbarIframe) return;
    
    toolbarIframe.style.display = 'block';
    
    // Position toolbar near selection - compact size is 320x45
    let left = x - 160; // Center the toolbar
    let top = y - 55;   // Above the selection
    
    // Keep toolbar on screen
    if (left < 10) left = 10;
    if (left + 320 > window.innerWidth - 10) {
      left = window.innerWidth - 330;
    }
    if (top < 10) top = y + 20; // Below selection if not enough room above
    
    toolbarIframe.style.left = left + 'px';
    toolbarIframe.style.top = top + 'px';
    
    console.log('[Obelos] Toolbar shown at', left, top);
  }

  // Hide toolbar
  function hideToolbar() {
    if (toolbarIframe) {
      toolbarIframe.style.display = 'none';
    }
  }

  // Create highlight from selection
  function createHighlightFromSelection(withAnnotation = false) {
    // Use saved selection
    if (!savedSelection) {
      console.log('[Obelos] No saved selection');
      return;
    }

    const text = savedSelection.toString().trim();
    if (text.length === 0) return;

    const id = generateId();
    const annotation = withAnnotation ? prompt('Enter annotation:') : '';
    
    // Create highlight data
    const highlightData = {
      id: id,
      text: text,
      color: currentColor,
      annotation: annotation || '',
      timestamp: Date.now(),
      // Store range info for restoration
      startOffset: savedSelection.startOffset,
      endOffset: savedSelection.endOffset,
      startXPath: getXPath(savedSelection.startContainer),
      endXPath: getXPath(savedSelection.endContainer)
    };

    // Apply highlight to DOM
    try {
      applyHighlight(savedSelection, id, currentColor, annotation);
      highlights.push(highlightData);
      saveData();
      showNotification('Highlight added');
    } catch (e) {
      console.error('[Obelos] Error creating highlight:', e);
      showNotification('Could not highlight this selection');
    }

    // Clear selection
    window.getSelection().removeAllRanges();
    savedSelection = null;
    hideToolbar();
  }

  // Apply highlight to a range
  function applyHighlight(range, id, color, annotation) {
    const span = document.createElement('span');
    span.className = 'ha-highlight' + (annotation ? ' has-annotation' : '');
    span.id = id;
    span.style.backgroundColor = COLORS[color];
    span.style.borderRadius = '2px';
    span.style.padding = '1px 0';
    span.dataset.color = color;
    span.dataset.annotation = annotation || '';
    
    // Show annotation as tooltip on hover
    if (annotation) {
      span.title = 'Annotation: ' + annotation;
      span.style.borderBottom = '2px dotted #333';
    }
    
    try {
      // Clone the range to avoid modifying the original
      const clonedRange = range.cloneRange();
      console.log('[Obelos] Applying highlight with surroundContents, range:', 
        clonedRange.startContainer.nodeName, clonedRange.startOffset, 
        'to', clonedRange.endContainer.nodeName, clonedRange.endOffset);
      clonedRange.surroundContents(span);
      console.log('[Obelos] surroundContents succeeded, span parent:', span.parentNode ? span.parentNode.nodeName : 'NO PARENT');
    } catch (e) {
      // If surroundContents fails (crosses element boundaries), highlight text nodes individually
      console.log('[Obelos] surroundContents failed:', e.message, '- using fallback');
      highlightRangeNodes(range, id, color, annotation);
    }
  }
  
  // Highlight text nodes within a range individually (for cross-boundary selections)
  function highlightRangeNodes(range, id, color, annotation) {
    const textNodes = [];
    const treeWalker = document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          const nodeRange = document.createRange();
          nodeRange.selectNodeContents(node);
          return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      }
    );
    
    let node;
    while (node = treeWalker.nextNode()) {
      if (range.intersectsNode(node)) {
        textNodes.push(node);
      }
    }
    
    textNodes.forEach((textNode, index) => {
      const span = document.createElement('span');
      span.className = 'ha-highlight' + (annotation ? ' has-annotation' : '');
      if (index === 0) span.id = id; // Only first span gets the ID
      span.style.backgroundColor = COLORS[color];
      span.style.borderRadius = '2px';
      span.style.padding = '1px 0';
      span.dataset.color = color;
      span.dataset.annotation = annotation || '';
      
      // Show annotation as tooltip on hover
      if (annotation) {
        span.title = 'Annotation: ' + annotation;
        span.style.borderBottom = '2px dotted #333';
      }
      
      const parent = textNode.parentNode;
      parent.insertBefore(span, textNode);
      span.appendChild(textNode);
    });
  }

  // Get XPath for an element
  function getXPath(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentNode;
    }
    
    const parts = [];
    while (node && node.nodeType === Node.ELEMENT_NODE) {
      let index = 1;
      let sibling = node.previousSibling;
      while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === node.tagName) {
          index++;
        }
        sibling = sibling.previousSibling;
      }
      parts.unshift(node.tagName.toLowerCase() + '[' + index + ']');
      node = node.parentNode;
    }
    return '/' + parts.join('/');
  }

  // Create anchor/bookmark
  function createAnchor() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const id = generateId();
    const label = prompt('Enter bookmark label (optional):') || 'Bookmark';
    
    const anchorData = {
      id: id,
      label: label,
      timestamp: Date.now(),
      xpath: getXPath(range.startContainer)
    };

    // Create anchor marker
    const marker = document.createElement('span');
    marker.className = 'ha-anchor-marker';
    marker.id = id;
    marker.textContent = '🔖';
    marker.dataset.label = label;
    marker.title = label;
    
    range.insertNode(marker);
    anchors.push(anchorData);
    saveData();
    
    selection.removeAllRanges();
    hideToolbar();
    showNotification('Bookmark added');
  }

  // Restore highlights from storage
  function restoreHighlights() {
    console.log('[Obelos] Restoring', highlights.length, 'highlights');
    
    highlights.forEach(highlightData => {
      try {
        // Try to find the text in the document using text search
        const found = findAndHighlightText(
          highlightData.text, 
          highlightData.id, 
          highlightData.color, 
          highlightData.annotation
        );
        if (found) {
          console.log('[Obelos] Restored highlight:', highlightData.text.substring(0, 30));
        } else {
          console.warn('[Obelos] Could not find text to restore:', highlightData.text.substring(0, 30));
        }
      } catch (e) {
        console.error('[Obelos] Error restoring highlight:', e);
      }
    });
  }
  
  // Restore anchors from storage
  function restoreAnchors() {
    console.log('[Obelos] Restoring', anchors.length, 'anchors');
    // Anchors are harder to restore without exact position - skip for now
  }
  
  // Find text in document and apply highlight
  function findAndHighlightText(searchText, id, color, annotation) {
    console.log('[Obelos] Finding text:', JSON.stringify(searchText));
    
    // Log character codes to detect hidden characters
    const charCodes = [];
    for (let i = 0; i < searchText.length; i++) {
      charCodes.push(searchText.charCodeAt(i));
    }
    console.log('[Obelos] Search text char codes:', charCodes.join(','));
    
    // Skip if already exists
    if (document.getElementById(id)) {
      console.log('[Obelos] Element already exists:', id);
      return true;
    }
    
    // Collect all text nodes
    const treeWalker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let node;
    const textNodes = [];
    
    while (node = treeWalker.nextNode()) {
      // Skip our own elements
      if (node.parentElement && 
          (node.parentElement.id === 'ha-toolbar-iframe' || 
           node.parentElement.closest && node.parentElement.closest('#ha-toolbar-iframe'))) {
        continue;
      }
      // Skip already highlighted text
      if (node.parentElement && node.parentElement.classList && 
          node.parentElement.classList.contains('ha-highlight')) {
        continue;
      }
      textNodes.push(node);
    }
    
    // APPROACH 1: Search for exact text match in single node
    for (const textNode of textNodes) {
      const idx = textNode.textContent.indexOf(searchText);
      if (idx !== -1) {
        try {
          const range = document.createRange();
          range.setStart(textNode, idx);
          range.setEnd(textNode, idx + searchText.length);
          console.log('[Obelos] Found exact match in single node');
          applyHighlight(range, id, color, annotation);
          return true;
        } catch (e) {
          console.error('[Obelos] Error creating range:', e);
        }
      }
    }
    
    // APPROACH 2: Search across multiple adjacent text nodes
    // Build a concatenated view of the text with node boundaries tracked
    let fullText = '';
    const nodeMap = []; // Maps character positions to {node, offset}
    
    for (const textNode of textNodes) {
      const startPos = fullText.length;
      fullText += textNode.textContent;
      nodeMap.push({
        node: textNode,
        start: startPos,
        end: fullText.length
      });
    }
    
    // Debug: Check if text exists anywhere in fullText
    if (fullText.includes('689,231')) {
      console.log('[Obelos] Found 689,231 in fullText!');
      // Find position and show surrounding context
      const pos = fullText.indexOf('689,231');
      console.log('[Obelos] Context:', JSON.stringify(fullText.substring(Math.max(0, pos-10), pos+20)));
    }
    
    // Search in the concatenated text
    const searchIdx = fullText.indexOf(searchText);
    console.log('[Obelos] Cross-node search index:', searchIdx);
    
    if (searchIdx !== -1) {
      const searchEnd = searchIdx + searchText.length;
      
      // Find which nodes contain the start and end
      let startNode = null, startOffset = 0;
      let endNode = null, endOffset = 0;
      
      for (const mapping of nodeMap) {
        if (!startNode && searchIdx >= mapping.start && searchIdx < mapping.end) {
          startNode = mapping.node;
          startOffset = searchIdx - mapping.start;
        }
        if (searchEnd > mapping.start && searchEnd <= mapping.end) {
          endNode = mapping.node;
          endOffset = searchEnd - mapping.start;
          break;
        }
      }
      
      if (startNode && endNode) {
        try {
          const range = document.createRange();
          range.setStart(startNode, startOffset);
          range.setEnd(endNode, endOffset);
          console.log('[Obelos] Found match across nodes');
          applyHighlight(range, id, color, annotation);
          return true;
        } catch (e) {
          console.error('[Obelos] Error with cross-node range:', e);
        }
      }
    }
    
    // APPROACH 3: Try normalized search (collapse whitespace)
    const normalizedSearch = searchText.replace(/\s+/g, '').toLowerCase();
    let normalizedFull = '';
    const normalizedMap = []; // Maps normalized positions to original positions
    
    for (let i = 0; i < fullText.length; i++) {
      if (!fullText[i].match(/\s/)) {
        normalizedMap.push(i);
        normalizedFull += fullText[i].toLowerCase();
      }
    }
    
    const normalizedIdx = normalizedFull.indexOf(normalizedSearch);
    if (normalizedIdx !== -1) {
      const origStart = normalizedMap[normalizedIdx];
      const origEnd = normalizedMap[normalizedIdx + normalizedSearch.length - 1] + 1;
      
      // Find nodes
      let startNode = null, startOffset = 0;
      let endNode = null, endOffset = 0;
      
      for (const mapping of nodeMap) {
        if (!startNode && origStart >= mapping.start && origStart < mapping.end) {
          startNode = mapping.node;
          startOffset = origStart - mapping.start;
        }
        if (origEnd > mapping.start && origEnd <= mapping.end) {
          endNode = mapping.node;
          endOffset = origEnd - mapping.start;
          break;
        }
      }
      
      if (startNode && endNode) {
        try {
          const range = document.createRange();
          range.setStart(startNode, startOffset);
          range.setEnd(endNode, endOffset);
          console.log('[Obelos] Found normalized match');
          applyHighlight(range, id, color, annotation);
          return true;
        } catch (e) {
          console.error('[Obelos] Error with normalized range:', e);
        }
      }
    }
    
    console.warn('[Obelos] Could not find text in any form');
    return false;
  }

  // Toggle visibility of all highlights
  function toggleVisibility() {
    highlightsVisible = !highlightsVisible;
    document.body.classList.toggle('ha-hidden', !highlightsVisible);
    saveData();
  }

  // Clear all highlights
  function clearAllHighlights() {
    document.querySelectorAll('.ha-highlight').forEach(el => {
      const parent = el.parentNode;
      while (el.firstChild) {
        parent.insertBefore(el.firstChild, el);
      }
      parent.removeChild(el);
    });
    
    document.querySelectorAll('.ha-anchor-marker').forEach(el => el.remove());
    
    highlights = [];
    anchors = [];
    saveData();
    showNotification('All highlights cleared');
  }

  // Show highlight context menu
  function showHighlightMenu(highlight, x, y) {
    const annotation = highlight.dataset.annotation || '';
    const text = highlight.textContent.substring(0, 50);
    const id = highlight.id;
    
    // Build menu text
    let menuText = `Highlight: "${text}..."`;
    if (annotation) {
      menuText += `\n\nAnnotation: ${annotation}`;
    }
    menuText += '\n\n';
    menuText += 'Actions:\n';
    menuText += '• Press 1 - Copy link to highlight\n';
    menuText += '• Press 2 - Edit annotation\n';
    menuText += '• Press 3 - Delete highlight\n';
    menuText += '• Press any other key - Cancel';
    
    const action = prompt(menuText);
    
    if (action === '1') {
      // Copy link to highlight
      const link = window.location.href.split('#')[0] + '#' + id;
      navigator.clipboard.writeText(link).then(() => {
        showNotification('Link copied to clipboard');
      }).catch(() => {
        // Fallback
        prompt('Copy this link:', link);
      });
    } else if (action === '2') {
      // Edit annotation
      const newAnnotation = prompt('Edit annotation:', annotation);
      if (newAnnotation !== null) {
        highlight.dataset.annotation = newAnnotation;
        // Update in storage
        const highlightData = highlights.find(h => h.id === id);
        if (highlightData) {
          highlightData.annotation = newAnnotation;
          saveData();
        }
        // Update class
        if (newAnnotation) {
          highlight.classList.add('has-annotation');
        } else {
          highlight.classList.remove('has-annotation');
        }
        showNotification('Annotation updated');
      }
    } else if (action === '3') {
      deleteHighlight(id);
    }
  }

  // Show anchor context menu
  function showAnchorMenu(anchor, x, y) {
    const label = anchor.dataset.label || 'Bookmark';
    const id = anchor.id;
    
    let menuText = `Bookmark: "${label}"`;
    menuText += '\n\n';
    menuText += 'Actions:\n';
    menuText += '• Press 1 - Copy link to bookmark\n';
    menuText += '• Press 2 - Edit label\n';
    menuText += '• Press 3 - Delete bookmark\n';
    menuText += '• Press any other key - Cancel';
    
    const action = prompt(menuText);
    
    if (action === '1') {
      // Copy link to anchor
      const link = window.location.href.split('#')[0] + '#' + id;
      navigator.clipboard.writeText(link).then(() => {
        showNotification('Link copied to clipboard');
      }).catch(() => {
        prompt('Copy this link:', link);
      });
    } else if (action === '2') {
      // Edit label
      const newLabel = prompt('Edit bookmark label:', label);
      if (newLabel !== null && newLabel.trim()) {
        anchor.dataset.label = newLabel;
        anchor.title = newLabel;
        // Update in storage
        const anchorData = anchors.find(a => a.id === id);
        if (anchorData) {
          anchorData.label = newLabel;
          saveData();
        }
        showNotification('Bookmark updated');
      }
    } else if (action === '3') {
      deleteAnchor(id);
    }
  }

  // Delete a highlight
  function deleteHighlight(id) {
    const element = document.getElementById(id);
    if (element) {
      const parent = element.parentNode;
      while (element.firstChild) {
        parent.insertBefore(element.firstChild, element);
      }
      parent.removeChild(element);
    }
    highlights = highlights.filter(h => h.id !== id);
    saveData();
    showNotification('Highlight deleted');
  }

  // Delete an anchor
  function deleteAnchor(id) {
    const element = document.getElementById(id);
    if (element) {
      element.remove();
    }
    anchors = anchors.filter(a => a.id !== id);
    saveData();
    showNotification('Bookmark deleted');
  }

  // Show notification
  function showNotification(message) {
    // Create a simple notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #333;
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      font-size: 14px;
      z-index: 2147483647;
      opacity: 0;
      transition: opacity 0.3s;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.style.opacity = '1', 10);
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }

  // Check for hash navigation
  function checkForHashNavigation() {
    if (window.location.hash) {
      const id = window.location.hash.substring(1);
      setTimeout(() => {
        const element = document.getElementById(id);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
