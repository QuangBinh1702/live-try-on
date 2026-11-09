// Service worker: owns the single try-on popup window and routes garments to it.
importScripts("shared.js");

const MENU_ID = "lto-try-image";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: MENU_ID, title: "Thử đồ với ảnh này", contexts: ["image"] });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === MENU_ID && info.srcUrl) openTryOn(info.srcUrl);
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "lto:tryon" && ltoIsTryableUrl(msg.url)) openTryOn(msg.url).then(() => sendResponse({ ok: true }));
  else if (msg?.type === "lto:open") openTryOn().then(() => sendResponse({ ok: true }));
  else return false;
  return true; // async response
});

chrome.windows.onRemoved.addListener(async (winId) => {
  const { ltoWin } = await chrome.storage.session.get("ltoWin");
  if (ltoWin?.winId === winId) await chrome.storage.session.remove("ltoWin");
});

async function existingWindow() {
  const { ltoWin } = await chrome.storage.session.get("ltoWin");
  if (!ltoWin) return null;
  try {
    await chrome.windows.get(ltoWin.winId);
    const tab = await chrome.tabs.get(ltoWin.tabId);
    return { ...ltoWin, tab };
  } catch {
    await chrome.storage.session.remove("ltoWin");
    return null;
  }
}

function waitForTabComplete(tabId, timeoutMs = 20000) {
  return new Promise((resolve) => {
    const done = () => {
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timer);
      resolve();
    };
    const listener = (id, change) => {
      if (id === tabId && change.status === "complete") done();
    };
    const timer = setTimeout(done, timeoutMs);
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then((t) => t.status === "complete" && done()).catch(done);
  });
}

async function sendGarment(tabId, url) {
  // The bridge in content.js queues the URL until the app says it is ready.
  for (let i = 0; i < 10; i++) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: "lto:garment", url });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  return false;
}

async function openTryOn(imageUrl) {
  const { appUrl } = await ltoGetSettings();
  let win = await existingWindow();
  if (!win) {
    const created = await chrome.windows.create({
      url: `${appUrl}/try?src=ext`,
      type: "popup",
      width: 1180,
      height: 820,
      focused: true,
    });
    const tabId = created.tabs?.[0]?.id;
    if (tabId == null) return;
    win = { winId: created.id, tabId };
    await chrome.storage.session.set({ ltoWin: win });
    await waitForTabComplete(tabId);
  } else {
    await chrome.windows.update(win.winId, { focused: true, drawAttention: true });
  }
  if (imageUrl) await sendGarment(win.tabId, imageUrl);
}
