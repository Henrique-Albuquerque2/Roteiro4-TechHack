"use strict";

const PrivacyLensCookies = (() => {
  const store = self.PrivacyLensTabStore;
  const { getEtldPlusOne } = self.PrivacyLensEtld;

  function parseSetCookie(headerValue, responseHost) {
    const parts = headerValue.split(";").map(p => p.trim());
    if (!parts.length) return null;
    const [name, ...rest] = parts[0].split("=");
    const value = rest.join("=");
    const cookie = {
      name: (name || "").trim(),
      value: value || "",
      domain: responseHost,
      path: "/",
      secure: false,
      httpOnly: false,
      sameSite: "",
      expires: null,
      maxAge: null
    };
    for (let i = 1; i < parts.length; i++) {
      const [k, ...v] = parts[i].split("=");
      const key = (k || "").toLowerCase().trim();
      const val = v.join("=").trim();
      if (key === "domain") cookie.domain = val.replace(/^\./, "") || responseHost;
      else if (key === "path") cookie.path = val || "/";
      else if (key === "secure") cookie.secure = true;
      else if (key === "httponly") cookie.httpOnly = true;
      else if (key === "samesite") cookie.sameSite = val.toLowerCase();
      else if (key === "expires") cookie.expires = val;
      else if (key === "max-age") cookie.maxAge = parseInt(val, 10);
    }
    return cookie.name ? cookie : null;
  }

  function isPersistent(cookie) {
    if (cookie.maxAge !== null && !isNaN(cookie.maxAge) && cookie.maxAge > 0) return true;
    if (cookie.expires) {
      const d = Date.parse(cookie.expires);
      if (!isNaN(d) && d > Date.now()) return true;
    }
    return false;
  }

  function valueFragmentsFor(value) {
    const out = [];
    if (!value) return out;
    if (value.length >= 8 && /[A-Za-z0-9_\-+/=.]+/.test(value)) {
      out.push(value);
    }
    const tokens = value.split(/[|;,&]/);
    for (const t of tokens) {
      const tt = t.trim();
      if (tt.length >= 12 && /^[A-Za-z0-9_\-+/=.]+$/.test(tt) && !out.includes(tt)) {
        out.push(tt);
      }
    }
    return out.slice(0, 3);
  }

  function onHeadersReceived(details) {
    if (details.tabId < 0) return;
    const tab = store.get(details.tabId);
    if (!tab || !tab.etld) return;

    let responseHost = "";
    try { responseHost = new URL(details.url).hostname; } catch (_) { return; }
    const responseEtld = getEtldPlusOne(responseHost);
    const thirdParty = responseEtld && responseEtld !== tab.etld;

    let hstsSeen = false;
    let etagSeen = null;

    for (const h of (details.responseHeaders || [])) {
      const name = (h.name || "").toLowerCase();
      const value = h.value || h.binaryValue || "";
      if (name === "set-cookie") {
        const lines = String(value).split("\n");
        for (const line of lines) {
          const c = parseSetCookie(line, responseHost);
          if (!c) continue;
          const cookieEtld = getEtldPlusOne(c.domain);
          const cookieIsThirdParty = cookieEtld && cookieEtld !== tab.etld;
          const persistent = isPersistent(c);
          store.addCookie(details.tabId, {
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path,
            secure: c.secure,
            httpOnly: c.httpOnly,
            sameSite: c.sameSite,
            expires: c.expires,
            maxAge: c.maxAge,
            thirdParty: !!cookieIsThirdParty,
            persistent
          });
          for (const frag of valueFragmentsFor(c.value)) {
            store.indexCookieValueFragment(details.tabId, getEtldPlusOne(c.domain) || c.domain, frag);
          }
        }
      } else if (name === "strict-transport-security") {
        hstsSeen = true;
      } else if (name === "etag") {
        etagSeen = String(value);
      }
    }

    if (hstsSeen && thirdParty) {
      const map = tab.hstsObservations;
      const set = map.get(responseEtld) || new Set();
      set.add(responseHost);
      map.set(responseEtld, set);
      if (set.size >= 3) {
        store.addSupercookie(details.tabId, {
          kind: "HSTS",
          host: responseEtld,
          detail: `HSTS aplicado em ${set.size} subdominios distintos de ${responseEtld}`
        });
      }
    }

    if (etagSeen && thirdParty && etagSeen.length >= 8) {
      const map = tab.etagObservations;
      const seen = map.get(responseHost);
      if (seen && seen === etagSeen) {
        store.addSupercookie(details.tabId, {
          kind: "ETag",
          host: responseHost,
          detail: `ETag persistente em ${responseHost}: ${etagSeen.slice(0, 24)}...`
        });
      }
      map.set(responseHost, etagSeen);
    }
  }

  function attach() {
    browser.webRequest.onHeadersReceived.addListener(
      onHeadersReceived,
      { urls: ["<all_urls>"] },
      ["responseHeaders"]
    );
  }

  return { attach };
})();

self.PrivacyLensCookies = PrivacyLensCookies;
