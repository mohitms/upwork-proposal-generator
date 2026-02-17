(() => {
  const API_ENDPOINT = 'https://upwork.webxhosts.in/api/extension/generate';
  const BUTTON_ID = 'upg-floating-button';
  const STYLE_ID = 'upg-popup-style';

  if (!isJobDetailPage(window.location.href)) {
    console.debug('[UPG] Not a supported Upwork job detail page.');
    return;
  }

  injectStyle();
  initFloatingButton();
  observeUrlChanges();

  function isJobDetailPage(url) {
    try {
      const u = new URL(url);
      return /(^|\.)upwork\.com$/.test(u.hostname) && /^\/(jobs|job)\//.test(u.pathname);
    } catch {
      return false;
    }
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const link = document.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('popup.css');
    document.head.appendChild(link);
  }

  function initFloatingButton() {
    if (document.getElementById(BUTTON_ID)) return;

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.textContent = 'Generate Proposal';
    button.setAttribute('aria-label', 'Generate Proposal');

    button.addEventListener('click', onGenerateClicked);
    document.body.appendChild(button);

    console.debug('[UPG] Floating button injected.');
  }

  async function onGenerateClicked() {
    const { createProposalModal } = await import(chrome.runtime.getURL('popup.js'));

    let modal;
    const run = async () => {
      modal.setLoading();

      try {
        const payload = scrapeJobAndClientData();
        console.debug('[UPG] Scraped payload:', payload);

        const response = await fetch(API_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const text = await response.text().catch(() => '');
          throw new Error(`API request failed (${response.status}) ${text || ''}`.trim());
        }

        const data = await response.json();
        if (!data?.success || !data?.proposal) {
          throw new Error('Backend did not return a valid proposal.');
        }

        modal.setResult(data.proposal);
      } catch (err) {
        console.error('[UPG] Proposal generation error:', err);
        modal.setError(err?.message || 'Unknown error occurred while generating proposal.');
      }
    };

    modal = await createProposalModal({
      onRetry: run,
      onClose: () => console.debug('[UPG] Modal closed.'),
      onCopy: async (text) => {
        await navigator.clipboard.writeText(text);
      }
    });

    document.body.appendChild(modal.element);
    modal.focus();
    run();
  }

  function scrapeJobAndClientData() {
    const titleSelectors = [
      '[data-test="job-title"]',
      '[data-test="up-job-title"]',
      '[data-testid="job-title"]',
      '[data-qa="job-title"]',
      'header h1',
      'main h1',
      'article h1',
      '.job-details-title',
      '.air3-card-section h1',
      'h1'
    ];
    const titleResult = firstTextWithMeta(titleSelectors);
    const title = titleResult.text;

    const description = firstText([
      '[data-test="job-description-text"]',
      '[data-test="Description"]',
      '[upc-name="description"]',
      '.job-description',
      '[data-test="up-job-description-text"]'
    ], true);

    const budgetSelectors = [
      '[data-test="job-type"]',
      '[data-test="job-type-label"]',
      '[data-test="budget"]',
      '[data-test="hourly-rate"]',
      '[data-test="fixed-price"]',
      '[data-testid="job-type"]',
      '[data-qa="job-type"]',
      '.js-budget',
      '.job-details [data-test*="budget"]',
      '.job-details [data-test*="rate"]',
      '.up-card-section [data-test*="budget"]',
      '.up-card-section [data-test*="rate"]',
      'section [data-test*="job-type"]'
    ];
    const budgetResult = firstTextWithMeta(budgetSelectors);
    const budgetRaw = budgetResult.text || findBudgetFromPageText();

    const budgetType = /hour|hr/i.test(budgetRaw) ? 'hourly' : 'fixed';
    const budget = extractBudget(budgetRaw);

    const skillSelectors = [
      '[data-test="token"]',
      '[data-test="skills"] a',
      '[data-test="skills"] [data-test*="skill"]',
      '[data-test*="skill"]',
      '[data-testid*="skill"]',
      '[data-cy*="skill"]',
      'a[data-test*="skill"]',
      '.air3-token',
      '.air3-pill',
      '.skills-list .air3-token'
    ];
    const skillsResult = uniqueTextsWithMeta(skillSelectors);
    const skills = skillsResult.texts;

    const categorySelectors = [
      '[data-test="job-category"]',
      '[data-test="category"]',
      '[data-testid="job-category"]',
      '[data-qa="job-category"]',
      'nav[aria-label*="breadcrumb" i] a:last-child',
      '.cfe-ui-job-breadcrumb a:last-child',
      '.up-breadcrumb a:last-child'
    ];
    const categoryResult = firstTextWithMeta(categorySelectors);
    const category = categoryResult.text || extractFromLabeledRows(['Category', 'Specialization']);

    const projectLength = extractFromLabeledRows(['Project length', 'Duration']);
    const hoursPerWeek = extractFromLabeledRows(['Hours per week', 'Hours needed']);
    const postedDate = firstText([
      '[data-test="posted-on"]',
      '[data-test="job-published-date"]',
      'small.text-muted'
    ]);

    const proposalsCount = extractInteger(
      extractFromLabeledRows(['Proposals', 'Proposals received']) || firstText(['[data-test="proposals-tier"]'])
    );

    const clientName = firstText([
      '[data-test="client-name"]',
      '.client-name',
      'section[data-test*="about-client"] h4'
    ]);

    const clientLocation = extractFromLabeledRows(['Location']) || firstText(['[data-test="client-location"]']);

    const paymentVerifiedText =
      extractFromLabeledRows(['Payment verified']) || firstText(['[data-test="payment-verified"]']);
    const paymentVerified = /verified|yes/i.test(paymentVerifiedText || '');

    const hires = extractInteger(extractFromLabeledRows(['Hires']) || firstText(['[data-test="client-hires"]']));

    const totalSpent = extractFromLabeledRows(['Total spent']) || firstText(['[data-test="client-spend"]']);

    const rating = extractFloat(
      extractFromLabeledRows(['Rating']) || firstText(['[data-test="client-rating"]', '[aria-label*="client rating"]'])
    );

    const jobsPosted = extractInteger(
      extractFromLabeledRows(['Jobs posted']) || firstText(['[data-test="client-jobs-posted"]'])
    );

    const hireRate = extractFromLabeledRows(['Hire rate']) || firstText(['[data-test="client-hire-rate"]']);

    const memberSince = extractFromLabeledRows(['Member since']) || firstText(['[data-test="member-since"]']);

    console.debug('[UPG] Title scrape:', {
      value: title,
      selector: titleResult.selector,
      tried: titleSelectors
    });
    console.debug('[UPG] Budget scrape:', {
      value: budget,
      raw: budgetRaw,
      selector: budgetResult.selector,
      tried: budgetSelectors
    });
    console.debug('[UPG] Skills scrape:', {
      values: skills,
      matchedSelectors: skillsResult.matchedSelectors,
      tried: skillSelectors
    });
    console.debug('[UPG] Category scrape:', {
      value: category,
      selector: categoryResult.selector,
      tried: categorySelectors
    });

    const payload = {
      job: {
        title,
        description,
        budget,
        budgetType,
        skills,
        category,
        projectLength,
        hoursPerWeek,
        postedDate,
        proposalsCount,
        url: window.location.href
      },
      client: {
        name: clientName,
        location: clientLocation,
        paymentVerified,
        hires,
        totalSpent,
        rating,
        jobsPosted,
        hireRate,
        memberSince
      }
    };

    return payload;
  }

  function firstText(selectors, preserveLineBreaks = false) {
    return firstTextWithMeta(selectors, preserveLineBreaks).text;
  }

  function firstTextWithMeta(selectors, preserveLineBreaks = false) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) continue;
      const text = normalizeText(preserveLineBreaks ? el.innerText : el.textContent, preserveLineBreaks);
      if (text) return { text, selector };
    }
    return { text: '', selector: '' };
  }

  function uniqueTexts(selectors) {
    return uniqueTextsWithMeta(selectors).texts;
  }

  function uniqueTextsWithMeta(selectors) {
    const values = new Set();
    const matchedSelectors = [];

    for (const selector of selectors) {
      const els = document.querySelectorAll(selector);
      if (els.length) matchedSelectors.push(`${selector} (${els.length})`);

      els.forEach((el) => {
        const text = normalizeText(el.textContent);
        if (text) values.add(text);
      });
    }

    return {
      texts: Array.from(values),
      matchedSelectors
    };
  }

  function normalizeText(value, preserveLineBreaks = false) {
    if (!value) return '';
    if (preserveLineBreaks) {
      return value
        .replace(/\u00a0/g, ' ')
        .replace(/\r/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }
    return value.replace(/\s+/g, ' ').trim();
  }

  function extractFromLabeledRows(labelCandidates) {
    const rows = document.querySelectorAll('li, div, section, p, span');

    for (const row of rows) {
      const text = normalizeText(row.textContent);
      if (!text) continue;

      for (const label of labelCandidates) {
        const re = new RegExp(`^${escapeRegex(label)}\\s*:?[\\s-]*(.+)$`, 'i');
        const match = text.match(re);
        if (match?.[1]) return normalizeText(match[1]);

        if (text.toLowerCase() === label.toLowerCase()) {
          const sibling = row.nextElementSibling;
          const siblingText = normalizeText(sibling?.textContent || '');
          if (siblingText) return siblingText;
        }
      }
    }

    return '';
  }

  function findBudgetFromPageText() {
    const text = normalizeText(document.body?.innerText || '');
    if (!text) return '';

    const hourly = text.match(/\$\s?[\d,.]+\s*-\s*\$\s?[\d,.]+\s*\/\s*hr/i);
    if (hourly?.[0]) return hourly[0];

    const fixed = text.match(/Fixed\s*price[^\n$]*(\$\s?[\d,.]+)/i);
    if (fixed?.[0]) return fixed[0];

    const general = text.match(/(Hourly\s*[:\-]?\s*)?\$\s?[\d,.]+(?:\s*-\s*\$\s?[\d,.]+)?(\s*\/\s*hr)?/i);
    return general?.[0] || '';
  }

  function extractBudget(raw) {
    if (!raw) return '';
    const moneyRanges = raw.match(/\$\s?[\d,.]+(?:\s*-\s*\$\s?[\d,.]+)?(?:\s*\/\s*hr)?/gi);
    if (moneyRanges?.length) return moneyRanges.map((v) => normalizeText(v)).join(' · ');
    return raw;
  }

  function extractInteger(value) {
    if (!value) return 0;
    const m = String(value).replace(/,/g, '').match(/\d+/);
    return m ? Number(m[0]) : 0;
  }

  function extractFloat(value) {
    if (!value) return 0;
    const m = String(value).replace(/,/g, '').match(/\d+(\.\d+)?/);
    return m ? Number(m[0]) : 0;
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function observeUrlChanges() {
    const observer = new MutationObserver(() => {
      const onJobPage = isJobDetailPage(window.location.href);
      const button = document.getElementById(BUTTON_ID);

      if (onJobPage && !button) {
        initFloatingButton();
      }

      if (!onJobPage && button) {
        button.remove();
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }
})();
