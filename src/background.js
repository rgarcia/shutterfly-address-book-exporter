const {
  convertToCSV,
  fetchAllContacts,
  isAddressListUrl,
} = require("./address-book");

const FETCH_HEADER_NAMES = new Set([
  "accept",
  "accountid",
  "authorization",
  "gsid",
  "noodle",
  "sfly-transactionid",
  "x-api-key",
]);
const REQUEST_CACHE_PREFIX = "addressBookRequest:";
const REQUEST_CACHE_TTL_MS = 60 * 60 * 1000;

const activeExports = new Set();

function requestCacheKey(tabId) {
  return `${REQUEST_CACHE_PREFIX}${tabId}`;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== "exportAddressBook") {
    return;
  }

  if (sender.tab?.id == null) {
    sendResponse({ accepted: false, error: "The Shutterfly tab was not found." });
    return;
  }

  const tabId = sender.tab.id;
  if (activeExports.has(tabId)) {
    sendResponse({ accepted: false, error: "An export is already in progress." });
    return;
  }

  activeExports.add(tabId);
  exportCachedAddressBook(tabId)
    .then(() => sendResponse({ accepted: true }))
    .catch((error) => {
      console.error("Unable to export the Shutterfly address book:", error);
      sendResponse({ accepted: false, error: error.message });
    })
    .finally(() => activeExports.delete(tabId));

  return true;
});

function getFetchHeaders(requestHeaders = []) {
  return Object.fromEntries(
    requestHeaders
      .filter(({ name, value }) =>
        value != null && FETCH_HEADER_NAMES.has(name.toLowerCase()),
      )
      .map(({ name, value }) => [name, value]),
  );
}

async function downloadCSV(csvContent) {
  const url = `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`;

  await new Promise((resolve, reject) => {
    chrome.downloads.download(
      {
        url,
        filename: "addressbook.csv",
        saveAs: false,
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(downloadId);
      },
    );
  });
}

async function exportCachedAddressBook(tabId) {
  const key = requestCacheKey(tabId);
  const stored = await chrome.storage.session.get(key);
  const cachedRequest = stored[key];

  if (
    !cachedRequest ||
    cachedRequest.capturedAt + REQUEST_CACHE_TTL_MS < Date.now()
  ) {
    throw new Error("Reload the address book page, then try exporting again.");
  }

  const contacts = await fetchAllContacts(
    cachedRequest.url,
    cachedRequest.headers,
  );
  await downloadCSV(convertToCSV(contacts));
}

async function cacheAddressListRequest(details) {
  if (
    details.tabId < 0 ||
    details.method !== "GET" ||
    !isAddressListUrl(details.url)
  ) {
    return;
  }

  await chrome.storage.session.set({
    [requestCacheKey(details.tabId)]: {
      capturedAt: Date.now(),
      headers: getFetchHeaders(details.requestHeaders),
      url: details.url,
    },
  });
}

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    void cacheAddressListRequest(details).catch((error) => {
      console.error("Unable to cache the Shutterfly address book request:", error);
    });
  },
  { urls: ["https://accounts-api3.shutterfly.com/accounts/v3/account/*"] },
  ["requestHeaders", "extraHeaders"],
);
