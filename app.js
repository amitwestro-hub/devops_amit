const STORAGE_KEY = "penny-finance-v1";
const palette = ["#69a27c", "#e6bd68", "#8f84c8", "#e9927e", "#80b1cc", "#ca90a6", "#9aa765"];
const defaults = {
  accounts: [
    { id: "bank", name: "Main account", type: "Bank", opening: 48250 },
    { id: "cash", name: "Cash wallet", type: "Cash", opening: 3200 },
    { id: "savings", name: "Savings", type: "Bank", opening: 65000 }
  ],
  budgets: { Overall: 60000, Food: 12000, Rent: 18000, Transport: 5000, Bills: 6000, Shopping: 7000, Health: 4000, Entertainment: 3000, Other: 4000 },
  transactions: []
};
const expenses = [
  ["Groceries at Nature's Basket", "Food", "Main account", 1240, "Weekly groceries"],
  ["Monthly rent", "Rent", "Main account", 18000, "November rent"],
  ["Metro card top-up", "Transport", "Cash wallet", 800, "Commute"],
  ["Electricity bill", "Bills", "Main account", 2350, ""],
  ["Coffee & brunch", "Food", "Cash wallet", 680, "Sunday brunch"],
  ["New running shoes", "Shopping", "Main account", 3499, ""],
  ["Pharmacy", "Health", "Cash wallet", 540, "Vitamins"],
  ["Streaming subscription", "Entertainment", "Main account", 799, "Monthly plan"],
  ["Cab to airport", "Transport", "Cash wallet", 1120, ""],
  ["Lunch with team", "Food", "Cash wallet", 560, ""]
];
let activeType = "expense";
let editingId = null;
let importRows = [];
let toastTimer;
const $ = (selector) => document.querySelector(selector);
const money = (amount) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Math.round(amount || 0));
const todayISO = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
function dateForMonth(day, offset = 0) {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + offset);
  date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.transactions) && Array.isArray(saved.accounts)) return { ...defaults, ...saved, budgets: { ...defaults.budgets, ...saved.budgets } };
  } catch (error) {
    console.warn("Could not read saved finance data.", error);
  }
  const seeded = {
    ...defaults,
    transactions: [
      ...expenses.map((item, index) => ({ id: `demo-${index}`, name: item[0], category: item[1], account: item[2], amount: item[3], note: item[4], type: "expense", date: dateForMonth([2, 3, 5, 6, 8, 9, 10, 11, 12, 14][index]) })),
      { id: "demo-income-1", name: "Monthly salary", category: "Salary", account: "Main account", amount: 92000, note: "November salary", type: "income", date: dateForMonth(1) },
      { id: "demo-income-2", name: "Freelance project", category: "Freelance", account: "Main account", amount: 12500, note: "Website project", type: "income", date: dateForMonth(10) },
      { id: "demo-prev-1", name: "October groceries", category: "Food", account: "Main account", amount: 3400, note: "", type: "expense", date: dateForMonth(27, -1) },
      { id: "demo-prev-2", name: "October salary", category: "Salary", account: "Main account", amount: 92000, note: "", type: "income", date: dateForMonth(1, -1) }
    ]
  };
  return seeded;
}
let state = loadState();
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (error) { showToast("Couldn't save changes in this browser."); console.error("Could not persist finance data.", error); }
}
function selectedMonth() { return $("#month-picker").value || todayISO().slice(0, 7); }
function monthTransactions() { return state.transactions.filter((item) => item.date && item.date.slice(0, 7) === selectedMonth()); }
function getTotals(items) {
  return items.reduce((totals, item) => {
    totals[item.type] = (totals[item.type] || 0) + Number(item.amount || 0);
    return totals;
  }, { income: 0, expense: 0 });
}
function categoriesFor(type) {
  const fixed = type === "income" ? ["Salary", "Freelance", "Investment", "Gift", "Other"] : ["Food", "Rent", "Transport", "Bills", "Shopping", "Health", "Entertainment", "Other"];
  return [...new Set([...fixed, ...state.transactions.filter((item) => item.type === type).map((item) => item.category).filter(Boolean)])];
}
function balanceFor(account) {
  return state.transactions.reduce((balance, item) => {
    if (item.account !== account.name) return balance;
    return balance + (item.type === "income" ? Number(item.amount) : -Number(item.amount));
  }, Number(account.opening || 0));
}
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}
function formatDate(value) {
  if (!value) return "";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function updateDashboard() {
  const items = monthTransactions();
  const totals = getTotals(items);
  const spent = totals.expense;
  const savings = totals.income - spent;
  const rate = totals.income ? Math.round((savings / totals.income) * 100) : 0;
  $("#total-balance").textContent = money(state.accounts.reduce((sum, account) => sum + balanceFor(account), 0));
  $("#total-income").textContent = money(totals.income);
  $("#total-expenses").textContent = money(spent);
  $("#net-savings").textContent = money(savings);
  $("#income-count").textContent = `${items.filter((item) => item.type === "income").length} ${items.filter((item) => item.type === "income").length === 1 ? "entry" : "entries"}`;
  $("#savings-rate").textContent = `${rate}%`;
  $("#donut-total").textContent = money(spent);
  renderBreakdown(items, spent);
  renderBudgets(items, spent);
  renderTransactions();
  renderAccounts();
}
function renderBreakdown(items, total) {
  const byCategory = {};
  items.filter((item) => item.type === "expense").forEach((item) => { byCategory[item.category] = (byCategory[item.category] || 0) + Number(item.amount); });
  const values = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const shown = values.slice(0, 5);
  const remainder = values.slice(5).reduce((sum, item) => sum + item[1], 0);
  if (remainder) shown.push(["Other", remainder]);
  const totalWithSpending = shown.reduce((sum, item) => sum + item[1], 0);
  let start = 0;
  const stops = shown.map((item, index) => {
    const end = totalWithSpending ? start + item[1] / totalWithSpending * 100 : 0;
    const stop = `${palette[index % palette.length]} ${start}% ${end}%`;
    start = end;
    return stop;
  });
  $("#spending-donut").style.background = total ? `conic-gradient(${stops.join(",")})` : "#edf0eb";
  $("#category-legend").innerHTML = shown.length ? shown.map(([name, amount], index) => `<div class="legend-item"><span class="legend-dot" style="background:${palette[index % palette.length]}"></span><span class="legend-name">${escapeHTML(name)}</span><span class="legend-value">${money(amount)}</span></div>`).join("") : `<div class="empty-legend">No spending this month yet</div>`;
}
function renderBudgets(items, spent) {
  const budgetEntries = Object.entries(state.budgets).filter(([category, amount]) => category !== "Overall" && Number(amount) > 0);
  const totalLimit = Number(state.budgets.Overall) || budgetEntries.reduce((sum, [, amount]) => sum + Number(amount), 0);
  const ratio = totalLimit ? spent / totalLimit : 0;
  $("#budget-spent").innerHTML = `${money(spent)} <small>/ ${money(totalLimit)}</small>`;
  const status = $("#budget-status");
  const tone = ratio >= 1 ? "over" : ratio >= .8 ? "warning" : "";
  status.className = `budget-badge ${tone}`;
  status.textContent = ratio >= 1 ? "Over budget" : ratio >= .8 ? "Getting close" : "On track";
  const overall = $("#overall-progress");
  overall.style.width = `${Math.min(ratio * 100, 100)}%`;
  overall.className = tone;
  const spentByCategory = {};
  items.filter((item) => item.type === "expense").forEach((item) => { spentByCategory[item.category] = (spentByCategory[item.category] || 0) + Number(item.amount); });
  const display = budgetEntries.slice(0, 4);
  $("#budget-list").innerHTML = display.length ? display.map(([name, limit], index) => {
    const amount = spentByCategory[name] || 0;
    const percent = amount / Number(limit) * 100;
    const stateClass = percent >= 100 ? "over" : percent >= 80 ? "warning" : "";
    return `<div class="budget-row"><div class="budget-name"><span class="legend-dot" style="background:${palette[index % palette.length]}"></span>${escapeHTML(name)}</div><div class="budget-amount"><strong>${money(amount)}</strong> / ${money(limit)}</div><div class="budget-mini"><span class="${stateClass}" style="width:${Math.min(percent, 100)}%"></span></div></div>`;
  }).join("") : `<div class="empty-legend">No budgets set. Add one to start planning.</div>`;
}
function renderTransactions() {
  const query = $("#search-input").value.trim().toLowerCase();
  const type = $("#type-filter").value;
  const items = monthTransactions().filter((item) => {
    const matchesText = [item.name, item.note, item.category, item.account].join(" ").toLowerCase().includes(query);
    return matchesText && (type === "all" || item.type === type);
  }).sort((a, b) => b.date.localeCompare(a.date));
  const list = $("#transaction-list");
  $("#empty-state").hidden = items.length > 0;
  list.innerHTML = items.slice(0, 6).map((item) => `<tr><td><div class="transaction-cell"><span class="transaction-icon ${item.type}">${item.type === "income" ? "↙" : categoryIcon(item.category)}</span><span><span class="transaction-title">${escapeHTML(item.name || item.category)}</span>${item.note ? `<span class="transaction-note">${escapeHTML(item.note)}</span>` : ""}</span></div></td><td><span class="category-pill">${escapeHTML(item.category)}</span></td><td>${formatDate(item.date)}</td><td>${escapeHTML(item.account)}</td><td class="amount-cell ${item.type}">${item.type === "income" ? "+" : "−"}${money(item.amount)}</td><td><button class="row-menu" data-edit="${escapeHTML(item.id)}" aria-label="Edit ${escapeHTML(item.name)}">···</button></td></tr>`).join("");
  $("#transaction-count").textContent = `Showing ${Math.min(items.length, 6)} of ${items.length} ${items.length === 1 ? "transaction" : "transactions"}`;
}
function renderAccounts() {
  const icons = { Bank: "▤", Cash: "◉", "Credit card": "▣", Wallet: "◈" };
  $("#account-count").textContent = `${state.accounts.length} ${state.accounts.length === 1 ? "account" : "accounts"}`;
  $("#account-list").innerHTML = state.accounts.map((account) => `<div class="account-card"><span class="account-icon">${icons[account.type] || "◈"}</span><div class="account-copy"><strong>${escapeHTML(account.name)}</strong><small>${escapeHTML(account.type)}</small></div><span class="account-balance">${money(balanceFor(account))}</span></div>`).join("");
}
function categoryIcon(category) {
  return ({ Food: "◒", Rent: "⌂", Transport: "↗", Bills: "▤", Shopping: "◇", Health: "✚", Entertainment: "♫" })[category] || "◈";
}
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
function populateSelects() {
  const categorySelect = $("#category-field");
  const accountSelect = $("#account-field");
  categorySelect.innerHTML = categoriesFor(activeType).map((category) => `<option>${escapeHTML(category)}</option>`).join("");
  accountSelect.innerHTML = state.accounts.map((account) => `<option>${escapeHTML(account.name)}</option>`).join("");
}
function openTransaction(item = null) {
  editingId = item?.id || null;
  activeType = item?.type || "expense";
  $(".type-choice.selected")?.classList.remove("selected");
  $(`.type-choice[data-type="${activeType}"]`).classList.add("selected");
  $("#form-title").textContent = editingId ? "Edit transaction" : "Add transaction";
  $("#delete-transaction").hidden = !editingId;
  $("#amount-field").value = item?.amount ?? "";
  $("#date-field").value = item?.date || todayISO();
  $("#note-field").value = item?.note || "";
  populateSelects();
  if (item) {
    $("#category-field").value = item.category;
    $("#account-field").value = item.account;
  }
  $("#transaction-dialog").showModal();
  setTimeout(() => $("#amount-field").focus(), 50);
}
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted && char === '"' && text[i + 1] === '"') { field += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(field.trim()); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field.trim()); field = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else field += char;
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
function csvToTransactions(rows) {
  if (rows.length < 2) throw new Error("The CSV needs a header row and at least one transaction.");
  const headers = rows[0].map((header) => header.toLowerCase().replace(/[^a-z]/g, ""));
  const find = (names) => headers.findIndex((header) => names.includes(header));
  const columns = {
    date: find(["date", "transactiondate", "posteddate"]),
    amount: find(["amount", "value", "total"]),
    type: find(["type", "transactiontype", "kind"]),
    category: find(["category", "label"]),
    account: find(["account", "accountname"]),
    note: find(["note", "description", "memo", "details", "name"])
  };
  if (columns.date < 0 || columns.amount < 0) throw new Error("Could not find date and amount columns. Name your headers “date” and “amount”.");
  return rows.slice(1).map((row, index) => {
    const amount = Number((row[columns.amount] || "").replace(/[₹,$\s]/g, ""));
    const dateRaw = row[columns.date] || "";
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : new Date(dateRaw);
    const date = parsedDate instanceof Date ? (Number.isNaN(parsedDate.getTime()) ? "" : parsedDate.toISOString().slice(0, 10)) : parsedDate;
    if (!Number.isFinite(amount) || amount <= 0 || !date) throw new Error(`Row ${index + 2} has an invalid date or amount.`);
    const typeRaw = columns.type < 0 ? "" : (row[columns.type] || "").toLowerCase();
    const type = typeRaw.includes("income") || typeRaw.includes("credit") ? "income" : "expense";
    const category = columns.category < 0 || !row[columns.category] ? (type === "income" ? "Other" : "Other") : row[columns.category];
    const account = columns.account < 0 || !row[columns.account] ? state.accounts[0]?.name : row[columns.account];
    const note = columns.note < 0 ? "" : row[columns.note];
    return { id: `tx-${Date.now()}-${index}`, name: note || category, category, account, amount, note, type, date };
  });
}
function downloadCSV() {
  const rows = [["date", "amount", "type", "category", "account", "note"], ...state.transactions.map((item) => [item.date, item.amount, item.type, item.category, item.account, item.note || ""])];
  const content = rows.map((row) => row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "penny-transactions.csv";
  link.click();
  URL.revokeObjectURL(url);
  showToast("Your transactions are ready to download.");
}
function renderBudgetEditor() {
  $("#budget-edit-list").innerHTML = Object.entries(state.budgets).map(([category, amount]) => `<div class="budget-edit-row"><label for="budget-${escapeHTML(category)}">${escapeHTML(category)}</label><input id="budget-${escapeHTML(category)}" data-budget="${escapeHTML(category)}" type="number" min="0" step="100" value="${Number(amount) || ""}" placeholder="No limit"></div>`).join("");
}
$("#month-picker").value = todayISO().slice(0, 7);
$("#today-label").textContent = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }).toUpperCase();
updateDashboard();

$("#add-transaction").addEventListener("click", () => openTransaction());
$(".main-nav").addEventListener("click", (event) => {
  const link = event.target.closest(".nav-link");
  if (!link) return;
  $(".nav-link.active")?.classList.remove("active");
  link.classList.add("active");
});
$("#view-transactions").addEventListener("click", () => $("#transactions").scrollIntoView({ behavior: "smooth" }));
$("#all-transactions").addEventListener("click", () => { $("#search-input").value = ""; $("#type-filter").value = "all"; renderTransactions(); });
$("#search-input").addEventListener("input", renderTransactions);
$("#type-filter").addEventListener("change", renderTransactions);
$("#month-picker").addEventListener("change", updateDashboard);
$(".type-toggle").addEventListener("click", (event) => {
  const button = event.target.closest(".type-choice");
  if (!button) return;
  activeType = button.dataset.type;
  $(".type-choice.selected")?.classList.remove("selected");
  button.classList.add("selected");
  populateSelects();
});
$("#transaction-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = Number($("#amount-field").value);
  if (!Number.isFinite(amount) || amount <= 0) { showToast("Enter an amount greater than zero."); return; }
  const category = $("#category-field").value;
  const transaction = {
    id: editingId || `tx-${Date.now()}`,
    name: $("#note-field").value.trim() || category,
    category,
    account: $("#account-field").value,
    amount,
    note: $("#note-field").value.trim(),
    type: activeType,
    date: $("#date-field").value
  };
  if (editingId) state.transactions = state.transactions.map((item) => item.id === editingId ? transaction : item);
  else state.transactions.unshift(transaction);
  persist();
  $("#transaction-dialog").close();
  updateDashboard();
  showToast(editingId ? "Transaction updated." : "Transaction added.");
});
$("#transaction-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit]");
  if (!button) return;
  const item = state.transactions.find((transaction) => transaction.id === button.dataset.edit);
  if (!item) return;
  openTransaction(item);
});
$("#delete-transaction").addEventListener("click", () => {
  if (!editingId || !confirm("Delete this transaction? This can't be undone.")) return;
  state.transactions = state.transactions.filter((transaction) => transaction.id !== editingId);
  persist();
  $("#transaction-dialog").close();
  updateDashboard();
  showToast("Transaction deleted.");
});
$("#edit-budgets").addEventListener("click", () => { renderBudgetEditor(); $("#budgets-dialog").showModal(); });
$("#budgets-form").addEventListener("submit", (event) => {
  event.preventDefault();
  document.querySelectorAll("[data-budget]").forEach((input) => { state.budgets[input.dataset.budget] = Number(input.value) || 0; });
  persist();
  $("#budgets-dialog").close();
  updateDashboard();
  showToast("Monthly budgets updated.");
});
$("#export-button").addEventListener("click", downloadCSV);
$("#import-button").addEventListener("click", () => { importRows = []; $("#csv-file").value = ""; $("#import-preview").hidden = true; $("#confirm-import").disabled = true; $("#import-dialog").showModal(); });
$("#csv-file").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    importRows = csvToTransactions(parseCSV(await file.text()));
    const preview = importRows.slice(0, 4).map((item) => `<tr><td>${formatDate(item.date)}</td><td>${escapeHTML(item.category)}</td><td>${money(item.amount)}</td></tr>`).join("");
    $("#import-preview").innerHTML = `<strong>${importRows.length} transactions ready to import</strong><table><thead><tr><th>DATE</th><th>CATEGORY</th><th>AMOUNT</th></tr></thead><tbody>${preview}</tbody></table>`;
    $("#import-preview").hidden = false;
    $("#confirm-import").disabled = false;
  } catch (error) {
    importRows = [];
    $("#import-preview").textContent = error.message;
    $("#import-preview").hidden = false;
    $("#confirm-import").disabled = true;
  }
});
$("#import-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!importRows.length) return;
  const known = new Set(state.transactions.map((item) => `${item.date}|${item.amount}|${item.note}`));
  let skipped = 0;
  const newRows = importRows.filter((item) => {
    const key = `${item.date}|${item.amount}|${item.note}`;
    if (known.has(key)) { skipped++; return false; }
    known.add(key);
    return true;
  });
  state.transactions.push(...newRows);
  persist();
  $("#import-dialog").close();
  updateDashboard();
  showToast(`Imported ${newRows.length} transactions${skipped ? ` · skipped ${skipped} duplicates` : ""}.`);
});
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
document.addEventListener("keydown", (event) => {
  const target = event.target;
  const typing = target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName));
  if (!typing && !event.repeat && (event.key.toLowerCase() === "n" || (event.ctrlKey && event.key.toLowerCase() === "k"))) {
    event.preventDefault();
    openTransaction();
  }
  if (event.key === "Escape") document.querySelectorAll("dialog[open]").forEach((dialog) => dialog.close());
});
