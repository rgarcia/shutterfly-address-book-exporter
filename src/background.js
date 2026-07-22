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
const PENDING_EXPORT_PREFIX = "pendingAddressBookExport:";
const PENDING_EXPORT_TTL_MS = 60_000;

const activeExports = new Set();

function pendingExportKey(tabId) {
  return `${PENDING_EXPORT_PREFIX}${tabId}`;
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

  chrome.storage.session
    .set({
      [pendingExportKey(tabId)]: {
        expiresAt: Date.now() + PENDING_EXPORT_TTL_MS,
      },
    })
    .then(() => sendResponse({ accepted: true }))
    .catch((error) =>
      sendResponse({ accepted: false, error: error.message }),
    );

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

async function exportAddressBook(url, requestHeaders, tabId) {
  try {
    const contacts = await fetchAllContacts(url, getFetchHeaders(requestHeaders));
    await downloadCSV(convertToCSV(contacts));
  } catch (error) {
    console.error("Unable to export the Shutterfly address book:", error);
  } finally {
    activeExports.delete(tabId);
  }
}

async function handleAddressListRequest(details) {
  if (
    activeExports.has(details.tabId) ||
    details.method !== "GET" ||
    !isAddressListUrl(details.url)
  ) {
    return;
  }

  const key = pendingExportKey(details.tabId);
  const stored = await chrome.storage.session.get(key);
  if (activeExports.has(details.tabId)) {
    return;
  }

  const pendingExport = stored[key];
  if (!pendingExport) {
    return;
  }

  if (pendingExport.expiresAt < Date.now()) {
    await chrome.storage.session.remove(key);
    return;
  }

  activeExports.add(details.tabId);
  await chrome.storage.session.remove(key);
  await exportAddressBook(details.url, details.requestHeaders, details.tabId);
}

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    void handleAddressListRequest(details).catch((error) => {
      activeExports.delete(details.tabId);
      console.error("Unable to start the Shutterfly address book export:", error);
    });
  },
  { urls: ["https://accounts-api3.shutterfly.com/accounts/v3/account/*"] },
  ["requestHeaders", "extraHeaders"],
);
