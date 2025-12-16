// Popup script for browser action

// Browser API compatibility (Firefox and Chrome)
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

document.addEventListener('DOMContentLoaded', async () => {
  
  // Get active tab
  const tabs = await browserAPI.tabs.query({ active: true, currentWindow: true });
  const activeTab = tabs[0];

  // Get current state from content script
  let state = {
    highlightsCount: 0,
    anchorsCount: 0,
    visible: true,
    currentColor: 'yellow'
  };

  try {
    state = await browserAPI.tabs.sendMessage(activeTab.id, { action: 'getState' });
  } catch (e) {
    console.log('Could not get state from content script');
  }

  // Update UI with current state
  updateStats(state);
  updateVisibilityButton(state.visible);
  updateColorSelection(state.currentColor);

  // Color selection
  document.querySelectorAll('.color-option').forEach(btn => {
    btn.addEventListener('click', async () => {
      const color = btn.dataset.color;
      
      // Update UI
      document.querySelectorAll('.color-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Send to content script
      try {
        await browserAPI.tabs.sendMessage(activeTab.id, { 
          action: 'setColor', 
          color: color 
        });
      } catch (e) {
        console.error('Error setting color:', e);
      }
    });
  });

  // Toggle visibility
  document.getElementById('toggle-visibility').addEventListener('click', async () => {
    try {
      await browserAPI.tabs.sendMessage(activeTab.id, { action: 'toggleVisibility' });
      
      // Update UI
      state.visible = !state.visible;
      updateVisibilityButton(state.visible);
    } catch (e) {
      console.error('Error toggling visibility:', e);
    }
  });

  // Clear all
  document.getElementById('clear-all').addEventListener('click', async () => {
    try {
      await browserAPI.tabs.sendMessage(activeTab.id, { action: 'clearAll' });
      
      // Update UI
      state.highlightsCount = 0;
      state.anchorsCount = 0;
      updateStats(state);
    } catch (e) {
      console.error('Error clearing all:', e);
    }
  });

  // Update stats display
  function updateStats(state) {
    document.getElementById('highlights-count').textContent = state.highlightsCount;
    document.getElementById('anchors-count').textContent = state.anchorsCount;
  }

  // Update visibility button
  function updateVisibilityButton(visible) {
    const text = document.getElementById('visibility-text');
    text.textContent = visible ? 'Hide Highlights' : 'Show Highlights';
  }

  // Update color selection
  function updateColorSelection(color) {
    document.querySelectorAll('.color-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.color === color);
    });
  }

});
