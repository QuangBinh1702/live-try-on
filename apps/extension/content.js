// Runs on every page. Two roles:
//  1. On the try-on web app itself: a bridge that forwards garments from the extension to the page.
//  2. Everywhere else: a single floating "Thử đồ" badge over product-sized images (visible only to this user).
(async () => {
  const { appUrl, disabledHosts } = await ltoGetSettings();
  let appOrigin = "";
  try {
    appOrigin = new URL(appUrl).origin;
  } catch {}

  if (location.origin === appOrigin) return runBridge();
  if (disabledHosts.includes(location.hostname)) return;
  runBadges();

  // ── 1. bridge ──────────────────────────────────────────────────────────
  function runBridge() {
    let appReady = false;
    const queue = [];
    const post = (url) => window.postMessage({ source: "live-tryon-ext", type: "garment", url }, location.origin);

    window.addEventListener("message", (e) => {
      if (e.source !== window || e.data?.source !== "live-tryon-app" || e.data?.type !== "ready") return;
      appReady = true;
      while (queue.length) post(queue.shift());
    });
    chrome.runtime.onMessage.addListener((msg, _s, sendResponse) => {
      if (msg?.type !== "lto:garment" || !ltoIsTryableUrl(msg.url)) return false;
      if (appReady) post(msg.url);
      else queue.push(msg.url);
      sendResponse({ ok: true });
      return false;
    });
  }

  // ── 2. badges ──────────────────────────────────────────────────────────
  function runBadges() {
    const MIN_SIDE = 140;
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;z-index:2147483647;top:0;left:0;pointer-events:none;";
    const root = host.attachShadow({ mode: "closed" });
    root.innerHTML = `
      <style>
        button{pointer-events:auto;display:none;align-items:center;gap:6px;position:fixed;padding:6px 10px;border:0;border-radius:999px;
          background:#171717;color:#fff;font:600 12px/1 system-ui,-apple-system,Segoe UI,sans-serif;cursor:pointer;
          box-shadow:0 4px 14px rgba(0,0,0,.25);transition:transform .12s}
        button:hover{transform:scale(1.05)} span{width:8px;height:8px;border-radius:50%;background:#34d399}
      </style>
      <button type="button" title="Thử món này trực tiếp qua camera"><span></span>Thử đồ</button>`;
    const badge = root.querySelector("button");
    document.documentElement.appendChild(host);

    let target = null;
    let hideTimer = 0;

    const bestSrc = (img) => {
      if (img.currentSrc) return img.currentSrc;
      const set = img.getAttribute("srcset") || img.getAttribute("data-srcset");
      if (set) {
        let best = null;
        for (const part of set.split(",")) {
          const [u, d] = part.trim().split(/\s+/);
          const w = d?.endsWith("w") ? parseInt(d) : d?.endsWith("x") ? parseFloat(d) * 1000 : 1;
          if (u && (!best || w > best.w)) best = { u, w };
        }
        if (best) return new URL(best.u, location.href).href;
      }
      const lazy = img.getAttribute("data-src") || img.getAttribute("data-original");
      return new URL(lazy || img.src, location.href).href;
    };

    const place = () => {
      if (!target || !target.isConnected) return hide();
      const r = target.getBoundingClientRect();
      if (r.width < MIN_SIDE || r.height < MIN_SIDE || r.bottom < 0 || r.top > innerHeight) return hide();
      badge.style.display = "inline-flex";
      badge.style.top = `${Math.max(8, r.top + 10)}px`;
      badge.style.left = `${Math.min(innerWidth - 100, r.right - 92)}px`;
    };
    const hide = () => {
      badge.style.display = "none";
      target = null;
    };

    document.addEventListener(
      "mouseover",
      (e) => {
        const el = e.target;
        if (!(el instanceof HTMLImageElement)) return;
        const r = el.getBoundingClientRect();
        if (r.width < MIN_SIDE || r.height < MIN_SIDE) return;
        clearTimeout(hideTimer);
        target = el;
        place();
      },
      { capture: true, passive: true },
    );
    document.addEventListener(
      "mouseout",
      (e) => {
        if (e.target === target) hideTimer = setTimeout(hide, 600);
      },
      { capture: true, passive: true },
    );
    badge.addEventListener("mouseenter", () => clearTimeout(hideTimer));
    badge.addEventListener("mouseleave", () => (hideTimer = setTimeout(hide, 400)));
    addEventListener("scroll", place, { passive: true, capture: true });
    addEventListener("resize", place, { passive: true });

    badge.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!target) return;
      const url = bestSrc(target);
      if (!ltoIsTryableUrl(url)) return;
      badge.lastChild.textContent = "Đang mở…";
      chrome.runtime.sendMessage({ type: "lto:tryon", url }).finally(() => {
        badge.lastChild.textContent = "Thử đồ";
      });
    });
  }
})();
