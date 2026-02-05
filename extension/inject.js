/**
 * inject.js - Fetch/WebSocket Patch
 * Runs in page context to intercept all API/WebSocket traffic
 */

(function () {
  'use strict';

  // Prevent double-injection
  if (window.__WS_BRIDGE_INJECTED__) return;
  window.__WS_BRIDGE_INJECTED__ = true;

  // Store the native WebSocket constructor
  const NativeWebSocket = window.WebSocket;
  const wsRegistry = new Map();
  let lastSocketId = null;

  // Helper to safely convert data for postMessage
  function serializeData(data) {
    if (typeof data === 'string') {
      return { type: 'string', value: data };
    } else if (data instanceof ArrayBuffer) {
      // Convert ArrayBuffer to base64
      const bytes = new Uint8Array(data);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return { type: 'arraybuffer', value: btoa(binary) };
    } else if (data instanceof Blob) {
      // Blobs need async handling, mark as blob and handle separately
      return { type: 'blob', value: null, size: data.size };
    } else if (ArrayBuffer.isView(data)) {
      // TypedArray (Uint8Array, etc.)
      const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return { type: 'typedarray', value: btoa(binary) };
    }
    return { type: 'unknown', value: String(data) };
  }

  // Post message to content script
  function postToExtension(payload) {
    window.postMessage({
      source: 'WS_BRIDGE',
      payload: payload
    }, '*');
  }

  function postResultToExtension(payload) {
    window.postMessage({
      source: 'WS_BRIDGE_RESULT',
      payload: payload
    }, '*');
  }

  // Async blob serialization and posting
  async function postBlobData(socketId, url, direction, blob) {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      postToExtension({
        type: 'WS_EVENT',
        socketId: socketId,
        direction: direction,
        url: url,
        data: { type: 'blob', value: btoa(binary) },
        timestamp: Date.now()
      });
    } catch (e) {
      console.warn('[WS_BRIDGE] Failed to serialize blob:', e);
    }
  }

  // Create patched WebSocket constructor
  function PatchedWebSocket(url, protocols) {
    // Allow calling without 'new'
    if (!(this instanceof PatchedWebSocket)) {
      return new PatchedWebSocket(url, protocols);
    }

    // Create native WebSocket instance
    const ws = protocols !== undefined
      ? new NativeWebSocket(url, protocols)
      : new NativeWebSocket(url);

    // Generate unique socket ID
    const socketId = crypto.randomUUID();
    const socketUrl = url;

    wsRegistry.set(socketId, { ws, url: socketUrl });
    lastSocketId = socketId;

    // Notify about new connection
    postToExtension({
      type: 'WS_OPEN',
      socketId: socketId,
      url: socketUrl,
      timestamp: Date.now()
    });

    // Store original send
    const originalSend = ws.send.bind(ws);

    // Patch send() method
    ws.send = function (data) {
      // Forward outgoing message
      const serialized = serializeData(data);
      
      if (serialized.type === 'blob' && data instanceof Blob) {
        // Handle blob asynchronously
        postBlobData(socketId, socketUrl, 'out', data);
      } else {
        postToExtension({
          type: 'WS_EVENT',
          socketId: socketId,
          direction: 'out',
          url: socketUrl,
          data: serialized,
          timestamp: Date.now()
        });
      }

      // Call original send
      return originalSend(data);
    };

    // Helper to wrap message handlers
    function wrapMessageHandler(handler) {
      return function (event) {
        // Forward incoming message
        const serialized = serializeData(event.data);
        
        if (serialized.type === 'blob' && event.data instanceof Blob) {
          postBlobData(socketId, socketUrl, 'in', event.data);
        } else {
          postToExtension({
            type: 'WS_EVENT',
            socketId: socketId,
            direction: 'in',
            url: socketUrl,
            data: serialized,
            timestamp: Date.now()
          });
        }

        // Call original handler
        if (typeof handler === 'function') {
          return handler.call(this, event);
        }
      };
    }

    // Track onmessage property
    let _onmessage = null;
    Object.defineProperty(ws, 'onmessage', {
      get: function () {
        return _onmessage;
      },
      set: function (handler) {
        _onmessage = handler;
        // We need to intercept via addEventListener instead
      },
      configurable: true
    });

    // Store original addEventListener
    const originalAddEventListener = ws.addEventListener.bind(ws);
    const messageListeners = new Map();

    // Patch addEventListener
    ws.addEventListener = function (type, listener, options) {
      if (type === 'message' && typeof listener === 'function') {
        const wrappedListener = wrapMessageHandler(listener);
        messageListeners.set(listener, wrappedListener);
        return originalAddEventListener(type, wrappedListener, options);
      }
      return originalAddEventListener(type, listener, options);
    };

    // Store original removeEventListener
    const originalRemoveEventListener = ws.removeEventListener.bind(ws);

    // Patch removeEventListener
    ws.removeEventListener = function (type, listener, options) {
      if (type === 'message' && messageListeners.has(listener)) {
        const wrappedListener = messageListeners.get(listener);
        messageListeners.delete(listener);
        return originalRemoveEventListener(type, wrappedListener, options);
      }
      return originalRemoveEventListener(type, listener, options);
    };

    // Add a hidden message interceptor that runs first
    originalAddEventListener('message', function (event) {
      // Check if onmessage is set and forward
      if (_onmessage) {
        const serialized = serializeData(event.data);
        
        if (serialized.type === 'blob' && event.data instanceof Blob) {
          postBlobData(socketId, socketUrl, 'in', event.data);
        } else {
          postToExtension({
            type: 'WS_EVENT',
            socketId: socketId,
            direction: 'in',
            url: socketUrl,
            data: serialized,
            timestamp: Date.now()
          });
        }

        // Call onmessage handler
        _onmessage.call(ws, event);
      }
    });

    // Listen for close events
    originalAddEventListener('close', function (event) {
      wsRegistry.delete(socketId);
      if (lastSocketId === socketId) {
        lastSocketId = wsRegistry.size > 0 ? Array.from(wsRegistry.keys()).pop() : null;
      }
      postToExtension({
        type: 'WS_CLOSE',
        socketId: socketId,
        url: socketUrl,
        code: event.code,
        reason: event.reason,
        timestamp: Date.now()
      });
    });

    // Listen for error events
    originalAddEventListener('error', function (event) {
      postToExtension({
        type: 'WS_ERROR',
        socketId: socketId,
        url: socketUrl,
        timestamp: Date.now()
      });
    });

    return ws;
  }

  // Copy static properties and prototype
  PatchedWebSocket.prototype = NativeWebSocket.prototype;
  PatchedWebSocket.CONNECTING = NativeWebSocket.CONNECTING;
  PatchedWebSocket.OPEN = NativeWebSocket.OPEN;
  PatchedWebSocket.CLOSING = NativeWebSocket.CLOSING;
  PatchedWebSocket.CLOSED = NativeWebSocket.CLOSED;

  // Replace global WebSocket
  window.WebSocket = PatchedWebSocket;

  // Store reference to native for potential restoration
  window.__NativeWebSocket__ = NativeWebSocket;

  console.log('[WS_BRIDGE] WebSocket interceptor installed');

  // ============================================
  // Fetch API Interception
  // ============================================

  // Store the native fetch function
  const NativeFetch = window.fetch;

  // Configuration for fetch interception
  const FETCH_CONFIG = {
    // Only intercept API URLs (adjust patterns as needed)
    urlPatterns: [
      /\/api\//i,
      /\.json$/i,
      /graphql/i
    ],
    // Content types to capture
    contentTypes: [
      'application/json',
      'text/json',
      'application/graphql'
    ],
    // Max response size to capture (10MB)
    maxResponseSize: 10 * 1024 * 1024
  };

  // Check if URL should be intercepted
  function shouldInterceptUrl(url) {
    const urlStr = typeof url === 'string' ? url : url.toString();
    return FETCH_CONFIG.urlPatterns.some(pattern => pattern.test(urlStr));
  }

  // Check if content type should be captured
  function shouldCaptureContentType(contentType) {
    if (!contentType) return true; // Capture unknown content types
    const lowerType = contentType.toLowerCase();
    return FETCH_CONFIG.contentTypes.some(type => lowerType.includes(type));
  }

  // Generate unique request ID
  function generateRequestId() {
    return crypto.randomUUID();
  }

  // Patched fetch function
  async function PatchedFetch(input, init) {
    const requestId = generateRequestId();
    const timestamp = Date.now();
    
    // Determine URL
    let url;
    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else if (input instanceof Request) {
      url = input.url;
    } else {
      url = String(input);
    }

    // Determine method
    const method = (init && init.method) || (input instanceof Request ? input.method : 'GET');

    // Check if this URL should be intercepted
    if (!shouldInterceptUrl(url)) {
      return NativeFetch(input, init);
    }

    // Capture request body if present
    let requestBody = null;
    try {
      if (init && init.body) {
        if (typeof init.body === 'string') {
          requestBody = init.body;
        } else if (init.body instanceof FormData) {
          requestBody = '[FormData]';
        } else if (init.body instanceof URLSearchParams) {
          requestBody = init.body.toString();
        } else if (init.body instanceof ArrayBuffer || ArrayBuffer.isView(init.body)) {
          requestBody = '[Binary Data]';
        } else if (init.body instanceof Blob) {
          requestBody = '[Blob]';
        }
      }
    } catch (e) {
      requestBody = '[Error reading body]';
    }

    // Post request start event
    postToExtension({
      type: 'API_REQUEST',
      source: 'fetch',
      requestId: requestId,
      url: url,
      method: method,
      body: requestBody,
      timestamp: timestamp
    });

    try {
      // Call native fetch
      const response = await NativeFetch(input, init);
      
      // Clone response to read body without consuming it
      const responseClone = response.clone();
      
      // Check content type
      const contentType = response.headers.get('content-type');
      
      // Process response asynchronously without blocking
      (async () => {
        try {
          // Check content length
          const contentLength = response.headers.get('content-length');
          if (contentLength && parseInt(contentLength, 10) > FETCH_CONFIG.maxResponseSize) {
            postToExtension({
              type: 'API_RESPONSE',
              source: 'fetch',
              requestId: requestId,
              url: url,
              method: method,
              status: response.status,
              statusText: response.statusText,
              contentType: contentType,
              data: { type: 'truncated', value: '[Response too large]' },
              timestamp: Date.now(),
              duration: Date.now() - timestamp
            });
            return;
          }

          // Read response body
          let responseData;
          if (shouldCaptureContentType(contentType)) {
            const text = await responseClone.text();
            
            // Try to parse as JSON
            if (contentType && contentType.includes('json')) {
              try {
                const parsed = JSON.parse(text);
                responseData = { type: 'json', value: parsed };
              } catch (e) {
                responseData = { type: 'string', value: text };
              }
            } else {
              responseData = { type: 'string', value: text };
            }
          } else {
            responseData = { type: 'skipped', value: `[Content-Type: ${contentType}]` };
          }

          // Post response event
          postToExtension({
            type: 'API_RESPONSE',
            source: 'fetch',
            requestId: requestId,
            url: url,
            method: method,
            status: response.status,
            statusText: response.statusText,
            contentType: contentType,
            data: responseData,
            timestamp: Date.now(),
            duration: Date.now() - timestamp
          });
        } catch (e) {
          console.warn('[WS_BRIDGE] Failed to capture fetch response:', e);
          postToExtension({
            type: 'API_RESPONSE',
            source: 'fetch',
            requestId: requestId,
            url: url,
            method: method,
            status: response.status,
            statusText: response.statusText,
            contentType: contentType,
            data: { type: 'error', value: e.message },
            timestamp: Date.now(),
            duration: Date.now() - timestamp
          });
        }
      })();

      return response;
    } catch (error) {
      // Post error event
      postToExtension({
        type: 'API_ERROR',
        source: 'fetch',
        requestId: requestId,
        url: url,
        method: method,
        error: error.message,
        timestamp: Date.now(),
        duration: Date.now() - timestamp
      });

      // Re-throw the error
      throw error;
    }
  }

  // Replace global fetch
  window.fetch = PatchedFetch;

  // Store reference to native for potential restoration
  window.__NativeFetch__ = NativeFetch;

  console.log('[WS_BRIDGE] Fetch interceptor installed');

  function resolveAuthToken(tokenKey, tokenKeys) {
    try {
      if (tokenKey) {
        return window.localStorage.getItem(tokenKey);
      }
      if (Array.isArray(tokenKeys)) {
        for (const key of tokenKeys) {
          const value = window.localStorage.getItem(key);
          if (value) return value;
        }
      }
      const fallbackKeys = ['access_token', 'token', 'auth_token', 'authToken'];
      for (const key of fallbackKeys) {
        const value = window.localStorage.getItem(key);
        if (value) return value;
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  function normalizeHeaders(headers) {
    if (!headers) return {};
    if (headers instanceof Headers) {
      const obj = {};
      headers.forEach((value, key) => { obj[key] = value; });
      return obj;
    }
    return { ...headers };
  }

  function buildAuthHeaderValue(token, authScheme) {
    if (!token) return null;
    if (!authScheme) return token;
    const trimmed = token.trim();
    if (trimmed.startsWith(authScheme)) return trimmed;
    return `${authScheme} ${trimmed}`;
  }

  function resolveSocket({ socketId, urlContains } = {}) {
    if (socketId && wsRegistry.has(socketId)) return wsRegistry.get(socketId);
    if (urlContains) {
      for (const entry of wsRegistry.values()) {
        if (entry?.url && String(entry.url).includes(urlContains)) return entry;
      }
    }
    if (lastSocketId && wsRegistry.has(lastSocketId)) return wsRegistry.get(lastSocketId);
    return null;
  }

  async function executePageFetch(request) {
    const requestId = request.requestId || crypto.randomUUID();
    const method = request.method || 'GET';
    const rawUrl = request.url || '';
    const url = rawUrl.startsWith('http') ? rawUrl : new URL(rawUrl, window.location.origin).toString();
    const authToken = request.useAuthToken ? resolveAuthToken(request.tokenKey, request.tokenKeys) : null;
    const authHeaderName = request.authHeaderName || 'Authorization';
    const authScheme = request.authScheme || null;

    const headers = normalizeHeaders(request.headers);
    if (authToken) {
      headers[authHeaderName] = buildAuthHeaderValue(authToken, authScheme);
    }

    let body = request.body ?? null;
    if (body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob)) {
      body = JSON.stringify(body);
      if (!headers['Content-Type'] && !headers['content-type']) {
        headers['Content-Type'] = 'application/json';
      }
    }

    const init = {
      method,
      headers,
      body: body || undefined,
      credentials: request.credentials || 'include'
    };

    try {
      const fetchFn = window.__NativeFetch__ || window.fetch;
      const response = await fetchFn(url, init);
      const contentType = response.headers.get('content-type') || '';
      let data;
      try {
        if (contentType.includes('json')) {
          const parsed = await response.json();
          data = { type: 'json', value: parsed };
        } else {
          const text = await response.text();
          data = { type: 'string', value: text };
        }
      } catch (e) {
        data = { type: 'error', value: e.message };
      }

      postResultToExtension({
        type: 'PAGE_COMMAND_RESULT',
        action: 'page-fetch',
        requestId,
        url,
        method,
        status: response.status,
        statusText: response.statusText,
        data,
        timestamp: Date.now()
      });
    } catch (error) {
      postResultToExtension({
        type: 'PAGE_COMMAND_RESULT',
        action: 'page-fetch',
        requestId,
        url,
        method,
        status: 0,
        statusText: 'fetch_error',
        error: error?.message || String(error),
        timestamp: Date.now()
      });
    }
  }

  function executeWsSend(request) {
    const target = resolveSocket({ socketId: request.socketId, urlContains: request.urlContains });
    if (!target || !target.ws || target.ws.readyState !== NativeWebSocket.OPEN) {
      postResultToExtension({
        type: 'PAGE_COMMAND_RESULT',
        action: 'ws-send',
        requestId: request.requestId || null,
        error: 'socket_not_ready',
        timestamp: Date.now()
      });
      return;
    }

    let payload = request.data;
    if (payload && typeof payload === 'object' && !ArrayBuffer.isView(payload) && !(payload instanceof ArrayBuffer)) {
      payload = JSON.stringify(payload);
    }

    try {
      target.ws.send(payload);
      postResultToExtension({
        type: 'PAGE_COMMAND_RESULT',
        action: 'ws-send',
        requestId: request.requestId || null,
        socketId: request.socketId || null,
        timestamp: Date.now()
      });
    } catch (error) {
      postResultToExtension({
        type: 'PAGE_COMMAND_RESULT',
        action: 'ws-send',
        requestId: request.requestId || null,
        socketId: request.socketId || null,
        error: error?.message || String(error),
        timestamp: Date.now()
      });
    }
  }

  window.addEventListener('message', function (event) {
    if (event.source !== window) return;
    if (!event.data || event.data.source !== 'WS_BRIDGE_COMMAND') return;

    const payload = event.data.payload || {};
    const action = payload.action || payload.type;

    if (action === 'page-fetch') {
      const requests = Array.isArray(payload.requests) ? payload.requests : [payload];
      requests.forEach((request) => {
        executePageFetch(request);
      });
      return;
    }

    if (action === 'ws-send') {
      executeWsSend(payload);
    }
  });
})();
