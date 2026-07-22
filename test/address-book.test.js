const assert = require("node:assert/strict");
const test = require("node:test");
const Papa = require("papaparse");

const {
  buildPageUrl,
  convertToCSV,
  fetchAllContacts,
  getReplayHeaders,
  isAddressListUrl,
} = require("../src/address-book");

const ADDRESS_URL =
  "https://accounts-api3.shutterfly.com/accounts/v3/account/123/address?queryStart=1&queryLimit=100&querySortKeys=firstName%2B%2ClastName%2B";

test("recognizes only paginated address-list requests", () => {
  assert.equal(isAddressListUrl(ADDRESS_URL), true);
  assert.equal(
    isAddressListUrl(
      "https://accounts-api3.shutterfly.com/accounts/v3/account/123/address?tags=self",
    ),
    false,
  );
  assert.equal(
    isAddressListUrl(
      "https://accounts-api3.shutterfly.com/accounts/v3/account/123/address/groups?queryStart=1&queryLimit=20",
    ),
    false,
  );
});

test("changes queryStart without losing the request contract", () => {
  const result = new URL(buildPageUrl(ADDRESS_URL, 101));
  assert.equal(result.searchParams.get("queryStart"), "101");
  assert.equal(result.searchParams.get("queryLimit"), "100");
  assert.equal(result.searchParams.get("querySortKeys"), "firstName+,lastName+");
});

test("replays captured application headers but excludes browser-controlled headers", () => {
  const replayed = Object.fromEntries(
    getReplayHeaders([
      { name: "Accept", value: "application/json" },
      { name: "Authorization", value: "token" },
      { name: "X-API-Key", value: "key" },
      { name: "X-New-Contract-Header", value: "new" },
      { name: "Cookie", value: "private" },
      { name: "Origin", value: "https://accounts.shutterfly.com" },
      { name: "Host", value: "accounts-api3.shutterfly.com" },
      { name: "Sec-Fetch-Site", value: "same-site" },
      { name: "Proxy-Authorization", value: "private" },
    ]),
  );

  assert.deepEqual(replayed, {
    Accept: "application/json",
    Authorization: "token",
    "X-API-Key": "key",
    "X-New-Contract-Header": "new",
  });
});

test("fetches every page from the beginning", async () => {
  const starts = [];
  const fetchImpl = async (value, options) => {
    const queryStart = Number(new URL(value).searchParams.get("queryStart"));
    starts.push(queryStart);
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "error");
    const count = queryStart === 1 ? 100 : 2;
    const resources = Array.from({ length: count }, (_, index) => ({
      resource: { recordSeq: queryStart + index },
    }));

    return {
      ok: true,
      json: async () => ({ resources, totalResources: 102 }),
    };
  };

  const contacts = await fetchAllContacts(buildPageUrl(ADDRESS_URL, 101), [], fetchImpl);
  assert.deepEqual(starts, [1, 101]);
  assert.equal(contacts.length, 102);
});

test("creates a rectangular CSV with sorted flattened headers and arrays", () => {
  const csv = convertToCSV([
    { firstName: "Ada", line1: "1 Main St", tags: ["friend"] },
    { firstName: 'Grace, "Amazing"', line2: "Apt 2\nRear" },
  ]);
  const parsed = Papa.parse(csv);

  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.data[0], ["firstName", "line1", "line2", "tags.0"]);
  assert.equal(parsed.data.length, 3);
  assert.ok(parsed.data.every((row) => row.length === parsed.data[0].length));
  assert.equal(parsed.data[2][0], 'Grace, "Amazing"');
  assert.equal(parsed.data[2][2], "Apt 2\nRear");
});

test("escapes spreadsheet formula prefixes", () => {
  const values = ["=1+1", "+1+1", "-1+1", "@SUM(A1)", "\tcmd", "\rcmd"];
  const parsed = Papa.parse(convertToCSV(values.map((firstName) => ({ firstName }))));

  assert.deepEqual(
    parsed.data.slice(1).map(([firstName]) => firstName),
    values.map((value) => `'${value}`),
  );
});
