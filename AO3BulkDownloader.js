(function () {
  "use strict";

  const AO3 = "https://archiveofourown.org";
  const AO3_HOST = "archiveofourown.org";
  const QUEUE_DELAY = 10000;
  const LINK_CLEANUP_DELAY = 60000;
  const MAX_VISIBLE_CARDS = 6;
  const AO3_SLUG_LIMIT = 24;
  const DOWNLOAD_TEXT = "Download Selected";
  const FORMATS = ["epub", "azw3", "mobi", "pdf", "html"];
  const CONFIG = {
    font: "Cambria, serif",
    creditUrl: "https://github.com/phairiceismyotp",
  };

  const ID = {
    overlay: "ao3-dl-overlay",
    modal: "ao3-dl-modal",
    selectAll: "ao3-dl-select-all",
    format: "ao3-dl-format",
    download: "ao3-dl-download",
    stop: "ao3-dl-stop",
  };

  const SEL = {
    author: '[rel="author"]',
    checkbox: ".ao3-dl-work-checkbox",
    title: '.heading a[href^="/works/"]',
  };

  const RE = {
    bookmarks: /(^|\/)bookmarks(\/|$)/,
    series: /^\/series\/\d+\/?$/,
    workId: /\/works\/(\d+)/,
    routeName: /[^\w\s]/gi,
    space: /\s+/g,
    html: /[&<>"']/g,
  };

  const PAGE_RULES = [
    {
      pattern: RE.bookmarks,
      itemSelector: "li.bookmark, li.work",
      title: "Download Bookmarks",
      emptyMessage: "No bookmark items found.",
      noWorksMessage: "Found bookmark items, but none point to downloadable AO3 works.",
    },
    {
      pattern: RE.series,
      itemSelector: "li.work",
      title: "Download Series",
      emptyMessage: "No works found!",
      noWorksMessage: "Found series items, but none point to downloadable AO3 works.",
    },
  ];

  const HTML = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  const $ = (selector, root = document) => root?.querySelector(selector) || null;
  const $$ = (selector, root = document) => (root ? [...root.querySelectorAll(selector)] : []);
  const byId = (id) => document.getElementById(id);
  const cssPx = (style, name) => parseFloat(style[name]) || 0;

  const queue = (window.__ao3BulkDownloader ||= {});
  queue.timers ||= [];
  queue.isRunning = Boolean(queue.isRunning);
  queue.buttonText ||= DOWNLOAD_TEXT;
  queue.queueId ||= 0;

  const CSS = `
    #ao3-dl-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:999998}
    #ao3-dl-modal{--text:#1d1d1d;--panel:#fff;--panel-border:#c9c9c9;--header:#f8f8f8;--header-border:#ddd;--brand:#7b1113;--muted:#3f3f3f;--button:#fff;--button-text:#222;--button-border:#b9b9b9;--blue-title:#153f73;--blue-border:#cfdbea;--blue-bg:#eef4fa;--purple-title:#8b519f;--purple-border:#d6c3df;--purple-bg:#f8f2f9;position:fixed;top:8%;left:50%;transform:translateX(-50%);width:min(560px,calc(100vw - 24px));max-height:84vh;overflow:hidden;box-sizing:border-box;border:1px solid var(--panel-border);border-radius:4px;background:var(--panel);box-shadow:0 12px 36px #0004;color:var(--text);font-family:${CONFIG.font};font-size:16px;line-height:1.4;letter-spacing:0;z-index:999999}
    #ao3-dl-modal *{box-sizing:border-box}
    #ao3-dl-modal .ao3-dl-header{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 10px;border-bottom:1px solid var(--header-border);background:var(--header);white-space:nowrap}
    #ao3-dl-modal .ao3-dl-actions{display:flex;align-items:center;gap:8px;flex:0 0 auto;flex-wrap:nowrap}
    #ao3-dl-modal .ao3-dl-title{margin:0;color:var(--brand);font-size:16px;font-weight:700;white-space:nowrap}
    #ao3-dl-modal .ao3-dl-row-grid{display:grid;grid-template-columns:18px minmax(0,1fr);column-gap:7px;align-items:start}
    #ao3-dl-modal .ao3-dl-select-all-label{margin:0 0 7px;padding:0 9px;width:max-content;color:var(--text);cursor:pointer;font-size:13px;font-weight:700;line-height:15px;white-space:nowrap}
    #ao3-dl-modal .ao3-dl-checkbox{-webkit-appearance:auto!important;appearance:auto!important;display:block!important;width:13px!important;height:13px!important;min-width:13px!important;min-height:13px!important;max-width:13px!important;max-height:13px!important;margin:1px 0 0!important;padding:0!important;border:0!important;border-radius:0!important;background:initial!important;box-shadow:none!important;accent-color:#087adf;cursor:pointer;transform:none!important}
    #ao3-dl-modal .ao3-dl-format-select,#ao3-dl-modal .ao3-dl-button{height:28px;border:1px solid var(--button-border)!important;border-radius:4px;background:var(--button)!important;color:var(--button-text)!important;font:inherit;font-size:13px;font-weight:700;white-space:nowrap;box-shadow:none!important;text-shadow:none!important}
    #ao3-dl-modal .ao3-dl-format-select{flex:0 0 78px;width:78px;min-width:78px;max-width:78px;padding:0 18px 0 8px;cursor:pointer}
    #ao3-dl-modal .ao3-dl-format-select option{background:#fff!important;color:#222!important}
    #ao3-dl-modal .ao3-dl-button{flex:0 0 auto;padding:0 10px;cursor:pointer}
    #ao3-dl-modal .ao3-dl-stop-button[hidden]{display:none!important}
    #ao3-dl-modal .ao3-dl-button:hover,#ao3-dl-modal .ao3-dl-button:focus,#ao3-dl-modal .ao3-dl-format-select:hover,#ao3-dl-modal .ao3-dl-format-select:focus{border-color:var(--button-border)!important;background:var(--button)!important;color:var(--button-text)!important;outline:none!important}
    #ao3-dl-modal .ao3-dl-button:disabled{cursor:default;opacity:.55}
    #ao3-dl-modal .ao3-dl-body{overflow:auto;overscroll-behavior:contain;padding:8px;background:var(--panel)}
    #ao3-dl-modal .ao3-dl-list{display:grid;gap:7px;margin:0!important;padding:0!important;list-style:none!important}
    #ao3-dl-modal .ao3-dl-list>.ao3-dl-card{margin:0!important}
    #ao3-dl-modal .ao3-dl-card{overflow:hidden;padding:8px 9px;border:1px solid var(--blue-border);border-radius:4px;background:var(--blue-bg)}
    #ao3-dl-modal .ao3-dl-card.is-purple{border-color:var(--purple-border);background:var(--purple-bg)}
    #ao3-dl-modal .ao3-dl-meta{min-width:0;overflow-wrap:anywhere}
    #ao3-dl-modal .ao3-dl-work-title{margin:0 0 3px;color:var(--blue-title);font-size:14px;line-height:1.24;font-weight:700}
    #ao3-dl-modal .ao3-dl-card.is-purple .ao3-dl-work-title{color:var(--purple-title)}
    #ao3-dl-modal .ao3-dl-author{color:var(--muted);font-size:12.5px;line-height:1.22}
    #ao3-dl-modal .ao3-dl-author strong{color:var(--text);font-weight:700}
    #ao3-dl-modal .ao3-dl-credit{margin-top:7px;color:var(--text);font-size:11px;font-style:italic;text-align:right}
    #ao3-dl-modal .ao3-dl-credit a{color:inherit}
  `;

  let rangeAnchor = null;

  run();

  function run() {
    const page = getPage();
    if (!page) {
      alert("This bookmarklet only runs on AO3 series and bookmarks pages.");
      return;
    }

    const pageItems = $$(page.itemSelector);
    const works = readWorks(pageItems);
    if (!works.length) {
      alert(pageItems.length ? page.noWorksMessage : page.emptyMessage);
      return;
    }

    closeUi();
    renderUi(works, page.title);
    fitBody();
    bindUi(works);
  }

  function getPage() {
    if (window.location.hostname !== AO3_HOST) {
      return null;
    }

    const path = window.location.pathname;
    return PAGE_RULES.find((page) => page.pattern.test(path)) || null;
  }

  function readWorks(items) {
    const seen = new Set();
    const works = [];

    for (const item of items) {
      const work = readWork(item);
      if (!work || seen.has(work.id)) {
        continue;
      }
      seen.add(work.id);
      works.push(work);
    }

    return works;
  }

  function readWork(item) {
    const titleLink = $(SEL.title, item);
    const id = titleLink?.getAttribute("href")?.match(RE.workId)?.[1];
    const title = titleLink?.textContent.trim();

    if (!id || !title) {
      return null;
    }

    return {
      author: $(SEL.author, item)?.textContent.trim() || "Anonymous",
      downloadBaseUrl: `${AO3}/downloads/${id}/${getAo3Slug(title) || "work"}`,
      id,
      title,
    };
  }

  function getAo3Slug(title) {
    const words = title.replace(RE.routeName, "").trim().split(RE.space).filter(Boolean);
    let slug = "";

    for (const word of words) {
      const nextSlug = slug ? `${slug}_${word}` : word;
      if (nextSlug.length > AO3_SLUG_LIMIT) {
        return slug || word.slice(0, AO3_SLUG_LIMIT);
      }
      slug = nextSlug;
    }

    return slug;
  }

  function renderUi(works, title) {
    const cards = works.map(renderCard).join("");
    const options = FORMATS.map((format) => `<option value="${format}">${format.toUpperCase()}</option>`).join("");

    document.body.insertAdjacentHTML(
      "beforeend",
      `
        <div id="${ID.overlay}"></div>
        <div id="${ID.modal}">
          <style>${CSS}</style>
          <div class="ao3-dl-header">
            <h2 class="ao3-dl-title">${escapeHtml(title)}</h2>
            <div class="ao3-dl-actions">
              <button id="${ID.stop}" class="ao3-dl-button ao3-dl-stop-button" hidden>Stop</button>
              <select id="${ID.format}" class="ao3-dl-format-select">${options}</select>
              <button id="${ID.download}" class="ao3-dl-button ao3-dl-download-button">${DOWNLOAD_TEXT}</button>
            </div>
          </div>
          <div class="ao3-dl-body">
            <label class="ao3-dl-select-all-label ao3-dl-row-grid">
              <input id="${ID.selectAll}" class="ao3-dl-checkbox" type="checkbox" checked>
              <span>Select All</span>
            </label>
            <ul class="ao3-dl-list">${cards}</ul>
            <div class="ao3-dl-credit">Code by <a href="${CONFIG.creditUrl}" target="_blank" rel="noopener">phairiceismyotp</a></div>
          </div>
        </div>
      `,
    );
  }

  function renderCard(work, index) {
    return `
      <li class="ao3-dl-card ao3-dl-row-grid${index % 2 ? " is-purple" : ""}">
        <input class="ao3-dl-checkbox ao3-dl-work-checkbox" type="checkbox" data-index="${index}" checked>
        <div class="ao3-dl-meta">
          <h3 class="ao3-dl-work-title">${escapeHtml(work.title)}</h3>
          <div class="ao3-dl-author"><strong>Author:</strong>&nbsp;${escapeHtml(work.author)}</div>
        </div>
      </li>
    `;
  }

  function bindUi(works) {
    const modal = byId(ID.modal);
    const selectAll = byId(ID.selectAll);

    byId(ID.overlay).addEventListener("click", closeUi);
    byId(ID.download).addEventListener("click", () => startQueue(works));
    byId(ID.stop).addEventListener("click", stopQueue);

    selectAll.addEventListener("change", () => {
      getBoxes(modal).forEach((box) => {
        box.checked = selectAll.checked;
      });
      selectAll.indeterminate = false;
    });

    modal.addEventListener("click", (event) => {
      const box = event.target.closest?.(SEL.checkbox);
      if (!box) {
        return;
      }
      selectRange(modal, box, event.shiftKey);
      syncSelectAll(modal);
    });

    setQueueState(queue.isRunning, queue.buttonText);
  }

  function fitBody() {
    const modal = byId(ID.modal);
    const body = $(".ao3-dl-body", modal);
    const header = $(".ao3-dl-header", modal);
    const list = $(".ao3-dl-list", body);

    if (!body || !header || !list) {
      return;
    }

    const cards = $$(".ao3-dl-card", body);
    const shownCards = cards.slice(0, MAX_VISIBLE_CARDS);
    if (!shownCards.length) {
      return;
    }

    const bodyStyle = getComputedStyle(body);
    const listGap = cssPx(getComputedStyle(list), "gap") * Math.max(shownCards.length - 1, 0);
    const cardHeight = shownCards.reduce((height, card) => height + card.offsetHeight, 0);
    const contentHeight =
      cssPx(bodyStyle, "paddingTop") +
      cssPx(bodyStyle, "paddingBottom") +
      blockHeight($(".ao3-dl-select-all-label", body)) +
      listGap +
      cardHeight +
      blockHeight($(".ao3-dl-credit", body));
    const availableHeight = window.innerHeight * 0.84 - header.offsetHeight;

    body.style.maxHeight = `${Math.min(contentHeight + 2, availableHeight)}px`;
    body.style.overflow =
      cards.length > MAX_VISIBLE_CARDS || contentHeight > availableHeight
        ? "auto"
        : "visible";
  }

  function blockHeight(element) {
    if (!element) {
      return 0;
    }
    const style = getComputedStyle(element);
    return cssPx(style, "marginTop") + element.offsetHeight + cssPx(style, "marginBottom");
  }

  function selectRange(modal, box, isRangeClick) {
    if (isRangeClick && rangeAnchor) {
      const boxes = getBoxes(modal);
      const [start, end] = [rangeAnchor.dataset.index, box.dataset.index]
        .map(Number)
        .sort((left, right) => left - right);

      for (let index = start; index <= end; index += 1) {
        boxes[index].checked = box.checked;
      }
    }

    rangeAnchor = box;
  }

  function syncSelectAll(modal) {
    const boxes = getBoxes(modal);
    const checkedCount = boxes.filter((box) => box.checked).length;
    const selectAll = byId(ID.selectAll);

    selectAll.checked = checkedCount === boxes.length;
    selectAll.indeterminate = checkedCount > 0 && checkedCount < boxes.length;
  }

  function startQueue(works) {
    if (queue.isRunning) {
      alert("A download queue is already running. Stop it before starting a new one.");
      return;
    }

    const format = byId(ID.format).value;
    const urls = getSelectedUrls(works, format);
    if (!urls.length) {
      alert("Please select at least one item to download!");
      return;
    }

    queue.queueId += 1;
    clearTimers();
    setQueueState(true, "Downloading...");
    alert(
      "Starting to download in " +
        format.toUpperCase() +
        " format.\nFiles will be downloaded " +
        QUEUE_DELAY / 1000 +
        " seconds apart.",
    );

    const queueId = queue.queueId;
    urls.forEach((url, index) => {
      scheduleUrl(url, index, urls.length, queueId);
    });
  }

  function getSelectedUrls(works, format) {
    return getBoxes()
      .filter((box) => box.checked)
      .map((box) => `${works[box.dataset.index].downloadBaseUrl}.${format}`);
  }

  function scheduleUrl(url, index, total, queueId) {
    const timer = setTimeout(() => {
      if (!isActiveQueue(queueId)) {
        return;
      }

      clickDownload(url);
      setQueueState(true, "Downloading " + (index + 1) + "/" + total);

      if (index === total - 1) {
        finishQueue(queueId);
      }
    }, index * QUEUE_DELAY);

    queue.timers.push(timer);
  }

  function stopQueue() {
    if (!queue.isRunning) {
      return;
    }

    queue.queueId += 1;
    clearTimers();
    setQueueState(false, DOWNLOAD_TEXT);
  }

  function finishQueue(queueId) {
    if (!isActiveQueue(queueId)) {
      return;
    }

    clearTimers();
    setQueueState(false, DOWNLOAD_TEXT);
  }

  function isActiveQueue(queueId) {
    return queue.isRunning && queue.queueId === queueId;
  }

  function clearTimers() {
    queue.timers.forEach(clearTimeout);
    queue.timers = [];
  }

  function clickDownload(url) {
    const link = document.createElement("a");

    link.href = url;
    link.setAttribute("download", "");
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    setTimeout(() => link.remove(), LINK_CLEANUP_DELAY);
  }

  function setQueueState(isRunning, text) {
    queue.isRunning = isRunning;
    queue.buttonText = text;

    const downloadButton = byId(ID.download);
    const stopButton = byId(ID.stop);

    if (downloadButton) {
      downloadButton.disabled = isRunning;
      downloadButton.textContent = text;
    }

    if (stopButton) {
      stopButton.hidden = !isRunning;
    }
  }

  function getBoxes(root = byId(ID.modal)) {
    return $$(SEL.checkbox, root);
  }

  function closeUi() {
    byId(ID.overlay)?.remove();
    byId(ID.modal)?.remove();
  }

  function escapeHtml(value) {
    return value.replace(RE.html, (char) => HTML[char]);
  }
})();
