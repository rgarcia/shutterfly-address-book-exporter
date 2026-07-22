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
        async remove(key) {
          delete sessionStore[key];
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

function armExport(listener, tabId) {
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

test("keeps concurrent pending exports tab-scoped across a worker restart", async (t) => {
  const originalFetch = global.fetch;
  const sessionStore = {};

  t.after(() => {
    global.fetch = originalFetch;
    delete global.chrome;
    delete require.cache[BACKGROUND_PATH];
  });

  const firstWorker = createChromeMock(sessionStore);
  loadBackground(firstWorker);
  await Promise.all([
    armExport(firstWorker.state.messageListener, 11),
    armExport(firstWorker.state.messageListener, 22),
  ]);

  assert.deepEqual(Object.keys(sessionStore).sort(), [
    "pendingAddressBookExport:11",
    "pendingAddressBookExport:22",
  ]);

  global.fetch = async () => ({
    ok: true,
    json: async () => ({ resources: [], totalResources: 0 }),
  });

  const restartedWorker = createChromeMock(sessionStore);
  loadBackground(restartedWorker);
  restartedWorker.state.webRequestListener({
    method: "GET",
    requestHeaders: [],
    tabId: 11,
    url: ADDRESS_URL,
  });
  restartedWorker.state.webRequestListener({
    method: "GET",
    requestHeaders: [],
    tabId: 22,
    url: ADDRESS_URL,
  });

  await waitFor(
    () =>
      Object.keys(sessionStore).length === 0 &&
      restartedWorker.state.downloads.length === 2,
  );

  await armExport(restartedWorker.state.messageListener, 33);
  const duplicateRequest = {
    method: "GET",
    requestHeaders: [],
    tabId: 33,
    url: ADDRESS_URL,
  };
  restartedWorker.state.webRequestListener(duplicateRequest);
  restartedWorker.state.webRequestListener(duplicateRequest);
  await waitFor(
    () =>
      Object.keys(sessionStore).length === 0 &&
      restartedWorker.state.downloads.length === 3,
  );
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(restartedWorker.state.downloads.length, 3);
});
