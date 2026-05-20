"use strict";

const PrivacyLensNetwork = (() => {
  const store = self.PrivacyLensTabStore;
  const { getEtldPlusOne } = self.PrivacyLensEtld;

  function onBeforeRequest(details) {
    if (details.tabId < 0) return;
    const tab = store.get(details.tabId);
    if (!tab) return;

    if (details.type === "main_frame") {
      if (tab.url !== details.url) {
        store.setTopLevel(details.tabId, details.url);
      }
      return;
    }

    let tabEtld = tab.etld;
    if (!tabEtld) return;

    const requestEtld = getEtldPlusOne(details.url);
    if (!requestEtld) return;

    if (requestEtld !== tabEtld) {
      store.addThirdPartyDomain(details.tabId, requestEtld, details.type || "other");
      if (self.PrivacyLensCookieSync) {
        self.PrivacyLensCookieSync.scanRequestForSync(details);
      }
      if (self.PrivacyLensHijacking) {
        self.PrivacyLensHijacking.inspectScriptRequest(details);
      }
    }
  }

  function attach() {
    browser.webRequest.onBeforeRequest.addListener(
      onBeforeRequest,
      {
        urls: ["<all_urls>"],
        types: [
          "main_frame","sub_frame","stylesheet","script","image","font",
          "object","xmlhttprequest","ping","csp_report","media","websocket","other"
        ]
      }
    );
  }

  return { attach };
})();

self.PrivacyLensNetwork = PrivacyLensNetwork;
