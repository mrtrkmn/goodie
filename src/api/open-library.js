/**
 * Open Library API integration
 * Provides fallback book metadata fetching when Google Books API fails
 */

import { API_ENDPOINTS, DEFAULTS } from '../config/constants.js';
import { getLocalStorage, setLocalStorage } from '../utils/storage.js';
import { STORAGE_KEYS } from '../config/constants.js';

/**
 * Fetches book information from Open Library API
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
        console.log('Using cached Open Library book info for ISBN:', isbn);
        return cachedData;
      }
    }
    
    // Try the books API first
    const bookData = await fetchFromBooksAPI(isbn);
    if (bookData) {
      await cacheBookInfo(isbn, bookData);
      return bookData;
    }
    
    // Fallback to ISBN endpoint
    const isbnData = await fetchFromISBNEndpoint(isbn);
    if (isbnData) {
      await cacheBookInfo(isbn, isbnData);
      return isbnData;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching from Open Library:', error);
    return null;
  }
}

/**
 * Fetches from Open Library books API
 * @param {string} isbn - The ISBN
 * @returns {Promise<Object|null>} Book metadata or null
 */
async function fetchFromBooksAPI(isbn) {
  try {
    const url = new URL(API_ENDPOINTS.OPEN_LIBRARY_BOOKS);
    url.searchParams.set('bibkeys', `ISBN:${isbn}`);
    url.searchParams.set('format', 'json');
    url.searchParams.set('jscmd', 'data');
    
    console.log('Fetching from Open Library Books API:', url.toString());
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`Open Library API error: ${response.status}`);
    }
    
    const data = await response.json();
    const bookKey = `ISBN:${isbn}`;
    
    if (!data[bookKey]) {
      return null;
    }
    
    return parseOpenLibraryBooksResponse(data[bookKey], isbn);
  } catch (error) {
    console.error('Error fetching from Open Library Books API:', error);
    return null;
  }
}

/**
 * Fetches from Open Library ISBN endpoint
 * @param {string} isbn - The ISBN
 * @returns {Promise<Object|null>} Book metadata or null
 */
async function fetchFromISBNEndpoint(isbn) {
  try {
    const url = `${API_ENDPOINTS.OPEN_LIBRARY_ISBN}/${isbn}.json`;
    
    console.log('Fetching from Open Library ISBN endpoint:', url);
    const response = await fetch(url);
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    return parseOpenLibraryISBNResponse(data, isbn);
  } catch (error) {
    console.error('Error fetching from Open Library ISBN endpoint:', error);
    return null;
  }
}

/**
 * Parses Open Library Books API response
 * @param {Object} data - The book data from API
 * @param {string} isbn - The original ISBN
 * @returns {Object} Standardized book metadata
 */
function parseOpenLibraryBooksResponse(data, isbn) {
  const authors = data.authors ? data.authors.map(a => a.name) : [];
  const thumbnail = data.cover ? data.cover.medium || data.cover.small || data.cover.large : '';
  
  return {
    isbn: isbn,
    title: data.title || 'Unknown Title',
    authors: authors,
    description: data.notes || data.subtitle || '',
    thumbnail: thumbnail,
    publishedDate: data.publish_date || '',
    publisher: data.publishers ? data.publishers[0]?.name || '' : '',
    pageCount: data.number_of_pages || 0,
    categories: data.subjects ? data.subjects.map(s => s.name) : [],
    language: '',
    source: 'open-library'
  };
}

/**
 * Parses Open Library ISBN endpoint response
 * @param {Object} data - The book data from API
 * @param {string} isbn - The original ISBN
 * @returns {Object} Standardized book metadata
 */
function parseOpenLibraryISBNResponse(data, isbn) {
  const authors = data.authors || [];
  const authorNames = authors.map(a => a.name || a).filter(Boolean);
  
  const coverId = data.covers && data.covers.length > 0 ? data.covers[0] : null;
  const thumbnail = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : '';
  
  return {
    isbn: isbn,
    title: data.title || 'Unknown Title',
    authors: authorNames,
    description: data.description?.value || data.description || '',
    thumbnail: thumbnail,
    publishedDate: data.publish_date || '',
    publisher: data.publishers ? data.publishers[0] || '' : '',
    pageCount: data.number_of_pages || 0,
    categories: data.subjects || [],
    language: '',
    source: 'open-library'
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
