const assert = require("node:assert/strict");
const test = require("node:test");
const Papa = require("papaparse");

const {
  buildPageUrl,
  convertToCSV,
  fetchAllContacts,
  isAddressListUrl,
} = require("../src/address-book");

const ADDRESS_URL =
  "https://accounts-api3.shutterfly.com/accounts/v3/account/123/address?queryStart=1&queryLimit=100&querySortKeys=firstName%2B%2ClastName%2B";

test("grants webRequest access to the API and its initiator", () => {
  const manifest = require("../manifest.json");
  assert.ok(manifest.permissions.includes("storage"));
  assert.ok(
    manifest.host_permissions.includes("https://accounts.shutterfly.com/*"),
  );
  assert.ok(
    manifest.host_permissions.includes(
      "https://accounts-api3.shutterfly.com/*",
    ),
  );
});

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

test("fetches the live 100 plus 2 page boundary from page one", async () => {
  const starts = [];
  const fetchImpl = async (value) => {
    const queryStart = Number(new URL(value).searchParams.get("queryStart"));
    starts.push(queryStart);
    const count = queryStart === 1 ? 100 : 2;
    const resources = Array.from({ length: count }, (_, index) => ({
      resource: { recordSeq: queryStart + index },
    }));

    return {
      ok: true,
      json: async () => ({ resources, totalResources: 102 }),
    };
  };

  const capturedSecondPage = buildPageUrl(ADDRESS_URL, 101);
  const contacts = await fetchAllContacts(capturedSecondPage, {}, fetchImpl);
  assert.deepEqual(starts, [1, 101]);
  assert.equal(contacts.length, 102);
  assert.equal(contacts[0].recordSeq, 1);
  assert.equal(contacts[101].recordSeq, 102);
});

test("exports an empty address book", async () => {
  const contacts = await fetchAllContacts(ADDRESS_URL, {}, async () => ({
    ok: true,
    json: async () => ({ resources: [], totalResources: 0 }),
  }));

  assert.deepEqual(contacts, []);
});

test("creates a rectangular CSV with sorted flattened headers", () => {
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
