/**
 * Content script for ISBN detection
 * Scans web pages for ISBN numbers using regex patterns and MutationObserver
 * Validates ISBNs with checksums and communicates findings to background service worker
 * 
 * Note: Content scripts don't support ES modules in Manifest V3,
 * so we include the necessary utility functions inline.
 */

// Constants (duplicated from constants.js)
const MESSAGE_TYPES = {
  ISBNS_DETECTED: 'ISBNS_DETECTED',
  SCAN_PAGE: 'SCAN_PAGE',
  GET_DETECTED_BOOKS: 'GET_DETECTED_BOOKS'
};

const DEFAULTS = {
  AUTO_SCAN: true,
  DEBOUNCE_DELAY_MS: 500
};

const ISBN_PATTERNS = {
  ISBN13: /(?:ISBN(?:-13)?:?\s*)?(?:97[89][\s\-]?(?:\d[\s\-]?){9}\d)/gi,
  ISBN10: /(?:ISBN(?:-10)?:?\s*)?(?:\d[\s\-]?){9}[\dXx]/gi
};

// Utility functions (duplicated from utils/)

/**
 * Normalizes an ISBN by removing hyphens and spaces
 */
function normalizeISBN(isbn) {
  return isbn.replace(/[\s\-]/g, '').toUpperCase();
}

/**
 * Validates ISBN-10 checksum
 */
function validateISBN10Checksum(isbn10) {
  if (isbn10.length !== 10) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const digit = parseInt(isbn10[i], 10);
    if (isNaN(digit)) return false;
    sum += digit * (10 - i);
  }
  
  const checkDigit = isbn10[9] === 'X' ? 10 : parseInt(isbn10[9], 10);
  if (isNaN(checkDigit)) return false;
  
  sum += checkDigit;
  return sum % 11 === 0;
}

/**
 * Validates ISBN-13 checksum
 */
function validateISBN13Checksum(isbn13) {
  if (isbn13.length !== 13) return false;
  
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    const digit = parseInt(isbn13[i], 10);
    if (isNaN(digit)) return false;
    sum += digit * (i % 2 === 0 ? 1 : 3);
  }
  
  return sum % 10 === 0;
}

/**
 * Validates an ISBN
 */
function isValidISBN(isbn) {
  const normalized = normalizeISBN(isbn);
  
  if (normalized.length === 10) {
    return validateISBN10Checksum(normalized);
  } else if (normalized.length === 13) {
    if (!normalized.startsWith('978') && !normalized.startsWith('979')) {
      return false;
    }
    return validateISBN13Checksum(normalized);
  }
  
  return false;
}

/**
 * Extracts ISBNs from text
 */
function extractISBNs(text) {
  const foundISBNs = new Set();
  
  // Extract ISBN-13 first
  const isbn13Matches = text.matchAll(ISBN_PATTERNS.ISBN13);
  for (const match of isbn13Matches) {
    const isbn = normalizeISBN(match[0].replace(/ISBN(?:-13)?:?\s*/i, ''));
    if (isbn.length === 13 && isValidISBN(isbn)) {
      foundISBNs.add(isbn);
    }
  }
  
  // Extract ISBN-10
  const isbn10Matches = text.matchAll(ISBN_PATTERNS.ISBN10);
  for (const match of isbn10Matches) {
    const isbn = normalizeISBN(match[0].replace(/ISBN(?:-10)?:?\s*/i, ''));
    if (isbn.length === 10 && isValidISBN(isbn)) {
      foundISBNs.add(isbn);
    }
  }
  
  return Array.from(foundISBNs);
}

/**
 * Debounce function
 */
function debounce(func, delay) {
  let timeoutId;
  
  return function debounced(...args) {
    const context = this;
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(context, args);
    }, delay);
  };
}

// Track ISBNs found on this page to avoid duplicates
const foundISBNs = new Set();
let observer = null;
let isScanning = false;

/**
 * Scans the DOM for ISBN numbers
 * @param {Element} rootElement - The root element to scan (default: document.body)
 */
function scanForISBNs(rootElement = document.body) {
  if (isScanning) return;
  isScanning = true;
  
  try {
    const text = rootElement.textContent || '';
    const isbns = extractISBNs(text);
    
    // Filter out ISBNs we've already found
    const newISBNs = isbns.filter(isbn => !foundISBNs.has(isbn));
    
    if (newISBNs.length > 0) {
      newISBNs.forEach(isbn => foundISBNs.add(isbn));
      
      // Send to background service worker
      chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.ISBNS_DETECTED,
        data: {
          isbns: Array.from(foundISBNs),
          url: window.location.href
        }
      }).catch(error => {
        console.error('Error sending ISBNs to background:', error);
      });
      
      console.log('Goodie: Found ISBNs:', newISBNs);
    }
  } catch (error) {
    console.error('Error scanning for ISBNs:', error);
  } finally {
    isScanning = false;
  }
}

/**
 * Debounced scan function to avoid excessive scanning
 */
const debouncedScan = debounce(() => {
  scanForISBNs();
}, DEFAULTS.DEBOUNCE_DELAY_MS);

/**
 * Handles DOM mutations and scans new nodes
 * @param {MutationRecord[]} mutations - Array of mutation records
 */
function handleMutations(mutations) {
  let shouldScan = false;
  
  for (const mutation of mutations) {
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      // Check if any added nodes contain significant text
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const text = node.textContent || '';
          if (text.length > 10) { // Only scan if there's meaningful content
            shouldScan = true;
            break;
          }
        }
      }
    }
    if (shouldScan) break;
  }
  
  if (shouldScan) {
    debouncedScan();
  }
}

/**
 * Initializes the MutationObserver
 */
function initMutationObserver() {
  if (observer) {
    observer.disconnect();
  }
  
  observer = new MutationObserver(handleMutations);
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false,
    characterData: false
  });
  
  console.log('Goodie: MutationObserver initialized');
}

/**
 * Handles messages from the background service worker or popup
 * @param {Object} message - The message object
 * @param {Object} sender - The message sender
 * @param {Function} sendResponse - Function to send response
 */
function handleMessage(message, sender, sendResponse) {
  if (message.type === MESSAGE_TYPES.SCAN_PAGE) {
    // Clear found ISBNs and rescan
    foundISBNs.clear();
    scanForISBNs();
    sendResponse({ success: true, count: foundISBNs.size });
    return true;
  }
  
  if (message.type === MESSAGE_TYPES.GET_DETECTED_BOOKS) {
    sendResponse({ isbns: Array.from(foundISBNs) });
    return true;
  }
}

/**
 * Initializes the content script
 */
async function init() {
  console.log('Goodie: Content script loaded');
  
  // Check if auto-scan is enabled
  try {
    const result = await chrome.storage.sync.get('autoScan');
    const autoScan = result.autoScan !== undefined ? result.autoScan : DEFAULTS.AUTO_SCAN;
    
    if (autoScan) {
      // Wait a bit for the page to fully load
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          setTimeout(() => {
            scanForISBNs();
            initMutationObserver();
          }, 500);
        });
      } else {
        // Page already loaded
        setTimeout(() => {
          scanForISBNs();
          initMutationObserver();
        }, 500);
      }
    }
  } catch (error) {
    console.error('Error initializing Goodie:', error);
  }
  
  // Listen for messages
  chrome.runtime.onMessage.addListener(handleMessage);
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (observer) {
    observer.disconnect();
  }
});

// Initialize
init();
