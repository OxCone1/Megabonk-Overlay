/**
 * background.js - Service Worker
 * Maintains connection to relay WebSocket server and forwards messages
 */

// Configuration
const RELAY_SERVER_URL = 'ws://localhost:17502/ws'; // Change this to your relay server
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_DELAY_MS = 30000;
const HEARTBEAT_INTERVAL_MS = 30000;

// State
let relaySocket = null;
let reconnectAttempts = 0;
let reconnectTimeout = null;
let heartbeatInterval = null;
let messageQueue = [];
let isConnecting = false;
let relaySessionToken = null;

/**
 * Connect to the relay WebSocket server
 */
function connectToRelay() {
  if (isConnecting || (relaySocket && relaySocket.readyState === WebSocket.OPEN)) {
    return;
  }

  isConnecting = true;
  console.log('[WS_BRIDGE] Connecting to relay server:', RELAY_SERVER_URL);

  try {
    relaySocket = new WebSocket(RELAY_SERVER_URL);

    function sendRelayStatusToTabs(connected) {
      // Notify any content scripts (on the ladder site) about relay status
      try {
        chrome.tabs.query({ url: '*://ladder.megabonk.su/*' }, function (tabs) {
          if (chrome.runtime.lastError) return; // ignore
          tabs.forEach(function (tab) {
            chrome.tabs.sendMessage(tab.id, { type: 'WS_BRIDGE_STATUS', payload: { connected } }, function () {
              // ignore transient errors
              if (chrome.runtime.lastError) {
                const msg = chrome.runtime.lastError.message || '';
                if (msg.includes('Receiving end does not exist') || msg.includes('Extension context invalidated')) return;
                // otherwise ignore silently
              }
            });
          });
        });
      } catch (e) {
        // ignore
      }
    }

    relaySocket.onopen = function () {
      console.log('[WS_BRIDGE] Connected to relay server');
      isConnecting = false;
      reconnectAttempts = 0;

      // Flush queued messages
      while (messageQueue.length > 0) {
        const msg = messageQueue.shift();
        sendToRelay(msg);
      }

      // Start heartbeat
      startHeartbeat();

      // Notify content scripts that relay is connected
      sendRelayStatusToTabs(true);
    };

    relaySocket.onmessage = function (event) {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'welcome') {
          relaySessionToken = message.token || null;
          if (relaySessionToken && messageQueue.length > 0) {
            const queued = [...messageQueue];
            messageQueue = [];
            queued.forEach((queuedMessage) => sendToRelay(queuedMessage));
          }
        }
        handleRelayMessage(message);
      } catch (e) {
        console.warn('[WS_BRIDGE] Failed to parse relay message:', e);
      }
    };

    relaySocket.onclose = function (event) {
      console.log('[WS_BRIDGE] Relay connection closed:', event.code, event.reason);
      isConnecting = false;
      relaySocket = null;
      stopHeartbeat();
      sendRelayStatusToTabs(false);
      scheduleReconnect();
    };

    relaySocket.onerror = function (error) {
      console.error('[WS_BRIDGE] Relay connection error');
      isConnecting = false;
      sendRelayStatusToTabs(false);
    };

  } catch (error) {
    console.error('[WS_BRIDGE] Failed to create relay connection:', error);
    isConnecting = false;
    scheduleReconnect();
  }
}

/**
 * Schedule a reconnection attempt with exponential backoff
 */
function scheduleReconnect() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }

  const delay = Math.min(
    RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts),
    MAX_RECONNECT_DELAY_MS
  );
  
  reconnectAttempts++;
  console.log(`[WS_BRIDGE] Scheduling reconnect in ${delay}ms (attempt ${reconnectAttempts})`);

  reconnectTimeout = setTimeout(function () {
    reconnectTimeout = null;
    connectToRelay();
  }, delay);
}

/**
 * Start heartbeat to keep connection alive
 */
function startHeartbeat() {
  stopHeartbeat();
  heartbeatInterval = setInterval(function () {
    if (relaySocket && relaySocket.readyState === WebSocket.OPEN) {
      try {
        if (!relaySessionToken) return;
        relaySocket.send(JSON.stringify({
          type: 'heartbeat',
          origin: 'megabonk-extension',
          token: relaySessionToken,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn('[WS_BRIDGE] Heartbeat failed:', e);
      }
    }
  }, HEARTBEAT_INTERVAL_MS);
}

/**
 * Stop heartbeat
 */
function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

/**
 * Send message to relay server
 */
function sendToRelay(message) {
  if (!relaySessionToken) {
    if (messageQueue.length < 1000) {
      messageQueue.push(message);
    }
    connectToRelay();
    return false;
  }

  const payload = !message?.token
    ? { ...message, token: relaySessionToken }
    : message;
  if (relaySocket && relaySocket.readyState === WebSocket.OPEN) {
    try {
      relaySocket.send(JSON.stringify(payload));
      return true;
    } catch (e) {
      console.error('[WS_BRIDGE] Failed to send to relay:', e);
      return false;
    }
  } else {
    // Queue message for when connection is restored
    if (messageQueue.length < 1000) { // Prevent unbounded growth
      messageQueue.push(message);
    }
    // Ensure we're trying to connect
    connectToRelay();
    return false;
  }
}

/**
 * Handle messages from the relay server (for future bidirectional support)
 */
function handleRelayMessage(message) {
  console.log('[WS_BRIDGE] Received from relay:', message.type);

  if (message.type === 'command') {
    const payload = message.payload;
    const sendToTab = (tabId) => {
      chrome.tabs.sendMessage(tabId, {
        type: 'WS_BRIDGE_COMMAND',
        payload
      }, function () {
        if (chrome.runtime.lastError) {
          const msg = chrome.runtime.lastError.message || '';
          if (
            msg.includes('Receiving end does not exist') ||
            msg.includes('Extension context invalidated') ||
            msg.includes('Could not establish connection') ||
            msg.includes('The message port closed before a response was received') ||
            msg.includes('message port closed')
          ) {
            return;
          }
          console.warn('[WS_BRIDGE] Failed to forward command to tab:', chrome.runtime.lastError);
        }
      });
    };

    if (message.tabId) {
      chrome.tabs.get(message.tabId, function (tab) {
        if (chrome.runtime.lastError || !tab) {
          return;
        }
        sendToTab(message.tabId);
      });
      return;
    }

    chrome.tabs.query({ url: '*://ladder.megabonk.su/*' }, function (tabs) {
      if (chrome.runtime.lastError || !tabs || tabs.length === 0) {
        return;
      }
      tabs.forEach((tab) => sendToTab(tab.id));
    });
  }
}

/**
 * Handle messages from content scripts
 */
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  // Debug: log all incoming messages
  console.log('[WS_BRIDGE] onMessage received:', message.type, message.payload ? message.payload.type : '');

  if (message.type !== 'WS_BRIDGE_EVENT' && message.type !== 'WS_BRIDGE_RESULT') {
    return false;
  }

  const payload = message.payload;
  if (!payload) {
    console.warn('[WS_BRIDGE] Empty payload, ignoring');
    return false;
  }

  // Create envelope with metadata
  const envelope = {
    origin: 'megabonk-extension',
    tabId: sender.tab ? sender.tab.id : null,
    tabUrl: sender.tab ? sender.tab.url : null,
    frameId: sender.frameId,
    timestamp: Date.now(),
    event: payload
  };

  // Send to relay
  const sent = sendToRelay(envelope);
  console.log('[WS_BRIDGE] sendToRelay result:', sent, 'relaySocket state:', relaySocket ? relaySocket.readyState : 'null');

  // Log for debugging (can be disabled in production)
  if (payload.type === 'WS_EVENT') {
    console.log(
      '[WS_BRIDGE]',
      payload.direction === 'in' ? '←' : '→',
      payload.socketId.substring(0, 8),
      payload.data?.type || 'unknown'
    );
  } else if (payload.type === 'API_REQUEST') {
    console.log(
      '[WS_BRIDGE] API →',
      payload.method,
      payload.url
    );
  } else if (payload.type === 'API_RESPONSE') {
    console.log(
      '[WS_BRIDGE] API ←',
      payload.status,
      payload.method,
      payload.url,
      payload.duration + 'ms'
    );
  } else if (payload.type === 'API_ERROR') {
    console.log(
      '[WS_BRIDGE] API ✗',
      payload.method,
      payload.url,
      payload.error
    );
  } else if (payload.type === 'PAGE_COMMAND_RESULT') {
    console.log('[WS_BRIDGE] Command result ←', payload.action, payload.url || payload.socketId || '');
  }

  return false; // No async response needed
});

/**
 * Handle extension install/update
 */
chrome.runtime.onInstalled.addListener(function (details) {
  console.log('[WS_BRIDGE] Extension installed/updated:', details.reason);
  connectToRelay();
});

/**
 * Handle service worker startup
 */
chrome.runtime.onStartup.addListener(function () {
  console.log('[WS_BRIDGE] Service worker started');
  connectToRelay();
});

// Initial connection attempt
connectToRelay();

console.log('[WS_BRIDGE] Background service worker initialized');
