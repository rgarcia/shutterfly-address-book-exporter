const assert = require("node:assert/strict");
const test = require("node:test");

const {
  findAddressBookAddContactContainer,
} = require("../src/content-target");

test("finds the address-book controls without relying on the URL hash", () => {
  const container = {};
  const button = {
    closest(selector) {
      assert.equal(selector, ".addressbookContainer");
      return {};
    },
    parentElement: container,
  };
  const document = {
    getElementById(id) {
      assert.equal(id, "addNewAddressButton");
      return button;
    },
  };

  assert.equal(findAddressBookAddContactContainer(document), container);
});

test("ignores an add-contact control outside the address book", () => {
  const document = {
    getElementById() {
      return {
        closest() {
          return null;
        },
        parentElement: {},
      };
    },
  };

  assert.equal(findAddressBookAddContactContainer(document), null);
});
