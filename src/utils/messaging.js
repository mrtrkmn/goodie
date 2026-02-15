/**
 * Messaging utility functions
 * Provides helpers for chrome.runtime message passing
 */

import { MESSAGE_TYPES } from '../config/constants.js';

/**
 * Sends a message to the background service worker
 * @param {string} type - The message type
 * @param {Object} data - The message data
 * @returns {Promise<*>} The response from the background
 */
export async function sendMessage(type, data = {}) {
  try {
    return await chrome.runtime.sendMessage({ type, data });
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

/**
 * Sends a message to a specific tab
 * @param {number} tabId - The tab ID
 * @param {string} type - The message type
 * @param {Object} data - The message data
 * @returns {Promise<*>} The response from the tab
 */
export async function sendMessageToTab(tabId, type, data = {}) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type, data });
  } catch (error) {
    console.error('Error sending message to tab:', error);
    throw error;
  }
}

/**
 * Gets the current active tab
 * @returns {Promise<chrome.tabs.Tab>} The active tab
 */
export async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/**
 * Notifies content script to scan the page for ISBNs
 * @returns {Promise<*>} Response from content script
 */
export async function triggerPageScan() {
  try {
    const tab = await getCurrentTab();
    if (!tab?.id) {
      throw new Error('No active tab found');
    }
    return await sendMessageToTab(tab.id, MESSAGE_TYPES.SCAN_PAGE);
  } catch (error) {
    console.error('Error triggering page scan:', error);
    throw error;
  }
}
