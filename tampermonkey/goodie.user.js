// ==UserScript==
// @name         Goodie - ISBN Detector & Book Manager
// @namespace    https://github.com/mrtrkmn/goodie
// @version      1.0.0
// @description  Detects ISBN numbers on web pages, fetches book info, and integrates with Goodreads. Displays a floating book list panel.
// @author       mrtrkmn
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      www.googleapis.com
// @connect      openlibrary.org
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  // ── Constants ──────────────────────────────────────────────────────────

  const API_ENDPOINTS = {
    GOOGLE_BOOKS: 'https://www.googleapis.com/books/v1/volumes',
    OPEN_LIBRARY_BOOKS: 'https://openlibrary.org/api/books',
    OPEN_LIBRARY_ISBN: 'https://openlibrary.org/isbn',
    GOODREADS_SEARCH: 'https://www.goodreads.com/search',
    GOODREADS_BOOK_ISBN: 'https://www.goodreads.com/book/isbn',
  };

  const ISBN_PATTERNS = {
    ISBN13: /(?:ISBN(?:-13)?:?\s*)?(?:97[89][\s-]?(?:\d[\s-]?){9}\d)/gi,
    ISBN10: /(?:ISBN(?:-10)?:?\s*)?(?:\d[\s-]?){9}[\dXx]/gi,
  };

  const DEBOUNCE_DELAY_MS = 500;
  const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  const MIN_TEXT_LENGTH = 10; // minimum text length to trigger a rescan

  // ── ISBN Utilities ─────────────────────────────────────────────────────

  function normalizeISBN(isbn) {
    return isbn.replace(/[\s-]/g, '').toUpperCase();
  }

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

  function extractISBNs(text) {
    const foundISBNs = new Set();

    const isbn13Matches = text.matchAll(ISBN_PATTERNS.ISBN13);
    for (const match of isbn13Matches) {
      const isbn = normalizeISBN(match[0].replace(/ISBN(?:-13)?:?\s*/i, ''));
      if (isbn.length === 13 && isValidISBN(isbn)) {
        foundISBNs.add(isbn);
      }
    }

    const isbn10Matches = text.matchAll(ISBN_PATTERNS.ISBN10);
    for (const match of isbn10Matches) {
      const isbn = normalizeISBN(match[0].replace(/ISBN(?:-10)?:?\s*/i, ''));
      if (isbn.length === 10 && isValidISBN(isbn)) {
        foundISBNs.add(isbn);
      }
    }

    return Array.from(foundISBNs);
  }

  // ── API Fetching ───────────────────────────────────────────────────────

  /**
   * Wraps GM_xmlhttpRequest in a Promise.
   */
  function gmFetch(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: url,
        onload: function (response) {
          if (response.status >= 200 && response.status < 300) {
            try {
              resolve(JSON.parse(response.responseText));
            } catch (e) {
              reject(new Error('Failed to parse JSON'));
            }
          } else {
            reject(new Error('HTTP ' + response.status));
          }
        },
        onerror: function () {
          reject(new Error('Network error'));
        },
      });
    });
  }

  /**
   * Returns cached book info or null.
   */
  function getCachedBook(isbn) {
    try {
      const cache = GM_getValue('bookCache', {});
      const entry = cache[isbn];
      if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
        return entry.data;
      }
    } catch (_) {
      /* ignore */
    }
    return null;
  }

  function setCachedBook(isbn, bookInfo) {
    try {
      const cache = GM_getValue('bookCache', {});
      cache[isbn] = { data: bookInfo, timestamp: Date.now() };
      GM_setValue('bookCache', cache);
    } catch (_) {
      /* ignore */
    }
  }

  async function fetchFromGoogleBooks(isbn) {
    const url =
      API_ENDPOINTS.GOOGLE_BOOKS + '?q=isbn:' + encodeURIComponent(isbn);
    const data = await gmFetch(url);
    if (!data.items || data.items.length === 0) return null;

    const v = data.items[0].volumeInfo || {};
    const img = v.imageLinks || {};
    return {
      isbn,
      title: v.title || 'Unknown Title',
      authors: v.authors || [],
      thumbnail: img.thumbnail || img.smallThumbnail || '',
      source: 'google-books',
    };
  }

  async function fetchFromOpenLibrary(isbn) {
    const url =
      API_ENDPOINTS.OPEN_LIBRARY_BOOKS +
      '?bibkeys=ISBN:' +
      encodeURIComponent(isbn) +
      '&format=json&jscmd=data';
    const data = await gmFetch(url);
    const key = 'ISBN:' + isbn;
    if (!data[key]) return null;

    const d = data[key];
    const authors = d.authors ? d.authors.map((a) => a.name) : [];
    const thumbnail = d.cover
      ? d.cover.medium || d.cover.small || d.cover.large
      : '';
    return {
      isbn,
      title: d.title || 'Unknown Title',
      authors,
      thumbnail,
      source: 'open-library',
    };
  }

  async function fetchBookInfo(isbn) {
    const cached = getCachedBook(isbn);
    if (cached) return cached;

    let book = null;
    try {
      book = await fetchFromGoogleBooks(isbn);
    } catch (_) {
      /* ignore */
    }
    if (!book) {
      try {
        book = await fetchFromOpenLibrary(isbn);
      } catch (_) {
        /* ignore */
      }
    }
    if (book) setCachedBook(isbn, book);
    return book;
  }

  // ── Debounce ───────────────────────────────────────────────────────────

  function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  // ── Scanning ───────────────────────────────────────────────────────────

  const detectedISBNs = new Set();
  const bookData = new Map(); // isbn → book info
  let isScanning = false;

  async function scanPage() {
    if (isScanning) return;
    isScanning = true;
    try {
      const text = document.body.textContent || '';
      const isbns = extractISBNs(text);
      const newISBNs = isbns.filter((isbn) => !detectedISBNs.has(isbn));
      if (newISBNs.length === 0) {
        isScanning = false;
        return;
      }
      newISBNs.forEach((isbn) => detectedISBNs.add(isbn));

      // Fetch metadata for new ISBNs
      await Promise.all(
        newISBNs.map(async (isbn) => {
          const info = await fetchBookInfo(isbn);
          bookData.set(
            isbn,
            info || {
              isbn,
              title: 'Details Unavailable',
              authors: [],
              thumbnail: '',
              source: 'none',
            }
          );
        })
      );

      renderPanel();
    } catch (e) {
      console.error('Goodie: scan error', e);
    } finally {
      isScanning = false;
    }
  }

  const debouncedScan = debounce(scanPage, DEBOUNCE_DELAY_MS);

  // ── UI ─────────────────────────────────────────────────────────────────

  let panelEl = null;
  let panelVisible = true;

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #goodie-panel {
        position: fixed;
        top: 50%;
        right: 20px;
        transform: translateY(-50%);
        width: 360px;
        max-height: 70vh;
        background: #F4F1EA;
        border: 1px solid #ccc;
        border-radius: 10px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.18);
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        font-size: 14px;
        color: #333;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      #goodie-panel.goodie-collapsed {
        max-height: none;
        height: auto;
      }
      #goodie-panel.goodie-collapsed .goodie-body {
        display: none;
      }
      .goodie-header {
        background: #382110;
        color: #F4F1EA;
        padding: 10px 14px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: move;
        user-select: none;
        border-radius: 10px 10px 0 0;
        flex-shrink: 0;
      }
      #goodie-panel.goodie-collapsed .goodie-header {
        border-radius: 10px;
      }
      .goodie-header-title {
        font-size: 16px;
        font-weight: 600;
      }
      .goodie-header-actions {
        display: flex;
        gap: 6px;
        align-items: center;
      }
      .goodie-header-btn {
        background: none;
        border: none;
        color: #F4F1EA;
        font-size: 16px;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 4px;
        line-height: 1;
      }
      .goodie-header-btn:hover {
        background: rgba(255,255,255,0.15);
      }
      .goodie-body {
        overflow-y: auto;
        padding: 10px 14px;
        flex: 1;
      }
      .goodie-empty {
        text-align: center;
        padding: 24px 12px;
        color: #888;
      }
      .goodie-book {
        display: flex;
        gap: 10px;
        padding: 10px;
        background: #fff;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        margin-bottom: 10px;
      }
      .goodie-book:last-child {
        margin-bottom: 0;
      }
      .goodie-book-thumb {
        width: 50px;
        height: 74px;
        object-fit: cover;
        border-radius: 4px;
        background: #e0e0e0;
        flex-shrink: 0;
      }
      .goodie-book-thumb-placeholder {
        width: 50px;
        height: 74px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        background: linear-gradient(135deg, #e0e0e0, #c0c0c0);
        border-radius: 4px;
        flex-shrink: 0;
      }
      .goodie-book-info {
        flex: 1;
        min-width: 0;
      }
      .goodie-book-title {
        font-size: 13px;
        font-weight: 600;
        color: #333;
        margin-bottom: 2px;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }
      .goodie-book-authors {
        font-size: 11px;
        color: #666;
        margin-bottom: 2px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .goodie-book-isbn {
        font-size: 10px;
        color: #999;
        font-family: 'Courier New', monospace;
        margin-bottom: 6px;
      }
      .goodie-book-actions {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
      }
      .goodie-btn {
        padding: 3px 8px;
        font-size: 11px;
        font-weight: 500;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        white-space: nowrap;
        transition: background 0.15s;
        text-decoration: none;
        display: inline-block;
        line-height: 1.4;
      }
      .goodie-btn-primary {
        background: #409D69;
        color: #fff;
      }
      .goodie-btn-primary:hover {
        background: #368a5a;
      }
      .goodie-btn-secondary {
        background: #fff;
        color: #00635D;
        border: 1px solid #00635D;
      }
      .goodie-btn-secondary:hover {
        background: #e8f4f0;
      }
      .goodie-btn-success {
        background: #28a745;
        color: #fff;
      }
      .goodie-scan-bar {
        padding: 8px 14px;
        border-top: 1px solid #e0e0e0;
        display: flex;
        justify-content: center;
        flex-shrink: 0;
      }
      .goodie-scan-btn {
        padding: 5px 16px;
        font-size: 12px;
        font-weight: 500;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        background: #382110;
        color: #F4F1EA;
      }
      .goodie-scan-btn:hover {
        background: #4e3320;
      }
    `;
    document.head.appendChild(style);
  }

  function createPanel() {
    panelEl = document.createElement('div');
    panelEl.id = 'goodie-panel';

    // Header
    const header = document.createElement('div');
    header.className = 'goodie-header';
    header.innerHTML =
      '<span class="goodie-header-title">\u{1F4DA} Goodie</span>' +
      '<span class="goodie-header-actions">' +
      '<button class="goodie-header-btn" id="goodie-collapse-btn" title="Collapse">\u2212</button>' +
      '<button class="goodie-header-btn" id="goodie-close-btn" title="Close">\u2715</button>' +
      '</span>';
    panelEl.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'goodie-body';
    body.id = 'goodie-body';
    body.innerHTML = '<div class="goodie-empty">\u23F3 Scanning page for ISBNs\u2026</div>';
    panelEl.appendChild(body);

    // Scan bar
    const scanBar = document.createElement('div');
    scanBar.className = 'goodie-scan-bar';
    scanBar.innerHTML =
      '<button class="goodie-scan-btn" id="goodie-scan-btn">\u{1F50D} Scan Page</button>';
    panelEl.appendChild(scanBar);

    document.body.appendChild(panelEl);

    // Events
    document
      .getElementById('goodie-close-btn')
      .addEventListener('click', () => {
        panelEl.style.display = 'none';
        panelVisible = false;
      });

    document
      .getElementById('goodie-collapse-btn')
      .addEventListener('click', () => {
        const isCollapsed = panelEl.classList.toggle('goodie-collapsed');
        document.getElementById('goodie-collapse-btn').textContent = isCollapsed
          ? '\u002B'
          : '\u2212';
      });

    document
      .getElementById('goodie-scan-btn')
      .addEventListener('click', () => {
        detectedISBNs.clear();
        bookData.clear();
        scanPage();
      });

    // Drag support
    makeDraggable(panelEl, header);
  }

  function makeDraggable(el, handle) {
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    handle.addEventListener('mousedown', (e) => {
      if (e.target.closest('.goodie-header-btn')) return;
      isDragging = true;
      const rect = el.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const x = e.clientX - offsetX;
      const y = e.clientY - offsetY;
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.right = 'auto';
      el.style.transform = 'none';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  function renderPanel() {
    if (!panelEl) return;
    const body = document.getElementById('goodie-body');
    if (!body) return;

    if (bookData.size === 0) {
      body.innerHTML =
        '<div class="goodie-empty">\u{1F4D6} No ISBNs detected on this page.</div>';
      return;
    }

    let html = '';
    for (const [isbn, book] of bookData) {
      const thumbHTML = book.thumbnail
        ? '<img class="goodie-book-thumb" src="' + escapeAttr(book.thumbnail) + '" alt="' + escapeAttr(book.title) + '">'
        : '<div class="goodie-book-thumb-placeholder">\u{1F4DA}</div>';

      const authorsText =
        book.authors && book.authors.length > 0
          ? escapeHTML(book.authors.join(', '))
          : 'Unknown Author';

      const goodreadsAddURL =
        API_ENDPOINTS.GOODREADS_BOOK_ISBN +
        '/' +
        encodeURIComponent(isbn);
      const goodreadsSearchURL =
        API_ENDPOINTS.GOODREADS_SEARCH +
        '?q=' +
        encodeURIComponent(isbn);

      html +=
        '<div class="goodie-book">' +
        thumbHTML +
        '<div class="goodie-book-info">' +
        '<div class="goodie-book-title" title="' + escapeAttr(book.title) + '">' + escapeHTML(book.title) + '</div>' +
        '<div class="goodie-book-authors" title="' + escapeAttr(authorsText) + '">' + authorsText + '</div>' +
        '<div class="goodie-book-isbn">ISBN: ' + escapeHTML(isbn) + '</div>' +
        '<div class="goodie-book-actions">' +
        '<a class="goodie-btn goodie-btn-primary" href="' + escapeAttr(goodreadsAddURL) + '" target="_blank" rel="noopener noreferrer">\u{1F4D6} Add to Goodreads</a>' +
        '<a class="goodie-btn goodie-btn-secondary" href="' + escapeAttr(goodreadsSearchURL) + '" target="_blank" rel="noopener noreferrer">\u{1F50D} Search</a>' +
        '<button class="goodie-btn goodie-btn-secondary goodie-copy-btn" data-isbn="' + escapeAttr(isbn) + '">\u{1F4CB} Copy ISBN</button>' +
        '</div>' +
        '</div>' +
        '</div>';
    }

    body.innerHTML = html;

    // Attach copy handlers
    body.querySelectorAll('.goodie-copy-btn').forEach((btn) => {
      btn.addEventListener('click', function () {
        const isbnVal = this.getAttribute('data-isbn');
        GM_setClipboard(isbnVal, 'text');
        const original = this.textContent;
        this.textContent = '\u2713 Copied!';
        this.classList.remove('goodie-btn-secondary');
        this.classList.add('goodie-btn-success');
        setTimeout(() => {
          this.textContent = original;
          this.classList.remove('goodie-btn-success');
          this.classList.add('goodie-btn-secondary');
        }, 2000);
      });
    });

    // Attach image error handlers for thumbnail fallback
    body.querySelectorAll('.goodie-book-thumb').forEach((img) => {
      img.addEventListener('error', function () {
        const placeholder = document.createElement('div');
        placeholder.className = 'goodie-book-thumb-placeholder';
        placeholder.textContent = '\u{1F4DA}';
        this.replaceWith(placeholder);
      });
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ── MutationObserver ───────────────────────────────────────────────────

  function initObserver() {
    const observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (
              node.nodeType === Node.ELEMENT_NODE &&
              !node.closest('#goodie-panel') &&
              (node.textContent || '').length > MIN_TEXT_LENGTH
            ) {
              shouldScan = true;
              break;
            }
          }
        }
        if (shouldScan) break;
      }
      if (shouldScan) debouncedScan();
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ── Bootstrap ──────────────────────────────────────────────────────────

  function init() {
    injectStyles();
    createPanel();
    scanPage();
    initObserver();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
