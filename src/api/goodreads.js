/**
 * Goodreads integration module
 * Handles Goodreads OAuth 1.0a and fallback strategies
 * Note: Goodreads API was deprecated in December 2020
 */

import { API_ENDPOINTS } from '../config/constants.js';
import { getSyncStorage } from '../utils/storage.js';
import { STORAGE_KEYS } from '../config/constants.js';

/**
 * Checks if user has configured Goodreads API credentials
 * @returns {Promise<boolean>} True if API key and secret are configured
 */
export async function hasGoodreadsCredentials() {
  const apiKey = await getSyncStorage(STORAGE_KEYS.GOODREADS_API_KEY, '');
  const apiSecret = await getSyncStorage(STORAGE_KEYS.GOODREADS_API_SECRET, '');
  return !!(apiKey && apiSecret);
}

/**
 * Opens Goodreads search in a new tab (fallback strategy)
 * @param {string} isbn - The ISBN to search for
 * @returns {Promise<void>}
 */
export async function searchOnGoodreads(isbn) {
  const url = `${API_ENDPOINTS.GOODREADS_SEARCH}?q=${encodeURIComponent(isbn)}`;
  await chrome.tabs.create({ url });
}

/**
 * Adds a book to a Goodreads shelf (requires API credentials)
 * Note: This is a placeholder for OAuth 1.0a implementation
 * Since the API is deprecated, this will likely not work for new users
 * @param {string} isbn - The ISBN of the book
 * @param {string} shelf - The shelf name (e.g., "to-read")
 * @returns {Promise<Object>} Result object with success status
 */
export async function addToShelf(isbn, shelf) {
  const hasCredentials = await hasGoodreadsCredentials();
  
  if (!hasCredentials) {
    return {
      success: false,
      error: 'Goodreads API credentials not configured. Please use "Search on Goodreads" instead.'
    };
  }
  
  // Placeholder for OAuth 1.0a implementation
  // In a real implementation, this would:
  // 1. Initiate OAuth 1.0a flow using chrome.identity.launchWebAuthFlow
  // 2. Get request token
  // 3. Authorize with user
  // 4. Exchange for access token
  // 5. Make authenticated API call to add book to shelf
  
  return {
    success: false,
    error: 'Goodreads API is deprecated. Please use "Search on Goodreads" to add books manually.',
    deprecated: true
  };
}

/**
 * Initiates OAuth 1.0a flow for Goodreads (legacy support)
 * @returns {Promise<Object>} OAuth tokens or error
 */
export async function initiateOAuth() {
  const hasCredentials = await hasGoodreadsCredentials();
  
  if (!hasCredentials) {
    return {
      success: false,
      error: 'Please configure Goodreads API key and secret in settings first.'
    };
  }
  
  // Placeholder for OAuth implementation
  // Since Goodreads API is deprecated, this is mainly for documentation
  
  return {
    success: false,
    error: 'Goodreads API is deprecated as of December 2020. New API keys are not available.',
    deprecated: true
  };
}

/**
 * Gets available Goodreads shelves for the user (requires authentication)
 * @returns {Promise<string[]>} List of shelf names
 */
export async function getUserShelves() {
  // Default shelves that all Goodreads users have
  return ['to-read', 'currently-reading', 'read'];
}
