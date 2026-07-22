const {
  findAddressBookAddContactContainer,
} = require("./content-target");

const EXPORT_BUTTON_ID = "shutterfly-address-book-export";
const EXPORT_CONTAINER_CLASS = "shutterfly-address-book-export-container";

function removeExportButton() {
  document.querySelector(`.${EXPORT_CONTAINER_CLASS}`)?.remove();
}

function startExport(button) {
  if (button.getAttribute("aria-busy") === "true") {
    return;
  }

  const content = button.querySelector(".sfs-button--content");
  const reset = () => {
    button.removeAttribute("aria-busy");
    button.style.pointerEvents = "";
    content.textContent = "Export contacts";
  };

  button.setAttribute("aria-busy", "true");
  button.style.pointerEvents = "none";
  content.textContent = "Exporting…";

  chrome.runtime.sendMessage({ action: "exportAddressBook" }, (response) => {
    if (chrome.runtime.lastError || !response?.accepted) {
      reset();
      console.error(
        "Unable to export the address book:",
        chrome.runtime.lastError?.message || response?.error,
      );
      return;
    }

    content.textContent = "Downloaded";
    window.setTimeout(reset, 2000);
  });
}

function createExportButton() {
  const container = document.createElement("div");
  container.className = `dropdown_container addContactButtonContainer ${EXPORT_CONTAINER_CLASS}`;

  const button = document.createElement("a");
  button.id = EXPORT_BUTTON_ID;
  button.className = "sfs-button sfs-button--primary compact";
  button.setAttribute("aria-label", "Export contacts as CSV");
  button.setAttribute("role", "button");
  button.setAttribute("tabindex", "0");

  const content = document.createElement("span");
  content.className = "sfs-button--content";
  content.textContent = "Export contacts";
  button.append(content);

  button.addEventListener("click", () => startExport(button));
  button.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      startExport(button);
    }
  });

  container.append(button);
  return container;
}

function syncExportButton() {
  const addContactContainer = findAddressBookAddContactContainer(document);
  if (!addContactContainer) {
    removeExportButton();
    return;
  }

  if (document.getElementById(EXPORT_BUTTON_ID)) {
    return;
  }

  addContactContainer.before(createExportButton());
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

const observer = new MutationObserver(scheduleSync);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("hashchange", scheduleSync);
scheduleSync();
