"use strict";

(function () {
  const POLL_INTERVAL_MS = 3000;
  const MAX_SAMPLE_RECORDS = 10;

  function sizeOf(value) {
    try {
      return new Blob([value == null ? "" : String(value)]).size;
    } catch (_) {
      return (value == null ? 0 : String(value).length);
    }
  }

  function readWebStorage(area, areaName) {
    const out = [];
    try {
      for (let i = 0; i < area.length; i++) {
        const key = area.key(i);
        if (key == null) continue;
        const value = area.getItem(key);
        out.push({
          area: areaName,
          key,
          size: sizeOf(value),
          preview: String(value).slice(0, 80)
        });
      }
    } catch (_) {}
    return out;
  }

  async function readIndexedDb() {
    const out = [];
    if (!indexedDB || typeof indexedDB.databases !== "function") return out;
    let dbs = [];
    try { dbs = await indexedDB.databases(); } catch (_) { return out; }
    for (const info of dbs) {
      if (!info || !info.name) continue;
      try {
        const db = await openDb(info.name, info.version);
        for (const storeName of db.objectStoreNames) {
          const stats = await statStore(db, storeName);
          out.push({
            area: "indexedDB",
            key: `${info.name}.${storeName}`,
            size: stats.size,
            preview: `${stats.count} registros (amostra: ${stats.size}B aprox)`
          });
        }
        db.close();
      } catch (_) {}
    }
    return out;
  }

  function openDb(name, version) {
    return new Promise((resolve, reject) => {
      const req = version ? indexedDB.open(name, version) : indexedDB.open(name);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("blocked"));
      req.onupgradeneeded = () => { req.transaction && req.transaction.abort(); };
    });
  }

  function statStore(db, storeName) {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const countReq = store.count();
        countReq.onsuccess = () => {
          const count = countReq.result || 0;
          const sample = store.getAll(null, MAX_SAMPLE_RECORDS);
          sample.onsuccess = () => {
            let size = 0;
            for (const row of (sample.result || [])) {
              try { size += new Blob([JSON.stringify(row)]).size; } catch (_) {}
            }
            const approx = count > 0 && (sample.result || []).length > 0
              ? Math.round(size * count / (sample.result || []).length)
              : size;
            resolve({ count, size: approx });
          };
          sample.onerror = () => resolve({ count, size: 0 });
        };
        countReq.onerror = () => resolve({ count: 0, size: 0 });
      } catch (_) {
        resolve({ count: 0, size: 0 });
      }
    });
  }

  async function collect() {
    const entries = [];
    entries.push(...readWebStorage(window.localStorage, "localStorage"));
    entries.push(...readWebStorage(window.sessionStorage, "sessionStorage"));
    const idb = await readIndexedDb();
    entries.push(...idb);

    try {
      browser.runtime.sendMessage({
        type: "STORAGE_REPORT",
        payload: {
          origin: location.origin,
          href: location.href,
          entries
        }
      });
    } catch (_) {}
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; collect(); }, 300);
  }

  collect();
  setInterval(collect, POLL_INTERVAL_MS);

  try {
    const observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  } catch (_) {}
})();
