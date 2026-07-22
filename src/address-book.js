const Papa = require("papaparse");
const { flatten } = require("flat");

const ADDRESS_LIST_PATH = /^\/accounts\/v3\/account\/[^/]+\/address$/;

function isAddressListUrl(value) {
  const url = new URL(value);

  return (
    url.hostname === "accounts-api3.shutterfly.com" &&
    ADDRESS_LIST_PATH.test(url.pathname) &&
    url.searchParams.has("queryStart") &&
    url.searchParams.has("queryLimit") &&
    !url.searchParams.has("tags")
  );
}

function buildPageUrl(value, queryStart) {
  const url = new URL(value);
  url.searchParams.set("queryStart", String(queryStart));
  return url.toString();
}

async function fetchAllContacts(initialUrl, headers, fetchImpl = fetch) {
  const contacts = [];
  let queryStart = 1;
  let totalResources = null;

  while (totalResources === null || contacts.length < totalResources) {
    const response = await fetchImpl(buildPageUrl(initialUrl, queryStart), {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Shutterfly returned HTTP ${response.status}`);
    }

    const data = await response.json();
    const page = Array.isArray(data.resources)
      ? data.resources.map(({ resource }) => resource).filter(Boolean)
      : [];
    const reportedTotal = Number(data.totalResources);
    if (Number.isFinite(reportedTotal) && reportedTotal >= 0) {
      totalResources = reportedTotal;
    }

    if (page.length === 0) {
      if (totalResources !== null && contacts.length < totalResources) {
        throw new Error("Shutterfly returned an incomplete address book page");
      }
      break;
    }

    contacts.push(...page);
    queryStart += page.length;

    if (totalResources === null && !data.nextResourceRef) {
      totalResources = contacts.length;
    }
  }

  if (totalResources !== null && contacts.length < totalResources) {
    throw new Error(
      `Shutterfly returned ${contacts.length} of ${totalResources} contacts`,
    );
  }

  return contacts;
}

function convertToCSV(contacts) {
  const rows = contacts.map((contact) =>
    flatten(contact, { delimiter: ".", safe: false }),
  );
  const fields = [...new Set(rows.flatMap((row) => Object.keys(row)))].sort();
  const data = rows.map((row) =>
    fields.map((field) => (row[field] == null ? "" : row[field])),
  );

  return Papa.unparse(
    { fields, data },
    { escapeFormulae: true, newline: "\r\n" },
  );
}

module.exports = {
  buildPageUrl,
  convertToCSV,
  fetchAllContacts,
  isAddressListUrl,
};
