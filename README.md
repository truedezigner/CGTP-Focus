# CGPT-Focus

A lightweight Chrome extension content script that **automatically refocuses the ChatGPT tab only after a response is fully finished generating**, and scrolls precisely to the final assistant output actions (Copy / Edit buttons).

This avoids premature tab switching while ChatGPT is still streaming text and works reliably with ChatGPT’s React-based UI.

---

## ✨ Features

- ✅ Detects **true submission events**
  - Enter key (without Shift)
  - Send button click
  - Form submit
- ✅ Waits for **generation to fully complete**
  - Uses disappearance of the **“Stop streaming”** button
- ✅ Prevents early or repeated focus switching
- ✅ Scrolls to the **exact end of the assistant message**
  - Anchors to the **Copy button** row when available
- ✅ Survives ChatGPT UI re-renders
- ✅ Quiet messaging (no `runtime.lastError` noise)
- ✅ No dependencies

---

## 🔍 Why This Exists

ChatGPT’s UI swaps DOM elements during generation.  
Most scripts incorrectly detect “done” as soon as text appears.

This script **only considers a run complete when the Stop button disappears**, which is the single reliable signal that generation has ended.

---

## 🧠 How It Works

1. Intercepts message submission (Enter / Send / Form submit)
2. Generates a unique run token
3. Polls the DOM for the **Stop streaming** button
4. Marks completion only when the Stop button disappears
5. Scrolls to the final assistant action buttons
6. Signals the background script to focus the tab

---

## 📂 Files

```
content.js   # Main logic (DOM detection, scrolling, messaging)
```

---

## 🧪 Console Messages (Safe to Ignore)

You may see messages like:

```
net::ERR_BLOCKED_BY_CLIENT
Permissions-Policy header warnings
```

These originate from blocked telemetry or browser privacy features and **do not affect functionality**.

---

## 🛠 Configuration

Polling interval:

```js
const POLL_MS = 250;
```

Scroll offset:

```js
btn.style.scrollMarginTop = "80px";
```

---

## 🚫 Non-Goals

- No UI injection
- No data storage
- No interference with streaming
- No ChatGPT output modification

---

## 📜 License

MIT — free to use, modify, and distribute.

---

## 🧠 Maintenance Notes

If ChatGPT updates their UI:
- Verify the **Stop button selector**
- Verify the **Copy button selector**
- Core logic should remain stable
