/**
 * URL scraper service for Upwork job posts.
 * Playwright-first extraction with parser fallback.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const TurndownService = require('turndown');

const ALLOWED_UPWORK_HOSTS = new Set(['upwork.com', 'www.upwork.com']);

const SCRAPE_ERROR_CODES = Object.freeze({
  INVALID_URL: 'INVALID_URL',
  UNSUPPORTED_DOMAIN: 'UNSUPPORTED_DOMAIN',
  SCRAPE_BLOCKED_CLOUDFLARE: 'SCRAPE_BLOCKED_CLOUDFLARE',
  SCRAPE_FAILED: 'SCRAPE_FAILED'
});

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const NAVIGATION_TIMEOUT_MS = Number.parseInt(process.env.SCRAPER_NAV_TIMEOUT_MS, 10) || 30000;
const CHALLENGE_WAIT_MS = Number.parseInt(process.env.SCRAPER_CHALLENGE_WAIT_MS, 10) || 7000;
const ENABLE_HTML_PARSER_FALLBACK = process.env.SCRAPER_ENABLE_PARSER_FALLBACK !== 'false';
const SCRAPER_HEADLESS = process.env.SCRAPER_HEADLESS !== 'false';
let cachedChromium = null;

const turndownService = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced'
});

class ScrapeError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = 'ScrapeError';
    this.code = code;
    this.cause = options.cause;
  }
}

function getChromium() {
  if (cachedChromium) {
    return cachedChromium;
  }

  ({ chromium: cachedChromium } = require('playwright'));
  return cachedChromium;
}

function isAllowedUpworkHost(hostname) {
  return ALLOWED_UPWORK_HOSTS.has(String(hostname || '').toLowerCase());
}

function assertAllowedUpworkHost(urlValue) {
  let parsed;
  try {
    parsed = new URL(urlValue);
  } catch {
    throw new ScrapeError(SCRAPE_ERROR_CODES.INVALID_URL, 'Invalid URL format');
  }

  if (!isAllowedUpworkHost(parsed.hostname)) {
    throw new ScrapeError(SCRAPE_ERROR_CODES.UNSUPPORTED_DOMAIN, 'Only Upwork job URLs are supported in this version');
  }
}

function validateUpworkUrl(inputUrl) {
  if (typeof inputUrl !== 'string' || !inputUrl.trim()) {
    throw new ScrapeError(SCRAPE_ERROR_CODES.INVALID_URL, 'A valid URL is required');
  }

  let parsed;
  try {
    parsed = new URL(inputUrl.trim());
  } catch {
    throw new ScrapeError(SCRAPE_ERROR_CODES.INVALID_URL, 'Invalid URL format');
  }

  if (parsed.protocol !== 'https:') {
    throw new ScrapeError(SCRAPE_ERROR_CODES.INVALID_URL, 'Only HTTPS URLs are supported');
  }

  assertAllowedUpworkHost(parsed.toString());

  parsed.hash = '';
  return parsed.toString();
}

function normalizeWhitespace(text) {
  if (!text) {
    return '';
  }

  return text
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function htmlToMarkdown(html) {
  if (!html) {
    return '';
  }

  const markdown = turndownService.turndown(html);
  return normalizeWhitespace(markdown);
}

function pickFirstText($, selectors = []) {
  for (const selector of selectors) {
    const el = $(selector).first();
    if (el.length) {
      const value = normalizeWhitespace(el.text());
      if (value) {
        return value;
      }
    }
  }
  return '';
}

function pickFirstAttr($, selectors = [], attr = 'content') {
  for (const selector of selectors) {
    const value = normalizeWhitespace($(selector).first().attr(attr) || '');
    if (value) {
      return value;
    }
  }
  return '';
}

function extractBudgetFromText(fullText) {
  if (!fullText) {
    return '';
  }

  const patterns = [
    /(\$\s?\d[\d,]*(?:\.\d{1,2})?\s?-\s?\$\s?\d[\d,]*(?:\.\d{1,2})?\s?(?:\/hr|per hour|hourly)?)/i,
    /(\$\s?\d[\d,]*(?:\.\d{1,2})?\s?(?:\/hr|per hour|hourly))/i,
    /(Budget\s*[:\-]?\s*\$\s?\d[\d,]*(?:\.\d{1,2})?(?:\s?-\s?\$\s?\d[\d,]*(?:\.\d{1,2})?)?)/i,
    /(Fixed\s*Price\s*[:\-]?\s*\$\s?\d[\d,]*(?:\.\d{1,2})?)/i
  ];

  for (const pattern of patterns) {
    const match = fullText.match(pattern);
    if (match?.[1]) {
      return normalizeWhitespace(match[1]);
    }
  }

  return '';
}

function extractSkillsFromText(fullText) {
  if (!fullText) {
    return [];
  }

  const sectionMatch = fullText.match(/Skills(?:\s+and\s+Expertise)?\s*[:\n]?([\s\S]{0,280})/i);
  if (!sectionMatch?.[1]) {
    return [];
  }

  return sectionMatch[1]
    .split(/[\n,|·•]/)
    .map((item) => normalizeWhitespace(item))
    .filter((item) => item.length > 1 && item.length < 40)
    .slice(0, 12);
}

function uniqueNonEmpty(values = []) {
  const out = [];
  const seen = new Set();

  for (const value of values) {
    const cleaned = normalizeWhitespace(value);
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) {
      continue;
    }

    seen.add(key);
    out.push(cleaned);
  }

  return out;
}

function detectCloudflareFromHtml(html) {
  if (!html) {
    return false;
  }

  const normalized = html.toLowerCase();
  return [
    'checking your browser before accessing',
    'just a moment...',
    'attention required! | cloudflare',
    'cf-browser-verification',
    'cdn-cgi/challenge-platform',
    'cf-turnstile'
  ].some((marker) => normalized.includes(marker));
}

function isLikelyCloudflareChallengePage(html, pageTitle = '') {
  const normalizedTitle = String(pageTitle || '').toLowerCase();
  const normalizedHtml = String(html || '').toLowerCase();

  const titleLooksLikeChallenge =
    normalizedTitle.includes('just a moment') ||
    normalizedTitle.includes('attention required');

  const hasChallengePath = normalizedHtml.includes('cdn-cgi/challenge-platform');
  const hasBrowserCheckText = normalizedHtml.includes('checking your browser before accessing');
  const hasChallengeMarker = detectCloudflareFromHtml(normalizedHtml);

  return titleLooksLikeChallenge || hasChallengePath || (hasChallengeMarker && hasBrowserCheckText);
}

function extractFromHtml(html, pageUrl, mode) {
  const $ = cheerio.load(html);

  const warnings = [];

  const title = uniqueNonEmpty([
    pickFirstText($, [
      'h1[data-test="job-title"]',
      'h1[data-test="job-title-text"]',
      'h1.air3-line-clamp',
      'h1'
    ]),
    pickFirstAttr($, ['meta[property="og:title"]'])
  ])[0] || '';

  const descriptionHtml = [
    $('[data-test="job-description-text"]').first().html(),
    $('[data-test="job-description"]').first().html(),
    $('section[data-test="JobDescription"]').first().html(),
    $('div[data-qa="job-description"]').first().html(),
    $('article').first().html()
  ].find((value) => Boolean(value));

  const description = normalizeWhitespace(
    descriptionHtml ? htmlToMarkdown(descriptionHtml) : pickFirstAttr($, ['meta[name="description"]'])
  );

  const pageText = normalizeWhitespace($('body').text());

  const budget = uniqueNonEmpty([
    pickFirstText($, [
      '[data-test="job-budget"]',
      '[data-test="is-fixed-price"]',
      '[data-test="hourly-rate"]',
      'li[data-test*="budget"]',
      'div[data-test*="budget"]'
    ]),
    extractBudgetFromText(pageText)
  ])[0] || '';

  const skills = uniqueNonEmpty([
    ...$('[data-test="job-skills"] [data-test="Token"], [data-test="Skills"] [data-test="Token"], a[data-test="link-skill"], span[data-test="skill"], .air3-token').map((_, el) => $(el).text()).get(),
    ...extractSkillsFromText(pageText)
  ]);

  if (!title) {
    warnings.push('Could not confidently detect job title');
  }
  if (!description) {
    warnings.push('Could not confidently detect job description');
  }
  if (!budget) {
    warnings.push('Budget was not found');
  }
  if (skills.length === 0) {
    warnings.push('Skills were not found');
  }

  if (!title || !description) {
    throw new ScrapeError(SCRAPE_ERROR_CODES.SCRAPE_FAILED, 'Could not extract required job details from this URL');
  }

  return {
    url: pageUrl,
    title,
    description,
    budget: budget || null,
    skills: skills.join(', '),
    mode,
    warnings
  };
}

async function detectCloudflareOnPage(page) {
  const title = await page.title().catch(() => '');
  const html = await page.content().catch(() => '');
  return isLikelyCloudflareChallengePage(html, title);
}

async function scrapeWithPlaywright(url) {
  const chromium = getChromium();
  const browser = await chromium.launch({ headless: SCRAPER_HEADLESS });
  let page;
  let context;

  try {
    context = await browser.newContext({
      userAgent: DEFAULT_USER_AGENT,
      viewport: { width: 1440, height: 1024 },
      locale: 'en-US'
    });

    page = await context.newPage();

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: NAVIGATION_TIMEOUT_MS
    });

    await page.waitForTimeout(1200);

    if (await detectCloudflareOnPage(page)) {
      await page.waitForTimeout(CHALLENGE_WAIT_MS);
      await page.waitForLoadState('domcontentloaded', { timeout: Math.min(NAVIGATION_TIMEOUT_MS, 15000) }).catch(() => {});
    }

    const finalUrl = page.url();
    assertAllowedUpworkHost(finalUrl);
    const finalTitle = await page.title().catch(() => '');
    const html = await page.content();
    const challengeLikely = isLikelyCloudflareChallengePage(html, finalTitle);

    try {
      const data = extractFromHtml(html, finalUrl, 'playwright');
      if (challengeLikely) {
        data.warnings = uniqueNonEmpty([
          ...data.warnings,
          'Cloudflare markers were detected; extracted data may be partial'
        ]);
      }
      return data;
    } catch (extractError) {
      if (challengeLikely) {
        throw new ScrapeError(
          SCRAPE_ERROR_CODES.SCRAPE_BLOCKED_CLOUDFLARE,
          'Could not fetch this URL due to page protection. Please fill fields manually and continue.',
          { cause: extractError }
        );
      }
      throw extractError;
    }
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    if (context) {
      await context.close().catch(() => {});
    }
    await browser.close().catch(() => {});
  }
}

async function scrapeWithParser(url) {
  const response = await axios.get(url, {
    timeout: NAVIGATION_TIMEOUT_MS,
    maxRedirects: 3,
    headers: {
      'User-Agent': DEFAULT_USER_AGENT,
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  const finalUrl = response.request?.res?.responseUrl || response.config?.url || url;
  assertAllowedUpworkHost(finalUrl);

  const contentType = String(response.headers?.['content-type'] || '').toLowerCase();
  if (contentType && !contentType.includes('text/html')) {
    throw new ScrapeError(
      SCRAPE_ERROR_CODES.SCRAPE_FAILED,
      'Could not extract job details from non-HTML response'
    );
  }

  const htmlContent = typeof response.data === 'string' ? response.data : String(response.data || '');
  const challengeLikely = isLikelyCloudflareChallengePage(htmlContent);

  try {
    const data = extractFromHtml(htmlContent, finalUrl, 'parser');
    data.warnings = uniqueNonEmpty([
      ...data.warnings,
      'Used parser fallback extraction mode'
    ]);
    if (challengeLikely) {
      data.warnings.push('Cloudflare markers were detected; extracted data may be partial');
    }
    return data;
  } catch (extractError) {
    if (challengeLikely) {
      throw new ScrapeError(
        SCRAPE_ERROR_CODES.SCRAPE_BLOCKED_CLOUDFLARE,
        'Could not fetch this URL due to page protection. Please fill fields manually and continue.',
        { cause: extractError }
      );
    }
    throw extractError;
  }
}

function normalizeScrapeError(error) {
  if (error instanceof ScrapeError) {
    return error;
  }

  return new ScrapeError(
    SCRAPE_ERROR_CODES.SCRAPE_FAILED,
    'Failed to fetch and parse this URL',
    { cause: error }
  );
}

async function scrapeJobUrl(rawUrl) {
  const safeUrl = validateUpworkUrl(rawUrl);

  try {
    return await scrapeWithPlaywright(safeUrl);
  } catch (error) {
    const normalizedError = normalizeScrapeError(error);

    if (!ENABLE_HTML_PARSER_FALLBACK) {
      throw normalizedError;
    }

    try {
      return await scrapeWithParser(safeUrl);
    } catch (fallbackError) {
      const fallbackNormalized = normalizeScrapeError(fallbackError);
      if (fallbackNormalized.code === SCRAPE_ERROR_CODES.SCRAPE_BLOCKED_CLOUDFLARE) {
        throw fallbackNormalized;
      }
      throw fallbackNormalized;
    }
  }
}

module.exports = {
  SCRAPE_ERROR_CODES,
  ScrapeError,
  scrapeJobUrl,
  validateUpworkUrl,
  normalizeScrapeError,
  __test: {
    isAllowedUpworkHost,
    assertAllowedUpworkHost,
    normalizeWhitespace,
    extractBudgetFromText,
    extractSkillsFromText,
    extractFromHtml,
    detectCloudflareFromHtml,
    isLikelyCloudflareChallengePage
  }
};
