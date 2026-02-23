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

function getCropFramePercent(aspectRatio) {
  let width = 78;
  let height = width / aspectRatio;

  if (height > 78) {
    height = 78;
    width = height * aspectRatio;
  }

  return { width, height };
}

export async function openImageCropper({
  file,
  title = "Crop image",
  aspectRatio = 1,
  outputType = "image/jpeg",
  outputSize = 900,
  quality = 0.92
}) {
  if (!file) return null;

  const sourceDataUrl = await toDataUrl(file);
  const sourceImage = await loadImage(sourceDataUrl);
  const safeAspect = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1;
  const frame = getCropFramePercent(safeAspect);

  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className =
      "fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 opacity-0 transition-opacity duration-200";
    backdrop.innerHTML = `
      <div class="w-full max-w-3xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden transform scale-95 transition-transform duration-200">
        <div class="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 class="text-lg font-heading font-bold text-text">${title}</h3>
          <button type="button" id="cropper-close" class="w-8 h-8 rounded-full border border-border text-muted hover:text-text hover:border-text transition-colors">
            <span aria-hidden="true">&times;</span>
          </button>
        </div>
        <div class="p-5 space-y-4">
          <div class="relative rounded-xl border border-border bg-bg/70 h-[360px] md:h-[440px] overflow-hidden flex items-center justify-center">
            <img id="cropper-image" src="${sourceDataUrl}" alt="Image preview" class="max-w-full max-h-full object-contain pointer-events-none select-none transition-transform duration-100">
            <div class="absolute border-2 border-white/90 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] pointer-events-none" style="width:${frame.width}%;height:${frame.height}%;"></div>
          </div>
          <div>
            <label for="cropper-zoom" class="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Zoom</label>
            <input id="cropper-zoom" type="range" min="1" max="3" step="0.01" value="1" class="w-full accent-[var(--primary)]">
          </div>
        </div>
        <div class="px-5 py-4 border-t border-border bg-bg/40 flex justify-end gap-3">
          <button type="button" id="cropper-cancel" class="px-4 py-2 rounded-lg border border-border text-text hover:border-text transition-colors">Cancel</button>
          <button type="button" id="cropper-confirm" class="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors">Confirm</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    const modal = backdrop.firstElementChild;
    const image = backdrop.querySelector("#cropper-image");
    const zoomInput = backdrop.querySelector("#cropper-zoom");
    const closeBtn = backdrop.querySelector("#cropper-close");
    const cancelBtn = backdrop.querySelector("#cropper-cancel");
    const confirmBtn = backdrop.querySelector("#cropper-confirm");
    let isClosed = false;

    const onEsc = (event) => {
      if (event.key !== "Escape") return;
      close(null);
    };

    function applyZoom() {
      const zoom = Number(zoomInput.value || 1);
      image.style.transform = `scale(${zoom})`;
    }

    function close(result) {
      if (isClosed) return;
      isClosed = true;
      document.removeEventListener("keydown", onEsc);
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
        const zoom = Math.max(1, Number(zoomInput.value || 1));
        const imageAspect = sourceImage.width / sourceImage.height;

        let baseCropWidth;
        let baseCropHeight;
        if (imageAspect >= safeAspect) {
          baseCropHeight = sourceImage.height;
          baseCropWidth = baseCropHeight * safeAspect;
        } else {
          baseCropWidth = sourceImage.width;
          baseCropHeight = baseCropWidth / safeAspect;
        }

        const cropWidth = baseCropWidth / zoom;
        const cropHeight = baseCropHeight / zoom;
        const sx = Math.max(0, (sourceImage.width - cropWidth) / 2);
        const sy = Math.max(0, (sourceImage.height - cropHeight) / 2);

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
        ctx.drawImage(sourceImage, sx, sy, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);

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
    zoomInput.addEventListener("input", applyZoom);
    closeBtn.addEventListener("click", () => close(null));
    cancelBtn.addEventListener("click", () => close(null));
    confirmBtn.addEventListener("click", confirmCrop);
    document.addEventListener("keydown", onEsc);

    requestAnimationFrame(() => {
      backdrop.classList.remove("opacity-0");
      modal.classList.remove("scale-95");
      modal.classList.add("scale-100");
      applyZoom();
    });
  });
}
