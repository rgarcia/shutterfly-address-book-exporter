# shutterfly-address-book-exporter

Chrome extension that adds an export button to your Shutterfly address book.

## Usage

Install the extension and navigate to [https://www.shutterfly.com/addressbook/management.sfly#/contacts](https://www.shutterfly.com/addressbook/management.sfly#/contacts). You should see an export button. Click it.

## Developing

`npm run build` + add the extension manually and "Load unpacked" from chrome://extensions/.

## Publishing

```
git archive --format zip --output archive.zip HEAD
zip -ur archive.zip dist
```

Upload archive.zip
