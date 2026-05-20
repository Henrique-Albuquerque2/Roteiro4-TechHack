"use strict";

(function injectFingerprintHooks() {
  try {
    const src = browser.runtime.getURL("injected/fingerprint-hooks.js");
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.dataset.privacyLens = "1";
    (document.head || document.documentElement).appendChild(script);
    script.addEventListener("load", () => script.remove());
  } catch (e) {
    console.warn("[PrivacyLens] failed to inject hooks", e);
  }
})();

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.__privacyLens !== true) return;
  try {
    browser.runtime.sendMessage({
      type: "FINGERPRINT_EVENT",
      payload: {
        surface: data.surface,
        api: data.api,
        detail: data.detail || "",
        scriptUrl: data.scriptUrl || "",
        origin: location.origin,
        href: location.href
      }
    });
  } catch (_) {}
});
