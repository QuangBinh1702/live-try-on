(async () => {
  document.getElementById("open").addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ type: "lto:open" });
    window.close();
  });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const box = document.getElementById("site");
  let hostname = "";
  try {
    hostname = new URL(tab?.url || "").hostname;
  } catch {}
  if (!hostname) {
    box.disabled = true;
    return;
  }
  document.getElementById("host").textContent = hostname;
  const { disabledHosts } = await ltoGetSettings();
  box.checked = !disabledHosts.includes(hostname);
  box.addEventListener("change", async () => {
    const s = await ltoGetSettings();
    const set = new Set(s.disabledHosts);
    if (box.checked) set.delete(hostname);
    else set.add(hostname);
    await chrome.storage.sync.set({ disabledHosts: [...set] });
    if (tab?.id) chrome.tabs.reload(tab.id);
  });
})();
