# Changelog

All notable changes to the Chrome extension will be documented here.

## [1.0.1] - 2026-02-17

### Fixed
- Improved Upwork scraper with robust CSS selectors for title, budget, skills, and category
- Added multiple fallback selectors to handle Upwork DOM structure variations
- Added debug logging to console for troubleshooting scraped data
- Fixed CORS issue by adding upwork.com to allowed origins

### Changed
- Enhanced budget extraction with pattern matching fallback
- Better error messages and debugging output

## [1.0.0] - 2026-02-17

### Added
- Initial release
- Floating "Generate Proposal" button on Upwork job pages
- Scrapes job data (title, description, budget, skills, category)
- Scrapes client data for future trust scoring
- One-click proposal generation via AI
- Copy to clipboard functionality
- Loading states and error handling with retry
- Modern UI with teal theme matching dashboard
