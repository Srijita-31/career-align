const { CheerioCrawler, RequestList, log } = require('@crawlee/cheerio');
const { PlaywrightCrawler } = require('@crawlee/playwright');
const cheerio = require('cheerio');
const { appConfig, getJobSources, getJobTermLimit, sourceConfig } = require('../config');
const { recordScraperSourceResult } = require('./db');

const normalize = (value) => String(value || '').trim();
const cleanText = (value) => normalize(value).replace(/\s+/g, ' ');
const isValidUrl = (value) => {
  const url = String(value || '').trim();
  return /^https?:\/\//i.test(url) &&
    !/localhost|127\.0\.0\.1|example\.com|example\.|placeholder|dummy|fallback/i.test(url);
};
const sanitizeRelativeUrl = (value, baseUrl) => {
  const href = String(value || '').trim();
  if (!href) return '';
  if (/^https?:\/\//i.test(href)) return href;
  try {
    return new URL(href, baseUrl || 'https://example.com').toString();
  } catch (error) {
    return '';
  }
};

const inferWorkMode = ({ title = '', location = '', description = '', fallback = 'Onsite' } = {}) => {
  const text = `${title} ${location} ${description}`;
  if (/remote|work from home|wfh/i.test(text)) return 'Remote';
  if (/hybrid/i.test(text)) return 'Hybrid';
  if (/onsite|on site|office|in-office/i.test(text)) return 'Onsite';
  return fallback;
};

const buildDescription = (title, company, location, extra) => {
  const parts = [title, company, location, extra].filter(Boolean);
  const text = cleanText(parts.join(' - '));
  return text.length >= 60 ? text : `${text} - Live scraped job data from source`; 
};

const buildSearchTerms = (profile) => {
  const termLimit = getJobTermLimit();
  const terms = [];
  if (profile.desiredRole) terms.push(profile.desiredRole);
  if (profile.skills?.length) terms.push(...profile.skills.slice(0, 3));
  terms.push(...appConfig.defaultSearchTerms);
  return Array.from(new Set(terms.map((term) => normalize(term)).filter(Boolean))).slice(0, termLimit);
};

const sourceSettings = new Map(sourceConfig.sources.map((source) => [source.platform, source]));

const renderSearchUrl = (template, term, profile = {}) => {
  const location = normalize(profile.location || appConfig.defaultLocation);
  const replacements = {
    term: encodeURIComponent(term),
    termSlug: encodeURIComponent(normalize(term).replace(/\s+/g, '-')),
    location: encodeURIComponent(location),
  };
  return template.replace(/\{\{(term|termSlug|location)\}\}/g, (_, key) => replacements[key]);
};

const buildSourceUrls = (platform, terms, profile) => {
  const settings = sourceSettings.get(platform);
  return (settings?.searchUrls || [])
    .flatMap((template) => terms.map((term) => renderSearchUrl(template, term, profile)))
    .filter(Boolean);
};

const sourceDefinitions = [
  {
    name: 'RemoteOK',
    platform: 'RemoteOK',
    type: sourceSettings.get('RemoteOK')?.type || 'playwright',
    buildUrls: (terms, profile) => buildSourceUrls('RemoteOK', terms, profile),
    extract: async (page, request) => {
      await page.waitForSelector('table#jobsboard tr.job', { state: 'attached', timeout: 30000 });
      await page.waitForTimeout(2000);
      const jobs = await page.$$eval('table#jobsboard tr.job', (rows) =>
        rows
          .filter((row) => !row.classList.contains('placeholder') && !row.classList.contains('footer'))
          .map((row) => {
            const title = row.querySelector('td.position h2')?.innerText?.trim() || row.querySelector('h2')?.innerText?.trim() || row.getAttribute('data-position') || '';
            const company = row.querySelector('td.company h3')?.innerText?.trim() || row.getAttribute('data-company') || '';
            const location = row.querySelector('td.location')?.innerText?.trim() || row.getAttribute('data-location') || 'Remote';
            const href =
              row.querySelector('a.preventLink')?.getAttribute('href') ||
              row.querySelector('a[href*="/remote-jobs/"]')?.getAttribute('href') ||
              row.getAttribute('data-url') ||
              row.getAttribute('data-href') ||
              '';
            const link = href ? new URL(href, window.location.origin).toString() : '';
            const json = row.querySelector('script[type="application/ld+json"]')?.innerText;
            let description = '';
            let posted_date = '';
            if (json) {
              try {
                const parsed = JSON.parse(json);
                description = parsed.description?.replace(/<[^>]+>/g, ' ').trim() || '';
                posted_date = parsed.datePosted || parsed.datePostedRaw || '';
              } catch (err) {
                // ignore invalid JSON
              }
            }
            const tags = Array.from(row.querySelectorAll('div.tags a, div.tags span')).map((tag) => tag.innerText.trim()).filter(Boolean);
            const jobType = /intern|internship|trainee|fresher/i.test(title + tags.join(' ')) ? 'Internship' : 'Full-time';

            return {
              title,
              company,
              location,
              salary: '',
              job_type: jobType,
              work_mode: 'Remote',
              apply_url: link,
              description: description || `${title} at ${company} - ${location}`,
              skills: tags,
              source_platform: 'RemoteOK',
              posted_date,
            };
          }),
      );
      return { cards: jobs.length, jobs };
    },
  },
  {
    name: 'WeWorkRemotely',
    platform: 'WeWorkRemotely',
    type: sourceSettings.get('WeWorkRemotely')?.type || 'cheerio',
    buildUrls: (terms, profile) => buildSourceUrls('WeWorkRemotely', terms, profile),
    extract: ($, request) => {
      const rows = $('section.jobs article ul li').toArray();
      const jobs = rows
        .map((row) => {
          const $row = $(row);
          const anchor = $row.find('a[href^="/remote-jobs/"], a.listing-link--unlocked').first();
          const title = cleanText(
            $row.find('span.new-listing__header__title__text').text() ||
            anchor.find('span.title').text() ||
            anchor.find('h3').text() ||
            anchor.text(),
          );
          const company = cleanText($row.find('p.new-listing__company-name').text() || $row.find('span.company').text() || '');
          const location = cleanText($row.find('span.region').text()) || 'Remote';
          const apply_url = sanitizeRelativeUrl(anchor.attr('href') || $row.find('a').attr('href') || '', request.url);
          const description = cleanText(
            $row.find('div.new-listing__description').text() ||
            $row.find('p.new-listing__company-name').text() ||
            `${title} at ${company}`,
          );
          const tags = $row
            .find('span.listing-tag, .listing-tag, span.new-listing__header__icons__date span')
            .toArray()
            .map((tag) => cleanText($(tag).text()));
          const jobType = /intern|internship|trainee|fresher/i.test(title + description) ? 'Internship' : 'Full-time';
          const workMode = inferWorkMode({ title, location, description, fallback: 'Remote' });

          if (!title || !apply_url || /\/listing_ads\//i.test(apply_url) || /view company profile/i.test(title)) {
            return null;
          }

          return {
            title,
            company,
            location,
            salary: '',
            job_type: jobType,
            work_mode: workMode,
            apply_url,
            description,
            skills: tags.filter(Boolean),
            source_platform: 'WeWorkRemotely',
            posted_date: cleanText($row.find('time').text()),
          };
        })
        .filter(Boolean);
      return { cards: rows.length, jobs };
    },
  },
  {
    name: 'Internshala',
    platform: 'Internshala',
    type: sourceSettings.get('Internshala')?.type || 'playwright',
    buildUrls: (terms, profile) => buildSourceUrls('Internshala', terms, profile),
    extract: async (page, request) => {
      await page.waitForSelector('.individual_internship.view_detail_button', { timeout: 30000 });
      await page.waitForTimeout(1200);
      const jobs = await page.$$eval('.individual_internship.view_detail_button', (nodes) =>
        nodes.map((node) => {
          const title = node.querySelector('a.job-title-href')?.innerText?.trim() || '';
          const company = node.querySelector('.company-name')?.innerText?.trim() || '';
          const location = node.querySelector('.row-1-item.locations span')?.innerText?.trim() || node.querySelector('.row-1-item.locations')?.innerText?.trim() || 'India';
          const apply_url = node.querySelector('a.job-title-href')?.href || node.getAttribute('data-href') || '';
          const description = node.querySelector('.about_job .text')?.innerText?.trim() || '';
          const tags = Array.from(node.querySelectorAll('.job_skill')).map((tag) => tag.innerText.trim());
          const postedDate = node.querySelector('.detail-row-2 .status-success span')?.innerText?.trim() || '';
          const jobType = /intern|internship|trainee|fresher/.test(title + description) ? 'Internship' : 'Full-time';

          return {
            title,
            company,
            location,
            salary: node.querySelector('.stipend')?.innerText?.trim() || '',
            job_type: jobType,
            work_mode: inferWorkMode({ title, location, description }),
            apply_url,
            description,
            skills: tags,
            source_platform: 'Internshala',
            posted_date: postedDate,
          };
        }),
      );
      return { cards: jobs.length, jobs };
    },
  },
  {
    name: 'LinkedIn',
    platform: 'LinkedIn',
    type: sourceSettings.get('LinkedIn')?.type || 'cheerio',
    buildUrls: (terms, profile) => buildSourceUrls('LinkedIn', terms, profile),
    extract: ($, request) => {
      const rows = $('li, .job-search-card').toArray();
      const jobs = rows
        .map((row) => {
          const $row = $(row);
          const anchor = $row.find('a.base-card__full-link, a[href*="/jobs/view/"]').first();
          const title = cleanText(
            $row.find('.base-search-card__title').text() ||
            $row.find('h3').text() ||
            anchor.text(),
          );
          const company = cleanText($row.find('.base-search-card__subtitle').text() || $row.find('h4').text());
          const location = cleanText($row.find('.job-search-card__location').text()) || 'India';
          const apply_url = sanitizeRelativeUrl(anchor.attr('href'), request.url).split('?')[0];
          const posted_date = cleanText($row.find('time').attr('datetime') || $row.find('time').text());
          const description = buildDescription(title, company, location, posted_date);
          const jobType = /intern|internship|trainee|fresher/i.test(title) ? 'Internship' : 'Full-time';

          if (!title || !apply_url) return null;

          return {
            title,
            company,
            location,
            salary: '',
            job_type: jobType,
            work_mode: inferWorkMode({ title, location, description }),
            apply_url,
            description,
            skills: [],
            source_platform: 'LinkedIn',
            posted_date,
          };
        })
        .filter(Boolean);
      return { cards: rows.length, jobs };
    },
  },
  {
    name: 'Wellfound',
    platform: 'Wellfound',
    type: sourceSettings.get('Wellfound')?.type || 'playwright',
    buildUrls: (terms, profile) => buildSourceUrls('Wellfound', terms, profile),
    extract: async (page) => {
      await page.waitForSelector('a[data-test-job-tile], li[data-testid="job-card"], li.job-card', { timeout: 30000 });
      await page.waitForTimeout(1600);
      const jobs = await page.$$eval('a[data-test-job-tile], li[data-testid="job-card"], li.job-card', (nodes) =>
        nodes.map((node) => {
          const title = node.querySelector('h3')?.innerText?.trim() || node.querySelector('.job-title')?.innerText?.trim() || '';
          const company = node.querySelector('h4')?.innerText?.trim() || node.querySelector('.company-name')?.innerText?.trim() || '';
          const location = node.querySelector('.location')?.innerText?.trim() || node.querySelector('.job-location')?.innerText?.trim() || '';
          const apply_url = node.href || node.querySelector('a')?.href || '';
          const description = node.querySelector('.job-snippet')?.innerText?.trim() || '';
          const tags = Array.from(node.querySelectorAll('.tag, .skill-pill')).map((tag) => tag.innerText.trim());
          const postedDate = node.querySelector('time')?.innerText?.trim() || '';
          const jobType = /intern|internship|trainee|fresher/.test(title + description) ? 'Internship' : 'Full-time';
          const workMode = inferWorkMode({ title, location, description });

          return {
            title,
            company,
            location: location || 'India',
            salary: '',
            job_type: jobType,
            work_mode: workMode,
            apply_url,
            description,
            skills: tags,
            source_platform: 'Wellfound',
            posted_date: postedDate,
          };
        }),
      );
      return { cards: jobs.length, jobs };
    },
  },
  {
    name: 'Foundit',
    platform: 'Foundit',
    type: sourceSettings.get('Foundit')?.type || 'playwright',
    buildUrls: (terms, profile) => buildSourceUrls('Foundit', terms, profile),
    extract: async (page) => {
      await page.waitForSelector('article.job-card, .job-tile, .job-card', { timeout: 30000 });
      await page.waitForTimeout(1200);
      const jobs = await page.$$eval('article.job-card, .job-tile, .job-card', (nodes) =>
        nodes.map((node) => {
          const title = node.querySelector('h2.job-title, .job-title, .jobCard-title')?.innerText?.trim() || '';
          const company = node.querySelector('.company-name, .job-card__company-name')?.innerText?.trim() || '';
          const location = node.querySelector('.job-location, .jobCard-location')?.innerText?.trim() || '';
          const apply_url = node.querySelector('a')?.href || '';
          const description = node.querySelector('.job-summary, .job-description')?.innerText?.trim() || '';
          const tags = Array.from(node.querySelectorAll('ul.skill-tags li, .skills li')).map((tag) => tag.innerText.trim());
          const jobType = /intern|internship|trainee|fresher/.test(title + description) ? 'Internship' : 'Full-time';
          const workMode = inferWorkMode({ title, location, description });

          return {
            title,
            company,
            location: location || 'India',
            salary: '',
            job_type: jobType,
            work_mode: workMode,
            apply_url,
            description,
            skills: tags,
            source_platform: 'Foundit',
            posted_date: '',
          };
        }),
      );
      return { cards: jobs.length, jobs };
    },
  },
  {
    name: 'Naukri',
    platform: 'Naukri',
    type: sourceSettings.get('Naukri')?.type || 'playwright',
    buildUrls: (terms, profile) => buildSourceUrls('Naukri', terms, profile),
    extract: async (page) => {
      await page.waitForSelector('.srp-jobtuple-wrapper, div.jobTuple, .jobTuple, article.jobTuple', { timeout: 30000 });
      await page.waitForTimeout(1400);
      const jobs = await page.$$eval('.srp-jobtuple-wrapper, div.jobTuple, .jobTuple, article.jobTuple', (nodes) =>
        nodes.map((node) => {
          const titleAnchor = node.querySelector('a.title, .title a, a[href*="/job-listings-"]');
          const title = titleAnchor?.innerText?.trim() || node.querySelector('.title')?.innerText?.trim() || '';
          const company = node.querySelector('a.comp-name, a.subTitle, .companyInfo .subTitle, .companyName')?.innerText?.trim() || '';
          const location = node.querySelector('.locWdth, li.location, .location')?.innerText?.trim() || '';
          const apply_url = titleAnchor?.href || '';
          const description = node.querySelector('.job-desc, div.job-description, .job-description')?.innerText?.trim() || '';
          const tags = Array.from(node.querySelectorAll('ul.tags-gt li, ul.tags li, .tags li')).map((tag) => tag.innerText.trim());
          const salary = node.querySelector('.sal-wrap, .salary, li.salary')?.innerText?.trim() || '';
          const jobType = /intern|internship|trainee|fresher/.test(title + description) ? 'Internship' : 'Full-time';
          const workMode = inferWorkMode({ title, location, description });

          return {
            title,
            company,
            location: location || 'India',
            salary,
            job_type: jobType,
            work_mode: workMode,
            apply_url,
            description,
            skills: tags,
            source_platform: 'Naukri',
            posted_date: '',
          };
        }),
      );
      return { cards: jobs.length, jobs };
    },
  },
  {
    name: 'Indeed',
    platform: 'Indeed',
    type: sourceSettings.get('Indeed')?.type || 'playwright',
    buildUrls: (terms, profile) => buildSourceUrls('Indeed', terms, profile),
    extract: async (page) => {
      await page.waitForSelector('div.job_seen_beacon, a[data-jk], .jobsearch-SerpJobCard', { timeout: 30000 });
      await page.waitForTimeout(1400);
      const jobs = await page.$$eval('div.job_seen_beacon, .jobsearch-SerpJobCard', (nodes) =>
        nodes.map((node) => {
          const anchor = node.querySelector('h2.jobTitle a, a[data-jk], a.jcs-JobTitle');
          const title = anchor?.innerText?.replace(/\bnew\b/i, '').trim() || '';
          const company = node.querySelector('[data-testid="company-name"], .companyName')?.innerText?.trim() || '';
          const location = node.querySelector('[data-testid="text-location"], .companyLocation')?.innerText?.trim() || 'India';
          const href = anchor?.getAttribute('href') || '';
          const apply_url = href ? new URL(href, window.location.origin).toString() : '';
          const description = node.querySelector('.job-snippet, [data-testid="jobsnippet"]')?.innerText?.trim() || '';
          const salary = node.querySelector('.salary-snippet-container, [data-testid="attribute_snippet_testid"]')?.innerText?.trim() || '';
          const jobType = /intern|internship|trainee|fresher/i.test(title + description) ? 'Internship' : 'Full-time';

          return {
            title,
            company,
            location,
            salary,
            job_type: jobType,
            work_mode: inferWorkMode({ title, location, description }),
            apply_url,
            description,
            skills: [],
            source_platform: 'Indeed',
            posted_date: '',
          };
        }),
      );
      return { cards: jobs.length, jobs };
    },
  },
  {
    name: 'Glassdoor',
    platform: 'Glassdoor',
    type: sourceSettings.get('Glassdoor')?.type || 'playwright',
    buildUrls: (terms, profile) => buildSourceUrls('Glassdoor', terms, profile),
    extract: async (page) => {
      await page.waitForSelector('[data-test="jobListing"], li[data-test="jobListing"], .JobsList_jobListItem__wjTHv', { timeout: 30000 });
      await page.waitForTimeout(1400);
      const jobs = await page.$$eval('[data-test="jobListing"], li[data-test="jobListing"], .JobsList_jobListItem__wjTHv', (nodes) =>
        nodes.map((node) => {
          const anchor = node.querySelector('a[data-test="job-link"], a[href*="/job-listing/"], a[href*="/partner/jobListing"]');
          const title = node.querySelector('[data-test="job-title"], a[data-test="job-link"]')?.innerText?.trim() || anchor?.innerText?.trim() || '';
          const company = node.querySelector('[data-test="employer-name"], .EmployerProfile_compactEmployerName__LE242')?.innerText?.trim() || '';
          const location = node.querySelector('[data-test="job-location"], .JobCard_location__N_iYE')?.innerText?.trim() || 'India';
          const href = anchor?.getAttribute('href') || '';
          const apply_url = href ? new URL(href, window.location.origin).toString() : '';
          const salary = node.querySelector('[data-test="detailSalary"], .JobCard_salaryEstimate__QpbTW')?.innerText?.trim() || '';
          const description = [title, company, location, salary].filter(Boolean).join(' - ');
          const jobType = /intern|internship|trainee|fresher/i.test(title) ? 'Internship' : 'Full-time';

          return {
            title,
            company,
            location,
            salary,
            job_type: jobType,
            work_mode: inferWorkMode({ title, location, description }),
            apply_url,
            description,
            skills: [],
            source_platform: 'Glassdoor',
            posted_date: '',
          };
        }),
      );
      return { cards: jobs.length, jobs };
    },
  },
];

const configuredSources = getJobSources().map((source) => cleanText(source)).filter(Boolean);
const activeSourcePlatforms = new Set(configuredSources);

const fetchFullDescription = async (job) => {
  if (job.description && job.description.length > 500) {
    return job;
  }
  if (!isValidUrl(job.apply_url)) return job;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(job.apply_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!res.ok) return job;
    const html = await res.text();
    const $ = cheerio.load(html);
    
    let fullText = '';
    switch (job.source_platform) {
      case 'Internshala':
        fullText = $('.internship_details, .detail_view, .text-container').text();
        break;
      case 'LinkedIn':
        fullText = $('.show-more-less-html__markup, .description__text, div.core-section-container__content').text();
        break;
      case 'WeWorkRemotely':
        fullText = $('.listing-container, #job-listing-show-container').text();
        break;
      case 'Wellfound':
        fullText = $('.styles_description__2Xz19, .job-description, div[data-test="JobProfileAbout"]').text();
        break;
      case 'Naukri':
        fullText = $('.job-desc, .danger-html, section.job-desc').text();
        break;
      case 'Indeed':
        fullText = $('#jobDescriptionText').text();
        break;
      case 'Glassdoor':
        fullText = $('#JobDescriptionContainer, .desc').text();
        break;
      case 'Foundit':
        fullText = $('.job-description, #jobDescription').text();
        break;
      default:
        $('script, style, nav, header, footer').remove();
        fullText = $('body').text();
    }
    
    const cleaned = cleanText(fullText);
    if (cleaned && cleaned.length > job.description.length) {
      return { ...job, description: cleaned };
    }
  } catch (e) {
    // ignore
  }
  return job;
};

const enrichDescriptions = async (jobs) => {
  const result = [];
  for (let i = 0; i < jobs.length; i += 3) {
    const batch = jobs.slice(i, i + 3);
    const enrichedBatch = await Promise.all(batch.map(fetchFullDescription));
    result.push(...enrichedBatch);
  }
  return result;
};

const createRequestList = async (urls) => {
  return RequestList.open(`job-sources-${Date.now()}`, urls.map((url) => ({ url })));
};

const sourceUrlLimit = (source) => {
  const envLimit = Number(process.env.JOB_SOURCE_URL_LIMIT);
  if (Number.isFinite(envLimit) && envLimit > 0) return envLimit;
  return source.type === 'playwright' ? 2 : getJobTermLimit();
};

const scrapeSource = async (profile, source, options = {}) => {
  const terms = buildSearchTerms(profile);
  const urls = source.buildUrls(terms, profile).slice(0, sourceUrlLimit(source));
  if (!urls.length) {
    await recordScraperSourceResult({
      runId: options.runId,
      source: source.platform,
      status: 'empty',
      errorMessage: 'No search URLs configured for source.',
    });
    return [];
  }
  const requestList = await createRequestList(urls);
  const results = [];
  let cardsSeen = 0;
  let lastError = '';

  const crawlerOptions = {
    requestList,
    maxConcurrency: 1,
    maxRequestRetries: 0,
    navigationTimeoutSecs: 30,
    requestHandlerTimeoutSecs: 45,
    requestHandler: async ({ request, response, $ , page }) => {
      log.info(`[SCRAPER] Scraping ${source.platform}: ${request.url}`);
      try {
        const rawResult = await source.extract(page || $, request);
        const extracted = Array.isArray(rawResult) ? rawResult : rawResult.jobs || [];
        const cardCount = rawResult && typeof rawResult === 'object' && typeof rawResult.cards === 'number' ? rawResult.cards : extracted.length;
        cardsSeen += cardCount;
        const normalized = extracted
          .filter((job) => job.title && job.apply_url && isValidUrl(job.apply_url))
          .map((job) => ({
            ...job,
            source: source.platform,
            id: `${source.platform.toLowerCase()}-${cleanText(job.title || job.company || job.apply_url).replace(/\s+/g, '-')}-${Math.random().toString(36).slice(2, 7)}`,
          }));
        log.info(`[SCRAPER] ${source.platform}: Found ${cardCount} cards, extracted ${normalized.length} valid live jobs from ${request.url}`);
        if (!normalized.length && cardCount > 0) {
          log.info(`[SCRAPER] ${source.platform}: No valid live jobs could be extracted from ${request.url} after filtering by title and URL.`);
        }
        results.push(...normalized);
      } catch (error) {
        lastError = error.message;
        log.warning(`[SCRAPER] Extraction failed for ${source.platform}: ${error.message}`);
      }
    },
    failedRequestHandler: async ({ request, error }) => {
      lastError = error.message;
      log.warning(`[SCRAPER] Failed to load ${source.platform}: ${request.url} - ${error.message}`);
    },
  };

  const crawler = source.type === 'cheerio'
    ? new CheerioCrawler(crawlerOptions)
    : new PlaywrightCrawler({
        ...crawlerOptions,
        launchContext: {
          launchOptions: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
          },
        },
        preNavigationHooks: [
          async ({ page }) => {
            await page.setViewportSize({ width: 1280, height: 900 });
            await page.setExtraHTTPHeaders({
              'Accept-Language': 'en-US,en;q=0.9',
              'Upgrade-Insecure-Requests': '1',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36',
            });
            await page.route('**/*', (route) => {
              const resourceType = route.request().resourceType();
              if (['image', 'font', 'stylesheet'].includes(resourceType)) {
                route.abort();
              } else {
                route.continue();
              }
            });
            await page.waitForTimeout(250);
          },
        ],
      });

  await crawler.run();
  await recordScraperSourceResult({
    runId: options.runId,
    source: source.platform,
    status: results.length ? 'completed' : lastError ? 'failed' : 'empty',
    cardsSeen,
    jobsExtracted: results.length,
    errorMessage: lastError,
  });
  log.info(`[SCRAPER] Scraped ${results.length} jobs from ${source.platform}`);
  return results;
};

const runWithTimeout = (promise, ms, label) => {
  let timeout;
  const timer = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timer]).finally(() => clearTimeout(timeout));
};

const crawlJobSources = async (profile, options = {}) => {
  const jobs = [];
  const activeSources = sourceDefinitions
    .filter((source) => activeSourcePlatforms.has(source.platform))
    .sort((a, b) => (a.type === 'cheerio' ? 0 : 1) - (b.type === 'cheerio' ? 0 : 1));

  for (const source of activeSources) {
    try {
      const sourceTimeoutMs = Number(process.env.JOB_SOURCE_TIMEOUT_MS || 90000);
      const sourceJobs = await runWithTimeout(
        scrapeSource(profile, source, options),
        sourceTimeoutMs,
        source.platform
      );
      jobs.push(...sourceJobs);
    } catch (error) {
      await recordScraperSourceResult({
        runId: options.runId,
        source: source.platform,
        status: 'failed',
        errorMessage: error.message,
      });
      log.warning(`[SCRAPER] Skipping ${source.platform} due to error: ${error.message}`);
    }
  }

  const unique = new Map();
  jobs.forEach((job) => {
    // Fallback key: title + company + location
    const fallbackKey = `${cleanText(job.title)}|${cleanText(job.company)}|${cleanText(job.location)}`;
    // Primary key: apply_url without query params
    let urlKey = job.apply_url;
    try {
      const u = new URL(job.apply_url);
      u.search = '';
      urlKey = u.toString();
    } catch (e) {}
    
    const key = urlKey || fallbackKey;
    if (!unique.has(key)) {
      unique.set(key, job);
    }
  });

  const uniqueJobs = Array.from(unique.values());
  log.info(`[SCRAPER] Fetching full descriptions for ${uniqueJobs.length} jobs...`);
  const finalJobs = await enrichDescriptions(uniqueJobs);
  return finalJobs;
};

module.exports = { crawlJobSources };
