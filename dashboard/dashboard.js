"use strict";

const GRADE_COLORS = { A: "#1f9d55", B: "#7cb342", C: "#f9a825", D: "#ef6c00", F: "#c62828" };

const state = {
  tabId: null
};

function qs(id) { return document.getElementById(id); }

function emptyRow(colspan, text) {
  return `<tr><td class="empty" colspan="${colspan}">${text}</td></tr>`;
}

function escape(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function formatBytes(n) {
  if (n == null) return "-";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString();
}

async function loadTabs() {
  const tabs = await browser.tabs.query({});
  const select = qs("tab-select");
  select.innerHTML = "";
  for (const t of tabs) {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = `[${t.id}] ${(t.title || t.url || "").slice(0, 50)}`;
    if (t.id === state.tabId) opt.selected = true;
    select.appendChild(opt);
  }
  if (state.tabId == null && tabs.length) {
    state.tabId = tabs[0].id;
    select.value = String(state.tabId);
  }
}

async function refresh() {
  if (state.tabId == null) return;
  const resp = await browser.runtime.sendMessage({ type: "GET_TAB_REPORT", tabId: state.tabId });
  if (!resp) return;
  const { report, scoring } = resp;

  qs("origin").textContent = report.url || "(sem navegacao registrada)";
  qs("grade-badge").textContent = scoring.grade;
  qs("grade-badge").style.background = GRADE_COLORS[scoring.grade] || "#94a3b8";
  qs("score").textContent = scoring.score;

  qs("s-domains").textContent = (report.thirdPartyDomains || []).length;
  qs("s-cookies").textContent = (report.cookies || []).length;
  qs("s-storage").textContent = (report.storageEntries || []).length;
  qs("s-fp").textContent = (report.fingerprintEvents || []).length;
  qs("s-sync").textContent = (report.cookieSyncEdges || []).length;
  qs("s-hijack").textContent = (report.hijackingAlerts || []).length;

  renderDomains(report);
  renderCookies(report);
  renderStorage(report);
  renderFingerprint(report);
  renderCookieSync(report);
  renderHijacking(report);
  renderScore(scoring);
}

function renderDomains(report) {
  const rows = (report.thirdPartyDomains || []).map(d => {
    const types = Object.entries(d.types).map(([t, c]) => `<span class="tag">${escape(t)}: ${c}</span>`).join(" ");
    return `<tr>
      <td>${escape(d.domain)}</td>
      <td>${types}</td>
      <td>${d.count}</td>
      <td>${formatTime(d.firstSeenAt)}</td>
    </tr>`;
  });
  qs("tbl-domains").innerHTML = rows.length ? rows.join("") : emptyRow(4, "Nenhum dominio de terceira parte detectado.");
}

function renderCookies(report) {
  const rows = (report.cookies || []).map(c => {
    const partyTag = c.thirdParty
      ? '<span class="tag third">3rd</span>'
      : '<span class="tag first">1st</span>';
    const durTag = c.persistent
      ? '<span class="tag persistent">persistente</span>'
      : '<span class="tag session">sessao</span>';
    const flags = [];
    if (c.secure) flags.push('<span class="tag secure">Secure</span>');
    if (c.httpOnly) flags.push('<span class="tag secure">HttpOnly</span>');
    if (c.sameSite) flags.push(`<span class="tag">SameSite=${escape(c.sameSite)}</span>`);
    const preview = (c.value || "").slice(0, 40);
    return `<tr>
      <td>${escape(c.name)}</td>
      <td>${escape(c.domain)}</td>
      <td>${partyTag}</td>
      <td>${durTag}</td>
      <td>${flags.join(" ")}</td>
      <td><span class="value-cell" title="${escape(c.value)}">${escape(preview)}</span></td>
    </tr>`;
  });
  qs("tbl-cookies").innerHTML = rows.length ? rows.join("") : emptyRow(6, "Nenhum cookie capturado nas respostas.");

  const scRows = (report.supercookies || []).map(s => `<tr>
    <td>${escape(s.kind)}</td>
    <td>${escape(s.host)}</td>
    <td>${escape(s.detail || "")}</td>
  </tr>`);
  qs("tbl-supercookies").innerHTML = scRows.length ? scRows.join("") : emptyRow(3, "Nenhum supercookie detectado.");
}

function renderStorage(report) {
  const rows = (report.storageEntries || []).map(s => `<tr>
    <td>${escape(s.origin || "")}</td>
    <td>${escape(s.area)}</td>
    <td>${escape(s.key)}</td>
    <td>${formatBytes(s.size)}</td>
    <td><span class="value-cell" title="${escape(s.preview || "")}">${escape((s.preview || "").slice(0, 60))}</span></td>
  </tr>`);
  qs("tbl-storage").innerHTML = rows.length ? rows.join("") : emptyRow(5, "Nenhum dado armazenado no cliente.");
}

function renderFingerprint(report) {
  const rows = (report.fingerprintEvents || []).slice().reverse().map(e => `<tr>
    <td>${escape(e.surface)}</td>
    <td>${escape(e.api)}</td>
    <td><span class="value-cell" title="${escape(e.scriptUrl || "")}">${escape((e.scriptUrl || "").slice(0, 80))}</span></td>
    <td>${escape(e.origin || "")}</td>
  </tr>`);
  qs("tbl-fp").innerHTML = rows.length ? rows.join("") : emptyRow(4, "Nenhuma chamada de fingerprinting registrada.");
}

function renderCookieSync(report) {
  const rows = (report.cookieSyncEdges || []).map(e => `<tr>
    <td>${escape(e.from)}</td>
    <td>${escape(e.to)}</td>
    <td>${e.count}</td>
    <td>${(e.fragments || []).map(f => `<span class="tag">${escape(f)}</span>`).join(" ")}</td>
  </tr>`);
  qs("tbl-sync").innerHTML = rows.length ? rows.join("") : emptyRow(4, "Nenhuma troca de identificador entre dominios.");
}

function renderHijacking(report) {
  const rows = (report.hijackingAlerts || []).map(a => `<tr>
    <td>${escape(a.kind)}</td>
    <td><span class="tag ${escape(a.severity)}">${escape(a.severity)}</span></td>
    <td>${escape(a.label)}</td>
    <td><span class="value-cell" title="${escape(a.url || "")}">${escape((a.url || "").slice(0, 80))}</span></td>
  </tr>`);
  qs("tbl-hijack").innerHTML = rows.length ? rows.join("") : emptyRow(4, "Nenhuma anomalia de hijacking observada.");
}

function renderScore(scoring) {
  const rows = scoring.breakdown.map(b => `<tr>
    <td>${escape(b.label)}</td>
    <td>${b.count}</td>
    <td>${b.penalty === 0 ? "0" : `-${b.penalty}`}</td>
  </tr>`);
  rows.push(`<tr>
    <td><strong>Total</strong></td>
    <td></td>
    <td><strong>${scoring.totalPenalty === 0 ? "0" : `-${scoring.totalPenalty}`}</strong></td>
  </tr>`);
  qs("tbl-score").innerHTML = rows.join("");
}

function selectTab(name) {
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active", p.id === `panel-${name}`));
}

document.querySelectorAll(".tab").forEach(b => {
  b.addEventListener("click", () => selectTab(b.dataset.tab));
});

qs("tab-select").addEventListener("change", (e) => {
  state.tabId = parseInt(e.target.value, 10);
  refresh();
});

qs("refresh").addEventListener("click", () => refresh());

(async function init() {
  const params = new URLSearchParams(location.search);
  if (params.has("tabId")) state.tabId = parseInt(params.get("tabId"), 10);
  await loadTabs();
  await refresh();
  setInterval(refresh, 2500);
})();
