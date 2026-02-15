# 📚 Goodie - ISBN Detector & Book Manager

A production-ready Chrome Extension that automatically detects ISBN numbers on any webpage, fetches book metadata, and integrates with Goodreads (with modern fallback strategies).

## Features

- **🔍 Automatic ISBN Detection**: Scans web pages for ISBN-10 and ISBN-13 numbers using regex patterns with checksum validation
- **📖 Book Metadata Fetching**: Retrieves book information from Google Books API with Open Library as fallback
- **🔗 Goodreads Integration**: Add books to Goodreads shelves directly, or search books on Goodreads
- **⚡ Real-time Scanning**: Uses MutationObserver to detect ISBNs in dynamically loaded content
- **💾 Smart Caching**: Caches book metadata for 24 hours to minimize API calls
- **⚙️ Customizable Settings**: Configure auto-scan and preferences
- **🎨 Clean UI**: Modern, responsive popup interface with book cards
- **🔐 Security-First**: All API calls from background service worker, no inline scripts

## Architecture

```
goodie/
├── manifest.json                    # Chrome Extension manifest (Manifest V3)
├── README.md                        # This file
├── LICENSE                          # License file
├── .gitignore                       # Git ignore rules
├── icons/                           # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── src/
│   ├── background/
│   │   └── service-worker.js        # Background service worker
│   ├── content/
│   │   └── content-script.js        # Content script for ISBN detection
│   ├── popup/
│   │   ├── popup.html               # Popup UI
│   │   ├── popup.css                # Popup styles
│   │   └── popup.js                 # Popup logic
│   ├── api/
│   │   ├── google-books.js          # Google Books API integration
│   │   ├── open-library.js          # Open Library API integration
│   │   └── goodreads.js             # Goodreads integration
│   ├── utils/
│   │   ├── isbn.js                  # ISBN validation and utilities
│   │   ├── debounce.js              # Debounce/throttle utilities
│   │   ├── storage.js               # Chrome storage helpers
│   │   └── messaging.js             # Message passing helpers
│   └── config/
│       └── constants.js             # Configuration constants
└── tests/
    ├── isbn.test.js                 # ISBN utility unit tests
    └── test-runner.html             # Test runner interface
```

## Installation

### From Source (Developer Mode)

1. **Clone the repository**:
   ```bash
   git clone https://github.com/mrtrkmn/goodie.git
   cd goodie
   ```

2. **Open Chrome Extensions page**:
   - Navigate to `chrome://extensions/`
   - Or click the three-dot menu → More Tools → Extensions

3. **Enable Developer Mode**:
   - Toggle the "Developer mode" switch in the top-right corner

4. **Load the extension**:
   - Click "Load unpacked"
   - Select the `goodie/` directory
   - The extension should now appear in your extensions list

5. **Pin the extension** (optional):
   - Click the puzzle piece icon in Chrome toolbar
   - Find "Goodie - ISBN Detector & Book Manager"
   - Click the pin icon to keep it visible

## Usage

### Basic Usage

1. **Automatic Scanning**: Visit any webpage with ISBN numbers (e.g., Amazon, Goodreads, library websites)
2. **View Detected Books**: Click the Goodie extension icon to see detected books
3. **Manual Scan**: Click "🔍 Scan Page" button in the popup to manually trigger a scan
4. **Search on Goodreads**: Click "Search on Goodreads" for any book to open it in a new tab
5. **Copy ISBN**: Use the "Copy ISBN" button to copy the ISBN to clipboard

### Configuration

Click "⚙️ Settings" in the popup to configure:

- **Auto-scan pages**: Automatically scan pages when they load (default: enabled)
- **Confirm before adding**: Ask for confirmation before adding books to Goodreads (default: enabled)
- **Default shelf**: Choose default Goodreads shelf (default: "to-read")
- **Google Books API Key**: Optional API key for higher rate limits

### API Keys Setup

#### Google Books API (Optional)

1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable "Books API"
4. Go to "Credentials" → "Create Credentials" → "API Key"
5. Copy the API key and paste it in Goodie settings

**Note**: Google Books API works without a key (with lower rate limits of ~1000 requests/day).

### Goodreads Integration

Goodie integrates with Goodreads by opening the Goodreads book page directly using the detected ISBN.
No API key is required — simply click "Add to Goodreads" on any detected book to open its Goodreads page,
where you can add it to your shelves. You can also use "Search on Goodreads" to search by ISBN.

## How It Works

### ISBN Detection

The extension uses sophisticated regex patterns to detect ISBNs:

**ISBN-13 Pattern**:
- Starts with 978 or 979 prefix
- 13 digits total
- Optional hyphens or spaces
- Example: `978-0-13-468599-1` or `9780134685991`

**ISBN-10 Pattern**:
- 10 digits (last digit can be 'X')
- Optional hyphens or spaces
- Example: `0-13-468599-1` or `0134685991`

### Checksum Validation

To reduce false positives, all detected ISBNs are validated:

**ISBN-10 Checksum** (Modulo 11):
```
sum = d₁×10 + d₂×9 + d₃×8 + ... + d₉×2 + d₁₀×1
sum mod 11 = 0
```

**ISBN-13 Checksum** (Modulo 10):
```
sum = d₁×1 + d₂×3 + d₃×1 + d₄×3 + ... + d₁₃×1
sum mod 10 = 0
```

### Metadata Fetching

1. **Primary**: Google Books API
   - Fast and reliable
   - Rich metadata (title, authors, description, cover, etc.)
   - Works without API key

2. **Fallback**: Open Library API
   - Used when Google Books fails
   - Good coverage of older and academic books
   - Free and open source

### Performance Optimizations

- **Debounced Scanning**: Scans are debounced at 500ms to prevent excessive processing
- **MutationObserver**: Watches for dynamically added content efficiently
- **Smart Caching**: Metadata cached for 24 hours in `chrome.storage.local`
- **Badge Updates**: Extension badge shows count of detected ISBNs
- **Tab Cleanup**: Automatically clears data for closed tabs

## Testing

### Running Unit Tests

1. Open the test runner:
   ```
   Open tests/test-runner.html in Chrome
   ```

2. Tests will run automatically and display results

### Test Coverage

- ISBN-10 validation and checksum
- ISBN-13 validation and checksum
- ISBN extraction from text
- ISBN normalization
- ISBN-10 to ISBN-13 conversion
- ISBN formatting
- Edge cases: invalid ISBNs, partial matches, duplicates

## Known Limitations

1. **Goodreads Integration**: Adding books to Goodreads shelves requires users to be logged in to Goodreads in their browser. The extension opens the Goodreads book page where the user can add the book to a shelf.

2. **Rate Limits**:
   - Google Books: ~1000 requests/day (free tier)
   - Open Library: Be respectful with request frequency
   
3. **ISBN Detection**: May occasionally detect numbers that look like ISBNs but aren't. Checksum validation helps reduce false positives.

4. **Dynamic Content**: Some heavily JavaScript-based sites may require manual "Scan Page" trigger.

## Future Improvements

- [ ] **TypeScript Migration**: Migrate to TypeScript for better type safety
- [ ] **Alternative Services**: Integrate StoryGraph, LibraryThing, or Bookwyrm
- [ ] **Barcode Scanning**: Use device camera to scan physical book barcodes
- [ ] **Reading List Sync**: Sync reading lists across devices
- [ ] **Price Comparison**: Show book prices from multiple retailers
- [ ] **Export Functionality**: Export detected books as CSV/JSON
- [ ] **Multi-Browser Support**: Port to Firefox and Safari
- [ ] **Enhanced UI**: Dark mode, customizable themes
- [ ] **Book Notes**: Add personal notes and ratings
- [ ] **ISBN Database**: Build offline ISBN database for faster lookups

## Security & Privacy

- ✅ No inline scripts (CSP compliant)
- ✅ All API calls from background service worker only
- ✅ Tokens stored in `chrome.storage.local` (not accessible to content scripts)
- ✅ No data sent to third parties except chosen APIs
- ✅ No tracking or analytics
- ✅ Open source and auditable

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Google Books API for book metadata
- Open Library for fallback metadata
- Chrome Extensions documentation
- All contributors and users

## Support

If you encounter any issues or have questions:
- Open an issue on GitHub
- Check existing issues for solutions
- Review the documentation

---

**Made with ❤️ for book lovers**

Version: 1.0.0
