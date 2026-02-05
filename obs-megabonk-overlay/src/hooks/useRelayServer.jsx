/* eslint-disable react-refresh/only-export-components */
/**
 * Re-export from worker-based implementation for performance
 * All network operations now run in a dedicated Web Worker
 */
export { useRelayServer, RelayServerProvider } from './useRelayServerWorker';
