function findAddressBookAddContactContainer(document) {
  const button = document.getElementById("addNewAddressButton");
  if (!button?.closest(".addressbookContainer")) {
    return null;
  }

  return button.parentElement;
}

module.exports = { findAddressBookAddContactContainer };
