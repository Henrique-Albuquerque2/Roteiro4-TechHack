"use strict";

const PrivacyLensHijacking = (() => {
  const store = self.PrivacyLensTabStore;
  const { getEtldPlusOne, isIpAddress } = self.PrivacyLensEtld;

  const SUSPICIOUS_PATTERNS = [
    { re: /\/hook\.js(\?|$)/i,           label: "Padrao BeEF (hook.js)", severity: "high" },
    { re: /BEEFHOOK|beef-hook/i,         label: "BeEF hook identificador", severity: "high" },
    { re: /\/beef\//i,                   label: "Diretorio /beef/", severity: "high" },
    { re: /^data:text\/javascript/i,     label: "Script via data: URI", severity: "medium" },
    { re: /^javascript:/i,               label: "URL javascript:", severity: "medium" },
    { re: /eval\(|new Function\(/i,      label: "eval/new Function em inline", severity: "low" }
  ];

  function inspectScriptRequest(details) {
    if (!details.url) return;
    if (details.type !== "script" && details.type !== "sub_frame") return;

    const tab = store.get(details.tabId);
    if (!tab) return;

    let host = "";
    try { host = new URL(details.url).hostname; } catch (_) {}

    for (const { re, label, severity } of SUSPICIOUS_PATTERNS) {
      if (re.test(details.url)) {
        store.addHijackingAlert(details.tabId, {
          kind: "suspicious-script",
          severity,
          label,
          url: details.url
        });
        return;
      }
    }

    if (host && isIpAddress(host)) {
      store.addHijackingAlert(details.tabId, {
        kind: "ip-script",
        severity: "medium",
        label: "Script carregado de endereco IP bruto",
        url: details.url
      });
    }
  }

  function onBeforeRedirect(details) {
    if (details.tabId < 0) return;
    if (details.type !== "main_frame" && details.type !== "sub_frame") return;
    const fromEtld = getEtldPlusOne(details.url);
    const toEtld = getEtldPlusOne(details.redirectUrl);
    if (!fromEtld || !toEtld) return;
    if (fromEtld === toEtld) return;
    const statusLine = details.statusLine || "";
    if (/30[1278]/.test(statusLine)) {
      store.addHijackingAlert(details.tabId, {
        kind: "cross-site-redirect",
        severity: "low",
        label: `Redirecionamento ${fromEtld} -> ${toEtld}`,
        url: details.url,
        target: details.redirectUrl
      });
    }
  }

  function attach() {
    browser.webRequest.onBeforeRedirect.addListener(
      onBeforeRedirect,
      { urls: ["<all_urls>"] }
    );
  }

  return { attach, inspectScriptRequest };
})();

self.PrivacyLensHijacking = PrivacyLensHijacking;
