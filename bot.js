/* ==========================================================
   JIMMITEOBOT — cerebro del bot
   - Acciones: el bot puede editar la app (comidas, metas, fecha, agua)
   - Modo local: entiende comandos en español sin conexión
   - Modo IA: Claude API (Messages + tool use + visión)
   ========================================================== */

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const MODEL = "claude-opus-4-8";

/* ---------- Herramientas que el bot puede usar sobre la app ---------- */
const BOT_TOOLS = [
  {
    name: "add_meal",
    description: "Registra una comida en el día actual de la app. Úsala cuando el usuario diga que comió algo o pida agregar una comida. Estima macros realistas si no los da.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nombre corto de la comida, ej. 'Arroz con pollo'" },
        kcal: { type: "number", description: "Calorías totales" },
        protein: { type: "number", description: "Proteína en gramos" },
        carbs: { type: "number", description: "Carbohidratos en gramos" },
        fat: { type: "number", description: "Grasa en gramos" },
      },
      required: ["name", "kcal", "protein", "carbs", "fat"],
    },
  },
  {
    name: "delete_meal",
    description: "Elimina una comida del día actual. index es la posición (0 = primera). Usa -1 para eliminar la última.",
    input_schema: {
      type: "object",
      properties: { index: { type: "number", description: "Posición de la comida, -1 para la última" } },
      required: ["index"],
    },
  },
  {
    name: "set_goal",
    description: "Cambia una meta diaria del usuario: calorías, proteína, carbohidratos, grasa o vasos de agua.",
    input_schema: {
      type: "object",
      properties: {
        field: { type: "string", enum: ["kcal", "protein", "carbs", "fat", "water"] },
        value: { type: "number" },
      },
      required: ["field", "value"],
    },
  },
  {
    name: "set_date",
    description: "Cambia la fecha activa de la app (para ver o registrar en otro día). Formato YYYY-MM-DD.",
    input_schema: {
      type: "object",
      properties: { date: { type: "string", description: "Fecha en formato YYYY-MM-DD" } },
      required: ["date"],
    },
  },
  {
    name: "add_water",
    description: "Suma (o resta con negativo) vasos de agua al día actual.",
    input_schema: {
      type: "object",
      properties: { amount: { type: "number", description: "Vasos a sumar; negativo para restar" } },
      required: ["amount"],
    },
  },
];

/* ---------- Ejecutor de acciones (compartido por modo local e IA) ---------- */
const GOAL_LABEL = { kcal: "calorías", protein: "proteína", carbs: "carbos", fat: "grasa", water: "agua" };

function runBotAction(name, input) {
  switch (name) {
    case "add_meal": {
      const meal = App.addMeal({
        name: String(input.name || "Comida").slice(0, 60),
        kcal: Math.max(0, Math.round(+input.kcal || 0)),
        protein: Math.max(0, Math.round(+input.protein || 0)),
        carbs: Math.max(0, Math.round(+input.carbs || 0)),
        fat: Math.max(0, Math.round(+input.fat || 0)),
      });
      return `✅ Registré «${meal.name}» — ${meal.kcal} kcal · P ${meal.protein}g · C ${meal.carbs}g · G ${meal.fat}g`;
    }
    case "delete_meal": {
      const removed = App.deleteMealAt(+input.index);
      return removed ? `🗑️ Eliminé «${removed.name}» (${removed.kcal} kcal)` : "No encontré esa comida en el día actual.";
    }
    case "set_goal": {
      const field = input.field;
      if (!(field in GOAL_LABEL)) return "Meta no válida.";
      const value = Math.max(1, Math.round(+input.value || 0));
      App.setGoal(field, value);
      const unit = field === "kcal" ? "kcal" : field === "water" ? "vasos" : "g";
      return `🎯 Nueva meta de ${GOAL_LABEL[field]}: ${value} ${unit}`;
    }
    case "set_date": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date || "")) return "Fecha no válida (usa YYYY-MM-DD).";
      App.setDate(input.date);
      return `📅 Fecha cambiada a ${App.formatDate(input.date)}`;
    }
    case "add_water": {
      const n = App.addWater(Math.round(+input.amount || 0));
      return `💧 Agua del día: ${n} vasos`;
    }
    default:
      return "Acción desconocida.";
  }
}

/* ---------- Resumen del estado (contexto para el bot) ---------- */
function stateSummary() {
  const s = App.state;
  const t = App.dayTotals();
  const g = s.goals;
  const meals = App.currentDay().meals.map((m, i) => `${i}. ${m.name} (${m.kcal} kcal, P${m.protein} C${m.carbs} G${m.fat})`).join("\n") || "(sin comidas)";
  return [
    `Fecha activa: ${s.currentDate} (hoy es ${App.todayKey()})`,
    `Usuario: ${s.profile.nombre || "sin nombre"}${s.profile.peso ? `, ${s.profile.peso} kg` : ""}`,
    `Metas diarias: ${g.kcal} kcal · proteína ${g.protein}g · carbos ${g.carbs}g · grasa ${g.fat}g · agua ${g.water} vasos`,
    `Consumido en la fecha activa: ${t.kcal} kcal · P ${t.protein}g · C ${t.carbs}g · G ${t.fat}g · agua ${App.currentDay().water} vasos`,
    `Comidas de la fecha activa:\n${meals}`,
  ].join("\n");
}

function systemPrompt() {
  const books = KNOWLEDGE.books.map((b) => `- "${b.title}" — ${b.author} (${b.year}): ${b.why}`).join("\n");
  const videos = KNOWLEDGE.videos.map((v) => `- "${v.title}" — ${v.source}: ${v.why}`).join("\n");
  const tips = KNOWLEDGE.tips.map((t) => `- ${t.text} (Fuente: ${t.source})`).join("\n");
  return `Eres JimmiteoBot, el coach de nutrición y salud dentro de la app JimmiteoBot. Hablas español, eres cercano, motivador y breve (2-5 frases, usa emojis con moderación).

Puedes EDITAR la app con tus herramientas: registrar/eliminar comidas, cambiar metas, cambiar la fecha activa y sumar agua. Úsalas siempre que el usuario lo pida, sin pedir confirmación para acciones simples.

REGLAS DE VERACIDAD (muy importante):
- Solo recomienda libros y videos de esta lista verificada. Nunca inventes títulos, autores, estudios ni cifras.
- Si citas un dato de salud, usa los datos verificados de abajo con su fuente.
- No des diagnósticos médicos; para temas médicos serios recomienda consultar a un profesional.

LIBROS VERIFICADOS:
${books}

VIDEOS/CANALES VERIFICADOS:
${videos}

DATOS DE SALUD VERIFICADOS:
${tips}

ESTADO ACTUAL DE LA APP:
${stateSummary()}`;
}

/* ==========================================================
   MODO IA — Claude API con tool use
   ========================================================== */
async function claudeRequest(messages, extra = {}) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": App.state.apiKey,
      "anthropic-version": API_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt(),
      tools: BOT_TOOLS,
      messages,
      ...extra,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Error ${res.status} de la API`);
  }
  return res.json();
}

async function askClaude(userText, onAction) {
  const messages = [
    ...App.state.chat.slice(-12).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text })),
    { role: "user", content: userText },
  ];

  let finalText = "";
  // Bucle de tool use: Claude puede encadenar varias acciones
  for (let turn = 0; turn < 5; turn++) {
    const response = await claudeRequest(messages);

    const textBlocks = response.content.filter((b) => b.type === "text").map((b) => b.text);
    if (textBlocks.length) finalText = textBlocks.join("\n");

    if (response.stop_reason !== "tool_use") break;

    const toolResults = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      const result = runBotAction(block.name, block.input);
      if (onAction) onAction(result);
      toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
    }
    messages.push({ role: "assistant", content: response.content });
    messages.push({ role: "user", content: toolResults });
  }
  return finalText || "Listo ✅";
}

/* ---------- Análisis de foto (visión + tool use forzado) ---------- */
async function analyzeFoodPhoto(base64jpeg) {
  const messages = [{
    role: "user",
    content: [
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64jpeg } },
      { type: "text", text: "Analiza esta foto de comida. Identifica el plato y estima calorías y macros realistas de la porción visible. Luego regístrala con la herramienta add_meal. Si la imagen no es comida, dilo y no registres nada." },
    ],
  }];

  const response = await claudeRequest(messages);
  const results = [];
  let text = "";
  for (const block of response.content) {
    if (block.type === "text") text += block.text;
    if (block.type === "tool_use" && block.name === "add_meal") {
      results.push(runBotAction("add_meal", block.input));
    }
  }
  return { text: text.trim(), actions: results };
}

/* ==========================================================
   MODO LOCAL — comandos en español sin API key
   ========================================================== */
const GOAL_WORDS = [
  [/prote/i, "protein"], [/carb/i, "carbs"], [/gras/i, "fat"],
  [/calor|kcal/i, "kcal"], [/agua/i, "water"],
];

function localBot(text) {
  const t = text.toLowerCase().trim();
  const reply = (text, actions = []) => ({ text, actions });

  // Cambiar meta: "cambia mi meta de proteína a 150"
  const goalMatch = t.match(/meta[^0-9]*?(prote\w*|carb\w*|gras\w*|calor\w*|kcal|agua)[^0-9]*?(\d+)/);
  if (goalMatch) {
    const field = (GOAL_WORDS.find(([re]) => re.test(goalMatch[1])) || [])[1];
    if (field) {
      const msg = runBotAction("set_goal", { field, value: +goalMatch[2] });
      return reply("¡Hecho! Meta actualizada. 💪", [msg]);
    }
  }

  // Agua: "agrega un vaso de agua", "tomé 2 vasos"
  if (/agua|vaso/.test(t) && /agrega|añade|toma|tomé|tome|suma|\+|bebi|bebí/.test(t)) {
    const n = +(t.match(/(\d+)/) || [])[1] || 1;
    return reply("¡Bien hidratado! 💧", [runBotAction("add_water", { amount: n })]);
  }

  // Borrar comida: "borra la última comida"
  if (/(borra|elimina|quita)/.test(t) && /comida|último|ultima|última/.test(t)) {
    return reply("Listo.", [runBotAction("delete_meal", { index: -1 })]);
  }

  // Fecha: "cambia la fecha a ayer / hoy / mañana / 2026-07-05"
  if (/fecha|ayer|mañana(?!\s*(comí|como))/.test(t) && /(cambia|pon|ve|muestra|vuelve|fecha)/.test(t)) {
    let date = App.todayKey();
    if (/ayer/.test(t)) date = App.shiftKey(App.todayKey(), -1);
    else if (/mañana/.test(t)) date = App.shiftKey(App.todayKey(), 1);
    const iso = t.match(/(\d{4}-\d{2}-\d{2})/);
    if (iso) date = iso[1];
    return reply("Fecha actualizada 📅", [runBotAction("set_date", { date })]);
  }

  // Libro / video / consejo (antes que comida: "recomiéndame" contiene "comi")
  if (/libro/.test(t)) {
    const b = randomOf(KNOWLEDGE.books);
    return reply(`📚 Te recomiendo «${b.title}» de ${b.author} (${b.year}).\n${b.why}`);
  }
  if (/video|canal|youtube|ver algo/.test(t)) {
    const v = randomOf(KNOWLEDGE.videos);
    return reply(`🎬 Mira «${v.title}» — ${v.source}.\n${v.why}`);
  }
  if (/consejo|tip\b|dato|recomienda|recomiéndame|recomiendame/.test(t)) {
    const tip = randomOf(KNOWLEDGE.tips);
    return reply(`💡 ${tip.text}\n\n📖 Fuente: ${tip.source}`);
  }

  // Registrar comida: "comí arroz con pollo", "agrega un huevo"
  if (/(^|\s)(comí|comi|desayun|almorc|almuerzo|cen[eé]|cena|agrega|añade|registra)/.test(t)) {
    const food = findFood(t);
    if (food) {
      const qty = +(t.match(/(\d+)\s/) || [])[1] || 1;
      const q = Math.min(qty, 10);
      const msg = runBotAction("add_meal", {
        name: q > 1 ? `${food.name} x${q}` : food.name,
        kcal: food.kcal * q, protein: food.protein * q, carbs: food.carbs * q, fat: food.fat * q,
      });
      return reply("¡Anotado! 🍽️ (macros aproximados de tabla USDA)", [msg]);
    }
    return reply("No tengo ese alimento en mi tabla local 😅. Dímelo así: «agrega Nombre, 350 kcal, 20 proteína, 40 carbos, 10 grasa» — o activa la API key en Ajustes para que la IA estime cualquier comida.");
  }

  // Comida manual con números: "agrega X, 350 kcal, 20 proteína..."
  const manual = t.match(/(\d+)\s*kcal.*?(\d+)\s*prote.*?(\d+)\s*carb.*?(\d+)\s*gras/);
  if (manual) {
    const name = text.split(",")[0].replace(/agrega|añade|registra|comí|comi/gi, "").trim() || "Comida";
    const msg = runBotAction("add_meal", { name, kcal: +manual[1], protein: +manual[2], carbs: +manual[3], fat: +manual[4] });
    return reply("¡Anotado! 🍽️", [msg]);
  }

  // Resumen: "¿cómo voy?"
  if (/como voy|cómo voy|resumen|cuant|cuánt|llevo|progreso/.test(t)) {
    const tt = App.dayTotals();
    const g = App.state.goals;
    const rest = g.kcal - tt.kcal;
    return reply(
      `📊 Hoy llevas ${tt.kcal} de ${g.kcal} kcal (${rest > 0 ? `te quedan ${rest}` : `¡${-rest} por encima!`}).\n` +
      `🥩 Proteína ${tt.protein}/${g.protein}g · 🍚 Carbos ${tt.carbs}/${g.carbs}g · 🥑 Grasa ${tt.fat}/${g.fat}g\n` +
      `💧 Agua: ${App.currentDay().water}/${g.water} vasos.\n` +
      (tt.protein < g.protein * 0.5 ? "Consejo: prioriza la proteína en tu próxima comida 💪" : "¡Vas muy bien, sigue así! 🔥")
    );
  }

  // Saludo
  if (/^(hola|hey|buenas|hi|holi)/.test(t)) {
    const name = App.state.profile.nombre;
    return reply(`¡Hola${name ? " " + name : ""}! 👋 Soy JimmiteoBot. Puedo registrar tus comidas, cambiar tus metas, sumar agua y recomendarte libros y videos verificados de salud. ¿En qué te ayudo?`);
  }

  // Fallback
  return reply(
    "Estoy en modo local 🤖 (sin API key). Puedo hacer esto:\n" +
    "• «Comí arroz con pollo» → registro la comida\n" +
    "• «Cambia mi meta de proteína a 150»\n" +
    "• «Agrega un vaso de agua» / «Borra la última comida»\n" +
    "• «¿Cómo voy hoy?» / «Recomiéndame un libro / video / consejo»\n\n" +
    "Para conversación libre y análisis de fotos, agrega tu API key de Anthropic en Ajustes ⚙️✨"
  );
}
