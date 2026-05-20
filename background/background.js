"use strict";

(function () {
  const store = self.PrivacyLensTabStore;
  const score = self.PrivacyLensScore;

  self.PrivacyLensNetwork.attach();
  self.PrivacyLensCookies.attach();
  self.PrivacyLensHijacking.attach();

  browser.webNavigation.onBeforeNavigate.addListener((details) => {
    if (details.frameId !== 0) return;
    const tab = store.get(details.tabId);
    if (!tab || tab.url !== details.url) {
      store.reset(details.tabId, details.url);
    }
    updateBadge(details.tabId);
  });

  browser.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId !== 0) return;
    const tab = store.get(details.tabId);
    if (tab && !tab.etld) {
      store.setTopLevel(details.tabId, details.url);
    }
    updateBadge(details.tabId);
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    store.remove(tabId);
  });

  browser.tabs.onActivated.addListener(({ tabId }) => updateBadge(tabId));

  browser.runtime.onMessage.addListener((msg, sender) => {
    if (!msg || !msg.type) return;
    const senderTabId = sender.tab && sender.tab.id;

    switch (msg.type) {
      case "FINGERPRINT_EVENT": {
        if (senderTabId === undefined) return;
        store.addFingerprintEvent(senderTabId, msg.payload || {});
        updateBadge(senderTabId);
        return;
      }
      case "STORAGE_REPORT": {
        if (senderTabId === undefined) return;
        const p = msg.payload || {};
        store.setStorageEntries(senderTabId, p.origin || "", p.entries || []);
        updateBadge(senderTabId);
        return;
      }
      case "GET_TAB_REPORT": {
        const tabId = msg.tabId;
        const report = store.toReport(tabId);
        const scoring = score.computePrivacyScore(report);
        return Promise.resolve({ report, scoring });
      }
      case "RESET_TAB": {
        if (typeof msg.tabId === "number") {
          store.remove(msg.tabId);
          updateBadge(msg.tabId);
        }
        return Promise.resolve({ ok: true });
      }
    }
  });

  async function updateBadge(tabId) {
    if (typeof tabId !== "number" || tabId < 0) return;
    const report = store.toReport(tabId);
    const scoring = score.computePrivacyScore(report);
    try {
      await browser.browserAction.setBadgeText({
        tabId,
        text: String(scoring.grade)
      });
      await browser.browserAction.setBadgeBackgroundColor({
        tabId,
        color: score.gradeColor(scoring.grade)
      });
    } catch (_) {}
  }
})();
