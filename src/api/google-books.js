/**
 * Google Books API integration
 * Fetches book metadata from Google Books API
 */

import { API_ENDPOINTS, DEFAULTS } from '../config/constants.js';
import { getLocalStorage, setLocalStorage, getSyncStorage } from '../utils/storage.js';
import { STORAGE_KEYS } from '../config/constants.js';

/**
 * Fetches book information from Google Books API
 * @param {string} isbn - The ISBN to look up
 * @param {boolean} useCache - Whether to use cached data
 * @returns {Promise<Object|null>} Book metadata or null if not found
 */
export async function fetchBookInfo(isbn, useCache = true) {
  try {
    // Check cache first
    if (useCache) {
      const cachedData = await getCachedBookInfo(isbn);
      if (cachedData) {
        console.log('Using cached book info for ISBN:', isbn);
        return cachedData;
      }
    }
    
    // Get API key from settings (optional)
    const apiKey = await getSyncStorage(STORAGE_KEYS.GOOGLE_BOOKS_API_KEY, '');
    
    // Build URL
    const url = new URL(API_ENDPOINTS.GOOGLE_BOOKS);
    url.searchParams.set('q', `isbn:${isbn}`);
    if (apiKey) {
      url.searchParams.set('key', apiKey);
    }
    
    console.log('Fetching from Google Books:', url.toString());
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`Google Books API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      return null;
    }
    
    const book = parseGoogleBooksResponse(data.items[0], isbn);
    
    // Cache the result
    await cacheBookInfo(isbn, book);
    
    return book;
  } catch (error) {
    console.error('Error fetching from Google Books:', error);
    return null;
  }
}

/**
 * Parses Google Books API response into standardized format
 * @param {Object} item - The book item from Google Books API
 * @param {string} isbn - The original ISBN
 * @returns {Object} Standardized book metadata
 */
function parseGoogleBooksResponse(item, isbn) {
  const volumeInfo = item.volumeInfo || {};
  const imageLinks = volumeInfo.imageLinks || {};
  
  return {
    isbn: isbn,
    title: volumeInfo.title || 'Unknown Title',
    authors: volumeInfo.authors || [],
    description: volumeInfo.description || '',
    thumbnail: imageLinks.thumbnail || imageLinks.smallThumbnail || '',
    publishedDate: volumeInfo.publishedDate || '',
    publisher: volumeInfo.publisher || '',
    pageCount: volumeInfo.pageCount || 0,
    categories: volumeInfo.categories || [],
    language: volumeInfo.language || '',
    source: 'google-books'
  };
}

/**
 * Gets cached book info if available and not expired
 * @param {string} isbn - The ISBN to look up
 * @returns {Promise<Object|null>} Cached book info or null
 */
async function getCachedBookInfo(isbn) {
  try {
    const cache = await getLocalStorage(STORAGE_KEYS.BOOK_METADATA_CACHE, {});
    const cached = cache[isbn];
    
    if (!cached) {
      return null;
    }
    
    // Check if cache is expired
    const now = Date.now();
    if (now - cached.timestamp > DEFAULTS.CACHE_TTL_MS) {
      console.log('Cache expired for ISBN:', isbn);
      return null;
    }
    
    return cached.data;
  } catch (error) {
    console.error('Error reading cache:', error);
    return null;
  }
}

/**
 * Caches book info with timestamp
 * @param {string} isbn - The ISBN
 * @param {Object} bookInfo - The book metadata to cache
 * @returns {Promise<void>}
 */
async function cacheBookInfo(isbn, bookInfo) {
  try {
    const cache = await getLocalStorage(STORAGE_KEYS.BOOK_METADATA_CACHE, {});
    cache[isbn] = {
      data: bookInfo,
      timestamp: Date.now()
    };
    await setLocalStorage(STORAGE_KEYS.BOOK_METADATA_CACHE, cache);
  } catch (error) {
    console.error('Error caching book info:', error);
  }
}
