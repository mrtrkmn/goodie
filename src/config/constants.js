/**
 * Configuration constants for the Goodie extension
 * Includes API endpoints, storage keys, and default settings
 */

export const API_ENDPOINTS = {
  GOOGLE_BOOKS: 'https://www.googleapis.com/books/v1/volumes',
  OPEN_LIBRARY_BOOKS: 'https://openlibrary.org/api/books',
  OPEN_LIBRARY_ISBN: 'https://openlibrary.org/isbn',
  GOODREADS_SEARCH: 'https://www.goodreads.com/search'
};

export const STORAGE_KEYS = {
  AUTO_SCAN: 'autoScan',
  DEFAULT_SHELF: 'defaultShelf',
  CONFIRM_BEFORE_ADD: 'confirmBeforeAdd',
  GOOGLE_BOOKS_API_KEY: 'googleBooksApiKey',
  GOODREADS_API_KEY: 'goodreadsApiKey',
  GOODREADS_API_SECRET: 'goodreadsApiSecret',
  DETECTED_BOOKS: 'detectedBooks',
  BOOK_METADATA_CACHE: 'bookMetadataCache'
};

export const DEFAULTS = {
  AUTO_SCAN: true,
  DEFAULT_SHELF: 'to-read',
  CONFIRM_BEFORE_ADD: true,
  CACHE_TTL_MS: 24 * 60 * 60 * 1000, // 24 hours
  DEBOUNCE_DELAY_MS: 500,
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_BACKOFF_MS: 1000
};

export const MESSAGE_TYPES = {
  ISBNS_DETECTED: 'ISBNS_DETECTED',
  FETCH_BOOK_INFO: 'FETCH_BOOK_INFO',
  ADD_TO_GOODREADS: 'ADD_TO_GOODREADS',
  SCAN_PAGE: 'SCAN_PAGE',
  GET_DETECTED_BOOKS: 'GET_DETECTED_BOOKS',
  SEARCH_GOODREADS: 'SEARCH_GOODREADS',
  COPY_ISBN: 'COPY_ISBN'
};

export const GOODREADS_SHELVES = [
  'to-read',
  'currently-reading',
  'read'
];

export const ISBN_PATTERNS = {
  // ISBN-13 pattern: 978 or 979 prefix, optional hyphens
  ISBN13: /(?:ISBN(?:-13)?:?\s*)?(?:97[89][\s\-]?(?:\d[\s\-]?){9}\d)/gi,
  // ISBN-10 pattern: 10 digits (last can be X), optional hyphens
  ISBN10: /(?:ISBN(?:-10)?:?\s*)?(?:\d[\s\-]?){9}[\dXx]/gi
};
