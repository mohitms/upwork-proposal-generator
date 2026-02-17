const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const scraper = require('../src/services/scraper');

const fixtureHtml = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'upwork-job-sample.html'),
  'utf8'
);

test('validateUpworkUrl accepts supported Upwork https URL', () => {
  const url = scraper.validateUpworkUrl('https://www.upwork.com/jobs/~0123456789');
  assert.equal(url, 'https://www.upwork.com/jobs/~0123456789');
});

test('validateUpworkUrl strips hash fragments', () => {
  const url = scraper.validateUpworkUrl('https://www.upwork.com/jobs/~0123456789#fragment');
  assert.equal(url, 'https://www.upwork.com/jobs/~0123456789');
});

test('validateUpworkUrl rejects invalid format', () => {
  assert.throws(
    () => scraper.validateUpworkUrl('not-a-url'),
    (error) => error.code === scraper.SCRAPE_ERROR_CODES.INVALID_URL
  );
});

test('validateUpworkUrl rejects non-https URL', () => {
  assert.throws(
    () => scraper.validateUpworkUrl('http://www.upwork.com/jobs/~0123456789'),
    (error) => error.code === scraper.SCRAPE_ERROR_CODES.INVALID_URL
  );
});

test('validateUpworkUrl rejects unsupported domains', () => {
  assert.throws(
    () => scraper.validateUpworkUrl('https://example.com/jobs/abc'),
    (error) => error.code === scraper.SCRAPE_ERROR_CODES.UNSUPPORTED_DOMAIN
  );
});

test('assertAllowedUpworkHost rejects redirected non-upwork hosts', () => {
  assert.throws(
    () => scraper.__test.assertAllowedUpworkHost('https://malicious.example/path'),
    (error) => error.code === scraper.SCRAPE_ERROR_CODES.UNSUPPORTED_DOMAIN
  );
});

test('extractFromHtml parses title, description, budget, and skills from Upwork fixture', () => {
  const data = scraper.__test.extractFromHtml(
    fixtureHtml,
    'https://www.upwork.com/jobs/~fixture',
    'parser'
  );

  assert.equal(data.title, 'Build Billing Dashboard');
  assert.match(data.description, /Node\.js engineer/);
  assert.equal(data.budget, '$35.00 - $60.00/hr');
  assert.equal(data.skills, 'Node.js, PostgreSQL, REST API');
  assert.equal(data.mode, 'parser');
});

test('extractBudgetFromText returns recognizable budget strings', () => {
  const text = 'Project details Budget: $500 - $1200 Estimated timeline 2 weeks';
  const budget = scraper.__test.extractBudgetFromText(text);
  assert.match(budget, /\$500 - \$1200/i);
});

test('detectCloudflareFromHtml identifies challenge pages', () => {
  const html = '<html><head><title>Just a moment...</title></head><body>Checking your browser before accessing</body></html>';
  assert.equal(scraper.__test.detectCloudflareFromHtml(html), true);
});

test('detectCloudflareFromHtml does not flag normal Upwork fixture as Cloudflare', () => {
  assert.equal(scraper.__test.detectCloudflareFromHtml(fixtureHtml), false);
});

test('normalizeScrapeError maps unknown errors to SCRAPE_FAILED', () => {
  const normalized = scraper.normalizeScrapeError(new Error('network issue'));
  assert.equal(normalized.code, scraper.SCRAPE_ERROR_CODES.SCRAPE_FAILED);
});
