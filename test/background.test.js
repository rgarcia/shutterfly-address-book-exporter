const assert = require("node:assert/strict");
const test = require("node:test");

const BACKGROUND_PATH = require.resolve("../src/background");
const ADDRESS_URL =
  "https://accounts-api3.shutterfly.com/accounts/v3/account/123/address?queryStart=1&queryLimit=100";

function createChromeMock(sessionStore) {
  const state = {
    downloads: [],
    messageListener: null,
    webRequestListener: null,
  };

  const chrome = {
    downloads: {
      download(options, callback) {
        state.downloads.push(options);
        callback(state.downloads.length);
      },
    },
    runtime: {
      lastError: null,
      onMessage: {
        addListener(listener) {
          state.messageListener = listener;
        },
      },
    },
    storage: {
      session: {
        async get(key) {
          return key in sessionStore ? { [key]: sessionStore[key] } : {};
        },
        async set(values) {
          Object.assign(sessionStore, values);
        },
      },
    },
    webRequest: {
      onBeforeSendHeaders: {
        addListener(listener) {
          state.webRequestListener = listener;
        },
      },
    },
  };

  return { chrome, state };
}

function loadBackground(mock) {
  delete require.cache[BACKGROUND_PATH];
  global.chrome = mock.chrome;
  require(BACKGROUND_PATH);
}

function requestExport(listener, tabId) {
  return new Promise((resolve) => {
    const keepAlive = listener(
      { action: "exportAddressBook" },
      { tab: { id: tabId } },
      resolve,
    );
    assert.equal(keepAlive, true);
  });
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail("Timed out waiting for background work");
}

test("exports cached requests without navigating or mixing tabs", async (t) => {
  const originalFetch = global.fetch;
  const sessionStore = {};

  t.after(() => {
    global.fetch = originalFetch;
    delete global.chrome;
    delete require.cache[BACKGROUND_PATH];
  });

  const firstWorker = createChromeMock(sessionStore);
  loadBackground(firstWorker);
  firstWorker.state.webRequestListener({
    method: "GET",
    requestHeaders: [{ name: "Authorization", value: "token-11" }],
    tabId: 11,
    url: ADDRESS_URL,
  });
  firstWorker.state.webRequestListener({
    method: "GET",
    requestHeaders: [{ name: "Authorization", value: "token-22" }],
    tabId: 22,
    url: ADDRESS_URL,
  });

  await waitFor(() => Object.keys(sessionStore).length === 2);
  assert.deepEqual(Object.keys(sessionStore).sort(), [
    "addressBookRequest:11",
    "addressBookRequest:22",
  ]);

  const seenTokens = [];
  global.fetch = async (url, options) => {
    seenTokens.push(options.headers.Authorization);
    return {
      ok: true,
      json: async () => ({ resources: [], totalResources: 0 }),
    };
  };

  const restartedWorker = createChromeMock(sessionStore);
  loadBackground(restartedWorker);
  const responses = await Promise.all([
    requestExport(restartedWorker.state.messageListener, 11),
    requestExport(restartedWorker.state.messageListener, 22),
  ]);

  assert.deepEqual(responses, [{ accepted: true }, { accepted: true }]);
  assert.deepEqual(seenTokens.sort(), ["token-11", "token-22"]);
  assert.equal(restartedWorker.state.downloads.length, 2);
});

test("rejects a duplicate export while the same tab is active", async (t) => {
  const originalFetch = global.fetch;
  const sessionStore = {
    "addressBookRequest:33": {
      capturedAt: Date.now(),
      headers: {},
      url: ADDRESS_URL,
    },
  };
  let finishFetch;

  t.after(() => {
    global.fetch = originalFetch;
    delete global.chrome;
    delete require.cache[BACKGROUND_PATH];
  });

  global.fetch = () =>
    new Promise((resolve) => {
      finishFetch = () =>
        resolve({
          ok: true,
          json: async () => ({ resources: [], totalResources: 0 }),
        });
    });

  const worker = createChromeMock(sessionStore);
  loadBackground(worker);
  const first = requestExport(worker.state.messageListener, 33);
  const second = await new Promise((resolve) => {
    worker.state.messageListener(
      { action: "exportAddressBook" },
      { tab: { id: 33 } },
      resolve,
    );
  });

  assert.deepEqual(second, {
    accepted: false,
    error: "An export is already in progress.",
  });

  await waitFor(() => typeof finishFetch === "function");
  finishFetch();
  assert.deepEqual(await first, { accepted: true });
  assert.equal(worker.state.downloads.length, 1);
});
