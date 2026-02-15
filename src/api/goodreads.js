/**
 * Goodreads integration module
 * Uses direct Goodreads URLs and the "Add to My Books" widget
 * to let users add books without needing API keys.
 * Inspired by https://github.com/stephensulzberger/add-book-to-goodreads
 */

import { API_ENDPOINTS } from '../config/constants.js';

/**
 * Opens Goodreads search in a new tab
 * @param {string} isbn - The ISBN to search for
 * @returns {Promise<void>}
 */
export async function searchOnGoodreads(isbn) {
  const url = `${API_ENDPOINTS.GOODREADS_SEARCH}?q=${encodeURIComponent(isbn)}`;
  await chrome.tabs.create({ url });
}

/**
 * Opens the Goodreads "Add to My Books" widget page for a given ISBN.
 * This allows users to add books to their shelves directly on Goodreads
 * without requiring an API key.
 * @param {string} isbn - The ISBN of the book
 * @returns {Promise<void>}
 */
export async function openAddToGoodreadsWidget(isbn) {
  const url = `${API_ENDPOINTS.GOODREADS_BOOK_ISBN}/${encodeURIComponent(isbn)}`;
  await chrome.tabs.create({ url });
}

/**
 * Gets available Goodreads shelves for the user
 * @returns {Promise<string[]>} List of shelf names
 */
export async function getUserShelves() {
  // Default shelves that all Goodreads users have
  return ['to-read', 'currently-reading', 'read'];
}
