const Papa = require("papaparse");

const ADDRESS_LIST_PATH = /^\/accounts\/v3\/account\/[^/]+\/address$/;
const FORBIDDEN_FETCH_HEADERS = new Set([
  "accept-charset",
  "accept-encoding",
  "access-control-request-headers",
  "access-control-request-method",
  "connection",
  "content-length",
  "cookie",
  "cookie2",
  "date",
  "dnt",
  "expect",
  "host",
  "keep-alive",
  "origin",
  "permissions-policy",
  "referer",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "user-agent",
  "via",
  "x-http-method",
  "x-http-method-override",
  "x-method-override",
]);

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

function getReplayHeaders(requestHeaders = []) {
  return requestHeaders
    .filter(({ name, value }) => {
      if (!name || value == null) {
        return false;
      }

      const normalizedName = name.toLowerCase();
      return (
        !FORBIDDEN_FETCH_HEADERS.has(normalizedName) &&
        !normalizedName.startsWith("proxy-") &&
        !normalizedName.startsWith("sec-")
      );
    })
    .map(({ name, value }) => [name, value]);
}

async function fetchAllContacts(initialUrl, headers, fetchImpl = fetch) {
  const contacts = [];
  let queryStart = 1;
  let totalResources = null;

  while (totalResources === null || contacts.length < totalResources) {
    const response = await fetchImpl(buildPageUrl(initialUrl, queryStart), {
      method: "GET",
      headers,
      credentials: "omit",
      redirect: "error",
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

function flattenContact(contact) {
  const result = Object.create(null);

  function visit(value, path) {
    const type = Object.prototype.toString.call(value);
    const isContainer = type === "[object Object]" || type === "[object Array]";
    const keys = isContainer ? Object.keys(value) : [];

    if (keys.length > 0) {
      for (const key of keys) {
        visit(value[key], path ? `${path}.${key}` : key);
      }
    } else if (path) {
      result[path] = value;
    }
  }

  visit(contact, "");
  return result;
}

function convertToCSV(contacts) {
  const rows = contacts.map(flattenContact);
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
  getReplayHeaders,
  isAddressListUrl,
};
