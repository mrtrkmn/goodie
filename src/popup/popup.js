/**
 * Popup UI logic for Goodie extension
 * Handles user interactions, displays detected books, and manages settings
 */

import { MESSAGE_TYPES, GOODREADS_SHELVES } from '../config/constants.js';
import { sendMessage, getCurrentTab, triggerPageScan } from '../utils/messaging.js';
import { getAllSettings, setSyncStorage } from '../utils/storage.js';
import { STORAGE_KEYS } from '../config/constants.js';
import * as goodreads from '../api/goodreads.js';

// DOM elements
let elements = {};

/**
 * Initializes the popup
 */
async function init() {
  // Get DOM elements
  elements = {
    status: document.getElementById('status'),
    booksList: document.getElementById('books-list'),
    emptyState: document.getElementById('empty-state'),
    loadingState: document.getElementById('loading-state'),
    scanBtn: document.getElementById('scan-btn'),
    settingsToggle: document.getElementById('settings-toggle'),
    settingsContent: document.getElementById('settings-content'),
    autoScan: document.getElementById('auto-scan'),
    confirmBeforeAdd: document.getElementById('confirm-before-add'),
    defaultShelf: document.getElementById('default-shelf'),
    googleApiKey: document.getElementById('google-api-key'),
    goodreadsApiKey: document.getElementById('goodreads-api-key'),
    goodreadsApiSecret: document.getElementById('goodreads-api-secret'),
    saveSettings: document.getElementById('save-settings')
  };
  
  // Set up event listeners
  elements.scanBtn.addEventListener('click', handleScanPage);
  elements.settingsToggle.addEventListener('click', toggleSettings);
  elements.saveSettings.addEventListener('click', saveSettings);
  
  // Load settings
  await loadSettings();
  
  // Load detected books
  await loadDetectedBooks();
}

/**
 * Loads and displays detected books from the current tab
 */
async function loadDetectedBooks() {
  try {
    showLoading(true);
    elements.emptyState.classList.add('hidden');
    
    const tab = await getCurrentTab();
    const response = await sendMessage(MESSAGE_TYPES.GET_DETECTED_BOOKS, { tabId: tab.id });
    
    showLoading(false);
    
    if (response.success && response.books && response.books.length > 0) {
      displayBooks(response.books);
    } else {
      showEmptyState();
    }
  } catch (error) {
    console.error('Error loading detected books:', error);
    showLoading(false);
    showEmptyState();
    showStatus('Error loading books. Please try again.', 'error');
  }
}

/**
 * Displays books in the UI
 * @param {Array} books - Array of book objects
 */
function displayBooks(books) {
  elements.booksList.innerHTML = '';
  elements.emptyState.classList.add('hidden');
  
  books.forEach(book => {
    const bookCard = createBookCard(book);
    elements.booksList.appendChild(bookCard);
  });
}

/**
 * Creates a book card element
 * @param {Object} book - Book object
 * @returns {HTMLElement} Book card element
 */
function createBookCard(book) {
  const card = document.createElement('div');
  card.className = 'book-card';
  
  // Thumbnail
  const thumbnail = document.createElement('div');
  if (book.thumbnail) {
    const img = document.createElement('img');
    img.src = book.thumbnail;
    img.alt = book.title;
    img.className = 'book-thumbnail';
    img.onerror = () => {
      img.style.display = 'none';
      thumbnail.innerHTML = '<div class="book-thumbnail placeholder">📚</div>';
    };
    thumbnail.appendChild(img);
  } else {
    thumbnail.innerHTML = '<div class="book-thumbnail placeholder">📚</div>';
  }
  
  // Book info
  const info = document.createElement('div');
  info.className = 'book-info';
  
  const title = document.createElement('div');
  title.className = 'book-title';
  title.textContent = book.title;
  title.title = book.title;
  
  const authors = document.createElement('div');
  authors.className = 'book-authors';
  authors.textContent = book.authors.length > 0 ? book.authors.join(', ') : 'Unknown Author';
  authors.title = authors.textContent;
  
  const isbn = document.createElement('div');
  isbn.className = 'book-isbn';
  isbn.textContent = `ISBN: ${book.isbn}`;
  
  const actions = document.createElement('div');
  actions.className = 'book-actions';
  
  // Search on Goodreads button
  const searchBtn = document.createElement('button');
  searchBtn.className = 'btn btn-secondary btn-small';
  searchBtn.textContent = '🔍 Search on Goodreads';
  searchBtn.onclick = () => handleSearchGoodreads(book.isbn);
  actions.appendChild(searchBtn);
  
  // Copy ISBN button
  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn btn-secondary btn-small';
  copyBtn.textContent = '📋 Copy ISBN';
  copyBtn.onclick = () => handleCopyISBN(book.isbn, copyBtn);
  actions.appendChild(copyBtn);
  
  info.appendChild(title);
  info.appendChild(authors);
  info.appendChild(isbn);
  info.appendChild(actions);
  
  card.appendChild(thumbnail);
  card.appendChild(info);
  
  return card;
}

/**
 * Handles scan page button click
 */
async function handleScanPage() {
  try {
    elements.scanBtn.disabled = true;
    elements.scanBtn.textContent = '⏳ Scanning...';
    
    await triggerPageScan();
    
    // Wait a bit for content script to process
    setTimeout(async () => {
      await loadDetectedBooks();
      elements.scanBtn.disabled = false;
      elements.scanBtn.textContent = '🔍 Scan Page';
      showStatus('Page scanned successfully!', 'success');
    }, 1000);
  } catch (error) {
    console.error('Error scanning page:', error);
    elements.scanBtn.disabled = false;
    elements.scanBtn.textContent = '🔍 Scan Page';
    showStatus('Error scanning page. Please try again.', 'error');
  }
}

/**
 * Handles search on Goodreads
 * @param {string} isbn - The ISBN to search
 */
async function handleSearchGoodreads(isbn) {
  try {
    await sendMessage(MESSAGE_TYPES.SEARCH_GOODREADS, { isbn });
    showStatus('Opened Goodreads search in new tab', 'success');
  } catch (error) {
    console.error('Error searching Goodreads:', error);
    showStatus('Error opening Goodreads search', 'error');
  }
}

/**
 * Handles copy ISBN to clipboard
 * @param {string} isbn - The ISBN to copy
 * @param {HTMLElement} button - The button element
 */
async function handleCopyISBN(isbn, button) {
  try {
    await navigator.clipboard.writeText(isbn);
    const originalText = button.textContent;
    button.textContent = '✓ Copied!';
    button.classList.remove('btn-secondary');
    button.classList.add('btn-success');
    
    setTimeout(() => {
      button.textContent = originalText;
      button.classList.remove('btn-success');
      button.classList.add('btn-secondary');
    }, 2000);
  } catch (error) {
    console.error('Error copying ISBN:', error);
    showStatus('Failed to copy ISBN', 'error');
  }
}

/**
 * Toggles settings panel
 */
function toggleSettings() {
  const isHidden = elements.settingsContent.classList.contains('hidden');
  
  if (isHidden) {
    elements.settingsContent.classList.remove('hidden');
    elements.settingsToggle.classList.add('active');
  } else {
    elements.settingsContent.classList.add('hidden');
    elements.settingsToggle.classList.remove('active');
  }
}

/**
 * Loads settings from storage and populates form
 */
async function loadSettings() {
  try {
    const settings = await getAllSettings();
    
    elements.autoScan.checked = settings.autoScan;
    elements.confirmBeforeAdd.checked = settings.confirmBeforeAdd;
    elements.defaultShelf.value = settings.defaultShelf;
    elements.googleApiKey.value = settings.googleBooksApiKey;
    elements.goodreadsApiKey.value = settings.goodreadsApiKey;
    elements.goodreadsApiSecret.value = settings.goodreadsApiSecret;
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

/**
 * Saves settings to storage
 */
async function saveSettings() {
  try {
    elements.saveSettings.disabled = true;
    elements.saveSettings.textContent = 'Saving...';
    
    await setSyncStorage(STORAGE_KEYS.AUTO_SCAN, elements.autoScan.checked);
    await setSyncStorage(STORAGE_KEYS.CONFIRM_BEFORE_ADD, elements.confirmBeforeAdd.checked);
    await setSyncStorage(STORAGE_KEYS.DEFAULT_SHELF, elements.defaultShelf.value);
    await setSyncStorage(STORAGE_KEYS.GOOGLE_BOOKS_API_KEY, elements.googleApiKey.value);
    await setSyncStorage(STORAGE_KEYS.GOODREADS_API_KEY, elements.goodreadsApiKey.value);
    await setSyncStorage(STORAGE_KEYS.GOODREADS_API_SECRET, elements.goodreadsApiSecret.value);
    
    showStatus('Settings saved successfully!', 'success');
    
    elements.saveSettings.disabled = false;
    elements.saveSettings.textContent = 'Save Settings';
    
    // Close settings panel after a delay
    setTimeout(() => {
      toggleSettings();
    }, 1500);
  } catch (error) {
    console.error('Error saving settings:', error);
    showStatus('Error saving settings', 'error');
    elements.saveSettings.disabled = false;
    elements.saveSettings.textContent = 'Save Settings';
  }
}

/**
 * Shows status message
 * @param {string} message - The message to display
 * @param {string} type - Message type: 'success', 'error', 'info'
 */
function showStatus(message, type = 'info') {
  elements.status.textContent = message;
  elements.status.className = `status ${type}`;
  elements.status.classList.remove('hidden');
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
    elements.status.classList.add('hidden');
  }, 3000);
}

/**
 * Shows/hides loading state
 * @param {boolean} show - Whether to show loading state
 */
function showLoading(show) {
  if (show) {
    elements.loadingState.classList.remove('hidden');
    elements.booksList.innerHTML = '';
  } else {
    elements.loadingState.classList.add('hidden');
  }
}

/**
 * Shows empty state
 */
function showEmptyState() {
  elements.booksList.innerHTML = '';
  elements.emptyState.classList.remove('hidden');
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', init);
