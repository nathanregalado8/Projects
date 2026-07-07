/* ==========================================================
   JIMMITEOBOT — app principal: estado, UI y animaciones
   ========================================================== */

const STORE_KEY = "jimmiteobot_v2";
const $ = (id) => document.getElementById(id);

/* ---------- Estado ---------- */
const DEFAULT_STATE = {
  profile: { nombre: "", peso: "", altura: "", edad: "", sexo: "m", actividad: "1.375" },
  goals: { kcal: 2200, protein: 140, carbs: 220, fat: 70, water: 8 },
  days: {},
  currentDate: null,
  apiKey: "",
  chat: [],
};

const App = {
  state: null,

  todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  },
  shiftKey(key, days) {
    const d = new Date(key + "T12:00:00");
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  },
  formatDate(key, opts = { weekday: "short", day: "numeric", month: "short" }) {
    return new Date(key + "T12:00:00").toLocaleDateString("es", opts);
  },

  load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      this.state = raw ? { ...structuredClone(DEFAULT_STATE), ...JSON.parse(raw) } : structuredClone(DEFAULT_STATE);
    } catch {
      this.state = structuredClone(DEFAULT_STATE);
    }
    if (!this.state.currentDate) this.state.currentDate = this.todayKey();
  },
  save() {
    localStorage.setItem(STORE_KEY, JSON.stringify(this.state));
  },

  currentDay() {
    const key = this.state.currentDate;
    if (!this.state.days[key]) this.state.days[key] = { meals: [], water: 0 };
    return this.state.days[key];
  },
  dayTotals(key = this.state.currentDate) {
    const day = this.state.days[key] || { meals: [] };
    return day.meals.reduce(
      (acc, m) => ({ kcal: acc.kcal + m.kcal, protein: acc.protein + m.protein, carbs: acc.carbs + m.carbs, fat: acc.fat + m.fat }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    );
  },

  /* --- acciones (usadas por la UI y por el bot) --- */
  addMeal(meal) {
    const entry = { id: Date.now() + Math.random(), time: new Date().toTimeString().slice(0, 5), ...meal };
    this.currentDay().meals.push(entry);
    this.save();
    renderAll();
    return entry;
  },
  updateMeal(id, patch) {
    const meal = this.currentDay().meals.find((m) => m.id === id);
    if (meal) Object.assign(meal, patch);
    this.save();
    renderAll();
  },
  deleteMealAt(index) {
    const meals = this.currentDay().meals;
    if (!meals.length) return null;
    const i = index < 0 ? meals.length - 1 : index;
    if (i >= meals.length) return null;
    const [removed] = meals.splice(i, 1);
    this.save();
    renderAll();
    return removed;
  },
  deleteMealById(id) {
    const meals = this.currentDay().meals;
    const i = meals.findIndex((m) => m.id === id);
    return i === -1 ? null : this.deleteMealAt(i);
  },
  setGoal(field, value) {
    this.state.goals[field] = value;
    this.save();
    renderAll();
  },
  setDate(key) {
    this.state.currentDate = key;
    this.save();
    renderAll();
  },
  addWater(amount) {
    const day = this.currentDay();
    day.water = Math.max(0, day.water + amount);
    this.save();
    renderAll();
    return day.water;
  },
};

/* ==========================================================
   UI — render
   ========================================================== */
const RING_LEN = 2 * Math.PI * 84; // circunferencia del anillo

function animateNumber(el, to) {
  const from = +el.dataset.val || 0;
  if (from === to) { el.textContent = to; return; }
  el.dataset.val = to;
  const start = performance.now();
  const dur = 700;
  function tick(now) {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (to - from) * eased);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

const FOOD_EMOJIS = [
  [/pollo|pechuga/i, "🍗"], [/arroz/i, "🍚"], [/huevo/i, "🍳"], [/ensalada|brócoli|brocoli|verdura/i, "🥗"],
  [/pizza/i, "🍕"], [/hamburguesa/i, "🍔"], [/pan|arepa|tortilla/i, "🥖"], [/pescado|salmón|salmon|atún|atun/i, "🐟"],
  [/fruta|manzana|banana|banano|plátano|platano/i, "🍎"], [/leche|yogur|queso/i, "🥛"], [/café|cafe/i, "☕"],
  [/pasta|espagueti/i, "🍝"], [/sopa/i, "🍲"], [/batido|proteína|proteina|whey/i, "🥤"], [/aguacate|palta/i, "🥑"],
];
const foodEmoji = (name) => (FOOD_EMOJIS.find(([re]) => re.test(name)) || [, "🍽️"])[1];

function renderHoy() {
  const s = App.state;
  const t = App.dayTotals();
  const g = s.goals;
  const day = App.currentDay();
  const isToday = s.currentDate === App.todayKey();

  // fecha
  $("dateLabel").textContent = App.formatDate(s.currentDate);
  $("dateInput").value = s.currentDate;
  $("dayTitle").textContent = isToday ? "Hoy" : App.formatDate(s.currentDate, { weekday: "long", day: "numeric", month: "long" });

  // anillo
  const pct = Math.min(1, t.kcal / g.kcal);
  const ring = $("ringProgress");
  ring.style.strokeDashoffset = RING_LEN * (1 - pct);
  ring.classList.toggle("over", t.kcal > g.kcal);
  animateNumber($("ringKcal"), t.kcal);
  $("editKcalGoal").textContent = g.kcal;
  const rest = g.kcal - t.kcal;
  const restEl = $("ringRest");
  restEl.textContent = rest >= 0 ? `te quedan ${rest} kcal` : `${-rest} kcal por encima`;
  restEl.classList.toggle("over", rest < 0);

  // macros
  const macroMap = [["Protein", t.protein, g.protein], ["Carbs", t.carbs, g.carbs], ["Fat", t.fat, g.fat]];
  for (const [key, val, goal] of macroMap) {
    animateNumber($("m" + key), val);
    $("g" + key).textContent = goal;
    $("b" + key).style.width = Math.min(100, (val / goal) * 100) + "%";
  }

  // agua
  $("waterCount").textContent = day.water;
  $("editWaterGoal").textContent = g.water;
  const cups = $("waterCups");
  cups.innerHTML = "";
  for (let i = 0; i < g.water; i++) {
    const c = document.createElement("div");
    c.className = "cup" + (i < day.water ? " full" : "");
    c.style.transitionDelay = `${i * 30}ms`;
    cups.appendChild(c);
  }

  // comidas
  const list = $("mealList");
  list.innerHTML = "";
  $("mealEmpty").style.display = day.meals.length ? "none" : "block";
  day.meals.forEach((m) => {
    const li = document.createElement("li");
    li.className = "meal";
    li.innerHTML = `
      <span class="meal-emoji">${foodEmoji(m.name)}</span>
      <div class="meal-info">
        <div class="meal-name">${escapeHtml(m.name)}</div>
        <div class="meal-macros"><i>🥩 ${m.protein}g</i><i>🍚 ${m.carbs}g</i><i>🥑 ${m.fat}g</i>${m.time ? `<i>🕐 ${m.time}</i>` : ""}</div>
      </div>
      <div class="meal-kcal">${m.kcal}<small> kcal</small></div>
      <div class="meal-actions">
        <button data-edit="${m.id}" title="Editar">✏️</button>
        <button data-del="${m.id}" title="Eliminar">🗑️</button>
      </div>`;
    list.appendChild(li);
  });
}

function renderLog() {
  const g = App.state.goals;

  // gráfica de 7 días (termina en la fecha activa o hoy, lo que sea mayor)
  const end = App.todayKey();
  const keys = Array.from({ length: 7 }, (_, i) => App.shiftKey(end, i - 6));
  const totals = keys.map((k) => App.dayTotals(k).kcal);
  const max = Math.max(g.kcal * 1.15, ...totals, 1);

  const chart = $("weekChart");
  chart.innerHTML = "";
  const goalLine = document.createElement("div");
  goalLine.className = "goal-line";
  // la zona de barras ocupa el alto del chart menos la etiqueta del día (~30px)
  goalLine.style.bottom = `${22 + (g.kcal / max) * (150 - 30)}px`;
  chart.appendChild(goalLine);

  keys.forEach((k, i) => {
    const bar = document.createElement("div");
    bar.className = "wbar" + (k === App.todayKey() ? " today" : "");
    const h = (totals[i] / max) * (150 - 30);
    bar.innerHTML = `
      <span class="wbar-val">${totals[i]}</span>
      <div class="wbar-fill" style="height:${Math.max(2, h)}px; animation-delay:${i * 70}ms"></div>
      <span class="wbar-day">${App.formatDate(k, { weekday: "short" }).slice(0, 3)}</span>`;
    bar.title = `${App.formatDate(k)}: ${totals[i]} kcal`;
    bar.addEventListener("click", () => { App.setDate(k); switchView("hoy"); });
    chart.appendChild(bar);
  });

  // lista de días con registros
  const entries = Object.entries(App.state.days)
    .filter(([, d]) => d.meals.length || d.water)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 30);
  const list = $("logList");
  list.innerHTML = "";
  $("logEmpty").style.display = entries.length ? "none" : "block";
  for (const [key, day] of entries) {
    const tot = App.dayTotals(key);
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.className = "log-item";
    btn.innerHTML = `
      <span class="log-date">${App.formatDate(key, { weekday: "long", day: "numeric", month: "short" })}</span>
      <span class="log-meta">${day.meals.length} comida${day.meals.length === 1 ? "" : "s"} · 💧${day.water}</span>
      <span class="log-kcal">${tot.kcal} kcal</span>`;
    btn.addEventListener("click", () => { App.setDate(key); switchView("hoy"); });
    li.appendChild(btn);
    list.appendChild(li);
  }
}

function renderConfig() {
  const { profile: p, goals: g } = App.state;
  $("pNombre").value = p.nombre; $("pPeso").value = p.peso; $("pAltura").value = p.altura;
  $("pEdad").value = p.edad; $("pSexo").value = p.sexo; $("pActividad").value = p.actividad;
  $("gKcalIn").value = g.kcal; $("gProteinIn").value = g.protein; $("gCarbsIn").value = g.carbs;
  $("gFatIn").value = g.fat; $("gWaterIn").value = g.water;
  $("apiKeyIn").value = App.state.apiKey;
  renderTdee();
  renderApiStatus();
}

function renderTdee() {
  const { peso, altura, edad, sexo, actividad } = App.state.profile;
  const hint = $("tdeeHint");
  if (!peso || !altura || !edad) { hint.textContent = ""; return; }
  // Mifflin-St Jeor (fórmula estándar de gasto energético)
  const bmr = 10 * peso + 6.25 * altura - 5 * edad + (sexo === "m" ? 5 : -161);
  const tdee = Math.round(bmr * +actividad);
  hint.textContent = `⚡ Tu gasto estimado (Mifflin-St Jeor) es ~${tdee} kcal/día para mantener tu peso.`;
}

function renderApiStatus() {
  const el = $("apiStatus");
  const has = !!App.state.apiKey;
  el.textContent = has ? "✅ IA activada: chat inteligente y análisis de fotos disponibles." : "🔌 Modo local activo: comandos básicos sin conexión.";
  el.classList.toggle("ok", has);
  $("chatChips").querySelectorAll(".chip").forEach((c) => c.classList.toggle("chip-ai", has));
}

function renderChat() {
  const list = $("chatList");
  list.innerHTML = "";
  if (!App.state.chat.length) {
    App.state.chat.push({
      role: "bot",
      text: "¡Hola! 👋 Soy JimmiteoBot, tu coach de nutrición.\n\nPuedo registrar lo que comes, cambiar tus metas y fechas, sumar agua y recomendarte libros y videos verificados de salud. Prueba los botones de abajo o escríbeme 👇",
    });
  }
  for (const m of App.state.chat) {
    const div = document.createElement("div");
    div.className = m.role === "user" ? "msg msg-user" : m.role === "action" ? "msg-action" : "msg msg-bot";
    div.textContent = m.text;
    list.appendChild(div);
  }
  $("chatScroll").scrollTop = $("chatScroll").scrollHeight;
}

function renderAll() {
  renderHoy();
  renderLog();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* ==========================================================
   Navegación / interacciones
   ========================================================== */
function switchView(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("view-active"));
  $("view-" + name).classList.add("view-active");
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("tab-active", t.dataset.view === name));
  if (name === "log") renderLog();
  if (name === "config") renderConfig();
  if (name === "bot") { renderChat(); document.querySelector(".tab-glow").classList.remove("on"); }
}

function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(() => (el.hidden = true), 2600);
}

/* ---------- Modales ---------- */
function openModal(html, onMount) {
  const box = $("modalBox");
  box.innerHTML = html;
  $("modalBackdrop").hidden = false;
  if (onMount) onMount(box);
}
function closeModal() { $("modalBackdrop").hidden = true; }

function mealModal(existing) {
  const m = existing || { name: "", kcal: "", protein: "", carbs: "", fat: "" };
  openModal(`
    <h3>${existing ? "✏️ Editar comida" : "🍽️ Agregar comida"}</h3>
    <div class="form-grid">
      <label style="grid-column:1/-1">Nombre<input id="fmName" type="text" value="${escapeHtml(m.name)}" placeholder="Ej. Arroz con pollo"></label>
      <label>Calorías<input id="fmKcal" type="number" min="0" value="${m.kcal}"></label>
      <label>Proteína (g)<input id="fmProt" type="number" min="0" value="${m.protein}"></label>
      <label>Carbos (g)<input id="fmCarb" type="number" min="0" value="${m.carbs}"></label>
      <label>Grasa (g)<input id="fmFat" type="number" min="0" value="${m.fat}"></label>
    </div>
    <div class="modal-btns">
      <button class="btn btn-ghost" id="fmCancel">Cancelar</button>
      <button class="btn btn-primary" id="fmSave">${existing ? "Guardar" : "Agregar"}</button>
    </div>`,
    (box) => {
      box.querySelector("#fmName").focus();
      box.querySelector("#fmCancel").onclick = closeModal;
      box.querySelector("#fmSave").onclick = () => {
        const data = {
          name: box.querySelector("#fmName").value.trim() || "Comida",
          kcal: Math.max(0, +box.querySelector("#fmKcal").value || 0),
          protein: Math.max(0, +box.querySelector("#fmProt").value || 0),
          carbs: Math.max(0, +box.querySelector("#fmCarb").value || 0),
          fat: Math.max(0, +box.querySelector("#fmFat").value || 0),
        };
        if (existing) { App.updateMeal(existing.id, data); toast("Comida actualizada ✏️"); }
        else { App.addMeal(data); toast(`+${data.kcal} kcal registradas 🍽️`); }
        closeModal();
      };
    });
}

function goalModal(field, label, unit) {
  openModal(`
    <h3>🎯 Meta de ${label}</h3>
    <div class="form-grid">
      <label style="grid-column:1/-1">${label} (${unit})<input id="fgVal" type="number" min="1" value="${App.state.goals[field]}"></label>
    </div>
    <div class="modal-btns">
      <button class="btn btn-ghost" id="fgCancel">Cancelar</button>
      <button class="btn btn-primary" id="fgSave">Guardar</button>
    </div>`,
    (box) => {
      const input = box.querySelector("#fgVal");
      input.focus(); input.select();
      box.querySelector("#fgCancel").onclick = closeModal;
      box.querySelector("#fgSave").onclick = () => {
        const v = Math.max(1, Math.round(+input.value || 0));
        App.setGoal(field, v);
        toast(`Meta de ${label}: ${v} ${unit} 🎯`);
        closeModal();
      };
    });
}

/* ---------- Chat ---------- */
let botBusy = false;

function pushChat(role, text) {
  App.state.chat.push({ role, text });
  if (App.state.chat.length > 60) App.state.chat = App.state.chat.slice(-60);
  App.save();
  renderChat();
}

function showTyping() {
  const div = document.createElement("div");
  div.className = "msg msg-bot";
  div.id = "typingMsg";
  div.innerHTML = `<span class="typing"><span></span><span></span><span></span></span>`;
  $("chatList").appendChild(div);
  $("chatScroll").scrollTop = $("chatScroll").scrollHeight;
}
function hideTyping() { $("typingMsg")?.remove(); }

async function sendToBot(text) {
  if (botBusy || !text.trim()) return;
  botBusy = true;
  pushChat("user", text.trim());
  showTyping();

  try {
    if (App.state.apiKey) {
      const answer = await askClaude(text.trim(), (actionMsg) => {
        hideTyping();
        pushChat("action", actionMsg);
        showTyping();
      });
      hideTyping();
      pushChat("bot", answer);
    } else {
      // pequeño delay para que se sienta natural
      await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));
      const { text: answer, actions } = localBot(text.trim());
      hideTyping();
      for (const a of actions) pushChat("action", a);
      pushChat("bot", answer);
    }
  } catch (err) {
    hideTyping();
    pushChat("bot", `⚠️ Ups: ${err.message}\n\nRevisa tu API key en Ajustes o inténtalo de nuevo.`);
  } finally {
    botBusy = false;
  }
}

/* ---------- Foto de comida ---------- */
function resizeImage(file, maxSide = 1024) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82).split(",")[1]);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

async function handlePhoto(file) {
  if (!App.state.apiKey) {
    toast("Agrega tu API key en Ajustes para analizar fotos 🤖");
    mealModal();
    return;
  }
  $("photoInner").hidden = true;
  $("photoLoading").hidden = false;
  try {
    const b64 = await resizeImage(file);
    const { text, actions } = await analyzeFoodPhoto(b64);
    for (const a of actions) pushChat("action", a);
    if (text) pushChat("bot", text);
    if (actions.length) {
      toast("¡Comida registrada desde la foto! 📸✅");
      document.querySelector(".tab-glow").classList.add("on");
    } else {
      toast(text ? "El bot respondió en el chat 🤖" : "No pude identificar comida en la foto 😅");
      if (text) document.querySelector(".tab-glow").classList.add("on");
    }
  } catch (err) {
    toast(`⚠️ ${err.message}`);
  } finally {
    $("photoInner").hidden = false;
    $("photoLoading").hidden = true;
    $("photoInput").value = "";
  }
}

/* ==========================================================
   Eventos
   ========================================================== */
function bindEvents() {
  // tabs
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => switchView(t.dataset.view)));

  // fecha
  $("prevDay").addEventListener("click", () => App.setDate(App.shiftKey(App.state.currentDate, -1)));
  $("nextDay").addEventListener("click", () => App.setDate(App.shiftKey(App.state.currentDate, 1)));
  $("dateInput").addEventListener("change", (e) => e.target.value && App.setDate(e.target.value));

  // metas rápidas
  $("editKcalGoal").addEventListener("click", (e) => { e.stopPropagation(); goalModal("kcal", "calorías", "kcal"); });
  $("editWaterGoal").addEventListener("click", (e) => { e.stopPropagation(); goalModal("water", "agua", "vasos"); });
  document.querySelectorAll(".macro").forEach((el) =>
    el.addEventListener("click", () => {
      const f = el.dataset.macro;
      goalModal(f, GOAL_LABEL[f], "g");
    })
  );

  // agua
  $("waterPlus").addEventListener("click", () => App.addWater(1));
  $("waterMinus").addEventListener("click", () => App.addWater(-1));

  // comidas
  $("addMealBtn").addEventListener("click", () => mealModal());
  $("mealList").addEventListener("click", (e) => {
    const editId = e.target.closest("[data-edit]")?.dataset.edit;
    const delId = e.target.closest("[data-del]")?.dataset.del;
    if (editId) {
      const meal = App.currentDay().meals.find((m) => m.id === +editId);
      if (meal) mealModal(meal);
    }
    if (delId) {
      const li = e.target.closest(".meal");
      li.classList.add("removing");
      setTimeout(() => { App.deleteMealById(+delId); toast("Comida eliminada 🗑️"); }, 250);
    }
  });

  // foto
  $("photoCard").addEventListener("click", () => !$("photoLoading").hidden || $("photoInput").click());
  $("photoInput").addEventListener("change", (e) => e.target.files[0] && handlePhoto(e.target.files[0]));

  // chat
  $("chatForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("chatText");
    sendToBot(input.value);
    input.value = "";
  });
  $("chatChips").addEventListener("click", (e) => {
    const q = e.target.closest(".chip")?.dataset.q;
    if (q) sendToBot(q);
  });

  // ajustes: perfil y metas
  const bindField = (id, obj, key, cb) =>
    $(id).addEventListener("change", (e) => {
      obj[key] = e.target.type === "number" ? +e.target.value || "" : e.target.value;
      App.save();
      if (cb) cb();
      renderAll();
    });
  bindField("pNombre", App.state.profile, "nombre");
  bindField("pPeso", App.state.profile, "peso", renderTdee);
  bindField("pAltura", App.state.profile, "altura", renderTdee);
  bindField("pEdad", App.state.profile, "edad", renderTdee);
  bindField("pSexo", App.state.profile, "sexo", renderTdee);
  bindField("pActividad", App.state.profile, "actividad", renderTdee);
  bindField("gKcalIn", App.state.goals, "kcal");
  bindField("gProteinIn", App.state.goals, "protein");
  bindField("gCarbsIn", App.state.goals, "carbs");
  bindField("gFatIn", App.state.goals, "fat");
  bindField("gWaterIn", App.state.goals, "water");
  $("apiKeyIn").addEventListener("change", (e) => {
    App.state.apiKey = e.target.value.trim();
    App.save();
    renderApiStatus();
    toast(App.state.apiKey ? "IA activada ✨" : "Modo local activo 🔌");
  });

  // datos
  $("exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ ...App.state, apiKey: "" }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `jimmiteobot-${App.todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Datos exportados 💾");
  });
  $("importBtn").addEventListener("click", () => $("importInput").click());
  $("importInput").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data.goals || !data.days) throw new Error("archivo no válido");
      const key = App.state.apiKey;
      App.state = { ...structuredClone(DEFAULT_STATE), ...data, apiKey: key };
      App.save();
      renderAll(); renderConfig(); renderChat();
      toast("Datos importados ✅");
    } catch {
      toast("⚠️ No pude leer ese archivo");
    }
    e.target.value = "";
  });
  $("resetBtn").addEventListener("click", () => {
    openModal(`
      <h3>⚠️ Borrar todo</h3>
      <p style="color:var(--ink-2);font-size:14px;line-height:1.6;margin-bottom:18px">Se eliminarán todas tus comidas, metas y el chat de este dispositivo. Esta acción no se puede deshacer.</p>
      <div class="modal-btns">
        <button class="btn btn-ghost" id="rCancel">Cancelar</button>
        <button class="btn btn-primary" id="rOk" style="background:var(--rose);color:#fff">Borrar todo</button>
      </div>`,
      (box) => {
        box.querySelector("#rCancel").onclick = closeModal;
        box.querySelector("#rOk").onclick = () => {
          localStorage.removeItem(STORE_KEY);
          App.load();
          renderAll(); renderConfig(); renderChat();
          closeModal();
          toast("Todo borrado. Empezamos de cero 🌱");
        };
      });
  });

  // modal: cerrar con fondo o Escape
  $("modalBackdrop").addEventListener("click", (e) => e.target === $("modalBackdrop") && closeModal());
  document.addEventListener("keydown", (e) => e.key === "Escape" && closeModal());
}

/* ---------- init ---------- */
App.load();
bindEvents();
renderAll();
renderApiStatus();
