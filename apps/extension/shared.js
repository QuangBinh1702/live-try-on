// Shared helpers (loaded by popup/options pages; the service worker imports it too).
const LTO_DEFAULT_APP_URL = "http://localhost:3000";

async function ltoGetSettings() {
  const s = await chrome.storage.sync.get({ appUrl: LTO_DEFAULT_APP_URL, disabledHosts: [] });
  return { appUrl: String(s.appUrl || LTO_DEFAULT_APP_URL).replace(/\/+$/, ""), disabledHosts: s.disabledHosts || [] };
}

function ltoIsTryableUrl(u) {
  return typeof u === "string" && (/^https?:\/\//i.test(u) || /^data:image\/(png|jpe?g|webp|avif);base64,/i.test(u)) && u.length < 12_000_000;
}
