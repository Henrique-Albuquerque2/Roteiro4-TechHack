"use strict";

const MULTI_LEVEL_SUFFIXES = new Set([
  "co.uk","org.uk","gov.uk","ac.uk","ltd.uk","plc.uk","me.uk","net.uk",
  "com.br","org.br","net.br","gov.br","edu.br","com.au","net.au","org.au","gov.au","edu.au",
  "com.ar","com.mx","com.co","com.pe","com.ve","com.cl","com.ec","com.uy","com.py",
  "co.jp","or.jp","ne.jp","ac.jp","go.jp","co.kr","or.kr","ne.kr","go.kr","re.kr",
  "co.in","org.in","net.in","gov.in","ac.in","co.za","org.za","net.za","gov.za","ac.za",
  "com.cn","net.cn","org.cn","gov.cn","edu.cn","com.hk","org.hk","net.hk","gov.hk","edu.hk",
  "com.sg","org.sg","net.sg","gov.sg","edu.sg","com.tw","org.tw","net.tw","gov.tw","edu.tw",
  "com.tr","org.tr","net.tr","gov.tr","edu.tr","com.eg","org.eg","gov.eg","edu.eg",
  "co.il","org.il","net.il","gov.il","ac.il","co.nz","org.nz","net.nz","govt.nz","ac.nz",
  "com.pl","com.ua","com.ru","com.my","org.my","net.my","gov.my","edu.my",
  "co.id","or.id","ac.id","go.id","co.th","or.th","ac.th","go.th",
  "co.ke","or.ke","ac.ke","go.ke","co.ug","co.tz","co.zw","co.zm"
]);

function isIpAddress(host) {
  if (!host) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  if (host.includes(":")) return true;
  return false;
}

function normalizeHost(host) {
  if (!host) return "";
  host = host.toLowerCase().trim();
  if (host.endsWith(".")) host = host.slice(0, -1);
  return host;
}

function getEtldPlusOne(hostOrUrl) {
  if (!hostOrUrl) return "";
  let host = hostOrUrl;
  if (host.includes("://")) {
    try {
      host = new URL(host).hostname;
    } catch (_) {
      return "";
    }
  }
  host = normalizeHost(host);
  if (!host) return "";
  if (isIpAddress(host)) return host;
  if (host === "localhost") return host;

  const parts = host.split(".");
  if (parts.length < 2) return host;

  const last2 = parts.slice(-2).join(".");
  const last3 = parts.length >= 3 ? parts.slice(-3).join(".") : null;

  if (last3 && MULTI_LEVEL_SUFFIXES.has(parts.slice(-2).join("."))) {
    return last3;
  }
  return last2;
}

function isThirdParty(requestHost, tabHost) {
  if (!requestHost || !tabHost) return false;
  const a = getEtldPlusOne(requestHost);
  const b = getEtldPlusOne(tabHost);
  if (!a || !b) return false;
  return a !== b;
}

if (typeof self !== "undefined") {
  self.PrivacyLensEtld = { getEtldPlusOne, isThirdParty, isIpAddress, normalizeHost };
}
