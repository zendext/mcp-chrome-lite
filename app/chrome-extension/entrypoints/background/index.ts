import { defineBackground } from 'wxt/utils/define-background';
import { initLiteWebSocketClient } from './lite/ws-client';

/**
 * Background script entry point
 * Initializes all background services and listeners
 */
export default defineBackground(() => {
  initLiteWebSocketClient();
});
