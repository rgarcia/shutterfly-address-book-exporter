const {
  convertToCSV,
  fetchAllContacts,
  getReplayHeaders,
  isAddressListUrl,
} = require("./address-book");

const REQUEST_CACHE_PREFIX = "addressBookRequest:";

function requestCacheKey(tabId) {
  return `${REQUEST_CACHE_PREFIX}${tabId}`;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== "exportAddressBook") {
    return;
  }

  if (sender.tab?.id == null) {
    sendResponse({ error: "Reload the address book and try again." });
    return;
  }

  exportCachedAddressBook(sender.tab.id)
    .then(() => sendResponse({ ok: true }))
    .catch((error) => {
      console.error("Unable to export the Shutterfly address book:", error);
      sendResponse({ error: "Reload the address book and try again." });
    });

  return true;
});

async function downloadCSV(csvContent) {
  const url = `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`;

  await new Promise((resolve, reject) => {
    let downloadId;
    const finish = (error) => {
      chrome.downloads.onChanged.removeListener(onChanged);
      error ? reject(error) : resolve();
    };
    const onChanged = (change) => {
      if (change.id !== downloadId || !change.state) {
        return;
      }
      finish(
        change.state.current === "complete"
          ? null
          : new Error(change.error?.current || "Download interrupted"),
      );
    };

    chrome.downloads.onChanged.addListener(onChanged);
    chrome.downloads.download(
      { url, filename: "addressbook.csv", saveAs: false },
      (id) => {
        if (chrome.runtime.lastError) {
          finish(new Error(chrome.runtime.lastError.message));
          return;
        }
        downloadId = id;
      },
    );
  });
}

async function exportCachedAddressBook(tabId) {
  const key = requestCacheKey(tabId);
  const stored = await chrome.storage.session.get(key);
  const cachedRequest = stored[key];

  if (!cachedRequest) {
    throw new Error("No address book request has been captured");
  }

  const contacts = await fetchAllContacts(cachedRequest.url, cachedRequest.headers);
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
      headers: getReplayHeaders(details.requestHeaders),
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
