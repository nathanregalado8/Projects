/* ==========================================================
   JIMMITEOBOT — app principal: estado, UI y animaciones
   ========================================================== */

const STORE_KEY = "jimmiteobot_v2";
const $ = (id) => document.getElementById(id);

/* ---------- Estado ---------- */
const DEFAULT_STATE = {
  profile: { nombre: "", peso: "", altura: "", edad: "", sexo: "m", actividad: "1.375", objetivo: "maintain" },
  goals: { kcal: 2200, protein: 140, carbs: 220, fat: 70 },
  days: {},
  weights: {},            // { 'YYYY-MM-DD': kg }
  units: { weight: "kg", height: "cm" },
  heroStyle: "auto",      // auto | liquid | battery | hero
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
    this.state.weights ||= {};
    this.state.units ||= { weight: "kg", height: "cm" };
    this.state.heroStyle ||= "auto";
  },
  save() {
    localStorage.setItem(STORE_KEY, JSON.stringify(this.state));
  },

  currentDay() {
    const key = this.state.currentDate;
    if (!this.state.days[key]) this.state.days[key] = { meals: [] };
    return this.state.days[key];
  },
  dayTotals(key = this.state.currentDate) {
    const day = this.state.days[key] || { meals: [] };
    return day.meals.reduce(
      (acc, m) => ({ kcal: acc.kcal + m.kcal, protein: acc.protein + m.protein, carbs: acc.carbs + m.carbs, fat: acc.fat + m.fat }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    );
  },

  /* --- unidades --- */
  kgToUnit(kg) { return this.state.units.weight === "lb" ? kg * 2.20462 : kg; },
  unitToKg(v) { return this.state.units.weight === "lb" ? v / 2.20462 : v; },
  fmtWeight(kg, decimals = 1) {
    return `${(+this.kgToUnit(kg)).toFixed(decimals)} ${this.state.units.weight}`;
  },

  /* --- acciones (usadas por la UI y por el bot) --- */
  addMeal(meal) {
    const entry = { id: Date.now() + Math.random(), time: new Date().toTimeString().slice(0, 5), ...meal };
    this.currentDay().meals.push(entry);
    this.save();
    renderAll();
    sparkBurst();
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
  logWeight(kg, key = this.state.currentDate) {
    kg = Math.round(kg * 10) / 10;
    this.state.weights[key] = kg;
    this.state.profile.peso = kg; // mantiene el cálculo de macros al día
    this.save();
    renderAll();
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
    return all.length ? { key: all[all.length - 1][0], kg: all[all.length - 1][1] } : null;
  },
  streak() {
    let n = 0;
    let key = this.todayKey();
    const has = (k) => (this.state.days[k]?.meals?.length || 0) > 0;
    if (!has(key)) key = this.shiftKey(key, -1); // el día en curso aún no rompe la racha
    while (has(key)) { n++; key = this.shiftKey(key, -1); }
    return n;
  },

  /* Gasto energético (Mifflin-St Jeor) + macros según objetivo.
     Proteína en el rango ISSN 1.6–2.2 g/kg; grasa 25% kcal; carbos el resto. */
  computeMacros() {
    const { peso, altura, edad, sexo, actividad, objetivo } = this.state.profile;
    if (!peso || !altura || !edad) return null;
    const bmr = 10 * peso + 6.25 * altura - 5 * edad + (sexo === "m" ? 5 : -161);
    const tdee = Math.round(bmr * +actividad);
    const factor = objetivo === "cut" ? 0.8 : objetivo === "bulk" ? 1.1 : 1;
    const gkg = objetivo === "cut" ? 2.0 : 1.8;
    const kcal = Math.round((tdee * factor) / 10) * 10;
    const protein = Math.round((peso * gkg) / 5) * 5;
    const fat = Math.round((kcal * 0.25) / 9 / 5) * 5;
    const carbs = Math.max(20, Math.round((kcal - protein * 4 - fat * 9) / 4 / 5) * 5);
    return { tdee, kcal, protein, carbs, fat };
  },
  applyMacros() {
    const m = this.computeMacros();
    if (!m) return null;
    Object.assign(this.state.goals, { kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat });
    this.save();
    renderAll();
    return m;
  },
};

/* ==========================================================
   UI — render
   ========================================================== */
function animateNumber(el, to) {
  const from = +el.dataset.val || 0;
  if (from === to) { el.textContent = to; return; }
  el.dataset.val = to;
  const start = performance.now();
  const dur = 800;
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

/* ---------- héroe de calorías (10 estilos) ---------- */
const HERO_MODES = ["liquid", "battery", "hero", "tower", "percent", "eq", "thermo", "pixels", "tube", "balance"];
const HERO_NAMES = {
  auto: "auto", liquid: "líquido", battery: "energía", hero: "número", tower: "torre",
  percent: "%", eq: "ecualizador", thermo: "termo", pixels: "píxeles", tube: "tubo", balance: "balance",
};

function activeHeroMode() {
  const pref = App.state.heroStyle;
  if (pref !== "auto") return pref;
  const dayN = Math.floor(new Date(App.state.currentDate + "T12:00:00").getTime() / 86400000);
  return HERO_MODES[dayN % HERO_MODES.length]; // rota día a día
}

const WAVE_PATH = "M0,12 C10,4 20,4 30,12 C40,20 50,20 60,12 C70,4 80,4 90,12 C100,20 110,20 120,12 L120,26 L0,26 Z";

function renderHero(t, g) {
  const stage = $("heroStage");
  const mode = activeHeroMode();
  const pct = Math.min(1, t.kcal / g.kcal);
  const over = t.kcal > g.kcal;

  if (stage.dataset.mode !== mode) {
    stage.dataset.mode = mode;
    if (mode === "liquid") {
      stage.innerHTML = `
        <div class="liquid-wrap">
          <div class="liquid-water" id="lqWater">
            <svg class="liquid-wave" viewBox="0 0 120 26" preserveAspectRatio="none"><path d="${WAVE_PATH}"/></svg>
            <svg class="liquid-wave w2" viewBox="0 0 120 26" preserveAspectRatio="none"><path d="${WAVE_PATH}"/></svg>
          </div>
          <div class="liquid-kcal"><span id="heroKcal">0</span><small id="heroLbl">KCAL RESTANTES</small></div>
        </div>`;
    } else if (mode === "battery") {
      stage.innerHTML = `
        <div class="batt-wrap">
          <div class="batt-num"><span id="heroKcal">0</span></div>
          <div class="hero-kcal-lbl" id="heroLbl">kcal restantes</div>
          <div class="batt" id="battRow">${'<div class="batt-cell"></div>'.repeat(12)}</div>
        </div>`;
    } else if (mode === "hero") {
      stage.innerHTML = `
        <div class="hero-num-wrap">
          <div class="hero-kcal" id="heroKcal">0</div>
          <div class="hero-kcal-lbl" id="heroLbl">kcal restantes</div>
          <div class="hero-bar"><div class="hero-bar-fill" id="heroBarFill"></div></div>
        </div>`;
    } else if (mode === "tower") {
      stage.innerHTML = `
        <div class="tower-wrap">
          <div class="tower" id="towerCol">${'<div class="tower-blk"></div>'.repeat(10)}</div>
          <div><div class="batt-num"><span id="heroKcal">0</span></div><div class="hero-kcal-lbl" id="heroLbl">kcal restantes</div></div>
        </div>`;
    } else if (mode === "percent") {
      stage.innerHTML = `
        <div class="hero-num-wrap">
          <div class="hero-kcal"><span id="pctNum">0</span><span class="pct-sign">%</span></div>
          <div class="hero-kcal-lbl">de tu meta diaria</div>
          <div class="hero-kcal-lbl" style="margin-top:4px"><b id="heroKcal" style="color:var(--ink)">0</b> <span id="heroLbl">kcal restantes</span></div>
        </div>`;
    } else if (mode === "eq") {
      stage.innerHTML = `
        <div class="batt-wrap">
          <div class="batt-num"><span id="heroKcal">0</span></div>
          <div class="hero-kcal-lbl" id="heroLbl">kcal restantes</div>
          <div class="eq" id="eqRow">${[38, 62, 50, 80, 58, 92, 66, 84, 48, 72, 56, 40].map((h) => `<div class="eq-bar" style="--h:${h}px"></div>`).join("")}</div>
        </div>`;
    } else if (mode === "thermo") {
      stage.innerHTML = `
        <div class="tower-wrap">
          <div class="thermo"><div class="thermo-fill" id="thermoFill"></div><div class="thermo-bulb"></div></div>
          <div><div class="batt-num"><span id="heroKcal">0</span></div><div class="hero-kcal-lbl" id="heroLbl">kcal restantes</div></div>
        </div>`;
    } else if (mode === "pixels") {
      stage.innerHTML = `
        <div class="batt-wrap">
          <div class="batt-num"><span id="heroKcal">0</span></div>
          <div class="hero-kcal-lbl" id="heroLbl">kcal restantes</div>
          <div class="pix" id="pixGrid">${'<div class="pix-dot"></div>'.repeat(60)}</div>
        </div>`;
    } else if (mode === "tube") {
      stage.innerHTML = `
        <div class="batt-wrap">
          <div class="batt-num"><span id="heroKcal">0</span></div>
          <div class="hero-kcal-lbl" id="heroLbl">kcal restantes</div>
          <div class="tube"><div class="tube-fill" id="tubeFill"></div></div>
        </div>`;
    } else {
      stage.innerHTML = `
        <div class="bal-wrap">
          <div class="bal-nums">
            <div><b id="balEat">0</b><span>llevas</span></div>
            <div><b id="heroKcal">0</b><span id="heroLbl">restantes</span></div>
          </div>
          <div class="bal-bar"><div class="bal-fill" id="balFill"></div></div>
        </div>`;
    }
  }

  // como en el diseño: el número protagonista son las kcal RESTANTES
  const restKcal = g.kcal - t.kcal;
  animateNumber($("heroKcal"), Math.abs(restKcal));
  const lbl = $("heroLbl");
  const lblText = restKcal >= 0 ? "kcal restantes" : "kcal de más";
  lbl.textContent = mode === "liquid" ? lblText.toUpperCase() : lblText;
  lbl.classList.toggle("over", restKcal < 0);
  $("heroModeLabel").textContent = HERO_NAMES[App.state.heroStyle];

  if (mode === "liquid") {
    const water = $("lqWater");
    water.style.height = Math.max(0, pct * 100) + "%";
    water.classList.toggle("over", over);
    water.querySelectorAll(".liquid-wave path").forEach((p) => p.style.fill = over ? "#F43F5E" : "#FF8A00");
  } else if (mode === "battery") {
    const cells = $("battRow").children;
    const on = Math.round(pct * cells.length);
    [...cells].forEach((c, i) => {
      setTimeout(() => {
        c.classList.toggle("on", i < on);
        c.classList.toggle("hot", over);
      }, i * 45);
    });
  } else if (mode === "hero") {
    const fill = $("heroBarFill");
    fill.style.width = pct * 100 + "%";
    fill.classList.toggle("over", over);
  } else if (mode === "tower") {
    [...$("towerCol").children].forEach((b, i) =>
      setTimeout(() => { b.classList.toggle("on", i < Math.round(pct * 10)); b.classList.toggle("hot", over); }, i * 50));
  } else if (mode === "percent") {
    animateNumber($("pctNum"), Math.round(pct * 100));
  } else if (mode === "eq") {
    [...$("eqRow").children].forEach((b, i) =>
      setTimeout(() => { b.classList.toggle("on", i < Math.round(pct * 12)); b.classList.toggle("hot", over); }, i * 45));
  } else if (mode === "thermo") {
    const f = $("thermoFill");
    f.style.height = Math.min(100, pct * 100) + "%";
    f.classList.toggle("over", over);
  } else if (mode === "pixels") {
    [...$("pixGrid").children].forEach((d, i) =>
      setTimeout(() => { d.classList.toggle("on", i < Math.round(pct * 60)); d.classList.toggle("hot", over); }, i * 12));
  } else if (mode === "tube") {
    const f = $("tubeFill");
    f.style.width = Math.min(100, pct * 100) + "%";
    f.classList.toggle("over", over);
  } else if (mode === "balance") {
    animateNumber($("balEat"), t.kcal);
    const f = $("balFill");
    f.style.width = Math.min(100, pct * 100) + "%";
    f.classList.toggle("over", over);
  }
}

/* chispas al registrar comida */
function sparkBurst() {
  const card = $("heroCard");
  if (!card || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const burst = document.createElement("div");
  burst.className = "spark-burst";
  burst.style.left = "50%";
  burst.style.top = "40%";
  const colors = ["#FF5A3C", "#FF8A00", "#84CC16", "#7C3AED", "#FFC53C"];
  for (let i = 0; i < 16; i++) {
    const p = document.createElement("div");
    p.className = "spark-p";
    const ang = (Math.PI * 2 * i) / 16 + Math.random() * 0.5;
    const dist = 60 + Math.random() * 70;
    p.style.setProperty("--dx", Math.cos(ang) * dist + "px");
    p.style.setProperty("--dy", Math.sin(ang) * dist - 20 + "px");
    p.style.background = colors[i % colors.length];
    burst.appendChild(p);
  }
  card.appendChild(burst);
  setTimeout(() => burst.remove(), 950);
}

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

  // racha
  const st = App.streak();
  $("streakChip").hidden = st < 2;
  $("streakDays").textContent = st;

  // héroe
  renderHero(t, g);
  $("editKcalGoal").textContent = g.kcal;
  const restEl = $("heroRest");
  restEl.textContent = `llevas ${t.kcal} kcal`;
  restEl.classList.toggle("over", t.kcal > g.kcal);

  // macros — su barrita sigue la temática del héroe del día (versión mini)
  const heroMode = activeHeroMode();
  const grp = ["battery", "tower", "eq", "pixels"].includes(heroMode) ? "seg"
    : ["liquid", "tube", "thermo"].includes(heroMode) ? "liq" : "bar";
  const macroMap = [["Protein", t.protein, g.protein], ["Carbs", t.carbs, g.carbs], ["Fat", t.fat, g.fat]];
  for (const [key, val, goal] of macroMap) {
    animateNumber($("m" + key), val);
    $("g" + key).textContent = goal;
    const pctM = Math.min(100, (val / goal) * 100);
    const color = { Protein: "#7c3aed", Carbs: "#d97706", Fat: "#e11d48" }[key];
    // el track se busca por la tarjeta (estable aunque cambie su contenido)
    const track = document.querySelector(`.macro[data-macro="${key.toLowerCase()}"] .macro-bar`);
    if (track.dataset.grp !== grp) {
      track.dataset.grp = grp;
      track.className = "macro-bar" + (grp === "bar" ? "" : " " + grp);
      track.innerHTML = grp === "seg"
        ? Array.from({ length: 6 }, () => `<i style="--c:${color}"></i>`).join("")
        : `<div class="macro-fill${grp === "liq" ? " liq" : ""}" style="--c:${color}; width:0%"></div>`;
    }
    if (grp === "seg") {
      const on = Math.round((pctM / 100) * 6);
      [...track.children].forEach((c, i) => setTimeout(() => c.classList.toggle("on", i < on), i * 60));
    } else {
      requestAnimationFrame(() => (track.firstElementChild.style.width = pctM + "%"));
    }
  }

  // peso
  renderWeightCard();

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
        <div class="meal-macros"><i>P ${m.protein}g</i><i>C ${m.carbs}g</i><i>G ${m.fat}g</i>${m.time ? `<i>${m.time}</i>` : ""}</div>
        <div class="meal-bars">
          <b><i style="--c:#7c3aed; width:${Math.min(100, (m.protein / g.protein) * 100)}%"></i></b>
          <b><i style="--c:#d97706; width:${Math.min(100, (m.carbs / g.carbs) * 100)}%"></i></b>
          <b><i style="--c:#e11d48; width:${Math.min(100, (m.fat / g.fat) * 100)}%"></i></b>
        </div>
      </div>
      <div class="meal-kcal">${m.kcal}<small> kcal</small></div>
      <div class="meal-actions">
        <button data-edit="${m.id}" title="Editar">✏️</button>
        <button data-del="${m.id}" title="Eliminar">🗑️</button>
      </div>`;
    list.appendChild(li);
  });
}

/* ---------- peso: tarjeta compacta + sparkline ---------- */
function renderWeightCard() {
  const latest = App.latestWeight();
  const unit = App.state.units.weight;
  $("weightUnit").textContent = " " + unit;
  if (!latest) {
    $("weightNow").textContent = "—";
    $("weightTrend").textContent = "registra tu primer peso";
    $("weightTrend").className = "weight-trend flat";
    $("weightSpark").innerHTML = "";
    return;
  }
  $("weightNow").textContent = App.kgToUnit(latest.kg).toFixed(1);

  // tendencia vs ~7 días antes del último registro
  const series = App.weightSeries(60);
  const weekAgoKey = App.shiftKey(latest.key, -6);
  const prev = [...series].reverse().find((p) => p.key <= weekAgoKey);
  const trendEl = $("weightTrend");
  if (prev) {
    const diff = App.kgToUnit(latest.kg - prev.kg);
    const abs = Math.abs(diff).toFixed(1);
    if (Math.abs(diff) < 0.05) { trendEl.textContent = "estable esta semana"; trendEl.className = "weight-trend flat"; }
    else if (diff < 0) { trendEl.textContent = `▼ ${abs} ${unit} esta semana`; trendEl.className = "weight-trend down"; }
    else { trendEl.textContent = `▲ ${abs} ${unit} esta semana`; trendEl.className = "weight-trend up"; }
  } else {
    trendEl.textContent = App.formatDate(latest.key);
    trendEl.className = "weight-trend flat";
  }

  // sparkline (últimos 14 registros)
  const pts = series.slice(-14);
  const svg = $("weightSpark");
  if (pts.length < 2) { svg.innerHTML = ""; return; }
  const kgs = pts.map((p) => p.kg);
  const min = Math.min(...kgs), max = Math.max(...kgs);
  const pad = (max - min) < 0.5 ? 0.5 : (max - min) * 0.15;
  const y = (v) => 40 - ((v - (min - pad)) / ((max + pad) - (min - pad))) * 36;
  const x = (i) => (i / (pts.length - 1)) * 116 + 2;
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.kg).toFixed(1)}`).join(" ");
  svg.innerHTML = `
    <defs><linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#16a34a"/><stop offset="100%" stop-color="#16a34a" stop-opacity="0"/>
    </linearGradient></defs>
    <path class="spark-area" d="${line} L${x(pts.length - 1).toFixed(1)},44 L2,44 Z"/>
    <path d="${line}"/>
    <circle cx="${x(pts.length - 1).toFixed(1)}" cy="${y(pts[pts.length - 1].kg).toFixed(1)}" r="3"/>`;
}

/* ---------- peso: gráfica grande (Log) ---------- */
function renderWeightChart() {
  const svg = $("weightChart");
  const series = App.weightSeries(42); // ~6 semanas
  const empty = $("weightEmpty");
  const unit = App.state.units.weight;

  if (!series.length) {
    svg.innerHTML = "";
    svg.style.display = "none";
    empty.style.display = "block";
    $("weightRange").textContent = "";
    return;
  }
  svg.style.display = "block";
  empty.style.display = "none";

  // un solo registro: muestra el punto con su valor
  if (series.length === 1) {
    const p0 = series[0];
    svg.innerHTML = `
      <circle class="w-dot w-dot-end" cx="170" cy="75" r="6"><title>${App.formatDate(p0.key)}: ${App.fmtWeight(p0.kg)}</title></circle>
      <text class="val-lbl" x="170" y="58" text-anchor="middle">${App.kgToUnit(p0.kg).toFixed(1)} ${unit}</text>
      <text class="axis-lbl" x="170" y="100" text-anchor="middle">${App.formatDate(p0.key)} · registra más días para ver tu línea</text>`;
    $("weightRange").textContent = "primer registro ✓";
    return;
  }

  const W = 340, H = 150, L = 8, R = 34, T = 14, B = 22;
  const kgs = series.map((p) => p.kg);
  const min = Math.min(...kgs), max = Math.max(...kgs);
  const pad = (max - min) < 1 ? 0.8 : (max - min) * 0.18;
  const lo = min - pad, hi = max + pad;
  const t0 = new Date(series[0].key + "T12:00:00").getTime();
  const t1 = new Date(series[series.length - 1].key + "T12:00:00").getTime();
  const x = (k) => {
    const t = new Date(k + "T12:00:00").getTime();
    return t1 === t0 ? L : L + ((t - t0) / (t1 - t0)) * (W - L - R);
  };
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);

  const line = series.map((p, i) => `${i ? "L" : "M"}${x(p.key).toFixed(1)},${y(p.kg).toFixed(1)}`).join(" ");
  const gridVals = [lo + (hi - lo) * 0.25, lo + (hi - lo) * 0.75];
  const dots = series.map((p, i) => {
    const last = i === series.length - 1;
    return `<circle class="w-dot ${last ? "w-dot-end" : ""}" cx="${x(p.key).toFixed(1)}" cy="${y(p.kg).toFixed(1)}" r="${last ? 5 : 3.5}">
      <title>${App.formatDate(p.key)}: ${App.fmtWeight(p.kg)}</title></circle>`;
  }).join("");

  // etiquetas de fecha: inicio, medio, fin
  const mid = series[Math.floor(series.length / 2)];
  const xLbls = [[series[0], "start"], [mid, "middle"], [series[series.length - 1], "end"]]
    .map(([p, anchor]) => `<text class="axis-lbl" x="${x(p.key).toFixed(1)}" y="${H - 6}" text-anchor="${anchor}">${App.formatDate(p.key, { day: "numeric", month: "short" })}</text>`)
    .join("");

  const lastP = series[series.length - 1];
  svg.innerHTML = `
    <defs><linearGradient id="wAreaGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#16a34a" stop-opacity="0.35"/><stop offset="100%" stop-color="#16a34a" stop-opacity="0"/>
    </linearGradient></defs>
    ${gridVals.map((v) => `<line class="grid-line" x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>`).join("")}
    <path class="w-area" fill="url(#wAreaGrad)" d="${line} L${x(lastP.key).toFixed(1)},${H - B} L${L},${H - B} Z"/>
    <path class="w-line" d="${line}"/>
    ${dots}
    <text class="val-lbl" x="${x(lastP.key).toFixed(1)}" y="${Math.max(12, y(lastP.kg) - 11).toFixed(1)}" text-anchor="end">${App.kgToUnit(lastP.kg).toFixed(1)}</text>
    ${xLbls}`;

  const first = series[0];
  const diff = App.kgToUnit(lastP.kg - first.kg);
  $("weightRange").textContent = `${diff <= 0 ? "▼" : "▲"} ${Math.abs(diff).toFixed(1)} ${unit} en ${series.length} registros`;
}

/* métrica activa de la gráfica semanal (kcal o macros, cada una con su meta) */
let chartMetric = "kcal";
const METRICS = {
  kcal: { name: "Calorías", color: "#EA580C", unit: "kcal" },
  protein: { name: "Proteína", color: "#7C3AED", unit: "g" },
  carbs: { name: "Carbos", color: "#D97706", unit: "g" },
  fat: { name: "Grasa", color: "#E11D48", unit: "g" },
};

function renderLog() {
  const g = App.state.goals;
  renderWeightChart();

  // gráfica de 7 días de la métrica elegida
  const m = METRICS[chartMetric];
  const goal = g[chartMetric];
  $("weekTitle").textContent = `${m.name} · últimos 7 días`;
  document.querySelectorAll("#segChart button").forEach((b) => b.classList.toggle("seg-on", b.dataset.m === chartMetric));

  const end = App.todayKey();
  const keys = Array.from({ length: 7 }, (_, i) => App.shiftKey(end, i - 6));
  const totals = keys.map((k) => App.dayTotals(k)[chartMetric]);
  const max = Math.max(goal * 1.15, ...totals, 1);

  const chart = $("weekChart");
  chart.style.setProperty("--barc", m.color);
  chart.innerHTML = "";
  const goalLine = document.createElement("div");
  goalLine.className = "goal-line";
  // la zona de barras ocupa el alto del chart menos la etiqueta del día (~30px)
  goalLine.style.bottom = `${22 + (goal / max) * (150 - 30)}px`;
  chart.appendChild(goalLine);

  keys.forEach((k, i) => {
    const bar = document.createElement("div");
    bar.className = "wbar" + (k === App.todayKey() ? " today" : "");
    const h = (totals[i] / max) * (150 - 30);
    bar.innerHTML = `
      <span class="wbar-val">${totals[i]}</span>
      <div class="wbar-fill" style="height:${Math.max(2, h)}px; animation-delay:${i * 70}ms"></div>
      <span class="wbar-day">${App.formatDate(k, { weekday: "short" }).slice(0, 3)}</span>`;
    bar.title = `${App.formatDate(k)}: ${totals[i]} ${m.unit} (meta ${goal})`;
    bar.addEventListener("click", () => { App.setDate(k); switchView("hoy"); });
    chart.appendChild(bar);
  });

  // lista de días con registros
  const entries = Object.entries(App.state.days)
    .filter(([, d]) => d.meals.length)
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
      <span class="log-meta">${day.meals.length} comida${day.meals.length === 1 ? "" : "s"}${App.state.weights[key] ? ` · ⚖ ${App.fmtWeight(App.state.weights[key])}` : ""}</span>
      <span class="log-kcal">${tot.kcal} kcal</span>`;
    btn.addEventListener("click", () => { App.setDate(key); switchView("hoy"); });
    li.appendChild(btn);
    list.appendChild(li);
  }
}

function renderConfig() {
  const { profile: p, goals: g, units: u } = App.state;
  $("pNombre").value = p.nombre; $("pObjetivo").value = p.objetivo || "maintain";
  $("pEdad").value = p.edad; $("pSexo").value = p.sexo; $("pActividad").value = p.actividad;
  $("gKcalIn").value = g.kcal; $("gProteinIn").value = g.protein; $("gCarbsIn").value = g.carbs;
  $("gFatIn").value = g.fat;
  $("apiKeyIn").value = App.state.apiKey;

  // unidades
  document.querySelectorAll("#segWeight button").forEach((b) => b.classList.toggle("seg-on", b.dataset.u === u.weight));
  document.querySelectorAll("#segHeight button").forEach((b) => b.classList.toggle("seg-on", b.dataset.u === u.height));
  document.querySelectorAll(".wUnitLbl").forEach((el) => (el.textContent = u.weight));

  // peso mostrado en la unidad elegida
  $("pPeso").value = p.peso ? App.kgToUnit(p.peso).toFixed(1) : "";

  // altura: cm o ft/in
  $("alturaCmWrap").hidden = u.height !== "cm";
  $("alturaFtWrap").hidden = u.height !== "ft";
  if (u.height === "cm") {
    $("pAltura").value = p.altura || "";
  } else if (p.altura) {
    const totalIn = p.altura / 2.54;
    $("pAlturaFt").value = Math.floor(totalIn / 12);
    $("pAlturaIn").value = Math.round(totalIn % 12);
  } else {
    $("pAlturaFt").value = ""; $("pAlturaIn").value = "";
  }

  renderTdee();
  renderApiStatus();
}

function renderTdee() {
  const m = App.computeMacros();
  $("tdeeHint").textContent = m
    ? `Tu gasto estimado (Mifflin-St Jeor) es ~${m.tdee} kcal/día. Sugerencia para tu objetivo: ${m.kcal} kcal · P ${m.protein}g · C ${m.carbs}g · G ${m.fat}g.`
    : "Completa peso, altura y edad para calcular tus macros.";
}

function renderApiStatus() {
  const el = $("apiStatus");
  const has = !!App.state.apiKey;
  el.textContent = has ? "✅ IA activada: chat inteligente y análisis de fotos disponibles." : "🔌 Modo local activo: comandos básicos sin conexión.";
  el.classList.toggle("ok", has);
}

function renderChat() {
  const list = $("chatList");
  list.innerHTML = "";
  if (!App.state.chat.length) {
    App.state.chat.push({
      role: "bot",
      text: "¡Hola! 👋 Soy JimmiteoBot, tu coach de nutrición.\n\nPuedo registrar lo que comes y tu peso, calcular y cambiar tus metas, moverte de fecha y recomendarte libros y videos verificados de salud. Prueba los botones de abajo o escríbeme 👇",
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

function weightModal() {
  const unit = App.state.units.weight;
  const latest = App.latestWeight();
  const prefill = latest ? App.kgToUnit(latest.kg).toFixed(1) : "";
  openModal(`
    <h3>⚖️ Registrar peso</h3>
    <div class="form-grid">
      <label style="grid-column:1/-1">Peso de ${App.formatDate(App.state.currentDate)} (${unit})
        <input id="fwVal" type="number" min="1" step="0.1" value="${prefill}" placeholder="${unit === "kg" ? "78.5" : "173.0"}">
      </label>
    </div>
    <div class="modal-btns">
      <button class="btn btn-ghost" id="fwCancel">Cancelar</button>
      <button class="btn btn-primary" id="fwSave">Guardar</button>
    </div>`,
    (box) => {
      const input = box.querySelector("#fwVal");
      input.focus(); input.select();
      box.querySelector("#fwCancel").onclick = closeModal;
      box.querySelector("#fwSave").onclick = () => {
        const v = +input.value;
        if (!v || v <= 0) { toast("Ingresa un peso válido ⚠️"); return; }
        const kg = App.logWeight(App.unitToKg(v));
        toast(`Peso registrado: ${App.fmtWeight(kg)} ⚖️`);
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

function handlePhoto(file) {
  if (!App.state.apiKey) {
    toast("Agrega tu API key en Ajustes para analizar fotos 🤖");
    mealModal();
    return;
  }
  // comentario opcional para dar más contexto a la IA
  openModal(`
    <h3>📸 Detalles de la foto</h3>
    <label>Comentario (opcional)
      <input id="fpNote" type="text" placeholder="Ej. arepa con queso, porción grande, sin salsa">
    </label>
    <p class="form-note" style="margin-top:10px">Ayuda a la IA a calcular macros más precisos.</p>
    <div class="modal-btns">
      <button class="btn btn-ghost" id="fpCancel">Cancelar</button>
      <button class="btn btn-primary" id="fpGo">Analizar</button>
    </div>`,
    (box) => {
      box.querySelector("#fpNote").focus();
      box.querySelector("#fpCancel").onclick = closeModal;
      box.querySelector("#fpGo").onclick = () => {
        const note = box.querySelector("#fpNote").value.trim();
        closeModal();
        runPhotoAnalysis(file, note);
      };
    });
}

async function runPhotoAnalysis(file, note) {
  $("photoInner").hidden = true;
  $("photoLoading").hidden = false;
  try {
    const b64 = await resizeImage(file);
    const { text, actions } = await analyzeFoodPhoto(b64, note);
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
    $("photoInputCam").value = "";
    $("photoInputGal").value = "";
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
  // abre el calendario nativo al tocar la píldora de fecha
  $("datePill").addEventListener("click", () => { try { $("dateInput").showPicker(); } catch {} });

  // héroe: cambiar estilo (auto → líquido → energía → número)
  $("heroSwitch").addEventListener("click", () => {
    const order = ["auto", ...HERO_MODES];
    const i = order.indexOf(App.state.heroStyle);
    App.state.heroStyle = order[(i + 1) % order.length];
    App.save();
    $("heroStage").dataset.mode = ""; // fuerza re-render con animación
    renderHoy();
    toast(`Estilo: ${HERO_NAMES[App.state.heroStyle]}${App.state.heroStyle === "auto" ? " (rota cada día)" : ""}`);
  });

  // metas rápidas
  $("editKcalGoal").addEventListener("click", (e) => { e.stopPropagation(); goalModal("kcal", "calorías", "kcal"); });
  document.querySelectorAll(".macro").forEach((el) =>
    el.addEventListener("click", () => {
      const f = el.dataset.macro;
      goalModal(f, GOAL_LABEL[f], "g");
    })
  );

  // peso
  $("logWeightBtn").addEventListener("click", weightModal);

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

  // foto: tomar con cámara o subir de galería
  $("btnCam").addEventListener("click", (e) => { e.stopPropagation(); $("photoInputCam").click(); });
  $("btnGal").addEventListener("click", (e) => { e.stopPropagation(); $("photoInputGal").click(); });
  $("photoCard").addEventListener("click", () => !$("photoLoading").hidden || $("photoInputGal").click());
  $("photoInputCam").addEventListener("change", (e) => e.target.files[0] && handlePhoto(e.target.files[0]));
  $("photoInputGal").addEventListener("change", (e) => e.target.files[0] && handlePhoto(e.target.files[0]));

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

  // métrica de la gráfica semanal
  $("segChart").addEventListener("click", (e) => {
    const m = e.target.closest("button")?.dataset.m;
    if (m) { chartMetric = m; renderLog(); }
  });

  // unidades
  $("segWeight").addEventListener("click", (e) => {
    const u = e.target.closest("button")?.dataset.u;
    if (!u) return;
    App.state.units.weight = u;
    App.save(); renderConfig(); renderHoy();
    toast(`Peso en ${u} ⚖️`);
  });
  $("segHeight").addEventListener("click", (e) => {
    const u = e.target.closest("button")?.dataset.u;
    if (!u) return;
    App.state.units.height = u;
    App.save(); renderConfig();
    toast(`Altura en ${u === "cm" ? "centímetros" : "pies y pulgadas"} 📏`);
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
  bindField("pObjetivo", App.state.profile, "objetivo", renderTdee);
  bindField("pEdad", App.state.profile, "edad", renderTdee);
  bindField("pSexo", App.state.profile, "sexo", renderTdee);
  bindField("pActividad", App.state.profile, "actividad", renderTdee);
  bindField("gKcalIn", App.state.goals, "kcal");
  bindField("gProteinIn", App.state.goals, "protein");
  bindField("gCarbsIn", App.state.goals, "carbs");
  bindField("gFatIn", App.state.goals, "fat");

  // peso y altura respetan la unidad elegida (se guardan en kg / cm)
  $("pPeso").addEventListener("change", (e) => {
    const v = +e.target.value;
    App.state.profile.peso = v ? Math.round(App.unitToKg(v) * 10) / 10 : "";
    App.save(); renderTdee(); renderAll();
  });
  $("pAltura").addEventListener("change", (e) => {
    App.state.profile.altura = +e.target.value || "";
    App.save(); renderTdee(); renderAll();
  });
  const ftChange = () => {
    const ft = +$("pAlturaFt").value || 0;
    const inch = +$("pAlturaIn").value || 0;
    App.state.profile.altura = ft || inch ? Math.round((ft * 12 + inch) * 2.54) : "";
    App.save(); renderTdee(); renderAll();
  };
  $("pAlturaFt").addEventListener("change", ftChange);
  $("pAlturaIn").addEventListener("change", ftChange);

  $("apiKeyIn").addEventListener("change", (e) => {
    App.state.apiKey = e.target.value.trim();
    App.save();
    renderApiStatus();
    toast(App.state.apiKey ? "IA activada ✨" : "Modo local activo 🔌");
  });

  // cálculo automático de macros según el perfil
  $("calcMacrosBtn").addEventListener("click", () => {
    const m = App.applyMacros();
    if (!m) { toast("Completa peso, altura y edad primero ⚠️"); return; }
    renderConfig();
    toast(`Metas actualizadas: ${m.kcal} kcal · P ${m.protein} · C ${m.carbs} · G ${m.fat} ⚡`);
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
      <p style="color:var(--ink-2);font-size:14px;line-height:1.6;margin-bottom:18px">Se eliminarán todas tus comidas, pesos, metas y el chat de este dispositivo. Esta acción no se puede deshacer.</p>
      <div class="modal-btns">
        <button class="btn btn-ghost" id="rCancel">Cancelar</button>
        <button class="btn btn-primary" id="rOk" style="background:var(--rose)">Borrar todo</button>
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

/* ---------- burbujas del fondo ---------- */
function initParticles() {
  const wrap = $("particles");
  if (!wrap || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (let i = 0; i < 18; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    const size = 3 + Math.random() * 5;
    p.style.width = p.style.height = size + "px";
    p.style.left = Math.random() * 100 + "%";
    p.style.animationDuration = 11 + Math.random() * 15 + "s";
    p.style.animationDelay = -Math.random() * 22 + "s";
    if (Math.random() < 0.4) p.style.background = "#CBE99B";
    wrap.appendChild(p);
  }
}

/* ---------- init ---------- */
App.load();
bindEvents();
renderAll();
renderApiStatus();
initParticles();
