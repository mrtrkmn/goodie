/**
 * Content script for ISBN detection
 * Scans web pages for ISBN numbers using regex patterns and MutationObserver
 * Validates ISBNs with checksums and communicates findings to background service worker
 */

import { extractISBNs } from '../utils/isbn.js';
import { debounce } from '../utils/debounce.js';
import { MESSAGE_TYPES, DEFAULTS } from '../config/constants.js';

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
    const text = rootElement.innerText || '';
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
          const text = node.innerText || '';
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
