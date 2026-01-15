(() => {
  console.log("[CGPT-Focus][CS] loaded");

  let currentRunToken = null;
  let generating = false;
  let doneSentForToken = null;

  // Extra robustness: catch submit even if React swaps DOM nodes
  let docClickHooked = false;
  let docKeyHooked = false;

  const POLL_MS = 250;

  function uuidToken() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  // Stop streaming button (your UI)
  function hasStopStreamingButton() {
    return (
      !!document.querySelector('button[data-testid="stop-button"][aria-label="Stop streaming"]') ||
      !!document.querySelector('button[data-testid="stop-button"]') ||
      !!document.querySelector('button[aria-label="Stop streaming"]')
    );
  }

  function getComposerTextarea() {
    return document.querySelector("textarea");
  }

  function getSendButton() {
    return (
      document.querySelector("#composer-submit-button") ||
      document.querySelector('[data-testid="send-button"]') ||
      document.querySelector('button[aria-label*="Send" i]') ||
      Array.from(document.querySelectorAll("button")).find((b) => {
        const t = (b.textContent || "").trim().toLowerCase();
        return t === "send" || t === "submit";
      })
    );
  }

  // Reliable + quiet messaging (with helpful debug)
  function safeSendMessage(payload) {
    try {
      chrome.runtime.sendMessage(payload, () => {
        const _ = chrome.runtime.lastError;
        void _;
      });
      console.log("[CGPT-Focus][CS] sent", payload.type);
      return true;
    } catch (e) {
      console.log("[CGPT-Focus][CS] send failed", e);
      return false;
    }
  }

  function scrollToLastTurnActions() {
    try {
      const allCopy = document.querySelectorAll(
        'button[data-testid="copy-turn-action-button"]'
      );

      if (allCopy && allCopy.length) {
        const btn = allCopy[allCopy.length - 1];
        btn.style.scrollMarginTop = "80px";
        btn.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });

        // Lock after layout settles
        setTimeout(() => {
          try {
            btn.scrollIntoView({ behavior: "auto", block: "start", inline: "nearest" });
          } catch (_) {}
        }, 250);

        return true;
      }

      const assistants = document.querySelectorAll(
        '[data-message-author-role="assistant"]'
      );

      if (assistants && assistants.length) {
        const last = assistants[assistants.length - 1];
        last.style.scrollMarginTop = "80px";
        last.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
        return true;
      }
    } catch (_) {}

    return false;
  }

  function markSubmitted(source) {
    currentRunToken = uuidToken();
    generating = true;
    doneSentForToken = null;

    console.log("[CGPT-Focus][CS] SUBMITTED", source, currentRunToken);

    safeSendMessage({
      type: "RUN_SUBMITTED",
      runToken: currentRunToken,
      submittedAt: Date.now()
    });
  }

  function checkDone() {
    if (!generating || !currentRunToken) return;

    const stopExists = hasStopStreamingButton();

    // Done only when stop button disappears
    if (!stopExists) {
      if (doneSentForToken === currentRunToken) return;

      doneSentForToken = currentRunToken;
      generating = false;

      // Let UI swap buttons → then scroll → then tell BG to focus tab
      setTimeout(() => {
        scrollToLastTurnActions();

        setTimeout(() => {
          console.log("[CGPT-Focus][CS] DONE (stop button gone)", currentRunToken);

          safeSendMessage({
            type: "RUN_DONE",
            runToken: currentRunToken
          });
        }, 75);
      }, 150);
    }
  }

  function hookSubmission() {
    const ta = getComposerTextarea();

    if (ta && !ta.__cgptFocusHooked) {
      ta.__cgptFocusHooked = true;

      ta.addEventListener(
        "keydown",
        (e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            markSubmitted("EnterKey");
          }
        },
        true
      );

      const form = ta.closest("form");
      if (form && !form.__cgptFocusFormHooked) {
        form.__cgptFocusFormHooked = true;
        form.addEventListener("submit", () => markSubmitted("FormSubmit"), true);
      }
    }

    const sendBtn = getSendButton();
    if (sendBtn && !sendBtn.__cgptFocusHooked) {
      sendBtn.__cgptFocusHooked = true;
      sendBtn.addEventListener("click", () => markSubmitted("SendClick"), true);
    }

    // Document-level capture fallbacks (survive React swaps / stopped propagation)
    if (!docClickHooked) {
      docClickHooked = true;

      document.addEventListener(
        "click",
        (e) => {
          const btn = e.target && e.target.closest && e.target.closest("#composer-submit-button");
          if (!btn) return;

          // If this button is currently "Stop", don't treat it as a new submission.
          const aria = (btn.getAttribute("aria-label") || "").toLowerCase();
          const dataTest = (btn.getAttribute("data-testid") || "").toLowerCase();
          const isStopLike =
            dataTest.includes("stop") || aria.includes("stop") || aria.includes("streaming");

          if (!isStopLike) {
            markSubmitted("DocClickComposerButton");
          }
        },
        true
      );
    }

    if (!docKeyHooked) {
      docKeyHooked = true;

      document.addEventListener(
        "keydown",
        (e) => {
          if (e.key !== "Enter") return;
          if (e.shiftKey) return;

          const active = document.activeElement;
          const isTextarea = active && active.tagName === "TEXTAREA";
          const isContentEditable =
            active && active.getAttribute && active.getAttribute("contenteditable") === "true";

          if (isTextarea || isContentEditable) {
            markSubmitted("DocEnter");
          }
        },
        true
      );
    }
  }

  const mo = new MutationObserver(() => {
    hookSubmission();
  });

  mo.observe(document.documentElement, { childList: true, subtree: true });

  hookSubmission();
  setInterval(checkDone, POLL_MS);
})();
