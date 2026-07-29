/* ==========================================================
   JIMMITEOBOT — estado, render e interacciones
   ========================================================== */
const STORE_KEY = "jimmiteobot_v2";
const $ = (id) => document.getElementById(id);

const DEFAULT_STATE = {
  profile: { nombre: "", peso: "", altura: "", edad: "", sexo: "m", actividad: "1.55", objetivo: "cut", ritmo: "0.5" },
  goals: { kcal: 2100, protein: 140, carbs: 210, fat: 70 },
  days: {},
  weights: {},
  units: { weight: "kg", height: "cm" },
  heroStyle: "auto",
  currentDate: null,
  apiKey: "",
  chat: [],
};

const MACRO_META = {
  protein: { key: "Protein", letter: "P", name: "Proteína", color: "#7C3AED", soft: "rgba(124,58,237,.12)", grad: "linear-gradient(90deg,#A78BFA,#7C3AED)" },
  carbs:   { key: "Carbs",   letter: "C", name: "Carbos",   color: "#D97706", soft: "rgba(217,119,6,.12)",  grad: "linear-gradient(90deg,#FBBF24,#D97706)" },
  fat:     { key: "Fat",     letter: "G", name: "Grasa",    color: "#E11D48", soft: "rgba(225,29,72,.12)",  grad: "linear-gradient(90deg,#FB7185,#E11D48)" },
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
    } catch { this.state = structuredClone(DEFAULT_STATE); }
    this.state.currentDate ||= this.todayKey();
    this.state.weights ||= {};
    this.state.units ||= { weight: "kg", height: "cm" };
    this.state.heroStyle ||= "auto";
    this.state.profile.ritmo ||= "0.5";
    const ayer = this.shiftKey(this.todayKey(), -1);
    for (const m of this.state.chat) m.d ||= ayer;
  },
  save() { localStorage.setItem(STORE_KEY, JSON.stringify(this.state)); },

  currentDay() {
    const k = this.state.currentDate;
    if (!this.state.days[k]) this.state.days[k] = { meals: [] };
    return this.state.days[k];
  },
  dayTotals(key = this.state.currentDate) {
    const day = this.state.days[key] || { meals: [] };
    return day.meals.reduce((a, m) => ({
      kcal: a.kcal + m.kcal, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat,
    }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  },

  /* unidades */
  kgToUnit(kg) { return this.state.units.weight === "lb" ? kg * 2.20462 : kg; },
  unitToKg(v) { return this.state.units.weight === "lb" ? v / 2.20462 : v; },
  fmtWeight(kg, d = 1) { return `${(+this.kgToUnit(kg)).toFixed(d)} ${this.state.units.weight}`; },

  /* acciones (también las usa el bot) */
  addMeal(meal) {
    const entry = { id: Date.now() + Math.random(), time: new Date().toTimeString().slice(0, 5), ...meal };
    this.currentDay().meals.push(entry);
    this.save(); renderAll();
    return entry;
  },
  updateMeal(id, patch) {
    const m = this.currentDay().meals.find((x) => x.id === id);
    if (m) Object.assign(m, patch);
    this.save(); renderAll();
  },
  deleteMealAt(index) {
    const meals = this.currentDay().meals;
    if (!meals.length) return null;
    const i = index < 0 ? meals.length - 1 : index;
    if (i >= meals.length) return null;
    const [rm] = meals.splice(i, 1);
    this.save(); renderAll();
    return rm;
  },
  deleteMealById(id) {
    const i = this.currentDay().meals.findIndex((m) => m.id === id);
    return i === -1 ? null : this.deleteMealAt(i);
  },
  setGoal(field, value) { this.state.goals[field] = value; this.save(); renderAll(); },
  setDate(key) { this.state.currentDate = key; this.save(); renderAll(); },
  logWeight(kg, key = this.state.currentDate) {
    kg = Math.round(kg * 10) / 10;
    this.state.weights[key] = kg;
    this.state.profile.peso = kg;
    this.save(); renderAll();
    return kg;
  },
  weightSeries(days = 42) {
    const from = this.shiftKey(this.todayKey(), -days);
    return Object.entries(this.state.weights)
      .filter(([k]) => k >= from && k <= this.todayKey())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => ({ key: k, kg: v }));
  },
  latestWeight() {
    const all = Object.entries(this.state.weights).sort((a, b) => a[0].localeCompare(b[0]));
    return all.length ? { key: all.at(-1)[0], kg: all.at(-1)[1] } : null;
  },
  streak() {
    let n = 0, key = this.todayKey();
    const has = (k) => (this.state.days[k]?.meals?.length || 0) > 0;
    if (!has(key)) key = this.shiftKey(key, -1);
    while (has(key)) { n++; key = this.shiftKey(key, -1); }
    return n;
  },

  /* Mifflin-St Jeor + ritmo semanal (7700 kcal ≈ 1 kg) */
  computeMacros() {
    const { peso, altura, edad, sexo, actividad, objetivo, ritmo } = this.state.profile;
    if (!peso || !altura || !edad) return null;
    const bmr = 10 * peso + 6.25 * altura - 5 * edad + (sexo === "m" ? 5 : -161);
    const tdee = Math.round(bmr * +actividad);
    const shift = (+ritmo || 0.5) * 7700 / 7;
    const raw = objetivo === "cut" ? tdee - shift : objetivo === "bulk" ? tdee + shift : tdee;
    const kcal = Math.max(1200, Math.round(raw / 10) * 10);
    const protein = Math.round((peso * (objetivo === "cut" ? 2.0 : 1.8)) / 5) * 5;
    const fat = Math.round((kcal * 0.25) / 9 / 5) * 5;
    const carbs = Math.max(20, Math.round((kcal - protein * 4 - fat * 9) / 4 / 5) * 5);
    return { tdee, kcal, protein, carbs, fat };
  },
  applyMacros() {
    const m = this.computeMacros();
    if (!m) return null;
    Object.assign(this.state.goals, { kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat });
    this.save(); renderAll();
    return m;
  },
};

/* ==========================================================
   Helpers
   ========================================================== */
function animateNumber(el, to) {
  const from = +el.dataset.val || 0;
  el.dataset.val = to;
  if (from === to) { el.textContent = to; return; }
  const start = performance.now();
  (function tick(now) {
    const p = Math.min(1, (now - start) / 800);
    el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  })(performance.now());
}
function esc(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
const FOOD_EMOJIS = [
  [/pollo|pechuga/i, "🍗"], [/arroz/i, "🍚"], [/huevo/i, "🍳"], [/ensalada|brócoli|brocoli|verdura/i, "🥗"],
  [/pizza/i, "🍕"], [/hamburguesa/i, "🍔"], [/pan|arepa|tortilla/i, "🥖"], [/pescado|salmón|salmon|atún|atun/i, "🐟"],
  [/fruta|manzana|banana|banano|plátano|platano/i, "🍎"], [/leche|yogur|queso/i, "🥛"], [/café|cafe/i, "☕"],
  [/pasta|espagueti/i, "🍝"], [/sopa/i, "🍲"], [/batido|proteína|proteina|whey/i, "🥤"], [/aguacate|palta/i, "🥑"],
  [/avena|oats/i, "🥣"], [/papa|patata/i, "🥔"],
];
const foodEmoji = (n) => (FOOD_EMOJIS.find(([re]) => re.test(n)) || [, "🍽️"])[1];

/* ==========================================================
   Medidor de calorías — 8 estilos de un mismo sistema
   ========================================================== */
const HERO_MODES = ["capsula", "bateria", "numero", "torre", "ecualizador", "termometro", "pixeles", "balance"];
const HERO_NAMES = {
  auto: "Auto", capsula: "Cápsula", bateria: "Batería", numero: "Número",
  torre: "Torre", ecualizador: "Ecualizador", termometro: "Termómetro", pixeles: "Píxeles", balance: "Balance",
};
const MACRO_THEME = {
  bateria: "seg", torre: "seg", ecualizador: "seg", pixeles: "seg",
  capsula: "liq", termometro: "liq",
  numero: "cls", balance: "cls",
};
const EQ_HEIGHTS = [18, 34, 26, 46, 30, 52, 38, 58, 28, 44, 22, 50, 32, 40, 24, 36];
const WAVE = (h, fill) => `<svg class="cap-wave${h === 24 ? " w2" : ""}" viewBox="0 0 920 ${h}" preserveAspectRatio="none"><path d="M0 ${h / 2} Q 57 0 115 ${h / 2} T 230 ${h / 2} T 345 ${h / 2} T 460 ${h / 2} T 575 ${h / 2} T 690 ${h / 2} T 805 ${h / 2} T 920 ${h / 2} V ${h} H 0 Z" fill="${fill}"/></svg>`;

function activeHeroMode() {
  const pref = App.state.heroStyle;
  if (pref !== "auto") return pref;
  const n = Math.floor(new Date(App.state.currentDate + "T12:00:00").getTime() / 86400000);
  return HERO_MODES[((n % HERO_MODES.length) + HERO_MODES.length) % HERO_MODES.length];
}

function renderHero(t, g) {
  const stage = $("heroStage");
  const mode = activeHeroMode();
  const pct = Math.max(0, Math.min(1, t.kcal / g.kcal));
  const over = t.kcal > g.kcal;
  const rest = Math.max(0, g.kcal - t.kcal);
  const build = stage.dataset.mode !== mode;
  if (build) stage.dataset.mode = mode;

  const N = (size) => `<span class="kbig" id="heroKcal" style="font-size:${size}px">0</span>`;

  if (build) {
    if (mode === "capsula") {
      stage.innerHTML = `<div class="cap">
        <div class="cap-water" id="capWater">
          ${WAVE(28, "rgba(255,138,0,.9)")}${WAVE(24, "#FF5A3C")}
          <div class="cap-fill"></div>
          <div class="cap-b" style="left:30%;width:6px;height:6px"></div>
          <div class="cap-b" style="left:60%;width:4px;height:4px;animation-duration:2.4s;animation-delay:1s"></div>
        </div>
        <div class="cap-txt">${N(50)}<div class="klbl" id="heroSub"></div></div>
      </div>`;
    } else if (mode === "bateria") {
      stage.innerHTML = `<div class="col-c">
        <div class="row-base">${N(54)}<span class="klbl" id="heroSub"></span></div>
        <div class="bat-box"><div class="bat-cells" id="batCells">${'<div class="cell"></div>'.repeat(12)}</div><div class="bat-tip"></div></div>
      </div>`;
    } else if (mode === "numero") {
      stage.innerHTML = `<div class="col-c">
        <div class="num-hero" id="heroKcal">0</div>
        <div class="num-bar"><div class="num-fill" id="numFill"></div></div>
        <div class="num-legend"><span>0</span><span class="meta" id="heroSub"></span></div>
      </div>`;
    } else if (mode === "torre") {
      stage.innerHTML = `<div class="tower-wrap">
        <div class="tower" id="towerCol">${'<div class="blk"></div>'.repeat(10)}</div>
        <div style="padding-bottom:8px">${N(44)}<div class="klbl" id="heroSub"></div></div>
      </div>`;
    } else if (mode === "ecualizador") {
      stage.innerHTML = `<div class="col-c">
        <div class="row-base">${N(46)}<span class="klbl" id="heroSub"></span></div>
        <div class="eq-box" id="eqRow">${EQ_HEIGHTS.map((h, i) => `<div class="eqb" style="height:${h}px;animation-delay:${i * .09}s"></div>`).join("")}</div>
      </div>`;
    } else if (mode === "termometro") {
      stage.innerHTML = `<div class="thermo-wrap">
        <div class="thermo-col">
          <div class="thermo"><div class="thermo-fill" id="thermoFill"></div><div class="thermo-gloss"></div></div>
          <div class="thermo-bulb"></div>
        </div>
        <div class="thermo-legend">
          ${N(46)}<div class="klbl" id="heroSub"></div>
          <div class="tl-row meta" style="margin-top:6px"><i></i><span id="tlMeta"></span></div>
          <div class="tl-row half"><i></i><span id="tlHalf"></span></div>
        </div>
      </div>`;
    } else if (mode === "pixeles") {
      stage.innerHTML = `<div class="col-c">
        <div class="row-base">${N(42)}<span class="klbl" id="heroSub"></span></div>
        <div class="pix-grid" id="pixGrid">${'<div class="px"></div>'.repeat(50)}</div>
      </div>`;
    } else {
      stage.innerHTML = `<div class="bal">
        <div class="bal-top">
          <div><div class="bal-k eat">LLEVAS</div><div class="bal-num" id="heroKcal" style="color:var(--ink)">0</div></div>
          <div style="text-align:right"><div class="bal-k left">TE QUEDAN</div><div class="bal-num" id="balRest" style="color:var(--lime)">0</div></div>
        </div>
        <div class="bal-track"><div class="bal-fill" id="balFill"><i></i></div><div class="bal-rest"></div></div>
      </div>`;
    }
  }

  animateNumber($("heroKcal"), t.kcal);
  $("heroModeLabel").textContent = HERO_NAMES[App.state.heroStyle];
  const sub = $("heroSub");

  if (mode === "capsula") {
    sub.textContent = `DE ${g.kcal} KCAL`;
    const w = $("capWater");
    w.style.height = pct * 100 + "%";
    w.querySelectorAll(".cap-fill").forEach((f) => f.style.background = over ? "linear-gradient(180deg,#FB7185,#E11D48)" : "linear-gradient(180deg,#FF8A00,#FF5A3C)");
  } else if (mode === "bateria") {
    sub.textContent = `/ ${g.kcal}`;
    const cells = $("batCells").children, on = Math.round(pct * cells.length);
    [...cells].forEach((c, i) => setTimeout(() => { c.classList.toggle("on", i < on); c.classList.toggle("hot", over); }, i * 26));
  } else if (mode === "numero") {
    sub.textContent = `META ${g.kcal}`;
    const f = $("numFill");
    requestAnimationFrame(() => (f.style.width = pct * 100 + "%"));
  } else if (mode === "torre") {
    const on = Math.round(pct * 10);
    sub.textContent = `${on} BLOQUES`;
    [...$("towerCol").children].forEach((b, i) => setTimeout(() => { b.classList.toggle("on", i < on); b.classList.toggle("hot", over); }, i * 32));
  } else if (mode === "ecualizador") {
    sub.textContent = `/ ${g.kcal}`;
    const bars = $("eqRow").children, on = Math.round(pct * bars.length);
    [...bars].forEach((b, i) => setTimeout(() => { b.classList.toggle("on", i < on); b.classList.toggle("hot", over); }, i * 24));
  } else if (mode === "termometro") {
    sub.textContent = `DE ${g.kcal} KCAL`;
    $("tlMeta").textContent = `meta ${g.kcal}`;
    $("tlHalf").textContent = `mitad ${Math.round(g.kcal / 2)}`;
    const f = $("thermoFill");
    requestAnimationFrame(() => (f.style.height = pct * 100 + "%"));
    f.style.background = over ? "linear-gradient(180deg,#FB7185,#E11D48)" : "linear-gradient(180deg,#FF8A00,#FF5A3C)";
  } else if (mode === "pixeles") {
    const on = Math.round(pct * 50);
    sub.textContent = `${on} PÍXELES`;
    [...$("pixGrid").children].forEach((d, i) => setTimeout(() => { d.classList.toggle("on", i < on); d.classList.toggle("hot", over); }, i * 6));
  } else {
    animateNumber($("balRest"), rest);
    const f = $("balFill");
    requestAnimationFrame(() => (f.style.width = pct * 100 + "%"));
    f.style.background = over ? "linear-gradient(90deg,#FB7185,#E11D48)" : "var(--grad)";
  }
  return mode;
}

/* macros — la barrita hereda el tema del medidor */
function renderMacros(t, g, mode) {
  const theme = MACRO_THEME[mode] || "cls";
  const row = $("macrosRow");
  if (row.dataset.theme !== theme) {
    row.dataset.theme = theme;
    row.innerHTML = Object.entries(MACRO_META).map(([k, m]) => `
      <button class="macro" data-macro="${k}" style="--c:${m.color};--grad2:${m.grad}">
        <span class="macro-head">
          <span class="macro-chip">${m.letter}</span>
          <span class="macro-g"><b id="m${m.key}">0</b> g</span>
          <span class="macro-meta">/ <span id="g${m.key}">0</span></span>
        </span>
        <span class="mbar ${theme}" data-k="${k}">
          ${theme === "seg" ? '<span class="track"></span><span class="fill"></span>'
            : theme === "liq" ? '<span class="fill"><i></i></span>'
            : '<span class="fill"></span><span class="goal"></span>'}
        </span>
      </button>`).join("");
  }
  for (const [k, m] of Object.entries(MACRO_META)) {
    const val = t[k], goal = g[k], pct = Math.min(100, (val / goal) * 100);
    animateNumber($("m" + m.key), val);
    $("g" + m.key).textContent = goal;
    const bar = row.querySelector(`.mbar[data-k="${k}"]`);
    const fill = bar.querySelector(".fill");
    requestAnimationFrame(() => {
      if (theme === "seg") fill.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
      else fill.style.width = pct + "%";
    });
  }
}

/* ==========================================================
   Vista HOY
   ========================================================== */
function renderHoy() {
  const s = App.state, t = App.dayTotals(), g = s.goals, day = App.currentDay();
  const isToday = s.currentDate === App.todayKey();

  $("dateLabel").textContent = isToday
    ? "hoy · " + App.formatDate(s.currentDate, { day: "numeric", month: "short" }).replace(".", "")
    : App.formatDate(s.currentDate, { weekday: "short", day: "numeric", month: "short" }).replace(/\.|,/g, "");
  $("dateInput").value = s.currentDate;

  const st = App.streak();
  $("streakChip").hidden = st < 2;
  $("streakDays").textContent = st;

  const mode = renderHero(t, g);
  renderMacros(t, g, mode);

  const rest = g.kcal - t.kcal;
  $("dlMeta").textContent = `${g.kcal} kcal`;
  $("dlRest").textContent = rest >= 0 ? rest : `+${-rest}`;
  $("dlPct").textContent = Math.round((t.kcal / g.kcal) * 100) + "%";
  document.querySelector(".dataline").classList.toggle("over", rest < 0);

  renderWeightCard();

  const list = $("mealList");
  list.innerHTML = "";
  $("mealEmpty").hidden = day.meals.length > 0;
  day.meals.forEach((m) => {
    // la barra mide cuánto aporta esta comida a tu meta diaria del macro
    const mr = (k) => {
      const meta = MACRO_META[k], val = m[k];
      const pct = Math.min(100, (val / g[k]) * 100);
      return `<div class="mrow" style="--c:${meta.color};--cbg:${meta.soft}">
        <span class="mrow-chip">${meta.letter}</span>
        <span class="mrow-g">${val} g</span>
        <span class="mrow-track"><span class="mrow-fill" style="width:${pct.toFixed(1)}%"></span></span>
        <span class="mrow-pct">${Math.round(pct)}%</span>
      </div>`;
    };
    const li = document.createElement("div");
    li.className = "meal";
    li.innerHTML = `
      <div class="meal-top">
        <div class="meal-emoji">${foodEmoji(m.name)}</div>
        <div class="meal-info">
          <div class="meal-name">${esc(m.name)}</div>
          <div class="meal-time">${m.time || ""}</div>
        </div>
        <div class="meal-kcal"><b>${m.kcal}</b><span>kcal</span></div>
        <div class="meal-acts">
          <button class="iact" data-edit="${m.id}" aria-label="Editar">
            <svg width="12" height="12" viewBox="0 0 14 14"><path d="M2 12l1-4 7-7 3 3-7 7Z" stroke="#B06A3A" stroke-width="1.6" fill="none" stroke-linejoin="round"/></svg>
          </button>
          <button class="iact del" data-del="${m.id}" aria-label="Eliminar">
            <svg width="11" height="12" viewBox="0 0 12 14"><path d="M1 3h10M4 3V1h4v2M2.5 3l.8 9.5h5.4L9.5 3" stroke="#E11D48" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
      <div class="mrows">${mr("protein")}${mr("carbs")}${mr("fat")}</div>`;
    list.appendChild(li);
  });
}

function renderWeightCard() {
  const latest = App.latestWeight(), unit = App.state.units.weight;
  $("weightUnit").textContent = unit;
  const dEl = $("weightDelta"), sEl = $("weightSince");
  if (!latest) {
    $("weightNow").textContent = "—";
    dEl.textContent = "sin registros"; dEl.className = "w-delta flat";
    sEl.textContent = ""; $("weightSpark").innerHTML = "";
    return;
  }
  $("weightNow").textContent = App.kgToUnit(latest.kg).toFixed(1);

  const series = App.weightSeries(60);
  const prev = [...series].reverse().find((p) => p.key <= App.shiftKey(latest.key, -6));
  if (prev) {
    const diff = App.kgToUnit(latest.kg - prev.kg), abs = Math.abs(diff).toFixed(1);
    if (Math.abs(diff) < 0.05) { dEl.textContent = "estable"; dEl.className = "w-delta flat"; }
    else if (diff < 0) { dEl.textContent = `▼ ${abs} ${unit}`; dEl.className = "w-delta"; }
    else { dEl.textContent = `▲ ${abs} ${unit}`; dEl.className = "w-delta up"; }
    sEl.textContent = "esta semana";
  } else {
    dEl.textContent = App.fmtWeight(latest.kg); dEl.className = "w-delta flat";
    sEl.textContent = App.formatDate(latest.key);
  }

  const pts = series.slice(-14), svg = $("weightSpark");
  if (pts.length < 2) { svg.innerHTML = ""; return; }
  const kgs = pts.map((p) => p.kg), min = Math.min(...kgs), max = Math.max(...kgs);
  const pad = (max - min) < .5 ? .5 : (max - min) * .18;
  const y = (v) => 46 - ((v - (min - pad)) / ((max + pad) - (min - pad))) * 38;
  const x = (i) => (i / (pts.length - 1)) * 104 + 4;
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.kg).toFixed(1)}`).join(" ");
  svg.innerHTML = `
    <defs><linearGradient id="gSpark" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#16A34A" stop-opacity=".22"/><stop offset="100%" stop-color="#16A34A" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${d} L${x(pts.length - 1).toFixed(1)},52 L4,52 Z" fill="url(#gSpark)"/>
    <path d="${d}" fill="none" stroke="#16A34A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${x(pts.length - 1).toFixed(1)}" cy="${y(pts.at(-1).kg).toFixed(1)}" r="3.5" fill="#16A34A"/>`;
}

/* ==========================================================
   Vista LOG
   ========================================================== */
let chartMetric = "kcal";
const METRICS = {
  kcal: { name: "Calorías", color: "#FF8A00", soft: "#FFE0C2", unit: "kcal" },
  protein: { name: "Proteína", color: "#7C3AED", soft: "#E4D9FB", unit: "g" },
  carbs: { name: "Carbos", color: "#D97706", soft: "#FBE6C4", unit: "g" },
  fat: { name: "Grasa", color: "#E11D48", soft: "#FAD4DC", unit: "g" },
};

function renderWeightChart() {
  const svg = $("weightChart"), labels = $("weightLabels"), empty = $("weightEmpty");
  const series = App.weightSeries(42), unit = App.state.units.weight;

  if (!series.length) {
    svg.hidden = true; labels.hidden = true; empty.hidden = false;
    $("weightRange").textContent = "";
    return;
  }
  svg.hidden = false; labels.hidden = false; empty.hidden = true;

  const W = 330, H = 150, L = 12, R = 12, T = 20, B = 26;
  const kgs = series.map((p) => p.kg), min = Math.min(...kgs), max = Math.max(...kgs);
  const pad = (max - min) < 1 ? .8 : (max - min) * .2;
  const lo = min - pad, hi = max + pad;
  const t0 = new Date(series[0].key + "T12:00:00").getTime();
  const t1 = new Date(series.at(-1).key + "T12:00:00").getTime();
  const x = (k) => t1 === t0 ? W / 2 : L + ((new Date(k + "T12:00:00").getTime() - t0) / (t1 - t0)) * (W - L - R);
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);

  if (series.length === 1) {
    const p = series[0];
    svg.innerHTML = `
      <circle cx="${W / 2}" cy="${H / 2}" r="11" fill="#16A34A" opacity=".2" style="transform-origin:${W / 2}px ${H / 2}px;animation:pointPing 1.8s ease-out infinite"/>
      <circle cx="${W / 2}" cy="${H / 2}" r="6" fill="#16A34A" stroke="#fff" stroke-width="2.5"/>`;
    labels.innerHTML = `<span>${App.formatDate(p.key)}</span><b>${App.fmtWeight(p.kg)}</b>`;
    $("weightRange").textContent = "primer registro ✓";
    return;
  }

  const pts = series.map((p) => `${x(p.key).toFixed(1)},${y(p.kg).toFixed(1)}`).join(" ");
  const area = `M${series.map((p) => `${x(p.key).toFixed(1)} ${y(p.kg).toFixed(1)}`).join(" L")} L${x(series.at(-1).key).toFixed(1)} ${H} L${x(series[0].key).toFixed(1)} ${H} Z`;
  const last = series.at(-1);
  svg.innerHTML = `
    <defs><linearGradient id="gPeso" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#16A34A" stop-opacity=".28"/><stop offset="100%" stop-color="#16A34A" stop-opacity="0"/>
    </linearGradient></defs>
    <line x1="0" y1="40" x2="330" y2="40" stroke="#F3E3D2" stroke-width="1"/>
    <line x1="0" y1="80" x2="330" y2="80" stroke="#F3E3D2" stroke-width="1"/>
    <line x1="0" y1="120" x2="330" y2="120" stroke="#F3E3D2" stroke-width="1"/>
    <path d="${area}" fill="url(#gPeso)"/>
    <polyline points="${pts}" fill="none" stroke="#16A34A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="600" style="animation:drawLine 1.8s ease-out both"/>
    ${series.slice(0, -1).map((p) => `<circle cx="${x(p.key).toFixed(1)}" cy="${y(p.kg).toFixed(1)}" r="4" fill="#fff" stroke="#16A34A" stroke-width="2.5"><title>${App.formatDate(p.key)}: ${App.fmtWeight(p.kg)}</title></circle>`).join("")}
    <circle cx="${x(last.key).toFixed(1)}" cy="${y(last.kg).toFixed(1)}" r="9" fill="#16A34A" opacity=".25" style="transform-origin:${x(last.key).toFixed(1)}px ${y(last.kg).toFixed(1)}px;animation:pointPing 1.8s ease-out infinite"/>
    <circle cx="${x(last.key).toFixed(1)}" cy="${y(last.kg).toFixed(1)}" r="5.5" fill="#16A34A" stroke="#fff" stroke-width="2.5"><title>${App.formatDate(last.key)}: ${App.fmtWeight(last.kg)}</title></circle>`;

  const step = Math.max(1, Math.floor(series.length / 5));
  const marks = series.filter((_, i) => i % step === 0).slice(0, 5);
  labels.innerHTML = marks.map((p) => `<span>${App.formatDate(p.key, { day: "numeric", month: "short" })}</span>`).join("")
    + `<b>hoy · ${App.kgToUnit(last.kg).toFixed(1)}</b>`;

  const diff = App.kgToUnit(last.kg - series[0].kg);
  $("weightRange").textContent = `${diff <= 0 ? "▼" : "▲"} ${Math.abs(diff).toFixed(1)} ${unit} en ${series.length} registros`;
}

function renderLog() {
  renderWeightChart();
  const g = App.state.goals, m = METRICS[chartMetric], goal = g[chartMetric];
  $("weekTitle").textContent = `${m.name} · 7 días`;
  document.querySelectorAll("#segChart .pill").forEach((b) => b.classList.toggle("on", b.dataset.m === chartMetric));

  const end = App.todayKey();
  const keys = Array.from({ length: 7 }, (_, i) => App.shiftKey(end, i - 6));
  const vals = keys.map((k) => App.dayTotals(k)[chartMetric]);
  const max = Math.max(goal * 1.2, ...vals, 1);
  const H = 132, LBL = 22, area = H - LBL;

  $("weekAvg").textContent = `${Math.round(vals.reduce((a, b) => a + b, 0) / 7)} ${m.unit}`;

  const chart = $("weekChart");
  chart.style.setProperty("--mc", m.color);
  chart.innerHTML = `
    <div class="meta-line" style="bottom:${(LBL + (goal / max) * area).toFixed(1)}px"></div>
    <div class="meta-lbl" style="bottom:${(LBL + (goal / max) * area + 3).toFixed(1)}px">META ${goal}</div>`
    + keys.map((k, i) => `
      <div class="wbar${k === end ? " today" : ""}" data-k="${k}" style="--bg2:${m.soft}" title="${App.formatDate(k)}: ${vals[i]} ${m.unit}">
        <div class="wbar-fill" style="height:${Math.max(3, (vals[i] / max) * area).toFixed(1)}px;animation-delay:${i * .07}s"></div>
        <span class="wbar-day">${App.formatDate(k, { weekday: "short" }).slice(0, 3)}</span>
      </div>`).join("");

  const entries = Object.entries(App.state.days)
    .filter(([, d]) => d.meals.length)
    .sort((a, b) => b[0].localeCompare(a[0])).slice(0, 30);
  const list = $("logList");
  list.innerHTML = "";
  $("logEmpty").hidden = entries.length > 0;
  for (const [key, day] of entries) {
    const tot = App.dayTotals(key), w = App.state.weights[key];
    const btn = document.createElement("button");
    btn.className = "day-row";
    btn.innerHTML = `
      <div class="day-date"><div class="day-num">${key.slice(8)}</div><div class="day-mes">${App.formatDate(key, { month: "short" }).replace(".", "")}</div></div>
      <div class="day-div"></div>
      <div class="day-main">
        <div class="day-kcal">${tot.kcal} kcal · ${day.meals.length} comida${day.meals.length === 1 ? "" : "s"}</div>
        <div class="day-macros">${tot.protein}P · ${tot.carbs}C · ${tot.fat}G</div>
      </div>
      ${w ? `<div class="day-w">${App.fmtWeight(w)}</div>` : ""}`;
    btn.onclick = () => { App.setDate(key); switchView("hoy"); };
    list.appendChild(btn);
  }
}

/* ==========================================================
   Vista AJUSTES
   ========================================================== */
function renderConfig() {
  const { profile: p, goals: g, units: u } = App.state;
  $("pNombre").value = p.nombre;
  $("pEdad").value = p.edad; $("pSexo").value = p.sexo;
  $("pActividad").value = p.actividad; $("pRitmo").value = p.ritmo;

  document.querySelectorAll("#segWeight .seg-btn").forEach((b) => b.classList.toggle("on", b.dataset.u === u.weight));
  document.querySelectorAll("#segHeight .seg-btn").forEach((b) => b.classList.toggle("on", b.dataset.u === u.height));
  document.querySelectorAll("#segObjetivo .seg-btn").forEach((b) => b.classList.toggle("on", b.dataset.o === p.objetivo));
  document.querySelectorAll(".wUnitLbl").forEach((el) => (el.textContent = u.weight));

  $("pPeso").value = p.peso ? App.kgToUnit(p.peso).toFixed(1) : "";
  $("alturaCmWrap").hidden = u.height !== "cm";
  $("alturaFtWrap").hidden = u.height !== "ft";
  if (u.height === "cm") $("pAltura").value = p.altura || "";
  else if (p.altura) {
    const ti = p.altura / 2.54;
    $("pAlturaFt").value = Math.floor(ti / 12); $("pAlturaIn").value = Math.round(ti % 12);
  }

  const rows = $("goalRows");
  const defs = [["kcal", "Calorías", "#FF8A00", 50], ["protein", "Proteína (g)", "#7C3AED", 5], ["carbs", "Carbos (g)", "#D97706", 5], ["fat", "Grasa (g)", "#E11D48", 5]];
  rows.innerHTML = defs.map(([k, name, c, stp]) => `
    <div class="goal-row">
      <span class="goal-dot" style="--c:${c}"></span>
      <span class="goal-name">${name}</span>
      <span class="stepper">
        <button class="step" data-g="${k}" data-d="-${stp}">−</button>
        <span class="step-v" id="gv-${k}">${g[k]}</span>
        <button class="step plus" data-g="${k}" data-d="${stp}">+</button>
      </span>
    </div>`).join("");

  const key = App.state.apiKey;
  $("apiKeyMask").textContent = key ? `sk-••••••••••••${key.slice(-4)}` : "sin configurar";
  renderTdee(); renderApiStatus();
}

function renderTdee() {
  const m = App.computeMacros();
  $("tdeeHint").innerHTML = m
    ? `gasto ~${m.tdee} kcal/día · sugerido: <b>${m.kcal} kcal</b> · ${m.protein} P · ${m.carbs} C · ${m.fat} G`
    : "Completa peso, altura y edad para calcular tus macros.";
}
function renderApiStatus() {
  const el = $("apiStatus"), has = !!App.state.apiKey;
  el.textContent = has ? "IA activada: análisis de fotos y chat inteligente." : "Modo local: comandos básicos sin conexión.";
  el.classList.toggle("ok", has);
}

/* ==========================================================
   Chat
   ========================================================== */
function chatDayLabel(key) {
  const t = App.todayKey();
  if (key === t) return "Hoy";
  if (key === App.shiftKey(t, -1)) return "Ayer";
  return App.formatDate(key, { weekday: "long", day: "numeric", month: "long" });
}

/* abre un hilo nuevo cada día, sin borrar el historial anterior */
function ensureTodayThread() {
  const t = App.todayKey();
  if (App.state.chat.at(-1)?.d === t) return;
  const n = App.state.profile.nombre;
  const first = !App.state.chat.length;
  App.state.chat.push({
    role: "bot", d: t,
    text: first
      ? `¡Hola${n ? " " + n : ""}! 👋 Soy tu coach.\n\nPuedo registrar lo que comes y tu peso, calcular tus metas y recomendarte libros y videos verificados. ¿En qué te ayudo?`
      : `¡Buenos días${n ? " " + n : ""}! ☀️ Empezamos ${App.formatDate(t, { weekday: "long", day: "numeric", month: "long" })}.\n\nTu historial sigue aquí arriba, así que puedes preguntarme por días anteriores cuando quieras.`,
  });
  App.save();
}

function renderChat() {
  ensureTodayThread();
  const list = $("chatList");
  list.innerHTML = "";
  let prev = null;
  for (const m of App.state.chat) {
    if (m.d && m.d !== prev) {
      prev = m.d;
      const sep = document.createElement("div");
      sep.className = "chat-day";
      sep.textContent = chatDayLabel(m.d);
      list.appendChild(sep);
    }
    const d = document.createElement("div");
    d.className = m.role === "user" ? "msg msg-user" : m.role === "action" ? "msg-act" : "msg msg-bot";
    d.textContent = m.text;
    list.appendChild(d);
  }
  scrollChatToEnd();
}

function scrollChatToEnd() {
  const el = $("chatScroll");
  el.scrollTop = el.scrollHeight;
  requestAnimationFrame(() => (el.scrollTop = el.scrollHeight));
}

/* solo re-dibuja la vista visible: mantiene la app fluida */
function renderAll() {
  renderHoy();
  if ($("view-log").classList.contains("view-active")) renderLog();
}

/* ==========================================================
   Navegación, hojas y toast
   ========================================================== */
function switchView(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("view-active"));
  $("view-" + name).classList.add("view-active");
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("tab-active", t.dataset.view === name));
  if (name === "log") renderLog();
  if (name === "config") renderConfig();
  document.body.classList.toggle("chat-mode", name === "bot");
  if (name === "bot") { renderChat(); document.querySelector(".tab-glow").classList.remove("on"); }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function toast(msg) {
  const el = $("toast");
  el.textContent = msg; el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(() => (el.hidden = true), 2600);
}

function openSheet(html, onMount) {
  const box = $("sheetBox");
  box.innerHTML = `<div class="grabber"></div>${html}`;
  $("sheetBackdrop").hidden = false;
  document.body.style.overflow = "hidden";
  if (onMount) onMount(box);
}
function closeSheet() {
  $("sheetBackdrop").hidden = true;
  document.body.style.overflow = "";
}

/* ---------- hoja: comida ---------- */
function mealSheet(existing) {
  const m = existing || { name: "", kcal: "", protein: "", carbs: "", fat: "" };
  openSheet(`
    <div class="sh-head">
      <div class="sh-icon">${existing ? "✏️" : "🍽️"}</div>
      <div><div class="sh-title">${existing ? "Editar comida" : "Agregar comida"}</div>
      <div class="sh-sub">Ajusta calorías y macros a tu porción.</div></div>
    </div>
    <div class="sh-form">
      <label class="pbox wide"><span class="pbox-k">NOMBRE</span><input class="pbox-v" id="fmName" type="text" value="${esc(m.name)}" placeholder="Arroz con pollo"></label>
      <label class="pbox"><span class="pbox-k">CALORÍAS</span><input class="pbox-v" id="fmKcal" type="number" min="0" value="${m.kcal}" placeholder="0"></label>
      <label class="pbox"><span class="pbox-k">PROTEÍNA (G)</span><input class="pbox-v" id="fmProt" type="number" min="0" value="${m.protein}" placeholder="0"></label>
      <label class="pbox"><span class="pbox-k">CARBOS (G)</span><input class="pbox-v" id="fmCarb" type="number" min="0" value="${m.carbs}" placeholder="0"></label>
      <label class="pbox"><span class="pbox-k">GRASA (G)</span><input class="pbox-v" id="fmFat" type="number" min="0" value="${m.fat}" placeholder="0"></label>
    </div>
    <div class="sh-btns"><button class="sh-btn" id="fmCancel">Cancelar</button><button class="sh-btn primary" id="fmSave">${existing ? "GUARDAR" : "AGREGAR"}</button></div>`,
    (box) => {
      box.querySelector("#fmName").focus();
      box.querySelector("#fmCancel").onclick = closeSheet;
      box.querySelector("#fmSave").onclick = () => {
        const d = {
          name: box.querySelector("#fmName").value.trim() || "Comida",
          kcal: Math.max(0, +box.querySelector("#fmKcal").value || 0),
          protein: Math.max(0, +box.querySelector("#fmProt").value || 0),
          carbs: Math.max(0, +box.querySelector("#fmCarb").value || 0),
          fat: Math.max(0, +box.querySelector("#fmFat").value || 0),
        };
        if (existing) { App.updateMeal(existing.id, d); toast("Comida actualizada ✏️"); }
        else { App.addMeal(d); toast(`+${d.kcal} kcal registradas 🍽️`); }
        closeSheet();
      };
    });
}

/* ---------- hoja: peso ---------- */
function weightSheet() {
  const unit = App.state.units.weight, latest = App.latestWeight();
  const start = latest ? +App.kgToUnit(latest.kg).toFixed(1) : (unit === "lb" ? 165 : 75);
  const step = unit === "lb" ? 0.2 : 0.1;
  openSheet(`
    <div class="sh-head">
      <div class="sh-icon green">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 20V9l8-5 8 5v11" stroke="#16A34A" stroke-width="2" stroke-linejoin="round"/><path d="M8 20v-6h8v6" stroke="#16A34A" stroke-width="2" stroke-linejoin="round"/><path d="M9.5 11.5L12 9l2.5 2.5" stroke="#16A34A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <div><div class="sh-title">Registrar peso</div>
      <div class="sh-sub">${App.formatDate(App.state.currentDate, { weekday: "long", day: "numeric", month: "long" })}</div></div>
    </div>
    <div class="wstep">
      <button class="wstep-btn" id="wMinus">−</button>
      <span class="wbig"><input id="wVal" type="number" step="${step}" value="${start.toFixed(1)}" inputmode="decimal"><span>${unit}</span></span>
      <button class="wstep-btn plus" id="wPlus">+</button>
    </div>
    <div class="ruler">
      <div class="ruler-line"></div>
      <div class="ruler-ticks" id="wTicks"></div>
      <div class="ruler-needle"></div>
      <div class="ruler-lbls" id="wLbls"></div>
    </div>
    <div id="wLast"></div>
    <div class="sh-btns"><button class="sh-btn" id="wCancel">Cancelar</button><button class="sh-btn primary green" id="wSave">GUARDAR</button></div>`,
    (box) => {
      const input = box.querySelector("#wVal");
      const ticks = box.querySelector("#wTicks"), lbls = box.querySelector("#wLbls"), lastEl = box.querySelector("#wLast");
      ticks.innerHTML = Array.from({ length: 17 }, (_, i) => `<i style="height:${i % 4 === 0 ? 14 : 8}px;background:${i === 8 ? "#16A34A" : "#F0D9C0"}"></i>`).join("");

      const paint = () => {
        const v = +input.value || 0, s = unit === "lb" ? 0.8 : 0.4;
        lbls.innerHTML = [-2, -1, 0, 1, 2].map((k) =>
          `<span class="${k === 0 ? "cur" : ""}">${(v + k * s).toFixed(1)}</span>`).join("");
        if (latest) {
          const diff = App.kgToUnit(App.unitToKg(v) - latest.kg);
          const days = Math.round((new Date(App.state.currentDate) - new Date(latest.key)) / 86400000);
          lastEl.innerHTML = `<div class="last-rec"><span>último registro <b>${App.fmtWeight(latest.kg)}</b>${days > 0 ? ` · hace ${days} día${days === 1 ? "" : "s"}` : ""}</span>
            <span class="d" style="color:${diff <= 0 ? "#16A34A" : "#D97706"}">${diff <= 0 ? "▼" : "▲"} ${Math.abs(diff).toFixed(1)}</span></div>`;
        }
      };
      const bump = (d) => { input.value = (Math.max(1, (+input.value || 0) + d)).toFixed(1); paint(); };
      box.querySelector("#wMinus").onclick = () => bump(-step);
      box.querySelector("#wPlus").onclick = () => bump(step);
      input.oninput = paint;
      paint();

      box.querySelector("#wCancel").onclick = closeSheet;
      box.querySelector("#wSave").onclick = () => {
        const v = +input.value;
        if (!v || v <= 0) { toast("Ingresa un peso válido ⚠️"); return; }
        const kg = App.logWeight(App.unitToKg(v));
        toast(`Peso registrado: ${App.fmtWeight(kg)} ⚖️`);
        closeSheet();
      };
    });
}

/* ---------- hoja: comentario de la foto ---------- */
const PHOTO_CHIPS = ["porción grande", "porción pequeña", "sin salsa", "integral", "compartido", "con aceite"];
function photoSheet(file) {
  openSheet(`
    <div class="sh-head">
      <div class="sh-icon">🥗<div class="beam"></div></div>
      <div><div class="sh-title">¿Algo que deba saber?</div>
      <div class="sh-sub">Un comentario opcional afina el cálculo de macros.</div></div>
    </div>
    <textarea class="sh-ta" id="fpNote" placeholder="porción grande, sin salsa…"></textarea>
    <div class="sh-chips" id="fpChips">${PHOTO_CHIPS.map((c) => `<button class="sh-chip">${c}</button>`).join("")}</div>
    <div class="sh-btns">
      <button class="sh-btn" id="fpSkip">Omitir</button>
      <button class="sh-btn primary" id="fpGo">
        <svg width="15" height="15" viewBox="0 0 16 16"><path d="M8 0l1.8 6.2L16 8l-6.2 1.8L8 16l-1.8-6.2L0 8l6.2-1.8Z" fill="#fff"/></svg>ANALIZAR
      </button>
    </div>`,
    (box) => {
      const ta = box.querySelector("#fpNote");
      box.querySelector("#fpChips").onclick = (e) => {
        const b = e.target.closest(".sh-chip");
        if (!b) return;
        b.classList.toggle("on");
        const on = [...box.querySelectorAll(".sh-chip.on")].map((x) => x.textContent);
        ta.value = on.join(", ");
      };
      const go = () => { const n = ta.value.trim(); closeSheet(); runPhotoAnalysis(file, n); };
      box.querySelector("#fpSkip").onclick = () => { closeSheet(); runPhotoAnalysis(file, ""); };
      box.querySelector("#fpGo").onclick = go;
    });
}

/* ---------- hoja: API key ---------- */
function apiSheet() {
  openSheet(`
    <div class="sh-head">
      <div class="sh-icon">🔑</div>
      <div><div class="sh-title">Cerebro del bot</div>
      <div class="sh-sub">Pega tu API key de Anthropic para activar el análisis de fotos y el chat inteligente. Se guarda solo en este dispositivo.</div></div>
    </div>
    <label class="pbox"><span class="pbox-k">API KEY</span><input class="pbox-v" id="akIn" type="password" value="${esc(App.state.apiKey)}" placeholder="sk-ant-…"></label>
    <div class="sh-btns"><button class="sh-btn" id="akCancel">Cancelar</button><button class="sh-btn primary" id="akSave">GUARDAR</button></div>`,
    (box) => {
      box.querySelector("#akIn").focus();
      box.querySelector("#akCancel").onclick = closeSheet;
      box.querySelector("#akSave").onclick = () => {
        App.state.apiKey = box.querySelector("#akIn").value.trim();
        App.save(); renderConfig(); closeSheet();
        toast(App.state.apiKey ? "IA activada ✨" : "Modo local activo");
      };
    });
}

/* ==========================================================
   Bot / foto
   ========================================================== */
let botBusy = false;
function pushChat(role, text) {
  App.state.chat.push({ role, text, d: App.todayKey() });
  if (App.state.chat.length > 60) App.state.chat = App.state.chat.slice(-60);
  App.save(); renderChat();
}
function showTyping() {
  const d = document.createElement("div");
  d.className = "msg msg-bot"; d.id = "typingMsg";
  d.innerHTML = `<span class="typing"><i></i><i></i><i></i></span>`;
  $("chatList").appendChild(d);
  scrollChatToEnd();
}
const hideTyping = () => $("typingMsg")?.remove();

async function sendToBot(text) {
  if (botBusy || !text.trim()) return;
  botBusy = true;
  pushChat("user", text.trim());
  showTyping();
  try {
    if (App.state.apiKey) {
      const answer = await askClaude(text.trim(), (a) => { hideTyping(); pushChat("action", a); showTyping(); });
      hideTyping(); pushChat("bot", answer);
    } else {
      await new Promise((r) => setTimeout(r, 480 + Math.random() * 400));
      const { text: answer, actions } = localBot(text.trim());
      hideTyping();
      for (const a of actions) pushChat("action", a);
      pushChat("bot", answer);
    }
  } catch (err) {
    hideTyping();
    pushChat("bot", `⚠️ Ups: ${err.message}\n\nRevisa tu API key en Ajustes o inténtalo de nuevo.`);
  } finally { botBusy = false; }
}

function resizeImage(file, maxSide = 1024) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", .82).split(",")[1]);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function handlePhoto(file) {
  if (!App.state.apiKey) {
    toast("Agrega tu API key en Ajustes para analizar fotos 🤖");
    mealSheet();
    return;
  }
  photoSheet(file);
}

async function runPhotoAnalysis(file, note) {
  $("photoInner").hidden = true; $("photoBtns").hidden = true; $("photoLoading").hidden = false;
  try {
    const b64 = await resizeImage(file);
    const { text, actions } = await analyzeFoodPhoto(b64, note);
    for (const a of actions) pushChat("action", a);
    if (text) pushChat("bot", text);
    if (actions.length) { toast("¡Comida registrada desde la foto! 📸"); document.querySelector(".tab-glow").classList.add("on"); }
    else { toast(text ? "El bot respondió en el chat 🤖" : "No pude identificar comida 😅"); if (text) document.querySelector(".tab-glow").classList.add("on"); }
  } catch (err) {
    toast(`⚠️ ${err.message}`);
  } finally {
    $("photoInner").hidden = false; $("photoBtns").hidden = false; $("photoLoading").hidden = true;
    $("photoInputCam").value = ""; $("photoInputGal").value = "";
  }
}

/* ==========================================================
   Eventos
   ========================================================== */
function bindEvents() {
  document.querySelectorAll(".tab").forEach((t) => t.onclick = () => switchView(t.dataset.view));

  $("prevDay").onclick = () => App.setDate(App.shiftKey(App.state.currentDate, -1));
  $("nextDay").onclick = () => App.setDate(App.shiftKey(App.state.currentDate, 1));
  $("dateInput").onchange = (e) => e.target.value && App.setDate(e.target.value);
  $("datePill").onclick = () => { try { $("dateInput").showPicker(); } catch {} };

  $("heroSwitch").onclick = () => {
    const order = ["auto", ...HERO_MODES];
    App.state.heroStyle = order[(order.indexOf(App.state.heroStyle) + 1) % order.length];
    App.save();
    $("heroStage").dataset.mode = "";
    renderHoy();
    toast(`Estilo: ${HERO_NAMES[App.state.heroStyle]}${App.state.heroStyle === "auto" ? " (rota cada día)" : ""}`);
  };

  $("macrosRow").onclick = (e) => {
    const k = e.target.closest(".macro")?.dataset.macro;
    if (!k) return;
    switchView("config");
    setTimeout(() => $("gv-" + k)?.closest(".goal-row")?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
  };

  $("logWeightBtn").onclick = weightSheet;
  $("addMealBtn").onclick = () => mealSheet();
  $("mealList").onclick = (e) => {
    const ed = e.target.closest("[data-edit]")?.dataset.edit;
    const dl = e.target.closest("[data-del]")?.dataset.del;
    if (ed) { const m = App.currentDay().meals.find((x) => x.id === +ed); if (m) mealSheet(m); }
    if (dl) {
      const li = e.target.closest(".meal");
      li.classList.add("removing");
      setTimeout(() => { App.deleteMealById(+dl); toast("Comida eliminada 🗑️"); }, 220);
    }
  };

  $("btnCam").onclick = (e) => { e.stopPropagation(); $("photoInputCam").click(); };
  $("btnGal").onclick = (e) => { e.stopPropagation(); $("photoInputGal").click(); };
  $("photoInputCam").onchange = (e) => e.target.files[0] && handlePhoto(e.target.files[0]);
  $("photoInputGal").onchange = (e) => e.target.files[0] && handlePhoto(e.target.files[0]);

  $("chatForm").onsubmit = (e) => { e.preventDefault(); sendToBot($("chatText").value); $("chatText").value = ""; };
  $("chatChips").onclick = (e) => { const q = e.target.closest(".chip")?.dataset.q; if (q) sendToBot(q); };

  $("segChart").onclick = (e) => { const m = e.target.closest(".pill")?.dataset.m; if (m) { chartMetric = m; renderLog(); } };

  $("segWeight").onclick = (e) => {
    const u = e.target.closest(".seg-btn")?.dataset.u; if (!u) return;
    App.state.units.weight = u; App.save(); renderConfig(); renderHoy(); renderLog();
    toast(`Peso en ${u}`);
  };
  $("segHeight").onclick = (e) => {
    const u = e.target.closest(".seg-btn")?.dataset.u; if (!u) return;
    App.state.units.height = u; App.save(); renderConfig();
    toast(`Altura en ${u === "cm" ? "centímetros" : "pies y pulgadas"}`);
  };
  $("segObjetivo").onclick = (e) => {
    const o = e.target.closest(".seg-btn")?.dataset.o; if (!o) return;
    App.state.profile.objetivo = o; App.save(); renderConfig();
  };

  const bind = (id, obj, key, cb) => $(id).onchange = (e) => {
    obj[key] = e.target.type === "number" ? +e.target.value || "" : e.target.value;
    App.save(); if (cb) cb(); renderAll();
  };
  bind("pNombre", App.state.profile, "nombre");
  bind("pEdad", App.state.profile, "edad", renderTdee);
  bind("pSexo", App.state.profile, "sexo", renderTdee);
  bind("pActividad", App.state.profile, "actividad", renderTdee);
  bind("pRitmo", App.state.profile, "ritmo", renderTdee);

  $("pPeso").onchange = (e) => {
    const v = +e.target.value;
    App.state.profile.peso = v ? Math.round(App.unitToKg(v) * 10) / 10 : "";
    App.save(); renderTdee(); renderAll();
  };
  $("pAltura").onchange = (e) => { App.state.profile.altura = +e.target.value || ""; App.save(); renderTdee(); };
  const ft = () => {
    const f = +$("pAlturaFt").value || 0, i = +$("pAlturaIn").value || 0;
    App.state.profile.altura = (f || i) ? Math.round((f * 12 + i) * 2.54) : "";
    App.save(); renderTdee();
  };
  $("pAlturaFt").onchange = ft; $("pAlturaIn").onchange = ft;

  $("goalRows").onclick = (e) => {
    const b = e.target.closest(".step"); if (!b) return;
    const k = b.dataset.g, v = Math.max(1, App.state.goals[k] + +b.dataset.d);
    App.state.goals[k] = v;
    $("gv-" + k).textContent = v;
    App.save(); renderAll();
  };

  $("calcMacrosBtn").onclick = () => {
    const m = App.applyMacros();
    if (!m) { toast("Completa peso, altura y edad ⚠️"); return; }
    renderConfig();
    toast(`Metas: ${m.kcal} kcal · ${m.protein}P · ${m.carbs}C · ${m.fat}G ⚡`);
  };

  $("apiRow").onclick = apiSheet;

  $("exportBtn").onclick = () => {
    const blob = new Blob([JSON.stringify({ ...App.state, apiKey: "" }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `jimmiteobot-${App.todayKey()}.json`; a.click();
    URL.revokeObjectURL(a.href);
    toast("Datos exportados 💾");
  };
  $("importBtn").onclick = () => $("importInput").click();
  $("importInput").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data.goals || !data.days) throw new Error("archivo no válido");
      const key = App.state.apiKey;
      App.state = { ...structuredClone(DEFAULT_STATE), ...data, apiKey: key };
      App.save(); renderAll(); renderConfig(); renderChat();
      toast("Datos importados ✅");
    } catch { toast("⚠️ No pude leer ese archivo"); }
    e.target.value = "";
  };
  $("resetBtn").onclick = () => {
    openSheet(`
      <div class="sh-head"><div class="sh-icon">⚠️</div>
      <div><div class="sh-title">Borrar todos los datos</div>
      <div class="sh-sub">Se eliminarán comidas, pesos, metas y el chat de este dispositivo. No se puede deshacer.</div></div></div>
      <div class="sh-btns"><button class="sh-btn" id="rCancel">Cancelar</button>
      <button class="sh-btn primary" id="rOk" style="background:linear-gradient(90deg,#F43F5E,#E11D48);animation:none">BORRAR TODO</button></div>`,
      (box) => {
        box.querySelector("#rCancel").onclick = closeSheet;
        box.querySelector("#rOk").onclick = () => {
          localStorage.removeItem(STORE_KEY);
          App.load(); renderAll(); renderConfig(); renderChat(); closeSheet();
          toast("Todo borrado. Empezamos de cero 🌱");
        };
      });
  };

  $("sheetBackdrop").onclick = (e) => { if (e.target === $("sheetBackdrop")) closeSheet(); };
  // addEventListener: con document.onkeydown, devolver false cancela la tecla
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });
}

/* burbujitas del fondo */
function initBubbles() {
  const wrap = $("bubbles");
  if (!wrap || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (let i = 0; i < 7; i++) {
    const b = document.createElement("div");
    b.className = "bub";
    const s = 6 + Math.random() * 12;
    b.style.width = b.style.height = s + "px";
    b.style.left = Math.random() * 100 + "%";
    b.style.animationDuration = 12 + Math.random() * 10 + "s";
    b.style.animationDelay = -Math.random() * 18 + "s";
    wrap.appendChild(b);
  }
}

App.load();
bindEvents();
renderAll();
renderApiStatus();
initBubbles();
