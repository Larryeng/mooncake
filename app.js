const seedItems = [
  { id: 1, name: "經典台式香腸", category: "food", quantity: "2 包", note: "炭火烤最香", claimedBy: null },
  { id: 2, name: "玉米與杏鮑菇", category: "food", quantity: "各 10 份", note: "蔬菜也要吃得飽", claimedBy: null },
  { id: 3, name: "冰涼無糖茶", category: "drink", quantity: "2 大瓶", note: "綠茶或烏龍茶都可以", claimedBy: null },
  { id: 4, name: "折疊桌椅", category: "gear", quantity: "1 組", note: "方便放食材的桌子", claimedBy: null },
  { id: 5, name: "木炭與點火用品", category: "gear", quantity: "1 份", note: "別忘了帶長柄打火機", claimedBy: null }
];
const categoryMeta = {
  food: { label: "食材", emoji: "🍢" }, drink: { label: "飲品", emoji: "🥤" },
  gear: { label: "器材", emoji: "🧺" }, other: { label: "其他", emoji: "✨" }
};
let authMode = "login";
let activeFilter = "all";
let currentUser = JSON.parse(localStorage.getItem("moon-current-user") || "null");
let users = JSON.parse(localStorage.getItem("moon-users") || "[]");
let items = JSON.parse(localStorage.getItem("moon-items") || "null") || seedItems;
let activityLog = JSON.parse(localStorage.getItem("moon-activity-log") || "[]");

const $ = (selector) => document.querySelector(selector);
function save() {
  localStorage.setItem("moon-users", JSON.stringify(users));
  localStorage.setItem("moon-items", JSON.stringify(items));
  localStorage.setItem("moon-activity-log", JSON.stringify(activityLog));
  if (currentUser) localStorage.setItem("moon-current-user", JSON.stringify(currentUser));
}
function logAction(action, detail, actor = currentUser) {
  activityLog.unshift({
    id: Date.now(),
    at: new Date().toISOString(),
    actor: actor ? `${actor.name} (${actor.email})` : "訪客",
    action,
    detail
  });
  save();
}
function showAuthMessage(message = "") { $("#auth-message").textContent = message; }
function switchAuth(mode) {
  authMode = mode;
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.auth === mode));
  $("#name-field").classList.toggle("hidden", mode !== "register");
  $("#auth-submit-label").textContent = mode === "login" ? "登入我的清單" : "建立我的帳號";
  $("#auth-password").setAttribute("autocomplete", mode === "login" ? "current-password" : "new-password");
  showAuthMessage();
}
function enterApp() {
  if (location.hash === "#admin") return renderAdmin();
  $("#auth-view").classList.add("hidden");
  $("#admin-view").classList.add("hidden");
  $("#app-view").classList.remove("hidden");
  $("#user-area").innerHTML = `<span>你好，<b>${currentUser.name}</b></span><button class="logout-button" id="logout-button">登出</button>`;
  $("#greeting").textContent = `嗨，${currentUser.name}`;
  $("#logout-button").addEventListener("click", () => { logAction("登出", "登出了網站"); currentUser = null; localStorage.removeItem("moon-current-user"); location.reload(); });
  renderItems();
}
function renderItems() {
  const filtered = items.filter((item) => activeFilter === "all" || item.category === activeFilter);
  $("#items-list").innerHTML = filtered.length ? filtered.map((item) => {
    const meta = categoryMeta[item.category] || categoryMeta.other;
    const isMine = item.claimedBy === currentUser.email;
    return `<article class="item-row"><div class="item-emoji">${meta.emoji}</div><div class="item-info"><h3>${escapeHtml(item.name)}</h3><div class="item-meta"><b>${meta.label}</b>${escapeHtml(item.quantity)}${item.note ? ` · ${escapeHtml(item.note)}` : ""}</div></div>${item.claimedBy ? (isMine ? `<button class="cancel-button" data-cancel="${item.id}"><span aria-hidden="true">↶</span> 取消認領</button>` : `<span class="claimed-label">已有人認領</span>`) : `<button class="claim-button" data-claim="${item.id}">我來帶這個</button>`}</article>`;
  }).join("") : `<div class="empty-state">這個分類還沒有物品，來新增第一樣吧！</div>`;
  document.querySelectorAll("[data-claim]").forEach((button) => button.addEventListener("click", () => claimItem(Number(button.dataset.claim))));
  document.querySelectorAll("[data-cancel]").forEach((button) => button.addEventListener("click", () => cancelClaim(Number(button.dataset.cancel))));
  const claimed = items.filter((item) => item.claimedBy).length;
  $("#claimed-count").textContent = claimed; $("#total-count").textContent = items.length;
  $("#unclaimed-count").textContent = items.length - claimed;
  $("#my-count").textContent = items.filter((item) => item.claimedBy === currentUser.email).length;
  $("#progress-percent").textContent = `${items.length ? Math.round(claimed / items.length * 100) : 0}%`;
  $("#progress-bar").style.width = `${items.length ? claimed / items.length * 100 : 0}%`;
  $("#all-filter-count").textContent = items.length;
}
function claimItem(id) {
  const item = items.find((entry) => entry.id === id);
  if (!item || item.claimedBy) return;
  item.claimedBy = currentUser.email;
  logAction("認領物品", `認領「${item.name}」`);
  renderItems();
}
function cancelClaim(id) {
  const item = items.find((entry) => entry.id === id);
  if (!item || item.claimedBy !== currentUser.email) return;
  item.claimedBy = null;
  logAction("取消認領", `取消認領「${item.name}」`);
  renderItems();
}
function escapeHtml(text) { return text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char])); }
function deleteItem(id) {
  const item = items.find((entry) => entry.id === id);
  if (!item || !window.confirm(`確定要刪除「${item.name}」嗎？`)) return;
  items = items.filter((entry) => entry.id !== id);
  logAction("刪除物品", `刪除「${item.name}」`);
  renderAdmin();
}
document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => switchAuth(tab.dataset.auth)));
$("#auth-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const email = $("#auth-email").value.trim().toLowerCase();
  const password = $("#auth-password").value;
  const name = $("#auth-name").value.trim();
  if (authMode === "register") {
    if (!name) return showAuthMessage("請填寫你的稱呼。");
    if (users.some((user) => user.email === email)) return showAuthMessage("這個信箱已經註冊過了，請直接登入。");
    currentUser = { name, email, password }; users.push(currentUser); logAction("建立帳號", "建立了新帳號"); enterApp();
  } else {
    const user = users.find((entry) => entry.email === email && entry.password === password);
    if (!user) return showAuthMessage("信箱或密碼不正確，請再試一次。");
    currentUser = user; logAction("登入", "登入了網站"); enterApp();
  }
});
function openModal() { $("#item-modal").classList.remove("hidden"); $("#item-name").focus(); }
function closeModal() { $("#item-modal").classList.add("hidden"); $("#item-form").reset(); }
$("#add-top-button").addEventListener("click", openModal);
$("#close-modal").addEventListener("click", closeModal);
$("#item-modal").addEventListener("click", (event) => { if (event.target === $("#item-modal")) closeModal(); });
$("#item-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const item = { id: Date.now(), name: $("#item-name").value.trim(), category: $("#item-category").value, quantity: $("#item-quantity").value.trim(), note: $("#item-note").value.trim(), claimedBy: null };
  items.unshift(item);
  logAction("新增物品", `新增「${item.name}」`);
  closeModal(); renderItems();
});
document.querySelectorAll(".filter-button").forEach((button) => button.addEventListener("click", () => {
  activeFilter = button.dataset.filter;
  document.querySelectorAll(".filter-button").forEach((entry) => entry.classList.toggle("active", entry === button));
  renderItems();
}));

function renderAdmin() {
  $("#auth-view").classList.add("hidden");
  $("#app-view").classList.add("hidden");
  $("#admin-view").classList.remove("hidden");
  $("#user-area").innerHTML = currentUser
    ? `<span>你好，<b>${escapeHtml(currentUser.name)}</b></span><a class="logout-button" href="#">回到清單</a>`
    : `<a class="logout-button" href="#">回到首頁</a>`;
  $("#log-count").textContent = activityLog.length;
  $("#user-count").textContent = users.length;
  $("#admin-item-count").textContent = items.length;
  $("#log-status").textContent = activityLog.length ? "最新紀錄在最上方" : "目前還沒有紀錄";
  $("#activity-log").innerHTML = activityLog.length ? activityLog.map((entry) => `
    <article class="log-entry">
      <div class="log-dot"></div>
      <div><strong>${escapeHtml(entry.action)}</strong><p>${escapeHtml(entry.actor)} · ${escapeHtml(entry.detail)}</p></div>
      <time>${new Date(entry.at).toLocaleString("zh-TW", { dateStyle: "short", timeStyle: "short" })}</time>
    </article>`).join("") : `<div class="empty-state">還沒有任何操作紀錄。</div>`;
  $("#admin-items-list").innerHTML = items.length ? items.map((item) => {
    const meta = categoryMeta[item.category] || categoryMeta.other;
    const claimedText = item.claimedBy ? "已認領" : "尚未認領";
    return `<article class="admin-item-row"><div class="item-emoji">${meta.emoji}</div><div><strong>${escapeHtml(item.name)}</strong><p>${meta.label} · ${escapeHtml(item.quantity)} · ${claimedText}</p></div><button class="delete-item-button" data-delete-item="${item.id}">刪除</button></article>`;
  }).join("") : `<div class="empty-state">目前沒有可管理的攜帶物品。</div>`;
  document.querySelectorAll("[data-delete-item]").forEach((button) => button.addEventListener("click", () => deleteItem(Number(button.dataset.deleteItem))));
}
$("#clear-log-button").addEventListener("click", () => {
  if (!activityLog.length || !window.confirm("確定要清除目前瀏覽器的所有 Log 嗎？")) return;
  activityLog = [];
  save();
  renderAdmin();
});
function renderRoute() {
  if (location.hash === "#admin") return renderAdmin();
  if (currentUser) return enterApp();
  $("#admin-view").classList.add("hidden");
  $("#app-view").classList.add("hidden");
  $("#auth-view").classList.remove("hidden");
  $("#user-area").innerHTML = "";
}
window.addEventListener("hashchange", renderRoute);
renderRoute();
