/**
 * content.js - Content Script
 * Bridges communication between inject.js (page context) and background.js (service worker)
 */

(function () {
  'use strict';

  // Listen for messages from the injected script
  function setupMessageListener() {
    window.addEventListener('message', function (event) {
      // Only accept messages from the same window
      if (event.source !== window) return;

      // Only process messages from our bridge
      if (!event.data || (event.data.source !== 'WS_BRIDGE' && event.data.source !== 'WS_BRIDGE_RESULT')) return;

      const payload = event.data.payload;
      if (!payload) return;

      // If payload contains a stringified JSON in event.data.value, try to parse it into an object
      try {
        if (payload.event && payload.event.data && payload.event.data.type === 'string' && typeof payload.event.data.value === 'string') {
          const s = payload.event.data.value;
          const trimmed = s.trim();
          if (trimmed && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
            try {
              const parsed = JSON.parse(s);
              payload.event.data = { type: 'json', value: parsed };
              console.log('[WS_BRIDGE] Parsed nested JSON in WS_EVENT into object');
            } catch (e) {
              // Not JSON — ignore and send as string
            }
          }
        }
        // Also handle API_RESPONSE string data
        if (payload.type === 'API_RESPONSE' && payload.data && payload.data.type === 'string' && typeof payload.data.value === 'string') {
          const s = payload.data.value;
          const trimmed = s.trim();
          if (trimmed && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
            try {
              const parsed = JSON.parse(s);
              payload.data = { type: 'json', value: parsed };
              console.log('[WS_BRIDGE] Parsed nested JSON in API_RESPONSE into object');
            } catch (e) {
              // Not JSON — ignore and send as string
            }
          }
        }
      } catch (e) {
        // Defensive: ensure we never throw here
      }

      // Debug: log that we're forwarding to background
      console.log('[WS_BRIDGE] Content forwarding to background:', payload.type);

      const messageType = event.data.source === 'WS_BRIDGE_RESULT' ? 'WS_BRIDGE_RESULT' : 'WS_BRIDGE_EVENT';

      // Forward to background service worker (use callback & lastError for robust error handling)
      try {
        chrome.runtime.sendMessage({
          type: messageType,
          payload: payload
        }, function (response) {
          const err = chrome.runtime.lastError;
          if (err) {
            const msg = err.message || '';
            // Silently ignore expected transient errors (service worker inactive, tab navigations, etc.)
            if (
              msg.includes('Receiving end does not exist') ||
              msg.includes('Extension context invalidated') ||
              msg.includes('Could not establish connection') ||
              msg.includes('The message port closed before a response was received') ||
              msg.includes('message port closed')
            ) {
              return;
            }
            console.warn('[WS_BRIDGE] Failed to send message:', err);
          }
        });
      } catch (error) {
        // Handle synchronous errors (ignore common transient errors)
        const msg = error && error.message ? error.message : '';
        if (!msg.includes('Extension context invalidated') && !msg.includes('Receiving end does not exist')) {
          console.warn('[WS_BRIDGE] Error sending message:', error);
        }
      }
    }, false);
  }

  // Listen for messages from background script (for future bidirectional support)
  function setupBackgroundListener() {
    chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
      if (message.type === 'WS_BRIDGE_COMMAND') {
        // Forward command to page context
        window.postMessage({
          source: 'WS_BRIDGE_COMMAND',
          payload: message.payload
        }, '*');
        sendResponse({ received: true });
        return false; // No async response
      }

      if (message.type === 'WS_BRIDGE_STATUS') {
        const connected = message.payload && message.payload.connected;
        console.log('[WS_BRIDGE] Relay', connected ? 'connected' : 'disconnected');
        // Also notify page context (optional)
        window.postMessage({ source: 'WS_BRIDGE_STATUS', payload: { connected } }, '*');
        sendResponse({ received: true });
        return false;
      }

      return false; // No async response
    });
  }

  // Initialize
  setupMessageListener();
  setupBackgroundListener();

  console.log('[WS_BRIDGE] Content script initialized');
})();
