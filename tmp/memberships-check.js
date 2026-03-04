// frontend/src/lib/api.js
var ApiError = class extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
  }
};
async function apiFetch(path, options = {}) {
  const baseUrl = "/api";
  const url = `${baseUrl}${path}`;
  const headers = {
    "Accept": "application/json",
    ...options.body ? { "Content-Type": "application/json" } : {},
    ...options.headers
  };
  const fetchOptions = {
    ...options,
    credentials: "include",
    // VERY IMPORTANT
    headers
  };
  if (fetchOptions.body && typeof fetchOptions.body !== "string") {
    fetchOptions.body = JSON.stringify(fetchOptions.body);
  }
  try {
    const response = await fetch(url, fetchOptions);
    if (response.status === 204) return null;
    let json;
    try {
      json = await response.json();
    } catch (e) {
      if (!response.ok) {
        throw new ApiError("NETWORK_ERROR", `HTTP Error ${response.status}`);
      }
      return null;
    }
    if (!json.success) {
      const { code, message, details } = json.error || {};
      throw new ApiError(code || "UNKNOWN_ERROR", message || "An unknown error occurred", details);
    }
    return json.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("NETWORK_ERROR", "Network error. Please check your connection.", error.message);
  }
}
function buildQuery(params) {
  if (!params) return "";
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== void 0 && value !== null && value !== "") {
      searchParams.append(key, value);
    }
  }
  const stringified = searchParams.toString();
  return stringified ? `?${stringified}` : "";
}

// frontend/src/components/ui/ImageCropper.js
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
async function openImageCropper({
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
    backdrop.className = "fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 opacity-0 transition-opacity duration-200";
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
            <div id="cropper-overlay" class="absolute border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] pointer-events-none ${isRound ? "rounded-full" : "rounded-lg"} flex-shrink-0"></div>
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
      const padding = 32;
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
        image.style.transitionDuration = "0s";
      } else {
        image.style.transitionDuration = "100ms";
      }
      image.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    }
    container.addEventListener("mousedown", (e) => {
      isDragging = true;
      startX = e.clientX - panX;
      startY = e.clientY - panY;
      container.style.cursor = "grabbing";
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      panX = e.clientX - startX;
      panY = e.clientY - startY;
      applyTransform();
    });
    window.addEventListener("mouseup", () => {
      if (!isDragging) return;
      isDragging = false;
      container.style.cursor = "grab";
      applyTransform();
    });
    container.addEventListener("touchstart", (e) => {
      isDragging = true;
      startX = e.touches[0].clientX - panX;
      startY = e.touches[0].clientY - panY;
      if (e.cancelable) e.preventDefault();
    }, { passive: false });
    window.addEventListener("touchmove", (e) => {
      if (!isDragging) return;
      panX = e.touches[0].clientX - startX;
      panY = e.touches[0].clientY - startY;
      applyTransform();
    }, { passive: false });
    window.addEventListener("touchend", () => {
      if (!isDragging) return;
      isDragging = false;
      applyTransform();
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

// frontend/src/components/ui/Skeleton.js
function CardSkeleton() {
  return `
    <div class="bg-surface rounded-2xl p-5 border border-border flex flex-col gap-4">
      <div class="skeleton h-5 w-1/3"></div>
      <div class="skeleton h-4 w-1/2"></div>
      <div class="mt-4 flex justify-between items-center">
        <div class="skeleton h-6 w-20"></div>
        <div class="skeleton h-8 w-24 rounded-lg"></div>
      </div>
    </div>
  `;
}

// frontend/src/lib/uploads.js
async function uploadLocalFile(file, { folder = "general" } = {}) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);
  const response = await fetch("/api/uploads/local", {
    method: "POST",
    credentials: "include",
    body: formData
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError("UPLOAD_FAILED", "Upload failed.");
  }
  if (!response.ok || !payload?.success) {
    const message = payload?.error?.message || "Upload failed.";
    throw new ApiError(payload?.error?.code || "UPLOAD_FAILED", message, payload?.error?.details || null);
  }
  return payload.data.fileUrl;
}

// frontend/src/components/ui/ColorInput.js
function ColorInput({ id = "", name = "", value = "#3B82F6", className = "", onChangeAttr = "" } = {}) {
  const uniqueId = id || `color-${Math.random().toString(36).substr(2, 9)}`;
  const textId = `${uniqueId}-text`;
  const popoverId = `${uniqueId}-popover`;
  const swatchId = `${uniqueId}-swatch`;
  const errorId = `${uniqueId}-error`;
  const PRESET_COLORS = [
    "#dbeafe",
    "#bfdbfe",
    "#93c5fd",
    "#60a5fa",
    "#3b82f6",
    "#2563eb",
    "#1d4ed8",
    "#1e40af",
    "#0ea5e9",
    "#0284c7",
    "#0369a1",
    "#7dd3fc",
    "#38bdf8",
    "#22d3ee",
    "#818cf8",
    "#a5b4fc",
    "#94a3b8",
    "#64748b",
    "#334155",
    "#0f172a"
  ];
  if (typeof window !== "undefined" && !window._colorInputV2Initialized) {
    window._colorInputV2Initialized = true;
    window.toggleColorPopover = (popoverId2, event) => {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      const el = document.getElementById(popoverId2);
      if (el) {
        const isHidden = el.classList.contains("hidden");
        document.querySelectorAll(".custom-color-popover").forEach((p) => p.classList.add("hidden"));
        if (isHidden) {
          el.classList.remove("hidden");
        }
      }
    };
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".color-input-container")) {
        document.querySelectorAll(".custom-color-popover").forEach((p) => p.classList.add("hidden"));
      }
    });
    window.handleColorChangeCore = (val, textId2, swatchId2, errorId2, userOnChange) => {
      const isValid = /^#([0-9A-F]{3}){1,2}$/i.test(val);
      const errorEl = document.getElementById(errorId2);
      const swatchEl = document.getElementById(swatchId2);
      const textEl = document.getElementById(textId2);
      if (textEl && textEl.value !== val) {
        textEl.value = val;
      }
      if (isValid) {
        if (errorEl) errorEl.classList.add("hidden");
        if (textEl) textEl.classList.remove("border-danger", "text-danger");
        if (swatchEl) {
          swatchEl.style.backgroundColor = val;
          const popPreview = document.getElementById(swatchId2 + "-preview");
          if (popPreview) popPreview.style.backgroundColor = val;
          const popInput = document.getElementById(textId2 + "-pop");
          if (popInput && popInput.value !== val) popInput.value = val;
        }
        if (userOnChange && textEl) {
          const func = new Function("event", userOnChange).bind(textEl);
          func({ target: textEl });
        }
      } else {
        if (val !== "") {
          if (errorEl) errorEl.classList.remove("hidden");
          if (textEl) textEl.classList.add("border-danger", "text-danger");
        } else {
          if (errorEl) errorEl.classList.add("hidden");
          if (textEl) textEl.classList.remove("border-danger", "text-danger");
        }
        if (swatchEl) swatchEl.style.backgroundColor = "transparent";
      }
    };
    window.handleColorTextChange = (inputEl, swatchId2, errorId2, userOnChange) => {
      let val = inputEl.value.trim();
      if (val.length > 0 && !val.startsWith("#")) {
        val = "#" + val;
        inputEl.value = val;
      }
      window.handleColorChangeCore(val, inputEl.id, swatchId2, errorId2, userOnChange);
    };
    window.handlePresetClick = (val, textId2, swatchId2, errorId2, popoverId2, userOnChange) => {
      window.handleColorChangeCore(val, textId2, swatchId2, errorId2, userOnChange);
      document.getElementById(popoverId2)?.classList.add("hidden");
    };
  }
  const textOnChange = `window.handleColorTextChange(this, '${swatchId}', '${errorId}', \`${onChangeAttr}\`)`;
  const popInputOnChange = `window.handleColorTextChange(this, '${swatchId}', '${errorId}', \`${onChangeAttr}\`)`;
  const presetsHtml = PRESET_COLORS.map(
    (c) => `<button type="button" onclick="window.handlePresetClick('${c}', '${textId}', '${swatchId}', '${errorId}', '${popoverId}', \`${onChangeAttr}\`)" class="w-8 h-8 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary hover:scale-110 hover:shadow-md transition-all duration-200" style="background-color: ${c}"></button>`
  ).join("");
  return `
      <div class="relative flex flex-col w-full color-input-container">
         <div class="flex items-center w-full bg-bg border border-border rounded-xl focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all duration-200 shadow-sm hover:shadow ${className}">
            
            <input 
                type="text" 
                id="${textId}"
                ${name ? `name="${name}"` : ""}
                value="${value}" 
                placeholder="#RRGGBB"
                oninput="${textOnChange}"
                class="flex-1 bg-transparent px-4 py-3 text-text placeholder-muted focus:outline-none uppercase"
            >
            
            <button 
                type="button"
                onclick="window.toggleColorPopover('${popoverId}', event)"
                class="relative flex items-center justify-center p-3 ltr:border-l rtl:border-r border-border hover:bg-primary/10 transition-colors rounded-e-xl cursor-pointer"
            >
                <div 
                    id="${swatchId}"
                    class="w-6 h-6 rounded-md shadow-sm border border-border overflow-hidden flex-shrink-0 pointer-events-none"
                    style="background-color: ${value};"
                ></div>
            </button>
         </div>

         <!-- Custom Popover Menu -->
         <div id="${popoverId}" class="custom-color-popover hidden absolute top-[calc(100%+8px)] ltr:right-0 rtl:left-0 z-50 w-64 bg-surface border border-primary/20 rounded-xl shadow-xl p-4 animate-in fade-in slide-in-from-top-2">
            <div class="mb-3">
                <label class="text-xs font-semibold text-muted mb-2 block">Preset Colors</label>
                <div class="grid grid-cols-5 gap-2">
                    ${presetsHtml}
                </div>
            </div>
            <div class="border-t border-border pt-3">
                <label class="text-xs font-semibold text-muted mb-2 block">Custom Hex</label>
                <div class="flex items-center gap-2">
                   <div 
                      id="${swatchId}-preview"
                      class="w-8 h-8 rounded-md shadow-inner border border-border flex-shrink-0"
                      style="background-color: ${value};"
                   ></div>
                   <input
                    type="text"
                    id="${textId}-pop"
                    value="${value}"
                    oninput="${popInputOnChange}"
                    class="flex-1 bg-bg border border-border rounded-md px-3 py-1.5 text-sm uppercase focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
                  >
                </div>
            </div>
         </div>

         <span id="${errorId}" class="hidden text-[10px] text-danger mt-1 ltr:ml-1 rtl:mr-1 absolute -bottom-5">Invalid hex color</span>
      </div>
    `;
}

// frontend/src/pages/admin/Memberships.js
function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function formatDate(value, fallback = "Not available") {
  if (!value) return fallback;
  return new Date(value).toLocaleString(void 0, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
function planDisplayName(plan) {
  return plan?.nameEn || plan?.nameAr || plan?.tier || "Membership Plan";
}
function badgeClass(status) {
  if (status === "ACTIVE") return "bg-success/15 text-success border-success/20";
  if (status === "PENDING") return "bg-primary/15 text-primary border-primary/20";
  if (status === "REJECTED") return "bg-danger/15 text-danger border-danger/20";
  return "bg-muted/15 text-muted border-border";
}
function emptyBenefitDraft() {
  return {
    id: void 0,
    code: "",
    titleEn: "",
    titleAr: "",
    descriptionEn: "",
    descriptionAr: "",
    limitCount: 1,
    isActive: true
  };
}
var PLAN_TIER_OPTIONS = [
  { value: "BRONZE", label: "Bronze" },
  { value: "SILVER", label: "Silver" },
  { value: "GOLD", label: "Gold" },
  { value: "PLATINUM", label: "Platinum" }
];
var PLAN_DURATION_OPTIONS = [1, 3, 6, 12, 24];
var PLAN_COLOR_PRESETS = [
  { label: "Blue", value: "#3B82F6" },
  { label: "Sky", value: "#0EA5E9" },
  { label: "Purple", value: "#8B5CF6" },
  { label: "Green", value: "#22C55E" },
  { label: "Gold", value: "#B8860B" }
];
function sanitizeHexColor(value, fallback = "#3B82F6") {
  const normalized = String(value ?? "").trim();
  return /^#([0-9A-F]{3}){1,2}$/i.test(normalized) ? normalized.toUpperCase() : fallback;
}
function hexToRgba(hex, alpha) {
  const normalized = sanitizeHexColor(hex).replace("#", "");
  const expanded = normalized.length === 3 ? normalized.split("").map((char) => `${char}${char}`).join("") : normalized;
  const value = Number.parseInt(expanded, 16);
  const r = value >> 16 & 255;
  const g = value >> 8 & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function formatDurationLabel(months) {
  const numeric = Number(months) || 0;
  return `${numeric} month${numeric === 1 ? "" : "s"}`;
}
function formatPreviewPrice(value) {
  const parsed = Number(value);
  return `${Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00"} JOD`;
}
function formatPreviewPeriod(months) {
  const numeric = Number(months) || 0;
  if (numeric === 12) return "/year";
  if (numeric === 1) return "/month";
  return `/${numeric} months`;
}
function benefitSummaryLabel(benefit, index) {
  const code = String(benefit?.code || "").trim();
  return benefit?.titleEn?.trim() || benefit?.titleAr?.trim() || code || `Benefit ${index + 1}`;
}
function resolveLocalizedText(lang, enValue, arValue, fallback = "") {
  return lang === "ar" ? String(arValue || "").trim() || String(enValue || "").trim() || fallback : String(enValue || "").trim() || String(arValue || "").trim() || fallback;
}
function AdminMemberships() {
  window.onMount = async () => {
    const plansGrid = document.getElementById("plans-grid");
    const subscribersGrid = document.getElementById("subscribers-grid");
    const pendingCountNode = document.getElementById("pending-count");
    const tabs = Array.from(document.querySelectorAll("[data-membership-tab]"));
    const tabPanels = {
      plans: document.getElementById("plans-panel"),
      subscribers: document.getElementById("subscribers-panel")
    };
    const subscriberSearchForm = document.getElementById("subscriber-search-form");
    const subscriberSearchInput = document.getElementById("subscriber-search");
    const statusButtons = Array.from(document.querySelectorAll("[data-subscriber-status]"));
    const createPlanBtn = document.getElementById("create-plan-btn");
    const planModal = document.getElementById("plan-modal");
    const planModalContent = document.getElementById("plan-modal-content");
    const subscriberModal = document.getElementById("subscriber-modal");
    const subscriberModalContent = document.getElementById("subscriber-modal-content");
    const state = {
      currentTab: "plans",
      subscriberStatus: "all",
      subscriberQuery: "",
      plans: [],
      subscribers: [],
      subscribersMeta: { pendingCount: 0, countsByStatus: {} },
      editingPlanId: null,
      planBenefits: [],
      currentSubscriberDetail: null
    };
    function openModal(node) {
      node.classList.remove("hidden");
      document.body.classList.add("overflow-hidden");
    }
    function closeModal(node) {
      node.classList.add("hidden");
      if (planModal.classList.contains("hidden") && subscriberModal.classList.contains("hidden")) {
        document.body.classList.remove("overflow-hidden");
      }
    }
    function syncTabs() {
      tabs.forEach((button) => {
        const isActive = button.getAttribute("data-membership-tab") === state.currentTab;
        button.className = `px-4 py-2 rounded-xl text-sm font-bold transition-colors ${isActive ? "bg-primary text-white" : "bg-bg border border-border text-muted hover:text-text hover:border-primary/40"}`;
      });
      Object.entries(tabPanels).forEach(([key, panel]) => {
        if (!panel) return;
        panel.classList.toggle("hidden", key !== state.currentTab);
      });
    }
    async function cropAndUpload(file, title) {
      const cropped = await openImageCropper({
        file,
        title,
        aspectRatio: 4 / 3,
        outputType: "image/jpeg",
        outputSize: 1200
      });
      if (!cropped) return null;
      const uploadFile = new File([cropped], `membership_${Date.now()}.jpg`, {
        type: cropped.type || "image/jpeg"
      });
      return uploadLocalFile(uploadFile, { folder: "memberships" });
    }
    function renderPlans() {
      if (!state.plans.length) {
        plansGrid.innerHTML = `<div class="col-span-full rounded-2xl border border-border bg-surface p-10 text-center text-muted">No plans found. Use Create Plan to add one.</div>`;
        return;
      }
      plansGrid.innerHTML = state.plans.map((plan) => `
        <article class="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col">
          <div class="aspect-[16/9] bg-bg border-b border-border overflow-hidden">
            ${plan.imageUrl ? `<img src="${plan.imageUrl}" alt="${escapeHtml(plan.nameEn)}" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center text-muted text-sm">No image</div>`}
          </div>
          <div class="p-5 flex flex-col gap-4 flex-1">
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="text-xs font-bold uppercase tracking-[0.22em] text-primary">${escapeHtml(plan.tier)}</div>
                <h3 class="mt-2 text-lg font-heading font-bold text-text">${escapeHtml(plan.nameEn)}</h3>
                <div class="text-xs text-muted">${escapeHtml(plan.nameAr || "")}</div>
              </div>
              <span class="inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase ${plan.isActive ? "border-success/20 bg-success/15 text-success" : "border-danger/20 bg-danger/15 text-danger"}">${plan.isActive ? "Active" : "Inactive"}</span>
            </div>
            <p class="text-sm text-muted leading-relaxed">${escapeHtml(plan.descriptionEn || "No description provided.")}</p>
            <div class="grid grid-cols-2 gap-3 text-sm">
              <div class="rounded-xl border border-border bg-bg p-3">
                <div class="text-xs uppercase tracking-[0.22em] text-muted">Price</div>
                <div class="mt-2 text-xl font-bold text-text">${Number(plan.priceJod).toFixed(2)} JOD</div>
              </div>
              <div class="rounded-xl border border-border bg-bg p-3">
                <div class="text-xs uppercase tracking-[0.22em] text-muted">Duration</div>
                <div class="mt-2 text-xl font-bold text-text">${plan.durationMonths} mo</div>
              </div>
            </div>
            <div class="rounded-xl border border-border bg-bg p-3">
              <div class="text-xs uppercase tracking-[0.22em] text-muted">Benefits</div>
              <div class="mt-2 text-sm text-text">${plan.benefits?.length || 0} configured benefit${(plan.benefits?.length || 0) === 1 ? "" : "s"}</div>
            </div>
            <div class="mt-auto flex items-center gap-2">
              <button class="plan-edit-btn flex-1 px-3 py-2 rounded-xl border border-primary text-primary font-semibold hover:bg-primary hover:text-white transition-colors" data-plan-id="${plan.id}">Edit</button>
              <button class="plan-toggle-btn px-3 py-2 rounded-xl border font-semibold transition-colors ${plan.isActive ? "border-danger text-danger hover:bg-danger hover:text-white" : "border-success text-success hover:bg-success hover:text-white"}" data-plan-id="${plan.id}" data-next-active="${String(!plan.isActive)}">
                ${plan.isActive ? "Disable" : "Enable"}
              </button>
            </div>
          </div>
        </article>
      `).join("");
      plansGrid.querySelectorAll(".plan-edit-btn").forEach((button) => {
        button.addEventListener("click", () => {
          const plan = state.plans.find((item) => item.id === button.getAttribute("data-plan-id"));
          if (plan) openPlanModal(plan);
        });
      });
      plansGrid.querySelectorAll(".plan-toggle-btn").forEach((button) => {
        button.addEventListener("click", async () => {
          const planId = button.getAttribute("data-plan-id");
          const nextActive = button.getAttribute("data-next-active") === "true";
          if (!planId) return;
          try {
            await apiFetch(`/memberships/plans/${planId}`, {
              method: "PATCH",
              body: { isActive: nextActive }
            });
            window.toast("Plan status updated.", "success");
            await loadPlans();
          } catch (error) {
            window.toast(error.message || "Failed to update plan status.", "error");
          }
        });
      });
    }
    function renderSubscribers() {
      pendingCountNode.textContent = `Pending Requests (${state.subscribersMeta.pendingCount || 0})`;
      statusButtons.forEach((button) => {
        const active = button.getAttribute("data-subscriber-status") === state.subscriberStatus;
        button.className = `px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${active ? "bg-primary text-white" : "bg-bg border border-border text-muted hover:text-text hover:border-primary/40"}`;
      });
      if (!state.subscribers.length) {
        subscribersGrid.innerHTML = `<div class="col-span-full rounded-2xl border border-border bg-surface p-10 text-center text-muted">No subscribers match the current filter.</div>`;
        return;
      }
      subscribersGrid.innerHTML = state.subscribers.map((item) => `
        <article class="subscriber-card cursor-pointer rounded-2xl border border-border bg-surface p-5 shadow-sm transition-colors hover:border-primary/40" data-subscription-id="${item.id}">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-lg font-heading font-bold text-text">${escapeHtml(item.customer.fullName || item.customer.phone || "Customer")}</div>
              <div class="text-sm text-muted">${escapeHtml(item.customer.phone || "")}</div>
            </div>
            <span class="inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase ${badgeClass(item.status)}">${item.status}</span>
          </div>
          <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div class="rounded-xl border border-border bg-bg p-3">
              <div class="text-xs uppercase tracking-[0.22em] text-muted">Plan</div>
              <div class="mt-2 font-semibold text-text">${escapeHtml(planDisplayName(item.plan))}</div>
            </div>
            <div class="rounded-xl border border-border bg-bg p-3">
              <div class="text-xs uppercase tracking-[0.22em] text-muted">Benefits Used</div>
              <div class="mt-2 font-semibold text-text">${item.usageSummary.used}/${item.usageSummary.total}</div>
            </div>
          </div>
          <div class="mt-4 space-y-2 text-sm text-muted">
            <div>Requested: <span class="text-text">${formatDate(item.requestedAt)}</span></div>
            <div>Approved: <span class="text-text">${item.approvedAt ? formatDate(item.approvedAt) : "Not approved yet"}</span></div>
            <div>Expires: <span class="text-text">${item.expiresAt ? formatDate(item.expiresAt) : "Not active"}</span></div>
          </div>
          <div class="mt-4 flex items-center justify-between text-sm">
            <div class="text-muted">Notes: <span class="text-text">${item.adminNotesCount}</span></div>
            <div class="text-primary font-semibold">Open details</div>
          </div>
        </article>
      `).join("");
      subscribersGrid.querySelectorAll(".subscriber-card").forEach((card) => {
        card.addEventListener("click", async () => {
          const id = card.getAttribute("data-subscription-id");
          if (!id) return;
          await openSubscriberDetail(id);
        });
      });
    }
    function renderSubscriberDetail() {
      const item = state.currentSubscriberDetail;
      if (!item) return;
      subscriberModalContent.innerHTML = `
        <div class="flex items-center justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <div class="text-xs font-bold uppercase tracking-[0.24em] text-muted">Subscriber Details</div>
            <h3 class="mt-2 text-xl font-heading font-bold text-text">${escapeHtml(item.customer.fullName || item.customer.phone || "Customer")}</h3>
            <div class="text-sm text-muted">${escapeHtml(item.customer.phone || "")}</div>
          </div>
          <button type="button" id="subscriber-modal-close" class="w-9 h-9 rounded-full border border-border text-muted hover:text-text hover:border-text">&times;</button>
        </div>
        <div class="max-h-[85vh] overflow-y-auto p-6 space-y-6">
          <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div class="rounded-2xl border border-border bg-bg p-5">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <div class="text-xs uppercase tracking-[0.22em] text-muted">Plan</div>
                  <div class="mt-2 text-lg font-bold text-text">${escapeHtml(planDisplayName(item.plan))}</div>
                </div>
                <span class="inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase ${badgeClass(item.status)}">${item.status}</span>
              </div>
              <div class="mt-4 space-y-2 text-sm text-muted">
                <div>Requested: <span class="text-text">${formatDate(item.requestedAt)}</span></div>
                <div>Approved: <span class="text-text">${item.approvedAt ? formatDate(item.approvedAt) : "Not approved yet"}</span></div>
                <div>Rejected: <span class="text-text">${item.rejectedAt ? formatDate(item.rejectedAt) : "Not rejected"}</span></div>
                <div>Expires: <span class="text-text">${item.expiresAt ? formatDate(item.expiresAt) : "Not active"}</span></div>
              </div>
            </div>
            <div class="rounded-2xl border border-border bg-bg p-5">
              <div class="text-xs uppercase tracking-[0.22em] text-muted">Delivery</div>
              <div class="mt-4 space-y-2 text-sm">
                <div class="flex justify-between gap-4"><span class="text-muted">Company</span><span class="text-text text-right">${escapeHtml(item.delivery?.deliveryCompanyName || "Not provided")}</span></div>
                <div class="flex justify-between gap-4"><span class="text-muted">Phone</span><span class="text-text text-right">${escapeHtml(item.delivery?.deliveryPhone || "Not provided")}</span></div>
                <div class="flex justify-between gap-4"><span class="text-muted">Tracking</span><span class="text-text text-right">${escapeHtml(item.delivery?.deliveryTrackingCode || "Pending")}</span></div>
                <div class="rounded-xl border border-border p-4 text-sm text-text">
                  <div class="text-xs uppercase tracking-[0.22em] text-muted">Delivery Note</div>
                  <div class="mt-2">${escapeHtml(item.delivery?.deliveryNote || "No note available.")}</div>
                </div>
              </div>
            </div>
          </div>

          ${item.status === "PENDING" ? `
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <form id="approve-subscription-form" class="rounded-2xl border border-border bg-bg p-5 space-y-4">
                <div>
                  <div class="text-xs uppercase tracking-[0.22em] text-muted">Approve Request</div>
                  <div class="mt-2 text-sm text-muted">At least one of company name or phone is required.</div>
                </div>
                <input type="text" name="deliveryCompanyName" placeholder="Delivery company" class="w-full rounded-xl border border-border bg-surface px-3 py-2 text-text">
                <input type="text" name="deliveryPhone" placeholder="Delivery phone" class="w-full rounded-xl border border-border bg-surface px-3 py-2 text-text">
                <input type="text" name="deliveryTrackingCode" placeholder="Tracking code" class="w-full rounded-xl border border-border bg-surface px-3 py-2 text-text">
                <textarea name="deliveryNote" rows="3" placeholder="Delivery note" class="w-full rounded-xl border border-border bg-surface px-3 py-2 text-text resize-none"></textarea>
                <button type="submit" class="w-full rounded-xl bg-success px-4 py-3 font-bold text-white hover:bg-green-600 transition-colors">Approve Subscription</button>
              </form>
              <form id="reject-subscription-form" class="rounded-2xl border border-border bg-bg p-5 space-y-4">
                <div>
                  <div class="text-xs uppercase tracking-[0.22em] text-muted">Reject Request</div>
                  <div class="mt-2 text-sm text-muted">A rejection reason is required and will be visible to the customer.</div>
                </div>
                <textarea name="rejectionReason" rows="5" placeholder="Rejection reason" class="w-full rounded-xl border border-border bg-surface px-3 py-2 text-text resize-none"></textarea>
                <button type="submit" class="w-full rounded-xl bg-danger px-4 py-3 font-bold text-white hover:bg-red-600 transition-colors">Reject Subscription</button>
              </form>
            </div>
          ` : ""}

          ${item.status === "REJECTED" ? `
            <div class="rounded-2xl border border-danger/30 bg-danger/5 p-5">
              <div class="text-xs uppercase tracking-[0.22em] text-danger/80">Rejection Reason</div>
              <div class="mt-3 text-sm text-text">${escapeHtml(item.rejectionReason || "No reason provided.")}</div>
            </div>
          ` : ""}

          <div class="rounded-2xl border border-border bg-bg p-5">
            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="text-xs uppercase tracking-[0.22em] text-muted">Benefits</div>
                <div class="mt-2 text-sm text-muted">Confirm each use manually. Confirmations are permanent.</div>
              </div>
              <div class="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">${item.benefitUsageSummary.used}/${item.benefitUsageSummary.total}</div>
            </div>
            <div class="mt-4 space-y-4">
              ${(item.benefits || []).length ? item.benefits.map((benefit) => `
                <div class="rounded-2xl border border-border bg-surface p-4">
                  <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div>
                      <div class="text-base font-semibold text-text">${escapeHtml(benefit.titleEn || benefit.titleAr || "Benefit")}</div>
                      <div class="mt-1 text-sm text-muted">${escapeHtml(benefit.descriptionEn || benefit.descriptionAr || "")}</div>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">${benefit.usedCount}/${benefit.limitCount}</span>
                      ${benefit.locked ? `<span class="rounded-full bg-success/15 px-3 py-1 text-xs font-bold text-success">Confirmed</span>` : ""}
                    </div>
                  </div>
                  <div class="mt-4 space-y-3">
                    ${(benefit.uses || []).length ? benefit.uses.map((use) => `
                      <div class="rounded-xl border border-border bg-bg p-3 text-sm">
                        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                          <div class="font-semibold text-text">Confirmed ${formatDate(use.usedAt)}</div>
                          <div class="text-muted">${escapeHtml(use.usedByAdmin?.fullName || use.usedByAdmin?.phone || "Admin")}</div>
                        </div>
                        ${use.confirmNote ? `<div class="mt-2 text-text">${escapeHtml(use.confirmNote)}</div>` : ""}
                      </div>
                    `).join("") : `<div class="text-sm text-muted">No confirmed uses yet.</div>`}
                  </div>
                  <form class="benefit-confirm-form mt-4 rounded-xl border border-border bg-bg p-4 space-y-3" data-benefit-id="${benefit.id}">
                    <label class="flex items-center gap-3 text-sm ${benefit.locked || item.status !== "ACTIVE" ? "text-muted" : "text-text"}">
                      <input type="checkbox" name="confirmToggle" class="w-4 h-4 accent-primary" ${benefit.locked || item.status !== "ACTIVE" ? "disabled" : ""}>
                      Mark one use as confirmed
                    </label>
                    <textarea name="confirmNote" rows="2" placeholder="Optional confirmation note" class="w-full rounded-xl border border-border bg-surface px-3 py-2 text-text resize-none" ${benefit.locked || item.status !== "ACTIVE" ? "disabled" : ""}></textarea>
                    <button type="submit" class="rounded-xl px-4 py-2 font-semibold transition-colors ${benefit.locked || item.status !== "ACTIVE" ? "bg-muted/20 text-muted cursor-not-allowed" : "bg-primary text-white hover:bg-primary-hover"}" ${benefit.locked || item.status !== "ACTIVE" ? "disabled" : ""}>Confirm</button>
                  </form>
                </div>
              `).join("") : `<div class="text-sm text-muted">No benefits available for this subscription.</div>`}
            </div>
          </div>

          <div class="rounded-2xl border border-border bg-bg p-5">
            <div class="text-xs uppercase tracking-[0.22em] text-muted">Admin Notes</div>
            <form id="subscription-note-form" class="mt-4 space-y-3">
              <textarea name="note" rows="3" placeholder="Add internal note" class="w-full rounded-xl border border-border bg-surface px-3 py-2 text-text resize-none"></textarea>
              <button type="submit" class="rounded-xl bg-primary px-4 py-2 font-semibold text-white hover:bg-primary-hover transition-colors">Add Note</button>
            </form>
            <div class="mt-4 space-y-3">
              ${(item.adminNotes || []).length ? item.adminNotes.map((note) => `
                <div class="rounded-xl border border-border bg-surface p-4">
                  <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-sm">
                    <div class="font-semibold text-text">${escapeHtml(note.createdByAdmin?.fullName || note.createdByAdmin?.phone || "Admin")}</div>
                    <div class="text-muted">${formatDate(note.createdAt)}</div>
                  </div>
                  <div class="mt-2 text-sm text-text">${escapeHtml(note.note)}</div>
                </div>
              `).join("") : `<div class="text-sm text-muted">No notes added yet.</div>`}
            </div>
          </div>
        </div>
      `;
      subscriberModalContent.querySelector("#subscriber-modal-close")?.addEventListener("click", () => closeModal(subscriberModal));
      subscriberModalContent.querySelectorAll(".benefit-confirm-form").forEach((form) => {
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          const benefitId = form.getAttribute("data-benefit-id");
          if (!benefitId) return;
          const toggle = form.querySelector('input[name="confirmToggle"]');
          const noteField = form.querySelector('textarea[name="confirmNote"]');
          if (!toggle?.checked) {
            window.toast("Tick the checkbox before confirming.", "error");
            return;
          }
          try {
            const response = await apiFetch(`/admin/memberships/subscriptions/${item.id}/benefits/${benefitId}/confirm`, {
              method: "POST",
              body: {
                confirmNote: noteField?.value || void 0
              }
            });
            state.currentSubscriberDetail = response.item;
            renderSubscriberDetail();
            await loadSubscribers();
            window.toast("Benefit confirmed.", "success");
          } catch (error) {
            window.toast(error.message || "Failed to confirm benefit.", "error");
          }
        });
      });
      subscriberModalContent.querySelector("#subscription-note-form")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.target;
        try {
          const response = await apiFetch(`/admin/memberships/subscriptions/${item.id}/notes`, {
            method: "POST",
            body: {
              note: form.note.value
            }
          });
          state.currentSubscriberDetail = response.item;
          renderSubscriberDetail();
          await loadSubscribers();
          window.toast("Note added.", "success");
        } catch (error) {
          window.toast(error.message || "Failed to add note.", "error");
        }
      });
      subscriberModalContent.querySelector("#approve-subscription-form")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.target;
        try {
          const response = await apiFetch(`/admin/memberships/subscriptions/${item.id}/approve`, {
            method: "POST",
            body: {
              deliveryCompanyName: form.deliveryCompanyName.value || void 0,
              deliveryPhone: form.deliveryPhone.value || void 0,
              deliveryTrackingCode: form.deliveryTrackingCode.value || void 0,
              deliveryNote: form.deliveryNote.value || void 0
            }
          });
          state.currentSubscriberDetail = response.item;
          renderSubscriberDetail();
          await Promise.all([loadSubscribers(), loadPlans()]);
          window.toast("Subscription approved.", "success");
        } catch (error) {
          window.toast(error.message || "Failed to approve subscription.", "error");
        }
      });
      subscriberModalContent.querySelector("#reject-subscription-form")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.target;
        try {
          const response = await apiFetch(`/admin/memberships/subscriptions/${item.id}/reject`, {
            method: "POST",
            body: {
              rejectionReason: form.rejectionReason.value
            }
          });
          state.currentSubscriberDetail = response.item;
          renderSubscriberDetail();
          await loadSubscribers();
          window.toast("Subscription rejected.", "success");
        } catch (error) {
          window.toast(error.message || "Failed to reject subscription.", "error");
        }
      });
    }
    async function openSubscriberDetail(id) {
      subscriberModalContent.innerHTML = `<div class="p-8 text-center text-muted">Loading subscriber details...</div>`;
      openModal(subscriberModal);
      try {
        const response = await apiFetch(`/admin/memberships/subscriptions/${id}`);
        state.currentSubscriberDetail = response.item;
        renderSubscriberDetail();
      } catch (error) {
        subscriberModalContent.innerHTML = `<div class="p-8 text-center text-danger">${escapeHtml(error.message || "Unable to load subscriber details.")}</div>`;
      }
    }
    function openPlanModal(plan = null) {
      state.editingPlanId = plan?.id || null;
      state.planBenefits = (plan?.benefits || []).map((benefit) => ({
        id: benefit.id,
        code: benefit.code || "",
        titleEn: benefit.titleEn || "",
        titleAr: benefit.titleAr || "",
        descriptionEn: benefit.descriptionEn || "",
        descriptionAr: benefit.descriptionAr || "",
        limitCount: benefit.limitCount || 1,
        isActive: benefit.isActive !== false
      }));
      let shouldShowBenefitValidation = false;
      let isSavingPlan = false;
      planModalContent.innerHTML = `
        <div class="flex items-center justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <div class="text-xs font-bold uppercase tracking-[0.24em] text-muted">${state.editingPlanId ? "Edit Plan" : "Create Plan"}</div>
            <h3 class="mt-2 text-xl font-heading font-bold text-text">${state.editingPlanId ? "Update membership plan" : "Create a new membership plan"}</h3>
          </div>
          <button type="button" id="plan-modal-close" class="w-9 h-9 rounded-full border border-border text-muted hover:text-text hover:border-text">&times;</button>
        </div>
        <form id="plan-modal-form" class="max-h-[85vh] overflow-y-auto p-6">
          <div class="grid grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_340px] gap-6">
            <div class="space-y-6">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-bold uppercase tracking-[0.22em] text-muted mb-2">Tier</label>
                  <select name="tier" required class="w-full rounded-xl border border-border bg-bg px-3 py-2 text-text">
                    ${PLAN_TIER_OPTIONS.map((option) => `<option value="${option.value}" ${String(plan?.tier || "BRONZE").toUpperCase() === option.value ? "selected" : ""}>${option.label}</option>`).join("")}
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-bold uppercase tracking-[0.22em] text-muted mb-2">Duration</label>
                  <select name="durationMonths" required class="w-full rounded-xl border border-border bg-bg px-3 py-2 text-text">
                    ${PLAN_DURATION_OPTIONS.map((months) => `<option value="${months}" ${Number(plan?.durationMonths || 12) === months ? "selected" : ""}>${formatDurationLabel(months)}</option>`).join("")}
                  </select>
                </div>
                <div class="md:col-span-2">
                  <label class="block text-xs font-bold uppercase tracking-[0.22em] text-muted mb-2">Theme Color</label>
                  <div class="mb-3 flex flex-wrap gap-2">
                    ${PLAN_COLOR_PRESETS.map((preset) => `
                      <button type="button" class="plan-color-preset inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-text transition-colors hover:border-primary/40" data-color-preset="${preset.value}">
                        <span class="h-3 w-3 rounded-full border border-white/20" style="background:${preset.value}"></span>
                        ${preset.label}
                      </button>
                    `).join("")}
                  </div>
                  ${ColorInput({
        id: "plan-theme-color",
        name: "color",
        value: sanitizeHexColor(plan?.themeColor || plan?.color || "#3B82F6"),
        onChangeAttr: "window.syncPlanModalUi && window.syncPlanModalUi()"
      })}
                </div>
                <div>
                  <label class="block text-xs font-bold uppercase tracking-[0.22em] text-muted mb-2">Name (EN)</label>
                  <input type="text" name="nameEn" value="${escapeHtml(plan?.nameEn || "")}" required class="w-full rounded-xl border border-border bg-bg px-3 py-2 text-text" placeholder="Gold Care">
                </div>
                <div>
                  <label class="block text-xs font-bold uppercase tracking-[0.22em] text-muted mb-2">Name (AR)</label>
                  <input type="text" name="nameAr" value="${escapeHtml(plan?.nameAr || "")}" required class="w-full rounded-xl border border-border bg-bg px-3 py-2 text-text" placeholder="\u0627\u0644\u062E\u0637\u0629 \u0627\u0644\u0630\u0647\u0628\u064A\u0629">
                </div>
                <div>
                  <label class="block text-xs font-bold uppercase tracking-[0.22em] text-muted mb-2">Price</label>
                  <div class="relative">
                    <span class="pointer-events-none absolute inset-y-0 ltr:left-0 rtl:right-0 flex items-center px-3 text-sm font-bold text-muted">JOD</span>
                    <input type="number" step="0.5" min="0" name="price" value="${escapeHtml(plan?.priceJod ?? "0")}" required class="w-full rounded-xl border border-border bg-bg py-2 text-text ltr:pl-14 ltr:pr-3 rtl:pr-14 rtl:pl-3">
                  </div>
                  <div class="mt-2 text-xs text-muted">Set 0 if this plan is free.</div>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold uppercase tracking-[0.22em] text-muted mb-2">Description (EN)</label>
              <textarea name="descriptionEn" rows="4" class="w-full rounded-xl border border-border bg-bg px-3 py-2 text-text resize-none" placeholder="Priority support, inspections, and member pricing.">${escapeHtml(plan?.descriptionEn || "")}</textarea>
            </div>
            <div>
              <label class="block text-xs font-bold uppercase tracking-[0.22em] text-muted mb-2">Description (AR)</label>
              <textarea name="descriptionAr" rows="4" class="w-full rounded-xl border border-border bg-bg px-3 py-2 text-text resize-none" placeholder="\u062F\u0639\u0645 \u0623\u0648\u0644\u0648\u064A\u0629 \u0648\u0641\u062D\u0648\u0635\u0627\u062A \u0648\u062A\u0633\u0639\u064A\u0631 \u062E\u0627\u0635 \u0644\u0644\u0623\u0639\u0636\u0627\u0621.">${escapeHtml(plan?.descriptionAr || "")}</textarea>
            </div>
          </div>

          <div class="rounded-2xl border border-border bg-bg p-5">
            <div class="text-xs font-bold uppercase tracking-[0.22em] text-muted">Plan Image</div>
            <input id="plan-image-file" type="file" accept="image/*" class="hidden">
            <input id="plan-image-url" name="imageUrl" type="hidden" value="${escapeHtml(plan?.imageUrl || "")}">
            <div class="mt-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <label for="plan-image-file" class="inline-flex items-center px-4 py-2 rounded-xl border border-border text-sm font-semibold text-text hover:border-primary hover:text-primary cursor-pointer transition-colors">Choose File</label>
              <div id="plan-image-preview" class="w-24 h-24 rounded-xl border border-border bg-surface overflow-hidden">${plan?.imageUrl ? `<img src="${plan.imageUrl}" alt="Plan image" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center text-[10px] text-muted">No image</div>`}</div>
              <div id="plan-image-hint" class="text-xs text-muted">${plan?.imageUrl ? "Update image if needed." : "Choose image to crop and upload."}</div>
            </div>
          </div>

          <div class="rounded-2xl border border-border bg-bg p-5">
            <div class="flex items-center justify-between gap-4">
              <div>
                <div class="text-xs font-bold uppercase tracking-[0.22em] text-muted">Benefits</div>
                <div class="mt-2 text-sm text-muted">These benefits are snapshotted when a pending request is approved.</div>
              </div>
              <button type="button" id="add-plan-benefit" class="inline-flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary hover:text-white transition-colors">
                <span class="text-base leading-none">+</span>
                Add Benefit
              </button>
            </div>
            <div id="plan-benefits-editor" class="mt-4 space-y-4"></div>
          </div>

          <div class="flex justify-end gap-3">
            <button type="button" id="plan-modal-cancel" class="px-4 py-2 rounded-xl border border-border text-text hover:border-text">Cancel</button>
            <button type="submit" id="plan-modal-submit" class="px-6 py-2.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70">${state.editingPlanId ? "Save Changes" : "Save Plan"}</button>
          </div>
        </div>

        <aside class="xl:sticky xl:top-0 self-start">
          <div class="rounded-2xl border border-border bg-bg p-5">
            <div class="text-xs font-bold uppercase tracking-[0.22em] text-muted">Plan Preview</div>
            <div class="mt-3 text-sm text-muted">Live customer-facing summary while you edit.</div>
            <div id="plan-preview-card" class="mt-5"></div>
          </div>
        </aside>
      </div>
    </form>
      `;
      const planForm = planModalContent.querySelector("#plan-modal-form");
      const benefitsEditor = planModalContent.querySelector("#plan-benefits-editor");
      const imageInput = planModalContent.querySelector("#plan-image-file");
      const imageUrlField = planModalContent.querySelector("#plan-image-url");
      const imagePreview = planModalContent.querySelector("#plan-image-preview");
      const imageHint = planModalContent.querySelector("#plan-image-hint");
      const planPreview = planModalContent.querySelector("#plan-preview-card");
      const submitButton = planModalContent.querySelector("#plan-modal-submit");
      function getBenefitValidation() {
        const validation = state.planBenefits.map(() => ({ missingCode: false, duplicateCode: false }));
        const seenCodes = /* @__PURE__ */ new Map();
        state.planBenefits.forEach((benefit, index) => {
          const normalizedCode = String(benefit.code || "").trim().toLowerCase();
          if (!normalizedCode) {
            validation[index].missingCode = true;
            return;
          }
          if (!seenCodes.has(normalizedCode)) {
            seenCodes.set(normalizedCode, []);
          }
          seenCodes.get(normalizedCode).push(index);
        });
        seenCodes.forEach((indexes) => {
          if (indexes.length < 2) return;
          indexes.forEach((index) => {
            validation[index].duplicateCode = true;
          });
        });
        return validation;
      }
      function updateSubmitState() {
        if (!submitButton) return;
        submitButton.disabled = isSavingPlan;
        submitButton.textContent = isSavingPlan ? "Saving..." : state.editingPlanId ? "Save Changes" : "Save Plan";
      }
      function showImage(url) {
        imagePreview.innerHTML = url ? `<img src="${url}" alt="Plan image" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center text-[10px] text-muted">No image</div>`;
      }
      function syncPlanPreview() {
        const locale = document.documentElement.lang === "ar" ? "ar" : "en";
        const tierValue = String(planForm.tier.value || "BRONZE").toUpperCase();
        const colorValue = sanitizeHexColor(planForm.color.value || "#3B82F6");
        const nameValue = resolveLocalizedText(
          locale,
          planForm.nameEn.value,
          planForm.nameAr.value,
          PLAN_TIER_OPTIONS.find((option) => option.value === tierValue)?.label || "Membership Plan"
        );
        const descriptionValue = resolveLocalizedText(
          locale,
          planForm.descriptionEn.value,
          planForm.descriptionAr.value,
          "Add a short plan description to help customers understand the offer."
        );
        const durationValue = Number(planForm.durationMonths.value || 12);
        const previewBenefits = state.planBenefits.filter((benefit) => benefit.isActive !== false).slice(0, 3);
        planPreview.innerHTML = `
          <div class="rounded-2xl border border-border bg-surface overflow-hidden">
            <div class="relative overflow-hidden p-5" style="background:
              radial-gradient(circle at top left, ${hexToRgba(colorValue, 0.34)}, transparent 38%),
              linear-gradient(145deg, ${hexToRgba(colorValue, 0.16)}, rgba(15, 23, 42, 0.92) 60%);
            ">
              <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_42%)]"></div>
              <div class="relative">
                <div class="flex items-start justify-between gap-3">
                  <span class="inline-flex rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em]" style="background:${hexToRgba(colorValue, 0.16)}; border-color:${hexToRgba(colorValue, 0.45)}; color:${colorValue};">${escapeHtml(tierValue)}</span>
                  <span class="text-xs font-semibold text-white/70">${escapeHtml(formatDurationLabel(durationValue))}</span>
                </div>
                <div class="mt-6">
                  <div class="text-xs font-bold uppercase tracking-[0.22em] text-white/60">Membership Plan</div>
                  <div class="mt-2 text-2xl font-heading font-bold text-white">${escapeHtml(nameValue)}</div>
                  <div class="mt-3 flex items-end justify-between gap-3">
                    <div class="text-white">
                      <span class="text-3xl font-bold">${escapeHtml(formatPreviewPrice(planForm.price.value || 0))}</span>
                      <span class="ml-2 text-sm font-medium text-white/70">${escapeHtml(formatPreviewPeriod(durationValue))}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="p-5">
              <div class="text-sm leading-relaxed text-muted">${escapeHtml(descriptionValue)}</div>
              <div class="mt-5 rounded-2xl border border-border bg-bg p-4">
                <div class="text-xs font-bold uppercase tracking-[0.22em] text-muted">Included Benefits</div>
                <div class="mt-3 space-y-3">
                  ${previewBenefits.length ? previewBenefits.map((benefit, index) => `
                      <div class="flex items-start gap-3">
                        <span class="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold" style="background:${hexToRgba(colorValue, 0.18)}; color:${colorValue};">\u2713</span>
                        <div>
                          <div class="text-sm font-semibold text-text">${escapeHtml(resolveLocalizedText(locale, benefit.titleEn, benefit.titleAr, benefitSummaryLabel(benefit, index)))}</div>
                          <div class="text-xs text-muted">${benefit.limitCount} use${Number(benefit.limitCount) === 1 ? "" : "s"}</div>
                        </div>
                      </div>
                    `).join("") : '<div class="text-sm text-muted">No benefits configured yet.</div>'}
                </div>
              </div>
            </div>
          </div>
        `;
      }
      function syncBenefitValidationUi() {
        const validation = getBenefitValidation();
        benefitsEditor.querySelectorAll("[data-benefit-index]").forEach((node) => {
          const index = Number(node.getAttribute("data-benefit-index"));
          const benefit = state.planBenefits[index];
          const summaryNode = node.querySelector("[data-benefit-summary]");
          const codeInput = node.querySelector('[data-field="code"]');
          const errorNode = node.querySelector("[data-benefit-code-error]");
          const status = validation[index] || { missingCode: false, duplicateCode: false };
          const message = status.duplicateCode ? "Benefit code must be unique within this plan." : shouldShowBenefitValidation && status.missingCode ? "Benefit code is required." : "";
          if (summaryNode) {
            summaryNode.textContent = benefitSummaryLabel(benefit, index);
          }
          if (errorNode) {
            errorNode.textContent = message;
            errorNode.classList.toggle("hidden", !message);
          }
          if (codeInput) {
            codeInput.classList.toggle("border-danger", Boolean(message));
          }
        });
      }
      function syncColorPresetUi() {
        const currentColor = sanitizeHexColor(planForm.color.value || "#3B82F6");
        planModalContent.querySelectorAll(".plan-color-preset").forEach((button) => {
          const active = sanitizeHexColor(button.getAttribute("data-color-preset")) === currentColor;
          button.classList.toggle("border-primary", active);
          button.classList.toggle("bg-primary/10", active);
          button.classList.toggle("text-primary", active);
        });
      }
      function syncPlanModalUi() {
        syncPlanPreview();
        syncBenefitValidationUi();
        syncColorPresetUi();
      }
      function renderPlanBenefitsEditor() {
        const validation = getBenefitValidation();
        benefitsEditor.innerHTML = state.planBenefits.length ? state.planBenefits.map((benefit, index) => {
          const errorMessage = validation[index]?.duplicateCode ? "Benefit code must be unique within this plan." : shouldShowBenefitValidation && validation[index]?.missingCode ? "Benefit code is required." : "";
          return `
              <div class="rounded-2xl border border-border bg-surface p-4 space-y-4" data-benefit-index="${index}">
                <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div class="flex items-start gap-3 min-w-0">
                    <div class="mt-0.5 text-lg text-muted">\u2630</div>
                    <div class="min-w-0">
                      <div class="text-sm font-bold text-text truncate" data-benefit-summary>${escapeHtml(benefitSummaryLabel(benefit, index))}</div>
                      <div class="mt-1 text-xs text-muted">Stable code and titles are shown to admins and customers.</div>
                    </div>
                  </div>
                  <div class="flex flex-wrap items-center justify-end gap-2">
                    <button type="button" class="benefit-move-btn rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted hover:border-primary hover:text-primary transition-colors disabled:cursor-not-allowed disabled:opacity-50" data-benefit-index="${index}" data-direction="-1" ${index === 0 ? "disabled" : ""}>Move up</button>
                    <button type="button" class="benefit-move-btn rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-muted hover:border-primary hover:text-primary transition-colors disabled:cursor-not-allowed disabled:opacity-50" data-benefit-index="${index}" data-direction="1" ${index === state.planBenefits.length - 1 ? "disabled" : ""}>Move down</button>
                    <label class="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text">
                      <input type="checkbox" data-field="isActive" data-benefit-index="${index}" class="benefit-input w-4 h-4 accent-primary" ${benefit.isActive ? "checked" : ""}>
                      Active
                    </label>
                    <button type="button" class="remove-benefit-btn rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:border-danger/40 hover:text-danger transition-colors" data-benefit-index="${index}">Remove</button>
                  </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-[11px] font-bold uppercase tracking-[0.18em] text-muted mb-2">Stable Code</label>
                    <input type="text" data-field="code" data-benefit-index="${index}" value="${escapeHtml(benefit.code)}" placeholder="free_diagnostic" class="benefit-input w-full bg-bg border ${errorMessage ? "border-danger" : "border-border"} rounded-xl px-3 py-2 text-text">
                    <div class="mt-2 text-xs text-muted">Examples: free_diagnostic, inverter_discount, cooling_service</div>
                    <div data-benefit-code-error class="mt-2 text-xs text-danger ${errorMessage ? "" : "hidden"}">${escapeHtml(errorMessage)}</div>
                  </div>
                  <div>
                    <label class="block text-[11px] font-bold uppercase tracking-[0.18em] text-muted mb-2">Usage Limit</label>
                    <input type="number" min="1" step="1" data-field="limitCount" data-benefit-index="${index}" value="${escapeHtml(benefit.limitCount)}" placeholder="1" class="benefit-input w-full bg-bg border border-border rounded-xl px-3 py-2 text-text">
                    <div class="mt-2 text-xs text-muted">How many times can this benefit be used?</div>
                  </div>
                  <div>
                    <label class="block text-[11px] font-bold uppercase tracking-[0.18em] text-muted mb-2">Title (EN)</label>
                    <input type="text" data-field="titleEn" data-benefit-index="${index}" value="${escapeHtml(benefit.titleEn)}" placeholder="Free Diagnostics" class="benefit-input w-full bg-bg border border-border rounded-xl px-3 py-2 text-text">
                  </div>
                  <div>
                    <label class="block text-[11px] font-bold uppercase tracking-[0.18em] text-muted mb-2">Title (AR)</label>
                    <input type="text" data-field="titleAr" data-benefit-index="${index}" value="${escapeHtml(benefit.titleAr)}" placeholder="\u0641\u062D\u0635 \u0645\u062C\u0627\u0646\u064A" class="benefit-input w-full bg-bg border border-border rounded-xl px-3 py-2 text-text">
                  </div>
                  <div>
                    <label class="block text-[11px] font-bold uppercase tracking-[0.18em] text-muted mb-2">Description (EN)</label>
                    <textarea data-field="descriptionEn" data-benefit-index="${index}" rows="2" placeholder="Describe the customer-facing benefit." class="benefit-input w-full bg-bg border border-border rounded-xl px-3 py-2 text-text resize-none">${escapeHtml(benefit.descriptionEn || "")}</textarea>
                  </div>
                  <div>
                    <label class="block text-[11px] font-bold uppercase tracking-[0.18em] text-muted mb-2">Description (AR)</label>
                    <textarea data-field="descriptionAr" data-benefit-index="${index}" rows="2" placeholder="\u0627\u0643\u062A\u0628 \u0648\u0635\u0641\u064B\u0627 \u0645\u0648\u062C\u0632\u064B\u0627 \u0644\u0644\u0645\u064A\u0632\u0629." class="benefit-input w-full bg-bg border border-border rounded-xl px-3 py-2 text-text resize-none">${escapeHtml(benefit.descriptionAr || "")}</textarea>
                  </div>
                </div>
              </div>
            `;
        }).join("") : `
            <div class="rounded-2xl border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-muted">
              No benefits yet. Add benefits now or save an empty plan.
            </div>
          `;
        benefitsEditor.querySelectorAll(".remove-benefit-btn").forEach((button) => {
          button.addEventListener("click", () => {
            const index = Number(button.getAttribute("data-benefit-index"));
            state.planBenefits.splice(index, 1);
            renderPlanBenefitsEditor();
            syncPlanModalUi();
          });
        });
        benefitsEditor.querySelectorAll(".benefit-move-btn").forEach((button) => {
          button.addEventListener("click", () => {
            const index = Number(button.getAttribute("data-benefit-index"));
            const direction = Number(button.getAttribute("data-direction"));
            const nextIndex = index + direction;
            if (!state.planBenefits[index] || !state.planBenefits[nextIndex]) return;
            const [current] = state.planBenefits.splice(index, 1);
            state.planBenefits.splice(nextIndex, 0, current);
            renderPlanBenefitsEditor();
            syncPlanModalUi();
          });
        });
        benefitsEditor.querySelectorAll(".benefit-input").forEach((input) => {
          const eventName = input.type === "checkbox" ? "change" : "input";
          input.addEventListener(eventName, () => {
            const index = Number(input.getAttribute("data-benefit-index"));
            const field = input.getAttribute("data-field");
            if (!Number.isInteger(index) || !field || !state.planBenefits[index]) return;
            if (field === "isActive") {
              state.planBenefits[index][field] = input.checked;
            } else if (field === "limitCount") {
              const nextValue = Math.max(1, Number(input.value || 1));
              state.planBenefits[index][field] = nextValue;
              input.value = String(nextValue);
            } else {
              state.planBenefits[index][field] = input.value;
            }
            syncPlanModalUi();
          });
        });
      }
      window.syncPlanModalUi = syncPlanModalUi;
      renderPlanBenefitsEditor();
      updateSubmitState();
      syncPlanModalUi();
      openModal(planModal);
      planModalContent.querySelector("#plan-modal-close")?.addEventListener("click", () => closeModal(planModal));
      planModalContent.querySelector("#plan-modal-cancel")?.addEventListener("click", () => closeModal(planModal));
      planModalContent.querySelector("#add-plan-benefit")?.addEventListener("click", () => {
        state.planBenefits.push(emptyBenefitDraft());
        renderPlanBenefitsEditor();
        syncPlanModalUi();
      });
      planModalContent.querySelectorAll(".plan-color-preset").forEach((button) => {
        button.addEventListener("click", () => {
          const nextColor = sanitizeHexColor(button.getAttribute("data-color-preset"));
          const colorField = planForm.querySelector('input[name="color"]');
          if (!colorField) return;
          colorField.value = nextColor;
          if (window.handleColorTextChange) {
            window.handleColorTextChange(
              colorField,
              "plan-theme-color-swatch",
              "plan-theme-color-error",
              "window.syncPlanModalUi && window.syncPlanModalUi()"
            );
          } else {
            syncPlanModalUi();
          }
        });
      });
      planForm.querySelectorAll('select[name="tier"], select[name="durationMonths"], input[name="nameEn"], input[name="nameAr"], textarea[name="descriptionEn"], textarea[name="descriptionAr"], input[name="price"]').forEach((field) => {
        field.addEventListener("input", syncPlanModalUi);
        field.addEventListener("change", syncPlanModalUi);
      });
      imageInput?.addEventListener("change", async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
          imageHint.textContent = "Processing image...";
          const fileUrl = await cropAndUpload(file, "Crop membership image");
          if (!fileUrl) {
            imageHint.textContent = "Upload cancelled.";
            return;
          }
          imageUrlField.value = fileUrl;
          showImage(fileUrl);
          imageHint.textContent = "Image uploaded.";
          syncPlanModalUi();
        } catch (error) {
          imageHint.textContent = "Upload failed.";
          window.toast(error.message || "Failed to upload image.", "error");
        } finally {
          event.target.value = "";
        }
      });
      planForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        shouldShowBenefitValidation = true;
        if (!planForm.reportValidity()) {
          syncPlanModalUi();
          return;
        }
        const benefitValidation = getBenefitValidation();
        if (benefitValidation.some((entry) => entry.missingCode || entry.duplicateCode)) {
          syncPlanModalUi();
          window.toast("Fix benefit code errors before saving.", "error");
          return;
        }
        if (!state.planBenefits.length) {
          const confirmed = window.confirm("Create plan without benefits?");
          if (!confirmed) return;
        }
        const payload = {
          tier: String(planForm.tier.value || "").toUpperCase(),
          color: sanitizeHexColor(planForm.color.value || "#3B82F6"),
          nameEn: planForm.nameEn.value,
          nameAr: planForm.nameAr.value,
          imageUrl: planForm.imageUrl.value || void 0,
          price: Math.max(0, parseFloat(planForm.price.value)),
          durationMonths: parseInt(planForm.durationMonths.value, 10),
          descriptionEn: planForm.descriptionEn.value || void 0,
          descriptionAr: planForm.descriptionAr.value || void 0,
          benefits: state.planBenefits.map((benefit) => ({
            ...benefit.id ? { id: benefit.id } : {},
            code: String(benefit.code || "").trim(),
            titleEn: benefit.titleEn,
            titleAr: benefit.titleAr,
            descriptionEn: benefit.descriptionEn || void 0,
            descriptionAr: benefit.descriptionAr || void 0,
            limitCount: Math.max(1, Number(benefit.limitCount || 1)),
            isActive: benefit.isActive !== false
          }))
        };
        try {
          isSavingPlan = true;
          updateSubmitState();
          if (state.editingPlanId) {
            await apiFetch(`/memberships/plans/${state.editingPlanId}`, {
              method: "PATCH",
              body: payload
            });
            window.toast("Membership plan updated.", "success");
          } else {
            await apiFetch("/memberships/plans", {
              method: "POST",
              body: payload
            });
            window.toast("Plan created", "success");
          }
          closeModal(planModal);
          await loadPlans();
        } catch (error) {
          window.toast(error.message || "Failed to save membership plan.", "error");
        } finally {
          isSavingPlan = false;
          updateSubmitState();
        }
      });
    }
    async function loadPlans() {
      plansGrid.innerHTML = Array(6).fill(CardSkeleton()).join("");
      try {
        const response = await apiFetch("/memberships/plans");
        state.plans = response?.items || [];
        renderPlans();
      } catch (error) {
        plansGrid.innerHTML = `<div class="col-span-full rounded-2xl border border-danger/40 bg-surface p-10 text-center text-danger">${escapeHtml(error.message || "Unable to load plans.")}</div>`;
      }
    }
    async function loadSubscribers() {
      subscribersGrid.innerHTML = Array(4).fill(CardSkeleton()).join("");
      try {
        const response = await apiFetch(`/admin/memberships/subscriptions${buildQuery({
          status: state.subscriberStatus,
          q: state.subscriberQuery || void 0
        })}`);
        state.subscribers = response?.items || [];
        state.subscribersMeta = response?.meta || { pendingCount: 0, countsByStatus: {} };
        renderSubscribers();
      } catch (error) {
        subscribersGrid.innerHTML = `<div class="col-span-full rounded-2xl border border-danger/40 bg-surface p-10 text-center text-danger">${escapeHtml(error.message || "Unable to load subscribers.")}</div>`;
      }
    }
    tabs.forEach((button) => {
      button.addEventListener("click", async () => {
        const nextTab = button.getAttribute("data-membership-tab");
        if (!nextTab || nextTab === state.currentTab) return;
        state.currentTab = nextTab;
        syncTabs();
        if (nextTab === "subscribers" && !state.subscribers.length) {
          await loadSubscribers();
        }
      });
    });
    statusButtons.forEach((button) => {
      button.addEventListener("click", async () => {
        const nextStatus = button.getAttribute("data-subscriber-status");
        if (!nextStatus || nextStatus === state.subscriberStatus) return;
        state.subscriberStatus = nextStatus;
        await loadSubscribers();
      });
    });
    subscriberSearchForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      state.subscriberQuery = subscriberSearchInput.value.trim();
      await loadSubscribers();
    });
    createPlanBtn?.addEventListener("click", () => openPlanModal());
    planModal?.addEventListener("click", (event) => {
      if (event.target === planModal) {
        closeModal(planModal);
      }
    });
    subscriberModal?.addEventListener("click", (event) => {
      if (event.target === subscriberModal) {
        closeModal(subscriberModal);
      }
    });
    syncTabs();
    await Promise.all([loadPlans(), loadSubscribers()]);
  };
  return `
    <div class="w-full h-full flex flex-col gap-6 fade-in">
      <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-surface border border-border p-6 rounded-2xl shadow-sm">
        <div>
          <h1 class="text-2xl font-heading font-bold text-text">Memberships</h1>
          <p class="text-sm text-muted mt-1">Manage plans, pending approvals, subscribers, benefits, and internal notes.</p>
        </div>
        <div class="flex items-center gap-3">
          <div id="pending-count" class="rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-sm font-bold text-primary">Pending Requests (0)</div>
          <button id="create-plan-btn" class="bg-primary hover:bg-primary-hover text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-sm flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
            Create Plan
          </button>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <button data-membership-tab="plans" class="px-4 py-2 rounded-xl text-sm font-bold">Plans</button>
        <button data-membership-tab="subscribers" class="px-4 py-2 rounded-xl text-sm font-bold">Subscribers</button>
      </div>

      <section id="plans-panel" class="space-y-6">
        <div id="plans-grid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"></div>
      </section>

      <section id="subscribers-panel" class="hidden space-y-6">
        <div class="bg-surface border border-border rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div class="flex flex-wrap items-center gap-2">
            <button data-subscriber-status="all" class="px-4 py-2 rounded-xl text-sm font-semibold">All</button>
            <button data-subscriber-status="pending" class="px-4 py-2 rounded-xl text-sm font-semibold">Pending</button>
            <button data-subscriber-status="active" class="px-4 py-2 rounded-xl text-sm font-semibold">Active</button>
            <button data-subscriber-status="rejected" class="px-4 py-2 rounded-xl text-sm font-semibold">Rejected</button>
          </div>
          <form id="subscriber-search-form" class="flex items-center gap-3 w-full lg:w-auto">
            <input id="subscriber-search" type="text" placeholder="Search by customer or plan" class="w-full lg:w-80 rounded-xl border border-border bg-bg px-4 py-2 text-text">
            <button type="submit" class="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-text hover:border-primary hover:text-primary">Search</button>
          </form>
        </div>
        <div id="subscribers-grid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"></div>
      </section>

      <div id="plan-modal" class="hidden fixed inset-0 z-[75] bg-black/60 backdrop-blur-sm p-4">
        <div class="mx-auto max-w-6xl rounded-3xl border border-border bg-surface shadow-2xl overflow-hidden">
          <div id="plan-modal-content"></div>
        </div>
      </div>

      <div id="subscriber-modal" class="hidden fixed inset-0 z-[76] bg-black/60 backdrop-blur-sm p-4">
        <div class="mx-auto max-w-6xl rounded-3xl border border-border bg-surface shadow-2xl overflow-hidden">
          <div id="subscriber-modal-content"></div>
        </div>
      </div>
    </div>
  `;
}
export {
  AdminMemberships
};
