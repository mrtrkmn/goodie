/**
 * Background service worker for Goodie extension
 * Handles message routing, API calls, badge updates, and tab tracking
 */

import { MESSAGE_TYPES } from '../config/constants.js';
import * as googleBooks from '../api/google-books.js';
import * as openLibrary from '../api/open-library.js';
import * as goodreads from '../api/goodreads.js';

// Track detected ISBNs per tab
const tabISBNs = new Map();

/**
 * Handles messages from content scripts and popup
 * @param {Object} message - The message object
 * @param {Object} sender - The message sender
 * @param {Function} sendResponse - Function to send response
 * @returns {boolean} True if response will be sent asynchronously
 */
function handleMessage(message, sender, sendResponse) {
  const { type, data } = message;
  
  switch (type) {
    case MESSAGE_TYPES.ISBNS_DETECTED:
      handleISBNsDetected(data, sender.tab?.id);
      sendResponse({ success: true });
      break;
      
    case MESSAGE_TYPES.FETCH_BOOK_INFO:
      handleFetchBookInfo(data.isbn).then(sendResponse);
      return true; // Async response
      
    case MESSAGE_TYPES.GET_DETECTED_BOOKS:
      handleGetDetectedBooks(data.tabId).then(sendResponse);
      return true; // Async response
      
    case MESSAGE_TYPES.SEARCH_GOODREADS:
      handleSearchGoodreads(data.isbn).then(sendResponse);
      return true; // Async response
      
    case MESSAGE_TYPES.ADD_TO_GOODREADS_WIDGET:
      handleAddToGoodreadsWidget(data.isbn).then(sendResponse);
      return true; // Async response
      
    case MESSAGE_TYPES.COPY_ISBN:
      // This is handled by the popup directly
      sendResponse({ success: true });
      break;
      
    default:
      console.warn('Unknown message type:', type);
      sendResponse({ success: false, error: 'Unknown message type' });
  }
}

/**
 * Handles ISBNs detected by content script
 * @param {Object} data - Contains isbns array and url
 * @param {number} tabId - The tab ID
 */
function handleISBNsDetected(data, tabId) {
  if (!tabId) return;
  
  const { isbns } = data;
  console.log(`ISBNs detected in tab ${tabId}:`, isbns);
  
  // Store ISBNs for this tab
  tabISBNs.set(tabId, isbns);
  
  // Update badge
  updateBadge(tabId, isbns.length);
}

/**
 * Fetches book information with fallback chain
 * @param {string} isbn - The ISBN to fetch
 * @returns {Promise<Object>} Book info result
 */
async function handleFetchBookInfo(isbn) {
  try {
    console.log('Fetching book info for ISBN:', isbn);
    
    // Try Google Books first
    let bookInfo = await googleBooks.fetchBookInfo(isbn);
    
    // Fallback to Open Library if Google Books fails
    if (!bookInfo) {
      console.log('Google Books failed, trying Open Library...');
      bookInfo = await openLibrary.fetchBookInfo(isbn);
    }
    
    if (bookInfo) {
      return { success: true, book: bookInfo };
    } else {
      return {
        success: false,
        error: 'Book metadata not found',
        isbn: isbn
      };
    }
  } catch (error) {
    console.error('Error fetching book info:', error);
    return {
      success: false,
      error: error.message,
      isbn: isbn
    };
  }
}

/**
 * Gets detected books for a specific tab
 * @param {number} tabId - The tab ID
 * @returns {Promise<Object>} Detected books result
 */
async function handleGetDetectedBooks(tabId) {
  try {
    // If no tabId provided, get current active tab
    if (!tabId) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      tabId = tab?.id;
    }
    
    if (!tabId) {
      return { success: false, error: 'No active tab found' };
    }
    
    const isbns = tabISBNs.get(tabId) || [];
    
    // Fetch metadata for each ISBN
    const books = await Promise.all(
      isbns.map(async (isbn) => {
        const result = await handleFetchBookInfo(isbn);
        if (result.success) {
          return result.book;
        } else {
          // Return minimal info if metadata fetch failed
          return {
            isbn: isbn,
            title: 'Details Unavailable',
            authors: [],
            description: '',
            thumbnail: '',
            source: 'none'
          };
        }
      })
    );
    
    return { success: true, books };
  } catch (error) {
    console.error('Error getting detected books:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Opens Goodreads search for an ISBN
 * @param {string} isbn - The ISBN to search
 * @returns {Promise<Object>} Result
 */
async function handleSearchGoodreads(isbn) {
  try {
    await goodreads.searchOnGoodreads(isbn);
    return { success: true };
  } catch (error) {
    console.error('Error opening Goodreads search:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Opens the Goodreads book page for an ISBN so users can add it to their shelves
 * @param {string} isbn - The ISBN
 * @returns {Promise<Object>} Result
 */
async function handleAddToGoodreadsWidget(isbn) {
  try {
    await goodreads.openAddToGoodreadsWidget(isbn);
    return { success: true };
  } catch (error) {
    console.error('Error opening Goodreads book page:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Updates the extension badge with ISBN count
 * @param {number} tabId - The tab ID
 * @param {number} count - Number of ISBNs detected
 */
function updateBadge(tabId, count) {
  if (count > 0) {
    chrome.action.setBadgeText({ text: count.toString(), tabId });
    chrome.action.setBadgeBackgroundColor({ color: '#409D69', tabId });
  } else {
    chrome.action.setBadgeText({ text: '', tabId });
  }
}

/**
 * Cleans up data for closed tabs
 * @param {number} tabId - The closed tab ID
 */
function handleTabClosed(tabId) {
  tabISBNs.delete(tabId);
  console.log(`Cleaned up data for tab ${tabId}`);
}

/**
 * Handles tab updates (e.g., navigation)
 * @param {number} tabId - The tab ID
 * @param {Object} changeInfo - Change information
 */
function handleTabUpdated(tabId, changeInfo) {
  // Clear ISBNs when navigating to a new page
  if (changeInfo.status === 'loading' && changeInfo.url) {
    tabISBNs.delete(tabId);
    updateBadge(tabId, 0);
  }
}

// Set up event listeners
chrome.runtime.onMessage.addListener(handleMessage);
chrome.tabs.onRemoved.addListener(handleTabClosed);
chrome.tabs.onUpdated.addListener(handleTabUpdated);

console.log('Goodie: Background service worker initialized');
