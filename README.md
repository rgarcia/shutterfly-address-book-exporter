# shutterfly-address-book-exporter

Chrome extension that adds an export button to your Shutterfly address book.

## Usage

Install the extension and navigate to [https://accounts.shutterfly.com/account-settings#addressbook](https://accounts.shutterfly.com/account-settings#addressbook). You should see an **Export contacts** button beside **Add contact**. Click it to download `addressbook.csv`.

## Developing

`npm run build` + add the extension manually and "Load unpacked" from chrome://extensions/.

## Publishing

```
git archive --format zip --output archive.zip HEAD
zip -ur archive.zip dist
```

Upload archive.zip
