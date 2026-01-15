let latest = { tabId: null, runToken: null, submittedAt: 0 };
const tabState = new Map();

function isChatGPTUrl(url = "") {
  return url.startsWith("https://chatgpt.com/") || url.startsWith("https://chat.openai.com/");
}

async function focusTab(tabId) {
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab) return;

  // Focus window + tab
  await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
  await chrome.tabs.update(tabId, { active: true }).catch(() => {});
}

// Register the content script dynamically (more reliable than manifest content_scripts in some setups)
async function ensureContentScriptRegistered() {
  try {
    // Clear and re-register to avoid stale versions
    await chrome.scripting.unregisterContentScripts({ ids: ["cgpt-focus-cs"] }).catch(() => {});
    await chrome.scripting.registerContentScripts([{
      id: "cgpt-focus-cs",
      js: ["content.js"],
      matches: ["https://chatgpt.com/*", "https://chat.openai.com/*"],
      runAt: "document_idle",
      persistAcrossSessions: true
    }]);
  } catch (e) {
    // If this fails, the extension still might work via manual injection below
    console.warn("[CGPT-Focus][BG] registerContentScripts failed", e);
  }
}

// On install/update/startup, register
chrome.runtime.onInstalled.addListener(() => ensureContentScriptRegistered());
chrome.runtime.onStartup.addListener(() => ensureContentScriptRegistered());

// Also try to inject into any already-open ChatGPT tabs when the worker wakes
async function injectIntoOpenChatGPTTabs() {
  const tabs = await chrome.tabs.query({}).catch(() => []);
  for (const t of tabs) {
    if (t.id != null && isChatGPTUrl(t.url || "")) {
      chrome.scripting.executeScript({
        target: { tabId: t.id },
        files: ["content.js"]
      }).catch(() => {});
    }
  }
}
injectIntoOpenChatGPTTabs();

chrome.runtime.onMessage.addListener((msg, sender) => {
  const tabId = sender?.tab?.id;

  if (msg?.type === "RUN_SUBMITTED" && tabId != null) {
    tabState.set(tabId, { runToken: msg.runToken, submittedAt: msg.submittedAt || Date.now() });
    latest = { tabId, runToken: msg.runToken, submittedAt: msg.submittedAt || Date.now() };
    return;
  }

  if (msg?.type === "RUN_DONE" && tabId != null) {
    const state = tabState.get(tabId);
    if (!state || state.runToken !== msg.runToken) return;

    // Only focus if it is still the globally latest submission
    if (latest.tabId !== tabId || latest.runToken !== msg.runToken) return;

    focusTab(tabId);
    return;
  }

  if (msg?.type === "TEST_FOCUS_LATEST") {
    if (latest.tabId != null) focusTab(latest.tabId);
    return;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabState.delete(tabId);
  if (latest.tabId === tabId) latest = { tabId: null, runToken: null, submittedAt: 0 };
});
