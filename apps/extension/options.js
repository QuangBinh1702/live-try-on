(async () => {
  const input = document.getElementById("app");
  input.value = (await ltoGetSettings()).appUrl;
  document.getElementById("save").addEventListener("click", async () => {
    let v = input.value.trim().replace(/\/+$/, "");
    try {
      const u = new URL(v);
      if (u.protocol !== "https:" && u.hostname !== "localhost" && u.hostname !== "127.0.0.1") throw new Error();
      v = u.origin;
    } catch {
      document.getElementById("msg").textContent = "URL không hợp lệ (cần https hoặc localhost)";
      return;
    }
    await chrome.storage.sync.set({ appUrl: v });
    await chrome.storage.session.remove("ltoWin").catch(() => {});
    document.getElementById("msg").textContent = "Đã lưu ✓";
  });
})();
