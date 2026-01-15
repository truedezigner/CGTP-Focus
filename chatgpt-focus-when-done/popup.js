document.getElementById("test").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "TEST_FOCUS_LATEST" });
  window.close();
});
