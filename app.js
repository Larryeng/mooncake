const SUPABASE_URL = "https://yleovqjmdgoafgfiohxk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsZW92cWptZGdvYWZnZmlvaHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxODA3NjEsImV4cCI6MjEwNTc1Njc2MX0.6HH0jJ9ejh6bfBoyMD0OHlXMBhRZ2YoxpcoOHG6x2H8";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const categoryMeta = {
  food: { label: "食材", emoji: "🍢" }, drink: { label: "飲品", emoji: "🥤" },
  gear: { label: "器材", emoji: "🧺" }, other: { label: "其他", emoji: "✨" }
};
let authMode = "login";
let activeFilter = "all";
let currentSession = null;
let profile = null;
let items = [];
let activityLog = [];
let userCount = 0;
let realtimeChannel = null;
const $ = (selector) => document.querySelector(selector);

function showAuthMessage(message = "") { $("#auth-message").textContent = message; }
function showAdminMessage(message = "") {
  const element = $("#admin-message");
  if (element) element.textContent = message;
}
function showError(error) {
  const message = error?.message || "";
  if (message.toLowerCase().includes("rate limit")) {
    showAuthMessage("Email 寄送次數已達上限，請先到 Supabase 關閉 Email Confirm，或稍後再試。");
    showAdminMessage("Email 寄送次數已達上限，請稍後再試。");
    return;
  }
  showAuthMessage(message || "目前無法完成操作，請稍後再試。");
  showAdminMessage(message || "目前無法完成操作，請稍後再試。");
}
function escapeHtml(text = "") { return String(text).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char])); }
function switchAuth(mode) {
  authMode = mode;
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.auth === mode));
  $("#name-field").classList.toggle("hidden", mode !== "register");
  $("#auth-submit-label").textContent = mode === "login" ? "登入我的清單" : "建立我的帳號";
  $("#auth-password").setAttribute("autocomplete", mode === "login" ? "current-password" : "new-password");
  showAuthMessage();
}
async function logAction(action, detail) {
  if (!currentSession) return;
  const { error } = await supabaseClient.from("activity_logs").insert({ actor_id: currentSession.user.id, action, detail });
  if (error) throw error;
}
async function loadData() {
  const [{ data: itemData, error: itemError }, { data: logData, error: logError }, { count, error: userError }] = await Promise.all([
    supabaseClient.from("items").select("*").order("created_at", { ascending: false }),
    profile?.is_admin ? supabaseClient.from("activity_logs").select("id, action, detail, created_at, profiles(display_name, email)").order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    profile?.is_admin ? supabaseClient.from("profiles").select("id", { count: "exact", head: true }) : Promise.resolve({ count: 0, error: null })
  ]);
  if (itemError) throw itemError;
  if (logError) throw logError;
  if (userError) throw userError;
  items = itemData || [];
  activityLog = logData || [];
  userCount = count || 0;
}
function renderItems() {
  const filtered = items.filter((item) => activeFilter === "all" || item.category === activeFilter);
  $("#items-list").innerHTML = filtered.length ? filtered.map((item) => {
    const meta = categoryMeta[item.category] || categoryMeta.other;
    const isMine = item.claimed_by === currentSession.user.id;
    return `<article class="item-row"><div class="item-emoji">${meta.emoji}</div><div class="item-info"><h3>${escapeHtml(item.name)}</h3><div class="item-meta"><b>${meta.label}</b>${escapeHtml(item.quantity)}${item.note ? ` · ${escapeHtml(item.note)}` : ""}</div></div>${item.claimed_by ? (isMine ? `<button class="cancel-button" data-cancel="${item.id}"><span aria-hidden="true">↶</span> 取消認領</button>` : `<span class="claimed-label">已有人認領</span>`) : `<button class="claim-button" data-claim="${item.id}">我來帶這個</button>`}</article>`;
  }).join("") : `<div class="empty-state">這個分類還沒有物品，來新增第一樣吧！</div>`;
  document.querySelectorAll("[data-claim]").forEach((button) => button.addEventListener("click", () => claimItem(button.dataset.claim)));
  document.querySelectorAll("[data-cancel]").forEach((button) => button.addEventListener("click", () => cancelClaim(button.dataset.cancel)));
  const claimed = items.filter((item) => item.claimed_by).length;
  $("#claimed-count").textContent = claimed; $("#total-count").textContent = items.length;
  $("#unclaimed-count").textContent = items.length - claimed;
  $("#my-count").textContent = items.filter((item) => item.claimed_by === currentSession.user.id).length;
  $("#progress-percent").textContent = `${items.length ? Math.round(claimed / items.length * 100) : 0}%`;
  $("#progress-bar").style.width = `${items.length ? claimed / items.length * 100 : 0}%`;
  $("#all-filter-count").textContent = items.length;
}
async function claimItem(id) {
  const { error } = await supabaseClient.rpc("claim_item", { item_id: id });
  if (error) return showError(error);
  await logAction("認領物品", `認領「${items.find((item) => item.id === id)?.name || "物品"}」`);
  await refresh();
}
async function cancelClaim(id) {
  const { error } = await supabaseClient.rpc("unclaim_item", { item_id: id });
  if (error) return showError(error);
  await logAction("取消認領", `取消認領「${items.find((item) => item.id === id)?.name || "物品"}」`);
  await refresh();
}
async function deleteItem(id) {
  const item = items.find((entry) => entry.id === id);
  if (!item || !window.confirm(`確定要刪除「${item.name}」嗎？`)) return;
  showAdminMessage("正在刪除，請稍候…");
  const { error } = await supabaseClient.from("items").delete().eq("id", id);
  if (error) return showError(error);
  try {
    await logAction("刪除物品", `刪除「${item.name}」`);
    await refresh();
    showAdminMessage(`已刪除「${item.name}」。`);
  } catch (error) {
    showError(error);
  }
}
async function updateQuantity(id, input) {
  const quantity = input.value.trim();
  if (!quantity) {
    input.focus();
    return;
  }
  const { error } = await supabaseClient.rpc("admin_update_quantity", { item_id: id, new_quantity: quantity });
  if (error) return showError(error);
  await logAction("修改數量", `將「${items.find((item) => item.id === id)?.name || "物品"}」數量改為「${quantity}」`);
  await refresh();
}
async function refresh() {
  await loadData();
  renderItems();
  if (location.hash === "#admin") renderAdmin();
}
function enterApp() {
  $("#auth-view").classList.add("hidden"); $("#admin-view").classList.add("hidden"); $("#app-view").classList.remove("hidden");
  $("#user-area").innerHTML = `<span>你好，<b>${escapeHtml(profile.display_name)}</b></span><button class="logout-button" id="logout-button">登出</button>`;
  $("#greeting").textContent = `嗨，${escapeHtml(profile.display_name)}`;
  $("#logout-button").addEventListener("click", async () => { await logAction("登出", "登出了網站"); await supabaseClient.auth.signOut(); });
  renderItems();
}
function renderAdmin() {
  if (!profile?.is_admin) {
    $("#admin-view").classList.add("hidden"); $("#app-view").classList.add("hidden"); $("#auth-view").classList.remove("hidden");
    showAuthMessage("此帳號沒有後台權限。請使用管理員帳號登入。"); return;
  }
  $("#auth-view").classList.add("hidden"); $("#app-view").classList.add("hidden"); $("#admin-view").classList.remove("hidden");
  showAdminMessage("");
  $("#user-area").innerHTML = `<span>管理員：<b>${escapeHtml(profile.display_name)}</b></span><a class="logout-button" href="#">回到清單</a>`;
  $("#log-count").textContent = activityLog.length; $("#user-count").textContent = userCount;
  $("#admin-item-count").textContent = items.length;
  $("#log-status").textContent = activityLog.length ? "最新紀錄在最上方" : "目前還沒有紀錄";
  $("#activity-log").innerHTML = activityLog.length ? activityLog.map((entry) => `<article class="log-entry"><div class="log-dot"></div><div><strong>${escapeHtml(entry.action)}</strong><p>${escapeHtml(entry.profiles?.display_name || "未知使用者")} (${escapeHtml(entry.profiles?.email || "")}) · ${escapeHtml(entry.detail)}</p></div><time>${new Date(entry.created_at).toLocaleString("zh-TW", { dateStyle: "short", timeStyle: "short" })}</time></article>`).join("") : `<div class="empty-state">還沒有任何操作紀錄。</div>`;
  $("#admin-items-list").innerHTML = items.length ? items.map((item) => { const meta = categoryMeta[item.category] || categoryMeta.other; return `<article class="admin-item-row"><div class="item-emoji">${meta.emoji}</div><div><strong>${escapeHtml(item.name)}</strong><p>${meta.label} · ${item.claimed_by ? "已認領" : "尚未認領"}</p><div class="quantity-editor"><label for="quantity-${item.id}">數量</label><input id="quantity-${item.id}" data-quantity-input="${item.id}" value="${escapeHtml(item.quantity)}"><button class="save-quantity-button" data-save-quantity="${item.id}">儲存</button></div></div><button class="delete-item-button" data-delete-item="${item.id}">刪除</button></article>`; }).join("") : `<div class="empty-state">目前沒有可管理的攜帶物品。</div>`;
  document.querySelectorAll("[data-delete-item]").forEach((button) => button.addEventListener("click", () => deleteItem(button.dataset.deleteItem)));
  document.querySelectorAll("[data-save-quantity]").forEach((button) => button.addEventListener("click", () => updateQuantity(button.dataset.saveQuantity, document.querySelector(`[data-quantity-input="${button.dataset.saveQuantity}"]`))));
}
async function handleAuth(event) {
  event.preventDefault();
  const email = $("#auth-email").value.trim().toLowerCase(), password = $("#auth-password").value, name = $("#auth-name").value.trim();
  try {
    if (authMode === "register") {
      if (!name) return showAuthMessage("請填寫你的稱呼。");
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { display_name: name }, emailRedirectTo: redirectTo }
      });
      if (error) throw error;
      if (!data.session) return showAuthMessage("註冊成功，請先到信箱完成驗證，再登入。");
    } else {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
    showAuthMessage("");
  } catch (error) { showError(error); }
}
async function openSession(session) {
  currentSession = session;
  if (!session) { profile = null; $("#user-area").innerHTML = ""; $("#app-view").classList.add("hidden"); $("#admin-view").classList.add("hidden"); $("#auth-view").classList.remove("hidden"); return; }
  const { data, error } = await supabaseClient.from("profiles").select("*").eq("id", session.user.id).single();
  if (error) return showError(error);
  profile = data;
  try { await loadData(); } catch (error) { return showError(error); }
  if (location.hash === "#admin") renderAdmin(); else { enterApp(); renderItems(); }
  subscribeToChanges();
}
function subscribeToChanges() {
  if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
  realtimeChannel = supabaseClient.channel("moon-shared-data")
    .on("postgres_changes", { event: "*", schema: "public", table: "items" }, () => refresh())
    .on("postgres_changes", { event: "*", schema: "public", table: "activity_logs" }, () => profile?.is_admin && refresh())
    .subscribe();
}
document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => switchAuth(tab.dataset.auth)));
$("#auth-form").addEventListener("submit", handleAuth);
$("#add-top-button").addEventListener("click", () => { $("#item-modal").classList.remove("hidden"); $("#item-name").focus(); });
$("#close-modal").addEventListener("click", () => { $("#item-modal").classList.add("hidden"); $("#item-form").reset(); });
$("#item-modal").addEventListener("click", (event) => { if (event.target === $("#item-modal")) $("#item-modal").classList.add("hidden"); });
$("#item-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const item = { name: $("#item-name").value.trim(), category: $("#item-category").value, quantity: $("#item-quantity").value.trim(), note: $("#item-note").value.trim(), created_by: currentSession.user.id };
  const { error } = await supabaseClient.from("items").insert(item);
  if (error) return showError(error);
  await logAction("新增物品", `新增「${item.name}」`);
  $("#item-modal").classList.add("hidden"); $("#item-form").reset(); await refresh();
});
$("#export-pdf-button").addEventListener("click", () => window.print());
document.querySelectorAll(".filter-button").forEach((button) => button.addEventListener("click", () => { activeFilter = button.dataset.filter; document.querySelectorAll(".filter-button").forEach((entry) => entry.classList.toggle("active", entry === button)); renderItems(); }));
window.addEventListener("hashchange", () => currentSession && (location.hash === "#admin" ? renderAdmin() : enterApp()));
supabaseClient.auth.onAuthStateChange((_event, session) => { if (_event === "INITIAL_SESSION" || _event === "SIGNED_IN" || _event === "SIGNED_OUT") openSession(session); });

const authError = new URLSearchParams(window.location.hash.slice(1));
if (authError.get("error") === "access_denied") {
  const description = authError.get("error_code") === "otp_expired"
    ? "驗證連結已過期或已使用，請重新註冊或從 Supabase 重新寄送驗證信。"
    : authError.get("error_description") || "Email 驗證失敗，請重新操作。";
  history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  showAuthMessage(description);
}
