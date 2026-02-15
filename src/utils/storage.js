/**
 * Chrome storage utility functions
 * Provides helpers for interacting with chrome.storage.sync and chrome.storage.local
 */

import { STORAGE_KEYS, DEFAULTS } from '../config/constants.js';

/**
 * Gets a value from chrome.storage.sync
 * @param {string} key - The storage key
 * @param {*} defaultValue - Default value if key doesn't exist
 * @returns {Promise<*>} The stored value or default
 */
export async function getSyncStorage(key, defaultValue = null) {
  try {
    const result = await chrome.storage.sync.get(key);
    return result[key] !== undefined ? result[key] : defaultValue;
  } catch (error) {
    console.error('Error getting sync storage:', error);
    return defaultValue;
  }
}

/**
 * Sets a value in chrome.storage.sync
 * @param {string} key - The storage key
 * @param {*} value - The value to store
 * @returns {Promise<void>}
 */
export async function setSyncStorage(key, value) {
  try {
    await chrome.storage.sync.set({ [key]: value });
  } catch (error) {
    console.error('Error setting sync storage:', error);
    throw error;
  }
}

/**
 * Gets a value from chrome.storage.local
 * @param {string} key - The storage key
 * @param {*} defaultValue - Default value if key doesn't exist
 * @returns {Promise<*>} The stored value or default
 */
export async function getLocalStorage(key, defaultValue = null) {
  try {
    const result = await chrome.storage.local.get(key);
    return result[key] !== undefined ? result[key] : defaultValue;
  } catch (error) {
    console.error('Error getting local storage:', error);
    return defaultValue;
  }
}

/**
 * Sets a value in chrome.storage.local
 * @param {string} key - The storage key
 * @param {*} value - The value to store
 * @returns {Promise<void>}
 */
export async function setLocalStorage(key, value) {
  try {
    await chrome.storage.local.set({ [key]: value });
  } catch (error) {
    console.error('Error setting local storage:', error);
    throw error;
  }
}

/**
 * Gets all user settings from sync storage
 * @returns {Promise<Object>} Object with all settings
 */
export async function getAllSettings() {
  try {
    const result = await chrome.storage.sync.get([
      STORAGE_KEYS.AUTO_SCAN,
      STORAGE_KEYS.DEFAULT_SHELF,
      STORAGE_KEYS.CONFIRM_BEFORE_ADD,
      STORAGE_KEYS.GOOGLE_BOOKS_API_KEY,
      STORAGE_KEYS.GOODREADS_API_KEY,
      STORAGE_KEYS.GOODREADS_API_SECRET
    ]);
    
    return {
      autoScan: result[STORAGE_KEYS.AUTO_SCAN] ?? DEFAULTS.AUTO_SCAN,
      defaultShelf: result[STORAGE_KEYS.DEFAULT_SHELF] ?? DEFAULTS.DEFAULT_SHELF,
      confirmBeforeAdd: result[STORAGE_KEYS.CONFIRM_BEFORE_ADD] ?? DEFAULTS.CONFIRM_BEFORE_ADD,
      googleBooksApiKey: result[STORAGE_KEYS.GOOGLE_BOOKS_API_KEY] ?? '',
      goodreadsApiKey: result[STORAGE_KEYS.GOODREADS_API_KEY] ?? '',
      goodreadsApiSecret: result[STORAGE_KEYS.GOODREADS_API_SECRET] ?? ''
    };
  } catch (error) {
    console.error('Error getting all settings:', error);
    return {
      autoScan: DEFAULTS.AUTO_SCAN,
      defaultShelf: DEFAULTS.DEFAULT_SHELF,
      confirmBeforeAdd: DEFAULTS.CONFIRM_BEFORE_ADD,
      googleBooksApiKey: '',
      goodreadsApiKey: '',
      goodreadsApiSecret: ''
    };
  }
}

/**
 * Clears all cached data from local storage
 * @returns {Promise<void>}
 */
export async function clearCache() {
  try {
    await chrome.storage.local.remove(STORAGE_KEYS.BOOK_METADATA_CACHE);
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}
