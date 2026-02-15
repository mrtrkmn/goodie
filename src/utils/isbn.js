/**
 * ISBN utility functions
 * Handles ISBN validation, checksum verification, normalization, and extraction
 */

import { ISBN_PATTERNS } from '../config/constants.js';

/**
 * Normalizes an ISBN by removing hyphens and spaces
 * @param {string} isbn - The ISBN to normalize
 * @returns {string} Normalized ISBN
 */
export function normalizeISBN(isbn) {
  return isbn.replace(/[\s\-]/g, '').toUpperCase();
}

/**
 * Validates ISBN-10 checksum using modulo 11 algorithm
 * @param {string} isbn10 - The ISBN-10 to validate (should be normalized)
 * @returns {boolean} True if checksum is valid
 */
export function validateISBN10Checksum(isbn10) {
  if (isbn10.length !== 10) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const digit = parseInt(isbn10[i], 10);
    if (isNaN(digit)) return false;
    sum += digit * (10 - i);
  }
  
  // Last digit can be X (representing 10)
  const checkDigit = isbn10[9] === 'X' ? 10 : parseInt(isbn10[9], 10);
  if (isNaN(checkDigit)) return false;
  
  sum += checkDigit;
  return sum % 11 === 0;
}

/**
 * Validates ISBN-13 checksum using modulo 10 algorithm
 * @param {string} isbn13 - The ISBN-13 to validate (should be normalized)
 * @returns {boolean} True if checksum is valid
 */
export function validateISBN13Checksum(isbn13) {
  if (isbn13.length !== 13) return false;
  
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    const digit = parseInt(isbn13[i], 10);
    if (isNaN(digit)) return false;
    
    // Multiply odd positions (0-indexed) by 1, even positions by 3
    sum += digit * (i % 2 === 0 ? 1 : 3);
  }
  
  return sum % 10 === 0;
}

/**
 * Validates an ISBN (either ISBN-10 or ISBN-13)
 * @param {string} isbn - The ISBN to validate
 * @returns {boolean} True if ISBN is valid
 */
export function isValidISBN(isbn) {
  const normalized = normalizeISBN(isbn);
  
  if (normalized.length === 10) {
    return validateISBN10Checksum(normalized);
  } else if (normalized.length === 13) {
    // ISBN-13 must start with 978 or 979
    if (!normalized.startsWith('978') && !normalized.startsWith('979')) {
      return false;
    }
    return validateISBN13Checksum(normalized);
  }
  
  return false;
}

/**
 * Extracts ISBNs from text
 * @param {string} text - The text to search for ISBNs
 * @returns {string[]} Array of valid ISBNs found
 */
export function extractISBNs(text) {
  const foundISBNs = new Set();
  
  // Extract ISBN-13 first (more specific)
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
 * Converts ISBN-10 to ISBN-13
 * @param {string} isbn10 - The ISBN-10 to convert
 * @returns {string|null} The ISBN-13 or null if invalid
 */
export function convertISBN10ToISBN13(isbn10) {
  const normalized = normalizeISBN(isbn10);
  if (normalized.length !== 10 || !validateISBN10Checksum(normalized)) {
    return null;
  }
  
  // Remove check digit and add 978 prefix
  const base = '978' + normalized.slice(0, 9);
  
  // Calculate new check digit
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(base[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  
  const checkDigit = (10 - (sum % 10)) % 10;
  return base + checkDigit;
}

/**
 * Formats an ISBN with hyphens for display
 * @param {string} isbn - The ISBN to format
 * @returns {string} Formatted ISBN
 */
export function formatISBN(isbn) {
  const normalized = normalizeISBN(isbn);
  
  if (normalized.length === 13) {
    // Format: 978-0-123-45678-9
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 4)}-${normalized.slice(4, 7)}-${normalized.slice(7, 12)}-${normalized.slice(12)}`;
  } else if (normalized.length === 10) {
    // Format: 0-123-45678-9
    return `${normalized.slice(0, 1)}-${normalized.slice(1, 4)}-${normalized.slice(4, 9)}-${normalized.slice(9)}`;
  }
  
  return isbn;
}
