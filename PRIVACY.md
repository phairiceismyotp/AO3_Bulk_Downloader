# Privacy and Disclaimer

AO3 Bulk Downloader Bookmarklet is designed to run in the user's own browser on Archive of Our Own pages.

## Data handling

- The bookmarklet reads the current AO3 series or bookmarks page DOM to find downloadable works.
- It creates AO3 download URLs from visible work links and opens those URLs in the browser.
- It does not automatically send data to third-party domains, analytics services, or author-controlled servers.
- It includes a visible credit link to GitHub, but that link is not opened unless the user clicks it.
- It does not collect AO3 passwords, read cookies directly, upload downloaded works, or store bookmark data.
- It keeps only temporary in-page queue state on `window.__ao3BulkDownloader`.
- It does not use persistent browser storage such as `localStorage` or `sessionStorage`.

When a download URL is opened, the browser may naturally send AO3 session cookies to AO3, the same way it does when using AO3's own download button.

## User responsibility

Users are responsible for reviewing the source code, rebuilding the bookmarklet if desired, and deciding whether to use the generated bookmarklet file.

Users should also follow AO3's terms, respect authors' works, and configure browser download permissions appropriately. Some browsers may ask for permission before allowing multiple downloads.

## Disclaimer

This project is provided without warranty. The author is not responsible for failed downloads, browser behavior, account issues, changed AO3 page structure, rate limits, or data loss.

This project is unofficial and is not affiliated with, endorsed by, or maintained by the Organization for Transformative Works or Archive of Our Own.
