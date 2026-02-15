/**
 * Unit tests for ISBN utilities
 * Tests ISBN validation, checksum verification, and extraction
 */

import { 
  normalizeISBN, 
  validateISBN10Checksum,
  validateISBN13Checksum, 
  isValidISBN,
  extractISBNs,
  convertISBN10ToISBN13,
  formatISBN
} from '../src/utils/isbn.js';

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

/**
 * Asserts that a condition is true
 */
function assert(condition, testName) {
  if (condition) {
    results.passed++;
    results.tests.push({ name: testName, status: 'PASS' });
  } else {
    results.failed++;
    results.tests.push({ name: testName, status: 'FAIL' });
  }
}

/**
 * Asserts that two values are equal
 */
function assertEqual(actual, expected, testName) {
  const condition = JSON.stringify(actual) === JSON.stringify(expected);
  if (condition) {
    results.passed++;
    results.tests.push({ name: testName, status: 'PASS' });
  } else {
    results.failed++;
    results.tests.push({ 
      name: testName, 
      status: 'FAIL', 
      message: `Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(actual)}` 
    });
  }
}

// Test normalizeISBN
function testNormalizeISBN() {
  assertEqual(normalizeISBN('978-0-13-468599-1'), '9780134685991', 'Normalize ISBN-13 with hyphens');
  assertEqual(normalizeISBN('0-13-468599-1'), '0134685991', 'Normalize ISBN-10 with hyphens');
  assertEqual(normalizeISBN('978 0 13 468599 1'), '9780134685991', 'Normalize ISBN with spaces');
  assertEqual(normalizeISBN('978-0-13-468599-x'), '978013468599X', 'Normalize with lowercase x');
}

// Test ISBN-10 checksum validation
function testValidateISBN10Checksum() {
  assert(validateISBN10Checksum('0134685991'), 'Valid ISBN-10: 0134685991');
  assert(validateISBN10Checksum('0306406152'), 'Valid ISBN-10: 0306406152');
  assert(validateISBN10Checksum('043942089X'), 'Valid ISBN-10 with X: 043942089X');
  assert(!validateISBN10Checksum('0134685990'), 'Invalid ISBN-10 checksum');
  assert(!validateISBN10Checksum('123456789'), 'Invalid ISBN-10 length');
}

// Test ISBN-13 checksum validation
function testValidateISBN13Checksum() {
  assert(validateISBN13Checksum('9780134685991'), 'Valid ISBN-13: 9780134685991');
  assert(validateISBN13Checksum('9780306406157'), 'Valid ISBN-13: 9780306406157');
  assert(!validateISBN13Checksum('9780134685990'), 'Invalid ISBN-13 checksum');
  assert(!validateISBN13Checksum('12345678901'), 'Invalid ISBN-13 length');
}

// Test isValidISBN
function testIsValidISBN() {
  assert(isValidISBN('978-0-13-468599-1'), 'Valid formatted ISBN-13');
  assert(isValidISBN('0-13-468599-1'), 'Valid formatted ISBN-10');
  assert(isValidISBN('9780134685991'), 'Valid bare ISBN-13');
  assert(isValidISBN('0134685991'), 'Valid bare ISBN-10');
  assert(!isValidISBN('9790134685991'), 'Invalid prefix 979 with wrong checksum');
  assert(!isValidISBN('1234567890'), 'Invalid ISBN-10');
  assert(!isValidISBN('9781234567890'), 'Invalid ISBN-13');
  assert(!isValidISBN('123'), 'Too short');
}

// Test extractISBNs
function testExtractISBNs() {
  const text1 = 'Check out this book: ISBN: 978-0-13-468599-1';
  assertEqual(extractISBNs(text1), ['9780134685991'], 'Extract ISBN-13 with prefix');
  
  const text2 = 'ISBN-10: 0-13-468599-1 is a great book';
  assertEqual(extractISBNs(text2), ['0134685991'], 'Extract ISBN-10 with prefix');
  
  const text3 = 'Books: 9780134685991 and 0306406152';
  const result3 = extractISBNs(text3);
  assert(result3.includes('9780134685991') && result3.includes('0306406152'), 'Extract multiple ISBNs');
  
  const text4 = 'No ISBNs here: 1234567890';
  assertEqual(extractISBNs(text4), [], 'No valid ISBNs');
  
  const text5 = 'Duplicate: 9780134685991 and 9780134685991';
  assertEqual(extractISBNs(text5), ['9780134685991'], 'Deduplicate ISBNs');
  
  const text6 = 'Invalid checksum: 9780134685990 should not match';
  assertEqual(extractISBNs(text6), [], 'Reject invalid checksum');
}

// Test convertISBN10ToISBN13
function testConvertISBN10ToISBN13() {
  assertEqual(convertISBN10ToISBN13('0134685991'), '9780134685991', 'Convert valid ISBN-10');
  assertEqual(convertISBN10ToISBN13('0306406152'), '9780306406157', 'Convert another valid ISBN-10');
  assertEqual(convertISBN10ToISBN13('invalid'), null, 'Return null for invalid ISBN-10');
  assertEqual(convertISBN10ToISBN13('12345'), null, 'Return null for wrong length');
}

// Test formatISBN
function testFormatISBN() {
  assertEqual(formatISBN('9780134685991'), '978-0-134-68599-1', 'Format ISBN-13');
  assertEqual(formatISBN('0134685991'), '0-134-68599-1', 'Format ISBN-10');
  assertEqual(formatISBN('123'), '123', 'Return original for invalid length');
}

// Run all tests
export function runAllTests() {
  console.log('Running ISBN utility tests...\n');
  
  testNormalizeISBN();
  testValidateISBN10Checksum();
  testValidateISBN13Checksum();
  testIsValidISBN();
  testExtractISBNs();
  testConvertISBN10ToISBN13();
  testFormatISBN();
  
  return results;
}

// Auto-run if loaded in test runner
if (typeof window !== 'undefined' && window.location.pathname.includes('test-runner.html')) {
  window.addEventListener('DOMContentLoaded', () => {
    const results = runAllTests();
    
    // Display results
    const resultsDiv = document.getElementById('test-results');
    if (resultsDiv) {
      let html = '<h2>Test Results</h2>';
      html += `<p class="summary">Passed: <span class="pass">${results.passed}</span> | Failed: <span class="fail">${results.failed}</span></p>`;
      html += '<ul>';
      
      results.tests.forEach(test => {
        const statusClass = test.status === 'PASS' ? 'pass' : 'fail';
        html += `<li class="${statusClass}">`;
        html += `<strong>${test.status}</strong>: ${test.name}`;
        if (test.message) {
          html += `<br><span class="error-message">${test.message}</span>`;
        }
        html += '</li>';
      });
      
      html += '</ul>';
      resultsDiv.innerHTML = html;
    }
  });
}
