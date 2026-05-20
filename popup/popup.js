"use strict";

const GRADE_COLORS = { A: "#1f9d55", B: "#7cb342", C: "#f9a825", D: "#ef6c00", F: "#c62828" };

async function getActiveTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

function uniqueFingerprintSurfaces(report) {
  const set = new Set();
  for (const e of (report.fingerprintEvents || [])) {
    if (e.surface) set.add(e.surface);
  }
  return set.size;
}

async function refresh() {
  const tab = await getActiveTab();
  if (!tab) return;
  document.getElementById("origin").textContent = tab.url || "";
  const resp = await browser.runtime.sendMessage({ type: "GET_TAB_REPORT", tabId: tab.id });
  if (!resp) return;
  const { report, scoring } = resp;

  const gradeEl = document.getElementById("grade");
  gradeEl.textContent = scoring.grade;
  gradeEl.style.background = GRADE_COLORS[scoring.grade] || "#94a3b8";
  document.getElementById("score").textContent = scoring.score;

  document.getElementById("c-domains").textContent = (report.thirdPartyDomains || []).length;
  document.getElementById("c-cookies").textContent = (report.cookies || []).length;
  document.getElementById("c-storage").textContent = (report.storageEntries || []).length;
  document.getElementById("c-fp").textContent = uniqueFingerprintSurfaces(report);
  document.getElementById("c-sync").textContent = (report.cookieSyncEdges || []).length;
  document.getElementById("c-hijack").textContent = (report.hijackingAlerts || []).length;

  const ul = document.getElementById("breakdown");
  ul.innerHTML = "";
  for (const item of scoring.breakdown) {
    const li = document.createElement("li");
    const label = document.createElement("span");
    label.className = "label";
    label.textContent = `${item.label} (${item.count})`;
    const penalty = document.createElement("span");
    penalty.className = item.penalty === 0 ? "penalty zero" : "penalty";
    penalty.textContent = item.penalty === 0 ? "0" : `-${item.penalty}`;
    li.appendChild(label);
    li.appendChild(penalty);
    ul.appendChild(li);
  }
}

document.getElementById("open-dashboard").addEventListener("click", async () => {
  const tab = await getActiveTab();
  const url = browser.runtime.getURL("dashboard/dashboard.html") + (tab ? `?tabId=${tab.id}` : "");
  await browser.tabs.create({ url });
  window.close();
});

document.getElementById("reset-tab").addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (!tab) return;
  await browser.runtime.sendMessage({ type: "RESET_TAB", tabId: tab.id });
  refresh();
});

refresh();
setInterval(refresh, 2000);
