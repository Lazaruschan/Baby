const PHOTOS = [
  ...Array.from({ length: 10 }, (_, index) => ({
    src: `assets/FACE_${index + 1}.png`,
    group: "寫真",
  })),
  ...Array.from({ length: 62 }, (_, index) => ({
    src: `assets/BABY OF M YIP_${index + 1}.png`,
    group: "時刻",
  })),
].map((photo, index) => ({
  ...photo,
  index,
  label: `#${index + 1}`,
  alt: `寶寶相簿 — 第 ${index + 1} 張相片`,
  filename: photo.src.split("/").pop(),
}));

const gallery = document.querySelector("#gallery");
const lightbox = document.querySelector("#lightbox");
const lightboxImage = document.querySelector("#lightbox-image");
const lightboxStage = document.querySelector("#lightbox-stage");
const lightboxCounter = document.querySelector("#lightbox-counter");
const lightboxClose = document.querySelector("#lightbox-close");
const lightboxDownload = document.querySelector("#lightbox-download");
const previousPhoto = document.querySelector("#previous-photo");
const nextPhoto = document.querySelector("#next-photo");
const toast = document.querySelector("#toast");

let currentIndex = 0;
let lastFocusedElement = null;
let zoom = 1;
let panX = 0;
let panY = 0;
let dragStart = null;
let pinchStart = null;
let lastTap = { time: 0, x: 0, y: 0 };
const activePointers = new Map();
const tapStarts = new Map();

function encodedPath(path) {
  return encodeURI(path);
}

function renderGallery() {
  const fragment = document.createDocumentFragment();

  PHOTOS.forEach((photo) => {
    const card = document.createElement("article");
    card.className = "photo-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `開啟${photo.alt}`);
    card.dataset.index = String(photo.index);

    const image = document.createElement("img");
    image.src = encodedPath(photo.src);
    image.alt = photo.alt;
    image.loading = photo.index === 0 ? "eager" : "lazy";
    image.decoding = "async";

    const meta = document.createElement("div");
    meta.className = "photo-meta";

    const label = document.createElement("div");
    label.className = "photo-label";
    label.innerHTML = `<strong>${photo.label}</strong><span>${photo.group}</span>`;

    const download = document.createElement("button");
    download.className = "download-button";
    download.type = "button";
    download.textContent = "下載";
    download.addEventListener("click", (event) => {
      event.stopPropagation();
      downloadPhoto(photo);
    });

    meta.append(label, download);
    card.append(image, meta);

    card.addEventListener("click", () => openLightbox(photo.index));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openLightbox(photo.index);
      }
    });

    fragment.append(card);
  });

  gallery.append(fragment);
}

function openLightbox(index) {
  lastFocusedElement = document.activeElement;
  currentIndex = index;
  resetTransform();
  updateLightboxPhoto();
  lightbox.classList.add("is-open");
  lightbox.setAttribute("aria-hidden", "false");
  document.body.classList.add("lightbox-open");
  lightboxClose.focus();
}

function closeLightbox() {
  lightbox.classList.remove("is-open");
  lightbox.setAttribute("aria-hidden", "true");
  document.body.classList.remove("lightbox-open");
  activePointers.clear();
  tapStarts.clear();
  resetTransform();

  if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
    lastFocusedElement.focus();
  }
}

function updateLightboxPhoto() {
  const photo = PHOTOS[currentIndex];
  lightboxImage.src = encodedPath(photo.src);
  lightboxImage.alt = photo.alt;
  lightboxCounter.textContent = `${currentIndex + 1} / ${PHOTOS.length}`;
  lightboxDownload.dataset.index = String(currentIndex);
  preloadNeighbor(currentIndex - 1);
  preloadNeighbor(currentIndex + 1);
}

function preloadNeighbor(index) {
  if (!PHOTOS[index]) {
    return;
  }

  const image = new Image();
  image.src = encodedPath(PHOTOS[index].src);
}

function showPreviousPhoto() {
  currentIndex = (currentIndex - 1 + PHOTOS.length) % PHOTOS.length;
  resetTransform();
  updateLightboxPhoto();
}

function showNextPhoto() {
  currentIndex = (currentIndex + 1) % PHOTOS.length;
  resetTransform();
  updateLightboxPhoto();
}

function resetTransform() {
  zoom = 1;
  panX = 0;
  panY = 0;
  dragStart = null;
  pinchStart = null;
  applyTransform();
}

function applyTransform() {
  lightboxImage.style.setProperty("--zoom", String(zoom));
  lightboxImage.style.setProperty("--pan-x", `${panX}px`);
  lightboxImage.style.setProperty("--pan-y", `${panY}px`);
}

function clampZoom(value) {
  return Math.min(4, Math.max(1, value));
}

function toggleZoom() {
  if (zoom > 1) {
    resetTransform();
    return;
  }

  zoom = 2.4;
  panX = 0;
  panY = 0;
  applyTransform();
}

function pointerDistance(first, second) {
  return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
}

function beginPointer(event) {
  activePointers.set(event.pointerId, event);
  tapStarts.set(event.pointerId, { x: event.clientX, y: event.clientY });
  lightboxStage.setPointerCapture(event.pointerId);

  if (activePointers.size === 2) {
    const pointers = Array.from(activePointers.values());
    pinchStart = {
      distance: pointerDistance(pointers[0], pointers[1]),
      zoom,
    };
    dragStart = null;
    return;
  }

  dragStart = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    panX,
    panY,
  };
}

function movePointer(event) {
  if (!activePointers.has(event.pointerId)) {
    return;
  }

  activePointers.set(event.pointerId, event);

  if (activePointers.size === 2 && pinchStart) {
    event.preventDefault();
    const pointers = Array.from(activePointers.values());
    const nextDistance = pointerDistance(pointers[0], pointers[1]);
    zoom = clampZoom(pinchStart.zoom * (nextDistance / pinchStart.distance));
    if (zoom === 1) {
      panX = 0;
      panY = 0;
    }
    applyTransform();
    return;
  }

  if (!dragStart || dragStart.pointerId !== event.pointerId || zoom <= 1) {
    return;
  }

  event.preventDefault();
  lightboxStage.classList.add("is-dragging");
  panX = dragStart.panX + event.clientX - dragStart.startX;
  panY = dragStart.panY + event.clientY - dragStart.startY;
  applyTransform();
}

function finishPointer(event) {
  const tapStart = tapStarts.get(event.pointerId);
  activePointers.delete(event.pointerId);
  tapStarts.delete(event.pointerId);
  lightboxStage.classList.remove("is-dragging");

  if (activePointers.size < 2) {
    pinchStart = null;
  }

  if (!tapStart) {
    return;
  }

  const moved = Math.hypot(event.clientX - tapStart.x, event.clientY - tapStart.y);
  const now = Date.now();
  const doubleTap = now - lastTap.time < 280 && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 32;

  if (moved < 8 && doubleTap) {
    toggleZoom();
    lastTap = { time: 0, x: 0, y: 0 };
    return;
  }

  lastTap = { time: now, x: event.clientX, y: event.clientY };
}

async function downloadPhoto(photo) {
  const url = encodedPath(photo.src);
  const filename = photo.filename;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Unable to fetch ${filename}`);
    }

    const blob = await response.blob();
    const file = new File([blob], filename, { type: blob.type || "image/png" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "寶寶相簿",
        text: `儲存寶寶相簿 ${photo.label}`,
      });
      showToast("請在分享選單選擇儲存到相片。");
      return;
    }

    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
    showToast("開始下載。");
  } catch (error) {
    if (error && error.name === "AbortError") {
      return;
    }

    window.open(url, "_blank", "noopener");
    showToast("已開啟相片。手機可長按圖片儲存。");
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 3600);
}

document.addEventListener("keydown", (event) => {
  if (!lightbox.classList.contains("is-open")) {
    return;
  }

  if (event.key === "Escape") {
    closeLightbox();
  } else if (event.key === "ArrowLeft") {
    showPreviousPhoto();
  } else if (event.key === "ArrowRight") {
    showNextPhoto();
  }
});

lightbox.addEventListener("click", (event) => {
  if (event.target.matches("[data-close-lightbox]")) {
    closeLightbox();
  }
});

lightboxClose.addEventListener("click", closeLightbox);
previousPhoto.addEventListener("click", showPreviousPhoto);
nextPhoto.addEventListener("click", showNextPhoto);
lightboxDownload.addEventListener("click", () => downloadPhoto(PHOTOS[currentIndex]));
lightboxImage.addEventListener("dblclick", toggleZoom);

lightboxStage.addEventListener("wheel", (event) => {
  if (!lightbox.classList.contains("is-open")) {
    return;
  }

  event.preventDefault();
  zoom = clampZoom(zoom + (event.deltaY < 0 ? 0.22 : -0.22));
  if (zoom === 1) {
    panX = 0;
    panY = 0;
  }
  applyTransform();
}, { passive: false });

lightboxStage.addEventListener("pointerdown", beginPointer);
lightboxStage.addEventListener("pointermove", movePointer, { passive: false });
lightboxStage.addEventListener("pointerup", finishPointer);
lightboxStage.addEventListener("pointercancel", finishPointer);

renderGallery();
