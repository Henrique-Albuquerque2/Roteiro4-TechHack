"use strict";

const PrivacyLensCookieSync = (() => {
  const store = self.PrivacyLensTabStore;
  const { getEtldPlusOne } = self.PrivacyLensEtld;

  function scanRequestForSync(details) {
    const tab = store.get(details.tabId);
    if (!tab || !tab.cookieValueIndex.size) return;

    const targetEtld = getEtldPlusOne(details.url);
    if (!targetEtld) return;

    let haystack = "";
    try {
      const url = new URL(details.url);
      haystack = url.search + " " + url.pathname;
    } catch (_) { return; }
    if (details.requestBody && details.requestBody.formData) {
      for (const k of Object.keys(details.requestBody.formData)) {
        haystack += " " + k + "=" + (details.requestBody.formData[k] || []).join(",");
      }
    }

    if (haystack.length < 12) return;

    for (const [fragment, sourceDomains] of tab.cookieValueIndex) {
      if (haystack.includes(fragment)) {
        for (const source of sourceDomains) {
          if (source !== targetEtld) {
            store.addCookieSyncEdge(details.tabId, source, targetEtld, fragment.slice(0, 24));
          }
        }
      }
    }
  }

  return { scanRequestForSync };
})();

self.PrivacyLensCookieSync = PrivacyLensCookieSync;
