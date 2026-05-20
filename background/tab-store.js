"use strict";

const PrivacyLensTabStore = (() => {
  const tabs = new Map();

  function emptyTab(tabId) {
    return {
      tabId,
      url: "",
      etld: "",
      navigatedAt: Date.now(),
      thirdPartyDomains: new Map(),
      cookies: new Map(),
      supercookies: [],
      storageEntries: [],
      fingerprintEvents: [],
      hijackingAlerts: [],
      cookieValueIndex: new Map(),
      cookieSyncEdges: new Map(),
      hstsObservations: new Map(),
      etagObservations: new Map()
    };
  }

  function get(tabId) {
    if (tabId === undefined || tabId === null || tabId < 0) return null;
    let t = tabs.get(tabId);
    if (!t) {
      t = emptyTab(tabId);
      tabs.set(tabId, t);
    }
    return t;
  }

  function reset(tabId, url) {
    const fresh = emptyTab(tabId);
    fresh.url = url || "";
    if (url) {
      try { fresh.etld = self.PrivacyLensEtld.getEtldPlusOne(url); } catch (_) {}
    }
    tabs.set(tabId, fresh);
    return fresh;
  }

  function remove(tabId) {
    tabs.delete(tabId);
  }

  function setTopLevel(tabId, url) {
    const t = reset(tabId, url);
    return t;
  }

  function addThirdPartyDomain(tabId, domain, type) {
    const t = get(tabId);
    if (!t) return;
    let entry = t.thirdPartyDomains.get(domain);
    if (!entry) {
      entry = { domain, types: {}, count: 0, firstSeenAt: Date.now() };
      t.thirdPartyDomains.set(domain, entry);
    }
    entry.count += 1;
    entry.types[type] = (entry.types[type] || 0) + 1;
  }

  function addCookie(tabId, cookie) {
    const t = get(tabId);
    if (!t) return;
    const key = `${cookie.domain}|${cookie.name}`;
    t.cookies.set(key, { ...cookie, observedAt: Date.now() });
  }

  function addSupercookie(tabId, sc) {
    const t = get(tabId);
    if (!t) return;
    t.supercookies.push({ ...sc, observedAt: Date.now() });
  }

  function setStorageEntries(tabId, origin, entries) {
    const t = get(tabId);
    if (!t) return;
    t.storageEntries = t.storageEntries.filter(e => e.origin !== origin);
    for (const e of entries) {
      t.storageEntries.push({ ...e, origin });
    }
  }

  function addFingerprintEvent(tabId, evt) {
    const t = get(tabId);
    if (!t) return;
    t.fingerprintEvents.push({ ...evt, observedAt: Date.now() });
    if (t.fingerprintEvents.length > 200) {
      t.fingerprintEvents = t.fingerprintEvents.slice(-200);
    }
  }

  function addHijackingAlert(tabId, alert) {
    const t = get(tabId);
    if (!t) return;
    t.hijackingAlerts.push({ ...alert, observedAt: Date.now() });
  }

  function indexCookieValueFragment(tabId, domain, fragment) {
    const t = get(tabId);
    if (!t) return;
    let set = t.cookieValueIndex.get(fragment);
    if (!set) {
      set = new Set();
      t.cookieValueIndex.set(fragment, set);
    }
    set.add(domain);
  }

  function addCookieSyncEdge(tabId, from, to, fragment) {
    const t = get(tabId);
    if (!t) return;
    const key = `${from}->${to}`;
    let edge = t.cookieSyncEdges.get(key);
    if (!edge) {
      edge = { from, to, count: 0, fragments: new Set(), firstSeenAt: Date.now() };
      t.cookieSyncEdges.set(key, edge);
    }
    edge.count += 1;
    edge.fragments.add(fragment);
  }

  function toReport(tabId) {
    const t = tabs.get(tabId);
    if (!t) {
      return {
        tabId,
        url: "",
        etld: "",
        thirdPartyDomains: [],
        cookies: [],
        supercookies: [],
        storageEntries: [],
        fingerprintEvents: [],
        hijackingAlerts: [],
        cookieSyncEdges: []
      };
    }
    return {
      tabId,
      url: t.url,
      etld: t.etld,
      navigatedAt: t.navigatedAt,
      thirdPartyDomains: Array.from(t.thirdPartyDomains.values())
        .sort((a, b) => b.count - a.count),
      cookies: Array.from(t.cookies.values()),
      supercookies: t.supercookies,
      storageEntries: t.storageEntries,
      fingerprintEvents: t.fingerprintEvents,
      hijackingAlerts: t.hijackingAlerts,
      cookieSyncEdges: Array.from(t.cookieSyncEdges.values()).map(e => ({
        from: e.from,
        to: e.to,
        count: e.count,
        fragments: Array.from(e.fragments).slice(0, 3),
        firstSeenAt: e.firstSeenAt
      }))
    };
  }

  return {
    get,
    reset,
    remove,
    setTopLevel,
    addThirdPartyDomain,
    addCookie,
    addSupercookie,
    setStorageEntries,
    addFingerprintEvent,
    addHijackingAlert,
    indexCookieValueFragment,
    addCookieSyncEdge,
    toReport
  };
})();

self.PrivacyLensTabStore = PrivacyLensTabStore;
