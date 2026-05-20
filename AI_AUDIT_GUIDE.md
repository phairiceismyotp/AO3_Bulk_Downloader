# AI Audit Guide

This guide helps users perform an independent, low-noise review before using or rebuilding the bookmarklet.

## Audit scope

Review these source files first:

- `AO3BulkDownloader.js`
- `scripts/build-bookmarklet.js`

After reviewing the source and build script, you may compare the generated files in `dist/` against a fresh local build.

Do not upload private AO3 account data, private bookmarks, downloaded works, browser cookies, or personal browsing history into an AI tool.

## Expected runtime behavior

The runtime bookmarklet is expected to:

- Run only when manually clicked by the user.
- Accept only `archiveofourown.org` series and bookmarks pages.
- Read the current AO3 page DOM to find work links, titles, and authors.
- Inject a temporary modal UI, style block, overlay, checkboxes, buttons, and format selector.
- Use `alert`, `setTimeout`, and temporary in-page state on `window.__ao3BulkDownloader` for the download queue.
- Create temporary hidden `<a>` elements and click AO3 download URLs under `https://archiveofourown.org/downloads/`.
- Wait between queued downloads to avoid firing many AO3 download requests at once.
- Show a visible credit link to GitHub. This link is not contacted unless the user clicks it.

Do not treat these behaviors as vulnerabilities by themselves. They are normal for this bookmarklet.

## Expected build behavior

The build script is expected to:

- Run locally with Node.js.
- Use `fs`, `path`, `process.argv`, `console`, and `process.exitCode`.
- Use `new Function` only to validate JavaScript syntax during the local build.
- Read the source file.
- Minify the runtime source.
- Write raw and encoded bookmarklet files into `dist/`.

The build script should not contact the network or install packages.

## Suggested AI prompt

```text
Please audit these files as a security, privacy, and transparency review before I use this AO3 bookmarklet:

Files:
- AO3BulkDownloader.js
- scripts/build-bookmarklet.js

Context:
- The runtime code is a browser bookmarklet for Archive of Our Own.
- It should run only when manually clicked on archiveofourown.org series or bookmarks pages.
- It should read the current AO3 page DOM, list works, let me choose a format, and open AO3 download URLs.
- DOM injection, a temporary style block, a modal UI, hidden download links, alerts, timers, and window.__ao3BulkDownloader queue state are expected behavior.
- A visible GitHub credit link may exist, but it should not be requested unless the user clicks it.
- The runtime should not send page data to third-party domains.
- The runtime should not collect AO3 credentials, read cookies directly, store private data, or upload downloaded content.
- The build script should only read local source, validate/minify JavaScript, and write generated bookmarklet files into dist/.

Please:
1. List every external domain, URL, or link target, and say whether it is contacted automatically or only opened after user action.
2. Identify whether the runtime uses fetch, XMLHttpRequest, sendBeacon, WebSocket, remote scripts, eval/new Function, localStorage, sessionStorage, cookies, clipboard APIs, or form submission.
3. Confirm whether any AO3 page data is sent anywhere other than AO3 download URLs.
4. Confirm whether the runtime host/page checks match the stated AO3-only scope.
5. Confirm whether the build script performs only local file reads/writes and JavaScript validation/minification.
6. Classify findings as:
   - Expected by design
   - Worth checking
   - Real issue
7. Avoid flagging expected DOM injection, CSS, timers, hidden AO3 download links, or temporary in-page queue state as issues unless they are used to send or persist data unexpectedly.
8. Do not rewrite the code unless I ask for a patch.
```

## Findings that should matter

Treat these as real concerns if found:

- Runtime automatically contacts any non-AO3 domain.
- Runtime sends AO3 page data, bookmark data, credentials, cookies, or downloaded content to any third party.
- Runtime loads remote scripts, images, stylesheets, or analytics.
- Runtime uses `fetch`, `XMLHttpRequest`, `sendBeacon`, `WebSocket`, `eval`, or runtime `new Function`.
- Runtime writes private data to persistent storage.
- Runtime modifies AO3 bookmarks, account settings, forms, comments, works, or user profile data.
- Build script contacts the network, installs packages, executes generated code beyond syntax validation, or writes outside the intended output path.

## Expected safe shape

- Runtime download targets should be AO3 URLs under `https://archiveofourown.org/downloads/`.
- Runtime should only read the current page DOM and create temporary UI/download elements.
- Runtime should not collect or persist private AO3 data.
- Runtime should not have automatic third-party network behavior.
- `window.__ao3BulkDownloader` should contain only temporary queue state.
- `new Function` and filesystem writes should appear only in `scripts/build-bookmarklet.js`.

## Important limit

AI review is helpful, but it is not a formal security audit. If you modify the code, review the diff again before rebuilding and using the bookmarklet.
