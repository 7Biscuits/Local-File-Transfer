(function () {
  "use strict";

  // ── DOM refs ──────────────────────────────────────────────────
  const fileInputPhotos = document.getElementById("file-input-photos");
  const fileInputVideos = document.getElementById("file-input-videos");
  const btnPickPhotos  = document.getElementById("btn-pick-photos");
  const btnPickVideos  = document.getElementById("btn-pick-videos");
  const dropZone       = document.getElementById("drop-zone");
  const gallerySection = document.getElementById("gallery-section");
  const galleryGrid    = document.getElementById("gallery-grid");
  const galleryCount   = document.getElementById("gallery-count");
  const btnClear       = document.getElementById("btn-clear");
  const btnTransfer    = document.getElementById("btn-transfer");
  const progressSect   = document.getElementById("progress-section");
  const progLabel      = document.getElementById("prog-label");
  const progPct        = document.getElementById("prog-pct");
  const progBar        = document.getElementById("prog-bar");
  const uploadQueue    = document.getElementById("upload-queue");
  const resultSection  = document.getElementById("result-section");
  const resultBanner   = document.getElementById("result-banner");
  const recentList     = document.getElementById("recent-list");

  // ── State ─────────────────────────────────────────────────────
  /** @type {File[]} */
  let selectedFiles = [];

  // ── Utility ───────────────────────────────────────────────────

  /** Format bytes as human-readable string */
  function fmtSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  }

  /** Return a short relative time label */
  function relTime(isoStr) {
    const diff = (Date.now() - new Date(isoStr).getTime()) / 1000;
    if (diff < 60)   return "just now";
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
    return Math.floor(diff / 86400) + "d ago";
  }

  /** Debounce helper */
  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  // ── File selection ────────────────────────────────────────────

  /** Merge newly picked files into selectedFiles (avoid duplicates) */
  function addFiles(fileList) {
    const incoming = Array.from(fileList);
    const allowedTypes = [
      // Images
      "image/jpeg", "image/png", "image/jpg",
      // Videos
      "video/mp4", "video/quicktime", "video/x-msvideo",
      "video/x-matroska", "video/webm", "video/3gpp", "video/x-m4v",
    ];

    incoming.forEach(file => {
      if (!allowedTypes.includes(file.type)) return; // silently skip non-images
      const isDupe = selectedFiles.some(
        f => f.name === file.name && f.size === file.size
      );
      if (!isDupe) selectedFiles.push(file);
    });

    renderGallery();
    updateTransferButton();
  }

  /** Re-render the thumbnail grid */
  function renderGallery() {
    galleryGrid.innerHTML = "";

    if (selectedFiles.length === 0) {
      gallerySection.classList.remove("visible");
      return;
    }

    gallerySection.classList.add("visible");
    const photoCount = selectedFiles.filter(f => f.type.startsWith("image/")).length;
    const videoCount = selectedFiles.filter(f => f.type.startsWith("video/")).length;
    const parts = [];
    if (photoCount) parts.push(`${photoCount} photo${photoCount !== 1 ? "s" : ""}`);
    if (videoCount) parts.push(`${videoCount} video${videoCount !== 1 ? "s" : ""}`);
    galleryCount.textContent = parts.join(", ") + " selected";

    selectedFiles.slice(0, 50).forEach((file, idx) => {
      const item = document.createElement("div");
      item.className = "thumb-item";
      item.dataset.idx = idx;

      if (file.type.startsWith("video/")) {
        // ── Video thumbnail: seek to an early frame for preview ──────
        const video = document.createElement("video");
        video.muted = true;
        video.playsInline = true;
        video.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;";

        const url = URL.createObjectURL(file);
        video.src = url;
        video.addEventListener("loadedmetadata", () => {
          video.currentTime = Math.min(1, video.duration * 0.1);
        });
        video.addEventListener("seeked", () => URL.revokeObjectURL(url), { once: true });

        const badge = document.createElement("div");
        badge.className = "thumb-video-badge";
        badge.textContent = "▶";

        item.append(video, badge);
      } else {
        // ── Image thumbnail ──────────────────────────────────────────
        const img = document.createElement("img");
        img.alt = file.name;
        const url = URL.createObjectURL(file);
        img.onload  = () => URL.revokeObjectURL(url);
        img.onerror = () => { img.src = ""; item.style.background = "var(--bg-hover)"; };
        img.src = url;
        item.append(img);
      }

      const nameTag = document.createElement("div");
      nameTag.className = "thumb-name";
      nameTag.textContent = file.name;

      const sizeTag = document.createElement("div");
      sizeTag.className = "thumb-size";
      sizeTag.textContent = fmtSize(file.size);

      item.append(nameTag, sizeTag);
      galleryGrid.append(item);
    });
  }

  function clearSelection() {
    selectedFiles = [];
    fileInputPhotos.value = "";
    fileInputVideos.value = "";
    renderGallery();
    updateTransferButton();
    hideProgress();
    hideResult();
  }

  function updateTransferButton() {
    btnTransfer.disabled = selectedFiles.length === 0;
  }

  // ── Drag and drop ─────────────────────────────────────────────

  dropZone.addEventListener("dragenter", e => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });

  dropZone.addEventListener("dragover", e => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });

  dropZone.addEventListener("dragleave", e => {
    if (!dropZone.contains(e.relatedTarget)) {
      dropZone.classList.remove("drag-over");
    }
  });

  dropZone.addEventListener("drop", e => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  });

  // ── Picker buttons → trigger the correct native picker ───────
  // Each input has a focused accept value so Android shows the right app.
  btnPickPhotos.addEventListener("click", () => fileInputPhotos.click());
  btnPickVideos.addEventListener("click", () => fileInputVideos.click());

  fileInputPhotos.addEventListener("change", () => {
    if (fileInputPhotos.files?.length) addFiles(fileInputPhotos.files);
  });
  fileInputVideos.addEventListener("change", () => {
    if (fileInputVideos.files?.length) addFiles(fileInputVideos.files);
  });

  btnClear.addEventListener("click", clearSelection);

  // ── Progress helpers ──────────────────────────────────────────

  function showProgress() {
    progressSect.classList.add("visible");
    resultSection.classList.remove("visible");
  }

  function hideProgress() {
    progressSect.classList.remove("visible");
    uploadQueue.innerHTML = "";
    progBar.style.width = "0%";
    progLabel.textContent = "";
    progPct.textContent = "";
  }

  function hideResult() {
    resultSection.classList.remove("visible");
  }

  /** Create a queue row for one file */
  function createQueueRow(file) {
    const row = document.createElement("div");
    row.className = "queue-item";
    row.id = `q-${CSS.escape(file.name + file.size)}`;

    const icon = document.createElement("span");
    icon.className = "q-icon";

    const name = document.createElement("span");
    name.className = "q-name";
    name.textContent = file.name;

    const size = document.createElement("span");
    size.className = "q-size";
    size.textContent = fmtSize(file.size);

    const status = document.createElement("span");
    status.className = "q-status";

    row.append(icon, name, size, status);
    return { row, icon, status };
  }

  /** Update a queue row's visual state */
  function setRowState(row, icon, status, state, detail = "") {
    row.classList.remove("uploading", "done", "error");
    row.classList.add(state);
    if (state === "uploading") {
      icon.textContent = "⏳";
      status.textContent = "uploading…";
      status.style.color = "var(--text-faint)";
    } else if (state === "done") {
      icon.textContent = "✓";
      status.textContent = "saved";
      status.style.color = "var(--success)";
    } else if (state === "error") {
      icon.textContent = "✗";
      status.textContent = "failed";
      status.style.color = "var(--error)";
      if (detail) row.title = detail;
    }
  }

  // ── Upload ────────────────────────────────────────────────────

  /**
   * Upload photos in small batches so the Android browser doesn't
   * run out of memory on 50+ photo selections.
   * Each batch is a single multipart/form-data POST to /upload.
   */
  const BATCH_SIZE = 10; // files per HTTP request

  btnTransfer.addEventListener("click", async () => {
    if (selectedFiles.length === 0) return;

    const files = [...selectedFiles];
    const total = files.length;
    let saved  = 0;
    let errors = 0;
    let destFolder = "";

    // Build queue UI
    showProgress();
    uploadQueue.innerHTML = "";
    const rowMap = new Map(); // filename+size → { row, icon, status }

    files.forEach(file => {
      const { row, icon, status } = createQueueRow(file);
      uploadQueue.append(row);
      rowMap.set(file.name + file.size, { row, icon, status });
    });

    btnTransfer.disabled = true;

    // Helper: update overall progress bar
    const updateOverall = (done) => {
      const pct = Math.round((done / total) * 100);
      progBar.style.width = pct + "%";
      progLabel.textContent = done < total
        ? `Uploading ${done + 1} of ${total} file${total !== 1 ? "s" : ""}…`
        : `Finishing up…`;
      progPct.textContent = pct + "%";
    };

    updateOverall(0);

    // Slice into batches
    for (let start = 0; start < total; start += BATCH_SIZE) {
      const batch = files.slice(start, Math.min(start + BATCH_SIZE, total));

      // Mark batch items as uploading
      batch.forEach(f => {
        const r = rowMap.get(f.name + f.size);
        if (r) setRowState(r.row, r.icon, r.status, "uploading");
      });

      const formData = new FormData();
      batch.forEach(f => formData.append("files", f, f.name));

      try {
        const resp = await fetch("/upload", {
          method: "POST",
          body: formData,
          // No custom headers — browser sets multipart boundary automatically
        });

        if (!resp.ok) {
          // Network/server error for entire batch
          const errText = await resp.text().catch(() => "Unknown server error");
          batch.forEach(f => {
            const r = rowMap.get(f.name + f.size);
            if (r) setRowState(r.row, r.icon, r.status, "error", errText);
            errors++;
          });
        } else {
          const data = await resp.json();
          destFolder = data.destination || destFolder;

          // Map individual results back to rows
          (data.results || []).forEach(result => {
            const key = result.filename + (
              batch.find(f => f.name === result.filename)?.size ?? ""
            );
            const r = rowMap.get(key) ||
              // Fallback: match by name only
              [...rowMap.entries()].find(([k]) => k.startsWith(result.filename))?.[1];

            if (r) {
              if (result.status === "ok") {
                setRowState(r.row, r.icon, r.status, "done");
                saved++;
              } else {
                setRowState(r.row, r.icon, r.status, "error", result.reason || "");
                errors++;
              }
            }
          });
        }
      } catch (netErr) {
        // No connection / server down
        batch.forEach(f => {
          const r = rowMap.get(f.name + f.size);
          if (r) setRowState(r.row, r.icon, r.status, "error", netErr.message);
          errors++;
        });
      }

      updateOverall(start + batch.length);

      // Scroll latest item into view
      uploadQueue.lastElementChild?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }

    // ── Show result banner ─────────────────────────────────────
    progLabel.textContent = "Complete";
    progBar.style.width = "100%";
    progPct.textContent = "100%";

    resultSection.classList.add("visible");
    resultBanner.className = "result-banner " +
      (errors === 0 ? "success" : saved === 0 ? "failure" : "partial");

    const headline = document.getElementById("result-headline");
    const path     = document.getElementById("result-path");
    const errDetail = document.getElementById("result-errors");

    if (errors === 0) {
      headline.textContent = `${saved} file${saved !== 1 ? "s" : ""} transferred successfully ✓`;
    } else if (saved === 0) {
      headline.textContent = `Transfer failed — ${errors} error${errors !== 1 ? "s" : ""}`;
    } else {
      headline.textContent = `${saved} transferred, ${errors} failed`;
    }

    path.textContent = destFolder ? `Saved to: ${destFolder}` : "";
    errDetail.textContent = errors > 0
      ? "See file list above for details on failed items."
      : "";

    btnTransfer.disabled = false;

    // Refresh the desktop recent uploads widget
    refreshRecent();
  });

  // ── Desktop: Live recent uploads ──────────────────────────────

  async function refreshRecent() {
    if (!recentList) return;
    try {
      const resp = await fetch("/api/recent");
      if (!resp.ok) return;
      const data = await resp.json();

      // Update total counter
      const totalEl = document.getElementById("stat-total");
      if (totalEl) totalEl.textContent = data.total || 0;

      if (!data.uploads || data.uploads.length === 0) {
        recentList.innerHTML = "<div class='empty-state'>No transfers yet. Send some photos!</div>";
        return;
      }

      recentList.innerHTML = data.uploads
        .map(u => {
          const isVideo = /\.(mp4|mov|avi|mkv|webm|3gp|m4v)$/i.test(u.filename);
          return `
          <div class="recent-item">
            <span>${isVideo ? "🎬" : "📷"}</span>
            <span class="ri-name">${escHtml(u.filename)}</span>
            <span class="ri-size">${fmtSize(u.size_bytes)}</span>
            <span class="ri-time">${relTime(u.timestamp)}</span>
          </div>`;
        })
        .join("");
    } catch (_) { /* silently ignore — LAN might not be up yet */ }
  }

  function escHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Poll for updates every 10 s on the desktop dashboard
  const debouncedRefresh = debounce(refreshRecent, 500);
  if (recentList) {
    refreshRecent();
    setInterval(refreshRecent, 10_000);
  }

  // ── Initial state ─────────────────────────────────────────────
  updateTransferButton();

})();