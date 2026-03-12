import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCCphNQvyBLj7DObyxoKjATyviB2I_Yh-k",
  authDomain: "kakeibo01-3d1d2.firebaseapp.com",
  projectId: "kakeibo01-3d1d2",
  storageBucket: "kakeibo01-3d1d2.firebasestorage.app",
  messagingSenderId: "452828457413",
  appId: "1:452828457413:web:9958ade8f3d5ae44c683ac"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];

let year, month, expenses = {};
let editing = null;

function getKey(d) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function evalAmount(val) {
  if (!val) return 0;
  try { return Math.max(0, Function('"use strict"; return (' + val + ')')()) || 0; } catch { return 0; }
}

function formatYen(n) { return "¥" + n.toLocaleString("ja-JP"); }

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return d.toISOString().split("T")[0];
}

async function loadData() {
  const docRef = doc(db, "expenses", `${year}-${String(month + 1).padStart(2, "0")}`);
  const snap = await getDoc(docRef);
  expenses = snap.exists() ? snap.data() : {};
}

async function saveData() {
  const docRef = doc(db, "expenses", `${year}-${String(month + 1).padStart(2, "0")}`);
  await setDoc(docRef, expenses);
}

function render() {
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDate = today.getDate();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;

  const weeks = [];
  let week = [];
  for (let i = 0; i < offset; i++) week.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  const monthTotal = Object.entries(expenses).reduce((s, [, v]) => s + evalAmount(v), 0);

  let html = `
    <div class="header">
      <button id="prev">‹</button>
      <div class="header-center">
        <div class="header-sub">Household Ledger</div>
        <div class="header-title">${year}年${month + 1}月</div>
      </div>
      <button id="next">›</button>
    </div>
    <div class="weekday-row">
      ${WEEKDAYS.map((w, i) => `<div class="${i===5?'sat':i===6?'sun':''}">${w}</div>`).join("")}
      <div class="wtotal">週計</div>
    </div>
  `;

  weeks.forEach(w => {
    const wTotal = w.reduce((s, d) => s + (d ? evalAmount(expenses[getKey(d)]) : 0), 0);
    html += `<div class="week-row">`;
    w.forEach((d, di) => {
      if (!d) { html += `<div class="day-cell empty"></div>`; return; }
      const amt = evalAmount(expenses[getKey(d)]);
      const isToday = isCurrentMonth && d === todayDate;
      const dayClass = `day-cell${isToday ? " today" : ""}`;
      const numClass = `day-num${isToday ? " today" : di===5 ? " sat" : di===6 ? " sun" : ""}`;
      html += `
        <div class="${dayClass}" data-day="${d}">
          <div class="${numClass}">${d}</div>
          ${amt > 0 ? `<div class="day-amount">${formatYen(amt)}</div>` : ""}
        </div>
      `;
    });
    html += `<div class="week-total${wTotal > 0 ? " has-amount" : ""}">${wTotal > 0 ? formatYen(wTotal) : "—"}</div>`;
    html += `</div>`;
  });

  html += `
    <div class="month-total">
      <div class="month-total-label">月次合計</div>
      <div class="month-total-amount${monthTotal > 0 ? " has-amount" : ""}">${monthTotal > 0 ? formatYen(monthTotal) : "—"}</div>
    </div>
  `;

  document.getElementById("app").innerHTML = html;

  document.getElementById("prev").onclick = async () => {
    if (month === 0) { year--; month = 11; } else month--;
    await loadData(); render();
  };
  document.getElementById("next").onclick = async () => {
    if (month === 11) { year++; month = 0; } else month++;
    await loadData(); render();
  };

  document.querySelectorAll(".day-cell[data-day]").forEach(el => {
    el.onclick = () => openModal(parseInt(el.dataset.day));
  });
}

function openModal(d) {
  editing = getKey(d);
  const dateLabel = `${year}年${month + 1}月${d}日`;
  const val = expenses[editing] || "";

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-date">${dateLabel}</div>
      <input type="text" inputmode="numeric" placeholder="金額（例: 500+300）" value="${val}" id="modal-input" />
      <div class="modal-buttons">
        <button class="btn-cancel" id="modal-cancel">キャンセル</button>
        <button class="btn-save" id="modal-save">記録する</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const input = document.getElementById("modal-input");
  input.focus();
  input.addEventListener("keydown", e => { if (e.key === "Enter") saveModal(); });
  document.getElementById("modal-cancel").onclick = () => overlay.remove();
  document.getElementById("modal-save").onclick = saveModal;
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };

  async function saveModal() {
    const v = input.value.trim();
    if (v === "") delete expenses[editing]; else expenses[editing] = v;
    overlay.remove();
    await saveData();
    render();
  }
}

async function init() {
  const now = new Date();
  year = now.getFullYear();
  month = now.getMonth();
  await loadData();
  render();
}

init();