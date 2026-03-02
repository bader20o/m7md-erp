function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read image file."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load image."));
    image.src = src;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

export async function openImageCropper({
  file,
  title = "Crop image",
  aspectRatio = 1,
  outputType = "image/jpeg",
  outputSize = 900,
  quality = 0.92,
  cropShape = "rect"
}) {
  if (!file) return null;

  const sourceDataUrl = await toDataUrl(file);
  const sourceImage = await loadImage(sourceDataUrl);
  const safeAspect = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1;

  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className =
      "fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 opacity-0 transition-opacity duration-200";

    const isRound = cropShape === "round";

    backdrop.innerHTML = `
      <div class="w-full max-w-3xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden transform scale-95 transition-transform duration-200 flex flex-col max-h-[90vh]">
        <div class="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h3 class="text-lg font-heading font-bold text-text">${title}</h3>
          <button type="button" id="cropper-close" class="w-8 h-8 rounded-full border border-border text-muted hover:text-text hover:border-text transition-colors">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <div class="p-5 space-y-4 flex-1 overflow-hidden flex flex-col">
          <div class="relative rounded-xl border border-border bg-bg/70 flex-1 overflow-hidden flex items-center justify-center cursor-grab" id="cropper-container">
            <img id="cropper-image" src="${sourceDataUrl}" alt="Image preview" class="max-w-full max-h-full object-contain pointer-events-none select-none transition-transform duration-100 origin-center">
            <div id="cropper-overlay" class="absolute border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] pointer-events-none ${isRound ? 'rounded-full' : 'rounded-lg'} flex-shrink-0"></div>
          </div>
          <div class="shrink-0 pt-2">
            <label for="cropper-zoom" class="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Zoom</label>
            <input id="cropper-zoom" type="range" min="1" max="4" step="0.01" value="1" class="w-full accent-[var(--primary)]">
          </div>
        </div>
        <div class="px-5 py-4 border-t border-border bg-bg/40 flex justify-end gap-3 shrink-0">
          <button type="button" id="cropper-cancel" class="px-4 py-2 rounded-lg border border-border text-text hover:border-text transition-colors">Cancel</button>
          <button type="button" id="cropper-confirm" class="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors">Confirm</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    const modal = backdrop.firstElementChild;
    const container = backdrop.querySelector("#cropper-container");
    const image = backdrop.querySelector("#cropper-image");
    const overlay = backdrop.querySelector("#cropper-overlay");
    const zoomInput = backdrop.querySelector("#cropper-zoom");
    const closeBtn = backdrop.querySelector("#cropper-close");
    const cancelBtn = backdrop.querySelector("#cropper-cancel");
    const confirmBtn = backdrop.querySelector("#cropper-confirm");
    let isClosed = false;

    let panX = 0;
    let panY = 0;
    let isDragging = false;
    let startX = 0;
    let startY = 0;

    const onEsc = (event) => {
      if (event.key !== "Escape") return;
      close(null);
    };

    function updateOverlaySize() {
      const cRect = container.getBoundingClientRect();
      const padding = 32; // minimum padding from edges
      let frameW = cRect.width - padding;
      let frameH = frameW / safeAspect;

      if (frameH > cRect.height - padding) {
        frameH = cRect.height - padding;
        frameW = frameH * safeAspect;
      }

      overlay.style.width = `${frameW}px`;
      overlay.style.height = `${frameH}px`;
    }

    const onResize = () => updateOverlaySize();
    window.addEventListener("resize", onResize);

    function applyTransform() {
      const zoom = Number(zoomInput.value || 1);
      if (isDragging) {
        image.style.transitionDuration = '0s';
      } else {
        image.style.transitionDuration = '100ms';
      }
      image.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    }

    // Mouse events
    container.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX - panX;
      startY = e.clientY - panY;
      container.style.cursor = 'grabbing';
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      panX = e.clientX - startX;
      panY = e.clientY - startY;
      applyTransform();
    });

    window.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      container.style.cursor = 'grab';
      applyTransform(); // restore transition
    });

    // Touch events
    container.addEventListener('touchstart', (e) => {
      isDragging = true;
      startX = e.touches[0].clientX - panX;
      startY = e.touches[0].clientY - panY;
      if (e.cancelable) e.preventDefault();
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      panX = e.touches[0].clientX - startX;
      panY = e.touches[0].clientY - startY;
      applyTransform();
    }, { passive: false });

    window.addEventListener('touchend', () => {
      if (!isDragging) return;
      isDragging = false;
      applyTransform(); // restore transition
    });

    function close(result) {
      if (isClosed) return;
      isClosed = true;
      document.removeEventListener("keydown", onEsc);
      window.removeEventListener("resize", onResize);
      backdrop.classList.add("opacity-0");
      modal.classList.remove("scale-100");
      modal.classList.add("scale-95");
      setTimeout(() => {
        backdrop.remove();
        resolve(result);
      }, 180);
    }

    async function confirmCrop() {
      confirmBtn.disabled = true;
      confirmBtn.classList.add("opacity-70", "cursor-not-allowed");

      try {
        const imgRect = image.getBoundingClientRect();
        const overRect = overlay.getBoundingClientRect();

        const scaleX = sourceImage.naturalWidth / imgRect.width;
        const scaleY = sourceImage.naturalHeight / imgRect.height;

        const sx = (overRect.left - imgRect.left) * scaleX;
        const sy = (overRect.top - imgRect.top) * scaleY;
        const sWidth = overRect.width * scaleX;
        const sHeight = overRect.height * scaleY;

        const canvas = document.createElement("canvas");
        const widthByAspect = safeAspect >= 1 ? outputSize : Math.round(outputSize * safeAspect);
        const heightByAspect = safeAspect >= 1 ? Math.round(outputSize / safeAspect) : outputSize;
        canvas.width = Math.max(1, widthByAspect);
        canvas.height = Math.max(1, heightByAspect);

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Unable to create image preview.");
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(sourceImage, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);

        const blob = await canvasToBlob(canvas, outputType, quality);
        if (!blob) {
          throw new Error("Unable to crop image.");
        }

        close(blob);
      } catch (error) {
        close(null);
        window.toast?.(error.message || "Image crop failed.", "error");
      }
    }

    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) close(null);
    });
    zoomInput.addEventListener("input", applyTransform);
    closeBtn.addEventListener("click", () => close(null));
    cancelBtn.addEventListener("click", () => close(null));
    confirmBtn.addEventListener("click", confirmCrop);
    document.addEventListener("keydown", onEsc);

    requestAnimationFrame(() => {
      backdrop.classList.remove("opacity-0");
      modal.classList.remove("scale-95");
      modal.classList.add("scale-100");
      updateOverlaySize();
      applyTransform();
    });
  });
}
