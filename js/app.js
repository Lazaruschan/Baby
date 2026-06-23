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
const sliderViewport = document.querySelector("#slider-viewport");
const sliderTrack = document.querySelector("#slider-track");
const sliderCounter = document.querySelector("#slider-counter");
const sliderPrevious = document.querySelector("#slider-previous");
const sliderNext = document.querySelector("#slider-next");
const sliderDownload = document.querySelector("#slider-download");
const sliderOpen = document.querySelector("#slider-open");
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
let sliderIndex = 0;
let lastFocusedElement = null;
let zoom = 1;
let panX = 0;
let panY = 0;
let dragStart = null;
let pinchStart = null;
let lastTap = { time: 0, x: 0, y: 0 };
let sliderDragStartX = 0;
let sliderDidDrag = false;
const activePointers = new Map();
const tapStarts = new Map();

function encodedPath(path) {
  return encodeURI(path);
}

function renderGallery() {
  const fragment = document.createDocumentFragment();

  PHOTOS.forEach((photo) => {
    const slide = document.createElement("figure");
    slide.className = "slider-slide";
    slide.dataset.index = String(photo.index);

    const image = document.createElement("img");
    image.src = encodedPath(photo.src);
    image.alt = photo.alt;
    image.loading = photo.index < 3 ? "eager" : "lazy";
    image.decoding = "async";
    image.draggable = false;

    slide.append(image);
    slide.addEventListener("click", () => {
      if (sliderDidDrag) {
        return;
      }

      openLightbox(photo.index);
    });
    fragment.append(slide);
  });

  sliderTrack.append(fragment);
  sliderIndex = 0;
  sliderViewport.scrollLeft = 0;
  updateSliderCounter();
  window.requestAnimationFrame(() => goToSlide(0, false));
}

function updateSliderCounter() {
  sliderCounter.textContent = `${sliderIndex + 1} / ${PHOTOS.length}`;
  gallery.setAttribute("aria-label", `寶寶相片輪播，目前第 ${sliderIndex + 1} 張，共 ${PHOTOS.length} 張`);
}

function goToSlide(index, smooth = true) {
  sliderIndex = (index + PHOTOS.length) % PHOTOS.length;
  const slide = sliderTrack.children[sliderIndex];
  if (!slide) {
    return;
  }

  const left = slide.offsetLeft - (sliderViewport.clientWidth - slide.clientWidth) / 2;
  sliderViewport.scrollTo({
    left,
    behavior: smooth ? "smooth" : "auto",
  });
  updateSliderCounter();
}

function syncSliderFromScroll() {
  const viewportCenter = sliderViewport.scrollLeft + sliderViewport.clientWidth / 2;
  let closestIndex = sliderIndex;
  let closestDistance = Infinity;

  Array.from(sliderTrack.children).forEach((slide, index) => {
    const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
    const distance = Math.abs(slideCenter - viewportCenter);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndex = index;
    }
  });

  if (closestIndex !== sliderIndex) {
    sliderIndex = closestIndex;
    updateSliderCounter();
  }
}

function beginSliderDrag(event) {
  sliderDragStartX = event.clientX;
  sliderDidDrag = false;
}

function moveSliderDrag(event) {
  if (Math.abs(event.clientX - sliderDragStartX) > 8) {
    sliderDidDrag = true;
  }
}

function finishSliderDrag() {
  window.setTimeout(() => {
    sliderDidDrag = false;
  }, 0);
}

function openLightbox(index) {
  lastFocusedElement = document.activeElement;
  currentIndex = index;
  sliderIndex = index;
  resetTransform();
  updateLightboxPhoto();
  updateSliderCounter();
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

  goToSlide(currentIndex, false);
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

sliderPrevious.addEventListener("click", () => goToSlide(sliderIndex - 1));
sliderNext.addEventListener("click", () => goToSlide(sliderIndex + 1));
sliderDownload.addEventListener("click", () => downloadPhoto(PHOTOS[sliderIndex]));
sliderOpen.addEventListener("click", () => openLightbox(sliderIndex));

sliderViewport.addEventListener("scroll", () => {
  window.clearTimeout(syncSliderFromScroll.timeout);
  syncSliderFromScroll.timeout = window.setTimeout(syncSliderFromScroll, 80);
}, { passive: true });

sliderViewport.addEventListener("pointerdown", beginSliderDrag);
sliderViewport.addEventListener("pointermove", moveSliderDrag);
sliderViewport.addEventListener("pointerup", finishSliderDrag);
sliderViewport.addEventListener("pointercancel", finishSliderDrag);

gallery.addEventListener("keydown", (event) => {
  if (lightbox.classList.contains("is-open")) {
    return;
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    goToSlide(sliderIndex - 1);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    goToSlide(sliderIndex + 1);
  }
});

renderGallery();
