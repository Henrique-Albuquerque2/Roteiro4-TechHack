"use strict";

const WEIGHTS = {
  thirdPartyDomain:        { per: 2,  cap: 30 },
  thirdPartyCookie:        { per: 3,  cap: 20 },
  persistentThirdPartyExtra: { per: 2, cap: 16 },
  supercookie:             { per: 10, cap: 30 },
  fingerprintSurface:      { per: 8,  cap: 24 },
  cookieSyncEdge:          { per: 5,  cap: 15 },
  hijackingAlert:          { per: 20, cap: 40 },
  storageHeavyOrigin:      { per: 3,  cap: 9 }
};

function capPenalty(count, { per, cap }) {
  return Math.min(count * per, cap);
}

function computePrivacyScore(report) {
  const r = report || {};
  const thirdPartyDomainCount = (r.thirdPartyDomains || []).length;
  const cookies = r.cookies || [];
  const thirdPartyCookies = cookies.filter(c => c.thirdParty);
  const persistentThirdParty = thirdPartyCookies.filter(c => c.persistent);
  const supercookieCount = (r.supercookies || []).length;
  const fingerprintSurfaces = new Set();
  for (const evt of (r.fingerprintEvents || [])) {
    if (evt.surface) fingerprintSurfaces.add(evt.surface);
  }
  const cookieSyncEdges = (r.cookieSyncEdges || []).length;
  const hijackingAlerts = (r.hijackingAlerts || []).length;
  const storageHeavyOrigins = (r.storageEntries || []).filter(e => e.size > 50 * 1024).length;

  const breakdown = [
    {
      key: "thirdPartyDomain",
      label: "Dominios de terceira parte",
      count: thirdPartyDomainCount,
      penalty: capPenalty(thirdPartyDomainCount, WEIGHTS.thirdPartyDomain)
    },
    {
      key: "thirdPartyCookie",
      label: "Cookies de terceira parte",
      count: thirdPartyCookies.length,
      penalty: capPenalty(thirdPartyCookies.length, WEIGHTS.thirdPartyCookie)
    },
    {
      key: "persistentThirdPartyExtra",
      label: "Cookies persistentes de terceira parte",
      count: persistentThirdParty.length,
      penalty: capPenalty(persistentThirdParty.length, WEIGHTS.persistentThirdPartyExtra)
    },
    {
      key: "supercookie",
      label: "Supercookies (HSTS/ETag)",
      count: supercookieCount,
      penalty: capPenalty(supercookieCount, WEIGHTS.supercookie)
    },
    {
      key: "fingerprintSurface",
      label: "Superficies de fingerprinting",
      count: fingerprintSurfaces.size,
      penalty: capPenalty(fingerprintSurfaces.size, WEIGHTS.fingerprintSurface)
    },
    {
      key: "cookieSyncEdge",
      label: "Cookie syncing entre dominios",
      count: cookieSyncEdges,
      penalty: capPenalty(cookieSyncEdges, WEIGHTS.cookieSyncEdge)
    },
    {
      key: "hijackingAlert",
      label: "Alertas de hijacking/hooking",
      count: hijackingAlerts,
      penalty: capPenalty(hijackingAlerts, WEIGHTS.hijackingAlert)
    },
    {
      key: "storageHeavyOrigin",
      label: "Origens com armazenamento pesado (>50KB)",
      count: storageHeavyOrigins,
      penalty: capPenalty(storageHeavyOrigins, WEIGHTS.storageHeavyOrigin)
    }
  ];

  const totalPenalty = breakdown.reduce((sum, b) => sum + b.penalty, 0);
  const score = Math.max(0, 100 - totalPenalty);
  const grade = scoreToGrade(score);

  return { score, grade, breakdown, totalPenalty };
}

function scoreToGrade(score) {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 50) return "C";
  if (score >= 30) return "D";
  return "F";
}

function gradeColor(grade) {
  switch (grade) {
    case "A": return "#1f9d55";
    case "B": return "#7cb342";
    case "C": return "#f9a825";
    case "D": return "#ef6c00";
    default:  return "#c62828";
  }
}

if (typeof self !== "undefined") {
  self.PrivacyLensScore = { computePrivacyScore, scoreToGrade, gradeColor, WEIGHTS };
}
