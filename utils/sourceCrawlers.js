const { CheerioCrawler, RequestList, log } = require('@crawlee/cheerio');
const { PlaywrightCrawler } = require('@crawlee/playwright');

const normalize = (value) => String(value || '').trim();
const cleanText = (value) => normalize(value).replace(/\s+/g, ' ');

const buildSearchTerms = (profile) => {
  const terms = [];
  if (profile.desiredRole) terms.push(profile.desiredRole);
  if (profile.skills?.length) terms.push(...profile.skills.slice(0, 3));
  terms.push(
    'software engineer',
    'frontend developer',
    'backend developer',
    'python developer',
    'react developer',
    'AI/ML intern',
    'data analyst',
    'cloud engineer',
    'internship',
    'fresher',
    'entry level',
  );
  return Array.from(new Set(terms.map((term) => normalize(term)).filter(Boolean))).slice(0, 6);
};

const buildLocation = (profile) => {
  if (/remote/.test(normalize(profile.workPreference))) return 'Remote';
  if (profile.location) return profile.location;
  return 'India';
};

const buildRemoteOKUrl = (term) => {
  const query = normalize(term).replace(/\s+/g, '-');
  return `https://remoteok.com/remote-${encodeURIComponent(query)}-jobs`;
};

const buildWeWorkRemoteUrl = (term) => {
  return `https://weworkremotely.com/remote-jobs/search?term=${encodeURIComponent(term)}`;
};

const buildInternshalaUrl = (term) => {
  return `https://internshala.com/internships/${encodeURIComponent(term.replace(/\s+/g, '-'))}?location=India`;
};

const buildWellfoundUrl = (term) => {
  return `https://wellfound.com/jobs?query=${encodeURIComponent(term)}&remote=true&locations=India`;
};

const buildFounditUrl = (term) => {
  return `https://www.foundit.in/jobs?searchTerm=${encodeURIComponent(term)}&location=India`;
};

const buildNaukriUrl = (term) => {
  const query = normalize(term).replace(/\s+/g, '-');
  return `https://www.naukri.com/${encodeURIComponent(query)}-jobs-in-india`;
};

const sourceDefinitions = [
  {
    name: 'RemoteOK',
    platform: 'RemoteOK',
    type: 'cheerio',
    buildUrls: (terms) => terms.map(buildRemoteOKUrl),
    extract: ($, request) => {
      return $('table#jobsboard tr.job')
        .toArray()
        .map((row) => {
          const $row = $(row);
          const title = cleanText($row.find('td.position h2').text() || $row.attr('data-position'));
          const company = cleanText($row.attr('data-company') || $row.find('td.company .companyLink').text());
          const location = cleanText($row.find('div.location').text() || $row.attr('data-location'));
          const salary = cleanText($row.find('td.salary').text());
          const tags = $row
            .find('td.tags a, td.tags span')
            .toArray()
            .map((tag) => cleanText($(tag).text()));
          const link = $row.find('td.company a.preventLink').attr('href') || $row.attr('data-url');
          const apply_url = link ? (link.startsWith('http') ? link : `https://remoteok.com${link}`) : request.url;
          const jobType = /intern|internship|trainee|fresher/.test(title + tags.join(' ')) ? 'Internship' : 'Full-time';
          const workMode = 'Remote';

          return {
            title,
            company,
            location: location || 'Remote',
            salary,
            job_type: jobType,
            work_mode: workMode,
            apply_url,
            description: cleanText($row.find('td.description').text()),
            skills: tags,
            source_platform: 'RemoteOK',
            posted_date: cleanText($row.find('td.time').text()),
          };
        })
        .filter((job) => job.title && job.company);
    },
  },
  {
    name: 'WeWorkRemotely',
    platform: 'WeWorkRemotely',
    type: 'cheerio',
    buildUrls: (terms) => terms.map(buildWeWorkRemoteUrl),
    extract: ($) => {
      return $('section.jobs article ul li')
        .toArray()
        .map((row) => {
          const $row = $(row);
          const anchor = $row.find('a').first();
          const title = cleanText($row.find('span.title').text() || anchor.text());
          const company = cleanText($row.find('span.company').text());
          const location = cleanText($row.find('span.region').text());
          const apply_url = anchor.attr('href') ? `https://weworkremotely.com${anchor.attr('href')}` : '';
          const jobType = /intern|internship|trainee|fresher/.test(title) ? 'Internship' : 'Full-time';
          const workMode = /remote/i.test(location) ? 'Remote' : 'Onsite';

          return {
            title,
            company,
            location: location || 'Remote',
            salary: '',
            job_type: jobType,
            work_mode: workMode,
            apply_url,
            description: cleanText($row.find('span.company').text()),
            skills: [],
            source_platform: 'WeWorkRemotely',
            posted_date: cleanText($row.find('time').text()),
          };
        })
        .filter((job) => job.title && job.company && job.apply_url);
    },
  },
  {
    name: 'Internshala',
    platform: 'Internshala',
    type: 'playwright',
    buildUrls: (terms) => terms.map(buildInternshalaUrl),
    extract: async (page) => {
      await page.waitForTimeout(1200);
      return page.$$eval('div.internship_meta', (nodes) =>
        nodes.map((node) => {
          const title = node.querySelector('div.profile h3')?.innerText?.trim() || '';
          const company = node.querySelector('div.company_name a')?.innerText?.trim() || '';
          const location = node.querySelector('div.location_link span')?.innerText?.trim() || '';
          const apply_url = node.querySelector('a.profile')?.href || '';
          const description = node.querySelector('div.internship_description')?.innerText?.trim() || '';
          const tags = Array.from(node.querySelectorAll('div.profile .info, .internship_tags li')).map((tag) => tag.innerText.trim());
          const postedDate = node.querySelector('div.other_details_item span')?.innerText?.trim() || '';
          const jobType = /intern|internship|trainee|fresher/.test(title + description) ? 'Internship' : 'Full-time';

          return {
            title,
            company,
            location: location || 'India',
            salary: '',
            job_type: jobType,
            work_mode: /remote/.test(description.toLowerCase()) ? 'Remote' : 'Hybrid',
            apply_url,
            description,
            skills: tags,
            source_platform: 'Internshala',
            posted_date: postedDate,
          };
        }),
      );
    },
  },
  {
    name: 'Wellfound',
    platform: 'Wellfound',
    type: 'playwright',
    buildUrls: (terms) => terms.map(buildWellfoundUrl),
    extract: async (page) => {
      await page.waitForTimeout(1600);
      return page.$$eval('a[data-test-job-tile], li[data-testid="job-card"], li.job-card', (nodes) =>
        nodes.map((node) => {
          const title = node.querySelector('h3')?.innerText?.trim() || node.querySelector('.job-title')?.innerText?.trim() || '';
          const company = node.querySelector('h4')?.innerText?.trim() || node.querySelector('.company-name')?.innerText?.trim() || '';
          const location = node.querySelector('.location')?.innerText?.trim() || node.querySelector('.job-location')?.innerText?.trim() || '';
          const apply_url = node.href || node.querySelector('a')?.href || '';
          const description = node.querySelector('.job-snippet')?.innerText?.trim() || '';
          const tags = Array.from(node.querySelectorAll('.tag, .skill-pill')).map((tag) => tag.innerText.trim());
          const postedDate = node.querySelector('time')?.innerText?.trim() || '';
          const jobType = /intern|internship|trainee|fresher/.test(title + description) ? 'Internship' : 'Full-time';
          const workMode = /(remote|work from home|wfh)/i.test(description) ? 'Remote' : 'Hybrid';

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
    },
  },
  {
    name: 'Foundit',
    platform: 'Foundit',
    type: 'playwright',
    buildUrls: (terms) => terms.map(buildFounditUrl),
    extract: async (page) => {
      await page.waitForTimeout(1200);
      return page.$$eval('article.job-card, .job-tile, .job-card', (nodes) =>
        nodes.map((node) => {
          const title = node.querySelector('h2.job-title, .job-title, .jobCard-title')?.innerText?.trim() || '';
          const company = node.querySelector('.company-name, .job-card__company-name')?.innerText?.trim() || '';
          const location = node.querySelector('.job-location, .jobCard-location')?.innerText?.trim() || '';
          const apply_url = node.querySelector('a')?.href || '';
          const description = node.querySelector('.job-summary, .job-description')?.innerText?.trim() || '';
          const tags = Array.from(node.querySelectorAll('ul.skill-tags li, .skills li')).map((tag) => tag.innerText.trim());
          const jobType = /intern|internship|trainee|fresher/.test(title + description) ? 'Internship' : 'Full-time';
          const workMode = /(remote|work from home|wfh)/i.test(description) ? 'Remote' : 'Hybrid';

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
    },
  },
  {
    name: 'Naukri',
    platform: 'Naukri',
    type: 'playwright',
    buildUrls: (terms) => terms.map(buildNaukriUrl),
    extract: async (page) => {
      await page.waitForTimeout(1400);
      return page.$$eval('div.jobTuple, .jobTuple', (nodes) =>
        nodes.map((node) => {
          const title = node.querySelector('a.title')?.innerText?.trim() || '';
          const company = node.querySelector('a.subTitle, .companyInfo .subTitle')?.innerText?.trim() || '';
          const location = node.querySelector('li.location, .location')?.innerText?.trim() || '';
          const apply_url = node.querySelector('a.title')?.href || '';
          const description = node.querySelector('div.job-description, .job-description')?.innerText?.trim() || '';
          const tags = Array.from(node.querySelectorAll('ul.tags li, .tags li')).map((tag) => tag.innerText.trim());
          const salary = node.querySelector('.salary, li.salary')?.innerText?.trim() || '';
          const jobType = /intern|internship|trainee|fresher/.test(title + description) ? 'Internship' : 'Full-time';
          const workMode = /(remote|work from home|wfh)/i.test(description) ? 'Remote' : 'Hybrid';

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
    },
  },
];

const createRequestList = async (urls) => {
  return RequestList.open(`job-sources-${Date.now()}`, urls.map((url) => ({ url })));
};

const scrapeSource = async (profile, source) => {
  const terms = buildSearchTerms(profile);
  const urls = source.buildUrls(terms);
  const requestList = await createRequestList(urls);
  const results = [];

  const crawlerOptions = {
    requestList,
    maxConcurrency: 1,
    navigationTimeoutSecs: 30,
    requestHandler: async ({ request, response, $ , page }) => {
      log.info(`[SCRAPER] Scraping ${source.platform}: ${request.url}`);
      try {
        const extracted = await source.extract(page || $, request);
        const normalized = extracted
          .filter((job) => job.title && job.company && job.apply_url)
          .map((job) => ({
            ...job,
            source: source.platform,
            id: `${source.platform.toLowerCase()}-${cleanText(job.title || job.company).replace(/\s+/g, '-')}-${Math.random().toString(36).slice(2, 7)}`,
          }));
        results.push(...normalized);
      } catch (error) {
        log.warning(`[SCRAPER] Extraction failed for ${source.platform}: ${error.message}`);
      }
    },
    failedRequestHandler: async ({ request, error }) => {
      log.warning(`[SCRAPER] Failed to load ${source.platform}: ${request.url} — ${error.message}`);
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
      });

  await crawler.run();
  log.info(`[SCRAPER] Scraped ${results.length} jobs from ${source.platform}`);
  return results;
};

const crawlJobSources = async (profile) => {
  const jobs = [];
  for (const source of sourceDefinitions) {
    try {
      const sourceJobs = await scrapeSource(profile, source);
      jobs.push(...sourceJobs);
    } catch (error) {
      log.warning(`[SCRAPER] Skipping ${source.platform} due to error: ${error.message}`);
    }
  }

  const unique = new Map();
  jobs.forEach((job) => {
    const key = `${cleanText(job.title)}|${cleanText(job.company)}|${cleanText(job.location)}|${cleanText(job.apply_url)}`;
    if (!unique.has(key)) {
      unique.set(key, job);
    }
  });

  return Array.from(unique.values());
};

module.exports = { crawlJobSources };

