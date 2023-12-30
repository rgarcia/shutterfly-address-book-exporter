const Papa = require('papaparse');
const { flatten } = require('flat');

function convertToCSV(data) {
  return Papa.unparse(data);
}
let isListeningForAddressBook = false;

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'exportAddressBook') {
    isListeningForAddressBook = true;
  }
});


function downloadCSV(csvContent, fileName) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const reader = new FileReader();
    reader.onload = function (e) {
        chrome.downloads.download({
            url: e.target.result,
            filename: fileName,
        });
    };
    reader.readAsDataURL(blob);
}

chrome.webRequest.onBeforeSendHeaders.addListener(
  function (details) {
    if (isListeningForAddressBook && details.method === 'GET' && details.url.includes('https://api2.shutterfly.com/v1/addressbook/') && details.url.includes('/contacts?')) {
      let headers = {};
      for (let header of details.requestHeaders) {
        headers[header.name] = header.value;
      }
      if (!headers['Authorization']) {
        return;
      }
      isListeningForAddressBook = false;
      const req = new Request(details.url, {
        method: 'GET',
        headers: headers,
      });
      fetch(req)
      .then(response => response.json())
      .then(data => {
        const flattened = data.items.map(item => flatten(item, {delimiter: '.', safe: false})); 
        const csvContent = Papa.unparse(JSON.stringify(flattened));
        downloadCSV(csvContent, "addressbook.csv");
      })
      .catch(error => console.error('Error fetching address book data:', error));
    }
  },
  { urls: ["https://api2.shutterfly.com/v1/addressbook/*"] },
  ["requestHeaders"]
);

