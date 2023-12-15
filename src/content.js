function injectExportButton() {
  const exportHtml = `<div class="toolBarUnits null delete export" tabindex="0">
  <svg class="iconImport uig-svg-icon" viewBox="0 0 22 20"><g id="icons/photos/uploads/import@1x-Page-1-37752" fill="none" fill-rule="evenodd"><g id="icons/photos/uploads/import@1x-Address-book-assets-37752" transform="translate(-116 -184)"><g id="icons/photos/uploads/import@1x-SVG-37752" transform="translate(116 57)"><g id="icons/photos/uploads/import@1x-icons/photos/uploads/import-37752" transform="translate(0 126)"><mask id="icons/photos/uploads/import@1x-mask-2-37752" fill="#fff"><path d="M7 5a1 1 0 1 1 0 2H2v12h18V7h-5a1 1 0 0 1 0-2h6a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6zm4-4a1 1 0 0 1 1 1v7.59l1.29-1.3a1.004 1.004 0 0 1 1.42 1.42l-3 3a1.26 1.26 0 0 1-.32.21.37.37 0 0 1-.14 0 .8.8 0 0 1-.5 0 .37.37 0 0 1-.14 0 1.26 1.26 0 0 1-.32-.21l-3-3a1.004 1.004 0 0 1 1.42-1.42L10 9.59V2a1 1 0 0 1 1-1z" id="icons/photos/uploads/import@1x-path-1-0-37752"></path></mask><path d="M7 5a1 1 0 1 1 0 2H2v12h18V7h-5a1 1 0 0 1 0-2h6a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6zm4-4a1 1 0 0 1 1 1v7.59l1.29-1.3a1.004 1.004 0 0 1 1.42 1.42l-3 3a1.26 1.26 0 0 1-.32.21.37.37 0 0 1-.14 0 .8.8 0 0 1-.5 0 .37.37 0 0 1-.14 0 1.26 1.26 0 0 1-.32-.21l-3-3a1.004 1.004 0 0 1 1.42-1.42L10 9.59V2a1 1 0 0 1 1-1z" id="icons/photos/uploads/import@1x-path-1-1-37752" fill="#000"></path></g></g></g></g><!-- Filename: sourceSvg/addressbook/import.svg --></svg>
  <a class="unitLabel labelHover">
    <span>Export contacts</span>
  </a>
</div>`;
  function insert() {
    const deleteDiv = document.querySelector('div.delete');
    if (!deleteDiv) {
      return;
    }
    // Create a container for the new HTML
    const container = document.createElement('div');
    container.innerHTML = exportHtml;

    // Insert the new HTML after the delete div
    deleteDiv.parentNode.insertBefore(container, deleteDiv.nextSibling);

    const exportButton = container.querySelector('.export');
    exportButton.addEventListener('click', function () {
      // Send a message to the background script to start the data fetching process
      chrome.runtime.sendMessage({ action: 'exportAddressBook' });
      
      // Reload the current tab
      window.location.reload();
    });
  }
 
  const observer = new MutationObserver((mutations, obs) => {
    const importDiv = document.querySelector('.import');
    if (importDiv) {
      insert();
      obs.disconnect(); // Stop watching for changes
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}
  

// Inject the button when the DOM is fully loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", injectExportButton);
} else {
  injectExportButton();
}
