let currentScrapePromise = null;
let lastScrapeResult = null;
let lastScrapeTime = 0;

const getCurrentScrape = () => currentScrapePromise;

const setCurrentScrape = (promise) => {
  currentScrapePromise = promise;
  if (promise) {
    promise.then((result) => {
      lastScrapeResult = result;
      lastScrapeTime = Date.now();
      if (currentScrapePromise === promise) {
        currentScrapePromise = null;
      }
    }).catch(() => {
      if (currentScrapePromise === promise) {
        currentScrapePromise = null;
      }
    });
  }
};

const waitForScrape = async (timeoutMs = 120000) => {
  if (currentScrapePromise) {
    const result = await Promise.race([
      currentScrapePromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Scrape timeout')), timeoutMs))
    ]);
    return result;
  }
  return lastScrapeResult || { scrapedCount: 0, totalPersisted: 0, inserted: 0 };
};

const getScrapeStatus = () => ({
  running: currentScrapePromise !== null,
  lastScrapeTime: lastScrapeTime ? new Date(lastScrapeTime).toISOString() : null,
  lastScrapeResult,
});

module.exports = { getCurrentScrape, setCurrentScrape, waitForScrape, getScrapeStatus };