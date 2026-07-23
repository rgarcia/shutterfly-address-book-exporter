const EXPORT_BUTTON_ID = "shutterfly-address-book-export";
const EXPORT_CONTAINER_CLASS = "shutterfly-address-book-export-container";

function findAddContactContainer() {
  const addContactButton = document.getElementById("addNewAddressButton");
  return addContactButton?.closest(".addressbookContainer")
    ? addContactButton.parentElement
    : null;
}

function startExport(button) {
  if (button.getAttribute("aria-busy") === "true") {
    return;
  }

  const content = button.querySelector(".sfs-button--content");
  button.setAttribute("aria-busy", "true");
  content.textContent = "Exporting…";

  chrome.runtime.sendMessage({ action: "exportAddressBook" }, (response) => {
    button.removeAttribute("aria-busy");

    if (chrome.runtime.lastError || !response?.ok) {
      content.textContent = "Reload address book and retry";
      return;
    }

    content.textContent = "Downloaded";
    window.setTimeout(() => {
      content.textContent = "Export contacts";
    }, 2000);
  });
}

function createExportButton() {
  const container = document.createElement("div");
  container.className = `dropdown_container addContactButtonContainer ${EXPORT_CONTAINER_CLASS}`;

  const button = document.createElement("button");
  button.id = EXPORT_BUTTON_ID;
  button.type = "button";
  button.className = "sfs-button sfs-button--primary compact";
  button.style.marginBottom = "0";
  button.setAttribute("aria-label", "Export contacts as CSV");

  const content = document.createElement("span");
  content.className = "sfs-button--content";
  content.textContent = "Export contacts";
  button.append(content);
  button.addEventListener("click", () => startExport(button));

  container.append(button);
  return container;
}

function syncExportButton() {
  const addContactContainer = findAddContactContainer();
  const exportContainer = document.querySelector(`.${EXPORT_CONTAINER_CLASS}`);

  if (!addContactContainer) {
    exportContainer?.remove();
  } else if (!document.getElementById(EXPORT_BUTTON_ID)) {
    addContactContainer.before(createExportButton());
  }
}

let syncScheduled = false;
function scheduleSync() {
  if (syncScheduled) {
    return;
  }

  syncScheduled = true;
  requestAnimationFrame(() => {
    syncScheduled = false;
    syncExportButton();
  });
}

new MutationObserver(scheduleSync).observe(document.documentElement, {
  childList: true,
  subtree: true,
});
scheduleSync();
