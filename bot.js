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
    name: "log_product",
    description: "Registra una porción PESADA de un producto guardado (etiqueta escaneada antes). La app calcula los macros exactos a partir de la etiqueta y los gramos. Úsala siempre que el usuario diga los gramos de algo que está en productos guardados.",
    input_schema: {
      type: "object",
      properties: {
        product: { type: "string", description: "Nombre tal como aparece en productos guardados" },
        grams: { type: "number", description: "Gramos (o ml) pesados en la báscula" },
        cooked: { type: "boolean", description: "true si lo pesó ya cocinado, false si crudo/seco o tal como viene. Omítelo si el usuario no lo dice (se usa lo último que usó con ese producto)." },
      },
      required: ["product", "grams"],
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
    description: "Cambia una meta diaria del usuario: calorías, proteína, carbohidratos o grasa.",
    input_schema: {
      type: "object",
      properties: {
        field: { type: "string", enum: ["kcal", "protein", "carbs", "fat"] },
        value: { type: "number" },
      },
      required: ["field", "value"],
    },
  },
  {
    name: "calculate_macros",
    description: "Calcula y aplica automáticamente las metas de calorías y macros del usuario a partir de su perfil (peso, altura, edad, sexo, actividad y objetivo) usando Mifflin-St Jeor y guías ISSN. Úsala cuando pida calcular sus macros o pregunte cuántas calorías debería comer.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "log_weight",
    description: "Registra el peso corporal del usuario para la fecha activa. Si el usuario da el peso en libras, pásalo con unit 'lb'.",
    input_schema: {
      type: "object",
      properties: {
        weight: { type: "number", description: "Peso corporal" },
        unit: { type: "string", enum: ["kg", "lb"], description: "Unidad del valor dado (por defecto kg)" },
      },
      required: ["weight"],
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
];

/* ---------- Lectura de etiqueta nutricional (una sola llamada, con revisión) ----------
   El orden de los campos importa: primero transcribe y revisa, después da los números. */
const LABEL_TOOL = {
  name: "read_label",
  description: "Devuelve los datos leídos de la tabla de información nutricional de la foto.",
  input_schema: {
    type: "object",
    properties: {
      transcript: { type: "string", description: "PRIMERO: copia literal, tal como aparecen en la foto, las líneas de: tamaño de porción (con los gramos), calorías, grasa total, carbohidratos totales y proteína. Si hay columna por 100 g y por porción, copia ambas." },
      review: { type: "string", description: "SEGUNDO: vuelve a mirar cada número en la foto y compáralo con tu transcripción (cuidado con 1/7, 3/8, 5/6, 0/8 y los decimales). Comprueba que 4·proteína + 4·carbos + 9·grasa se acerque a las calorías. Escribe qué comprobaste y qué corregiste, o 'Todo coincide'." },
      readable: { type: "boolean", description: "false si la foto no es una tabla nutricional o no se leen las calorías y macros" },
      confidence: { type: "string", enum: ["alta", "media", "baja"], description: "Qué tan seguro estás de los números tras la revisión" },
      name: { type: "string", description: "Nombre corto del producto (marca + producto si se ve), ej. 'Arroz Goya'" },
      base_g: { type: "number", description: "Gramos (o ml) a los que corresponden los valores. Si la etiqueta tiene columna por 100 g/100 ml, usa esa (100). Si no, el tamaño de porción EN GRAMOS." },
      kcal: { type: "number", description: "Calorías para base_g. Si solo aparece en kJ, divide entre 4.184" },
      protein: { type: "number", description: "Proteína (g) para base_g" },
      carbs: { type: "number", description: "Carbohidratos totales (g) para base_g" },
      fat: { type: "number", description: "Grasa total (g) para base_g" },
      serving_g: { type: "number", description: "Gramos de UNA porción según la etiqueta (ej. 'Serving size 2 cookies (28g)' → 28). 0 si no aparece." },
      serving_units: { type: "number", description: "Cuántas piezas/unidades es UNA porción (ej. '2 cookies' → 2, '1 bar' → 1, '1 patty' → 1). 0 si la porción no se expresa en piezas (ej. '1/4 cup', '45 g')." },
      unit_name: { type: "string", description: "Nombre en español de la pieza, singular (galleta, barra, tortilla, hamburguesa…). Vacío si no aplica." },
      ready_to_eat: { type: "boolean", description: "true si la etiqueta describe el producto tal como se come (yogurt, pan, cereal, embutido, pollo ya cocido, producto 'as prepared'). false si describe el producto crudo/seco que luego se cocina (arroz, pasta, avena, frijoles, papas, carne o pollo crudos)." },
      cooked_yield: { type: "number", description: "Si ready_to_eat es false: rendimiento típico peso cocido ÷ peso crudo según tablas USDA para este tipo de alimento (ej. arroz blanco ~2.8, pasta ~2.3, avena en agua ~4, frijoles secos ~2.5, papa horneada ~0.8, pechuga de pollo horneada ~0.72, carne molida ~0.73). Si ready_to_eat es true, 1." },
      note: { type: "string", description: "Aviso breve si algo fue dudoso o ilegible; vacío si todo se leyó bien" },
    },
    required: ["transcript", "review", "readable", "confidence", "name", "base_g", "kcal", "protein", "carbs", "fat", "ready_to_eat", "cooked_yield"],
  },
};

/* ---------- Estimación de plato (una sola llamada, desglosada y revisada) ---------- */
const ESTIMATE_TOOL = {
  name: "estimate_meal",
  description: "Devuelve la estimación de calorías y macros del plato de la foto.",
  input_schema: {
    type: "object",
    properties: {
      is_food: { type: "boolean", description: "false si la foto no es comida" },
      items: {
        type: "array", description: "PRIMERO: cada componente visible del plato (incluye aceite/salsa/queso probables) con sus gramos estimados y calorías.",
        items: { type: "object", properties: { food: { type: "string" }, grams: { type: "number" }, kcal: { type: "number" } }, required: ["food", "grams", "kcal"] },
      },
      review: { type: "string", description: "SEGUNDO: revisa tu desglose: ¿las porciones son realistas para lo que se ve? ¿olvidaste grasa de cocción o salsas? ¿4·P + 4·C + 9·G cuadra con las calorías? Di qué corregiste." },
      confidence: { type: "string", enum: ["alta", "media", "baja"] },
      name: { type: "string", description: "Nombre corto del plato, ej. 'Tacos al pastor'" },
      kcal: { type: "number", description: "Total del plato, después de la revisión" },
      protein: { type: "number" }, carbs: { type: "number" }, fat: { type: "number" },
    },
    required: ["is_food", "items", "review", "confidence", "name", "kcal", "protein", "carbs", "fat"],
  },
};

/* ---------- Revisiones en código (gratis, sin llamar a la API) ---------- */
const r1 = (x) => Math.round(x * 10) / 10;
// kcal vs 4·P + 4·C + 9·G (Atwater). >20% de diferencia = revisar.
function atwaterOff(d) {
  const est = 4 * d.protein + 4 * d.carbs + 9 * d.fat;
  return d.kcal > 20 && Math.abs(d.kcal - est) / d.kcal > 0.2 ? Math.round(est) : 0;
}
function labelIssues(d) {
  const out = [];
  const est = atwaterOff(d);
  if (est) out.push(`Las calorías (${d.kcal}) no cuadran con los macros (${est}). Revisa los datos.`);
  if (d.protein + d.carbs + d.fat > d.base_g * 1.02) out.push(`Los macros suman más que la porción (${d.base_g} g).`);
  if (d.kcal > d.base_g * 9.1) out.push(`${d.kcal} kcal en ${d.base_g} g es imposible. Revisa la porción.`);
  if (d.confidence && d.confidence !== "alta") out.push(`No leí la etiqueta con total seguridad. Compárala.`);
  return out;
}

/* ---------- Ejecutor de acciones (compartido por modo local e IA) ---------- */
const GOAL_LABEL = { kcal: "calorías", protein: "proteína", carbs: "carbos", fat: "grasa" };

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
    case "log_product": {
      const prod = App.findProduct(input.product || "");
      const grams = +input.grams || 0;
      if (!prod) return `No tengo «${input.product}» en productos guardados. Pídele al usuario que escanee su etiqueta.`;
      if (grams <= 0 || grams > 5000) return "Esos gramos no parecen válidos.";
      const meal = App.logProduct(prod, grams, input.cooked);
      return `⚖️ Registré «${meal.name}» — ${meal.kcal} kcal · P ${meal.protein}g · C ${meal.carbs}g · G ${meal.fat}g`;
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
      const unit = field === "kcal" ? "kcal" : "g";
      return `🎯 Nueva meta de ${GOAL_LABEL[field]}: ${value} ${unit}`;
    }
    case "calculate_macros": {
      const m = App.applyMacros();
      if (!m) return "Faltan datos del perfil (peso, altura o edad). Pídele al usuario que los complete en Ajustes.";
      return `⚡ Macros calculados y aplicados: ${m.kcal} kcal · Proteína ${m.protein}g · Carbos ${m.carbs}g · Grasa ${m.fat}g (gasto estimado: ${m.tdee} kcal/día)`;
    }
    case "log_weight": {
      let kg = +input.weight || 0;
      if (input.unit === "lb") kg = kg / 2.20462;
      if (kg < 20 || kg > 400) return "Ese peso no parece válido.";
      const saved = App.logWeight(kg);
      return `⚖️ Peso registrado: ${App.fmtWeight(saved)}`;
    }
    case "set_date": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date || "")) return "Fecha no válida (usa YYYY-MM-DD).";
      App.setDate(input.date);
      return `📅 Fecha cambiada a ${App.formatDate(input.date)}`;
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
  const p = s.profile;
  const OBJ = { cut: "perder grasa", maintain: "mantener", bulk: "ganar músculo" };
  const perfil = [
    p.nombre && `nombre ${p.nombre}`, p.peso && `${p.peso} kg`, p.altura && `${p.altura} cm`,
    p.edad && `${p.edad} años`, `objetivo: ${OBJ[p.objetivo] || "mantener"}`,
  ].filter(Boolean).join(", ");
  const meals = App.currentDay().meals.map((m, i) => `${i}. ${m.name} (${m.kcal} kcal, P${m.protein} C${m.carbs} G${m.fat})`).join("\n") || "(sin comidas)";
  const lastW = App.latestWeight();
  const prods = App.productList().slice(0, 40)
    .map((p) => `- ${p.name}: por ${p.base_g} g ${p.ready_to_eat ? "(listo para comer)" : `crudo (rinde x${p.cooked_yield} cocido; suele pesarlo ${p.weighed === "cooked" ? "cocinado" : "crudo"})`} → ${p.kcal} kcal, P${p.protein} C${p.carbs} G${p.fat}`).join("\n") || "(ninguno)";
  return [
    `Fecha activa: ${s.currentDate} (hoy es ${App.todayKey()})`,
    `Perfil del usuario: ${perfil}`,
    `Último peso registrado: ${lastW ? `${lastW.kg} kg el ${lastW.key}` : "ninguno"} (unidad preferida: ${s.units.weight})`,
    `Metas diarias: ${g.kcal} kcal · proteína ${g.protein}g · carbos ${g.carbs}g · grasa ${g.fat}g`,
    `Consumido en la fecha activa: ${t.kcal} kcal · P ${t.protein}g · C ${t.carbs}g · G ${t.fat}g`,
    `Comidas de la fecha activa:\n${meals}`,
    `Productos guardados (etiquetas escaneadas):\n${prods}`,
  ].join("\n");
}

function systemPrompt() {
  const books = KNOWLEDGE.books.map((b) => `- "${b.title}" — ${b.author} (${b.year}): ${b.why}`).join("\n");
  const videos = KNOWLEDGE.videos.map((v) => `- "${v.title}" — ${v.source}: ${v.why}`).join("\n");
  const tips = KNOWLEDGE.tips.map((t) => `- ${t.text} (Fuente: ${t.source})`).join("\n");
  const persona = window.APP?.bot
    ? `Eres ${BOT_NAME}, un Australian Shepherd red merle (un ojo marrón y uno azul) que es el coach de nutrición y salud dentro de la app ${APP_NAME}. Eres tierno y leal; de vez en cuando se te escapa un detalle perruno (🐾), sin exagerar.`
    : `Eres ${APP_NAME}, el coach de nutrición y salud dentro de la app ${APP_NAME}.`;
  const langRule = I18N.en ? " IMPORTANTE: responde SIEMPRE en inglés (English), aunque las instrucciones estén en español; los nombres de comidas que registres también en inglés." : "";
  return `${persona}${langRule} Hablas español, eres cercano, motivador y breve (2-5 frases, usa emojis con moderación).

Puedes EDITAR la app con tus herramientas: registrar/eliminar comidas, registrar el peso corporal, cambiar metas, calcular macros automáticamente desde el perfil y cambiar la fecha activa. Úsalas siempre que el usuario lo pida, sin pedir confirmación para acciones simples. Si pregunta cuántas calorías o macros debería comer, usa calculate_macros.

PESO DE LA COMIDA (el usuario usa báscula de cocina):
- Si da gramos de un producto guardado, usa log_product: la app hace la cuenta exacta con la etiqueta. No calcules tú. Si dice "cocido/cocinado" pasa cooked true; si dice "crudo/seco" pasa false.
- El usuario normalmente pesa la comida YA COCINADA. Las etiquetas de arroz, pasta, avena, frijoles y carnes crudas son para el producto crudo/seco: nunca apliques la etiqueta cruda directo a gramos cocidos.
- Si da gramos de algo que NO está guardado, estima con valores por 100 g de USDA, multiplica por los gramos, regístralo con add_meal (pon los gramos en el nombre, ej. "Arroz blanco cocido · 180 g") y aclara que es estimado; sugiere escanear la etiqueta si es un producto empacado.
- Distingue gramos de comida (g) del peso corporal (kg/lb): "150 g de avena" nunca es peso corporal.

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

/* ---------- Foto de plato → estimación desglosada (1 llamada) ---------- */
// prev + comments: re-estimación cuando el usuario corrige («creo que es menos papas»)
async function estimateMealPhoto(base64jpeg, note = "", grams = 0, prev = null, comments = []) {
  let text = (I18N.en ? "Write name, food names and review in English. " : "") + "Analiza esta foto de comida con cuidado. Desglosa cada componente, estima porciones realistas, revisa tu desglose y da el total. Devuélvelo con estimate_meal. Si no es comida, is_food false."
    + (grams ? `\n\nEl usuario pesó la comida ya servida: ${grams} g netos en total. Tus gramos por componente deben sumar ${grams} g; usa valores USDA de alimentos cocidos.` : "")
    + (note ? `\n\nDetalles del usuario (tenlos muy en cuenta): ${note}` : "");
  if (prev) {
    const items = prev.items.map((i) => `- ${i.food}: ~${Math.round(i.grams)} g, ${Math.round(i.kcal)} kcal`).join("\n");
    text += `\n\nTu estimación anterior fue:\n${items}\nTotal: ${prev.kcal} kcal · P ${prev.protein} · C ${prev.carbs} · G ${prev.fat}`
      + `\n\nEl usuario vio el plato en persona y te corrige (sus comentarios mandan sobre lo que ves en la foto, en orden):\n${comments.map((c, i) => `${i + 1}. «${c}»`).join("\n")}`
      + `\n\nAjusta SOLO lo que pide el usuario (cantidades, ingredientes que faltan o sobran, forma de cocinar) y deja igual lo demás. Recalcula el total y los macros, y revísalos.`;
  }
  const response = await claudeRequest(
    [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64jpeg } }, { type: "text", text }] }],
    { tools: [ESTIMATE_TOOL], tool_choice: { type: "tool", name: "estimate_meal" }, max_tokens: 2048 });
  const e = response.content.find((x) => x.type === "tool_use")?.input;
  if (!e) throw new Error("No pude analizar la foto");
  if (!e.is_food) return null;
  const out = { name: e.name + (grams ? ` · ${grams} g` : ""), items: e.items || [], confidence: e.confidence, issues: [] };
  for (const f of ["kcal", "protein", "carbs", "fat"]) out[f] = Math.max(0, Math.round(+e[f] || 0));
  const sum = out.items.reduce((a, i) => a + (+i.kcal || 0), 0);
  if (sum && Math.abs(sum - out.kcal) > Math.max(30, out.kcal * 0.1)) out.issues.push(`El desglose suma ${Math.round(sum)} kcal pero el total dice ${out.kcal}. Revisa.`);
  const est = atwaterOff(out);
  if (est) out.issues.push(`Las calorías no cuadran con los macros (4·P + 4·C + 9·G = ${est}).`);
  return out;
}

/* ---------- Foto de etiqueta → datos por base_g (1 llamada: transcribe, revisa, responde) ---------- */
async function readNutritionLabel(base64jpeg) {
  const messages = [{
    role: "user",
    content: [
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64jpeg } },
      { type: "text", text: "Esta es la foto de una tabla de información nutricional (Nutrition Facts). Lee los valores EXACTOS que aparecen, no estimes. Primero transcribe, luego revisa cada número contra la foto, y solo entonces da los valores. Prefiere la columna por 100 g si existe; si no, usa el tamaño de porción en gramos. Indica si describe el producto crudo/seco o listo para comer. Devuélvelo con read_label." + (I18N.en ? " Write name, unit_name, review and note in English." : "") },
    ],
  }];
  const response = await claudeRequest(messages, { tools: [LABEL_TOOL], tool_choice: { type: "tool", name: "read_label" }, max_tokens: 2048 });
  const d = response.content.find((b) => b.type === "tool_use" && b.name === "read_label")?.input;
  if (!d) throw new Error("No pude leer la etiqueta");
  if (!d.readable || !(+d.base_g > 0)) return { readable: false };
  for (const f of ["base_g", "kcal", "protein", "carbs", "fat"]) d[f] = r1(Math.max(0, +d[f] || 0));
  d.cooked_yield = d.ready_to_eat ? 1 : r1(+d.cooked_yield || 1);
  // productos que vienen en piezas: gramos por unidad y modo «unidades» por defecto
  const units = +d.serving_units || 0, sg = +d.serving_g || 0;
  d.unit_g = units > 0 && sg > 0 ? r1(sg / units) : 0;
  d.unit_name = d.unit_g ? String(d.unit_name || "unidad").trim().toLowerCase() : "";
  d.mode = d.unit_g && d.ready_to_eat ? "unit" : "g";
  delete d.serving_g; delete d.serving_units;
  d.issues = labelIssues(d);
  return d;
}

/* ==========================================================
   MODO LOCAL — comandos en español sin API key
   ========================================================== */
const GOAL_WORDS = [
  [/prote/i, "protein"], [/carb/i, "carbs"], [/gras/i, "fat"], [/calor|kcal/i, "kcal"],
];

function localBot(text) {
  const t = text.toLowerCase().trim();
  const reply = (text, actions = []) => ({ text, actions });

  // Registrar peso: "peso 78.5", "hoy pesé 172 libras"
  const wMatch = t.match(/(?:^|\s)(?:peso|pesé|pese|me pesé|me pese|marqué|marque)\s+(?:es\s+|de\s+)?(\d+(?:[.,]\d+)?)(?![\d.,]|\s*(?:g|gr|grs|gramos?|ml)\b)\s*(lb|libras?|kg|kilos?)?/);
  if (wMatch) {
    let v = parseFloat(wMatch[1].replace(",", "."));
    const saidLb = /lb|libra/.test(wMatch[2] || "");
    const saidKg = /kg|kilo/.test(wMatch[2] || "");
    let kg = saidLb ? v / 2.20462 : saidKg ? v : App.unitToKg(v); // sin unidad → usa la preferida
    if (kg >= 20 && kg <= 400) {
      const saved = App.logWeight(kg);
      return reply("¡Anotado en tu gráfica de peso! 📈", [`⚖️ Peso registrado: ${App.fmtWeight(saved)}`]);
    }
  }

  // Calcular macros: "calcula mis macros", "¿cuántas calorías debería comer?"
  if (/(calcula|calcúlame|calculame).*(macro|calor|meta)|cu[aá]nt[ao]s?\s+(calor|prote).*(deber|debo|tengo que)/.test(t)) {
    const m = App.applyMacros();
    if (!m) return reply("Para calcular tus macros necesito tu peso, altura y edad. Complétalos en Ajustes ⚙️ y vuelve a pedírmelo.");
    return reply(
      `Según tu perfil y tu objetivo, estas son tus metas (fórmula Mifflin-St Jeor + guías ISSN):\n` +
      `🔥 ${m.kcal} kcal · 🥩 ${m.protein}g proteína · 🍚 ${m.carbs}g carbos · 🥑 ${m.fat}g grasa\n` +
      `Tu gasto diario estimado es ~${m.tdee} kcal. ¡Ya las apliqué en la app!`,
      [`⚡ Macros calculados y aplicados: ${m.kcal} kcal · P ${m.protein}g · C ${m.carbs}g · G ${m.fat}g`]
    );
  }

  // Cambiar meta: "cambia mi meta de proteína a 150"
  const goalMatch = t.match(/meta[^0-9]*?(prote\w*|carb\w*|gras\w*|calor\w*|kcal)[^0-9]*?(\d+)/);
  if (goalMatch) {
    const field = (GOAL_WORDS.find(([re]) => re.test(goalMatch[1])) || [])[1];
    if (field) {
      const msg = runBotAction("set_goal", { field, value: +goalMatch[2] });
      return reply("¡Hecho! Meta actualizada. 💪", [msg]);
    }
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

  // Porción pesada: "150 g de avena", "comí 200 gramos de yogurt griego"
  const gMatch = t.match(/(\d+(?:[.,]\d+)?)\s*(?:g|gr|grs|gramos?|ml)\b\s*(?:de\s+)?(.+)/);
  if (gMatch) {
    const grams = parseFloat(gMatch[1].replace(",", "."));
    const prod = App.findProduct(gMatch[2]);
    if (prod && grams > 0 && grams <= 5000) {
      const cooked = /cocid|cocin|hervid/.test(t) ? true : /crud|seco/.test(t) ? false : undefined;
      return reply("¡Anotado con la etiqueta! ⚖️", [runBotAction("log_product", { product: prod.name, grams, cooked })]);
    }
    return reply(`No tengo «${gMatch[2].trim()}» guardado 🏷️. Escanea su etiqueta una vez (Hoy → 🏷️ Escanear producto) y a partir de ahí solo me dices los gramos.`);
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
      (tt.protein < g.protein * 0.5 ? "Consejo: prioriza la proteína en tu próxima comida 💪" : "¡Vas muy bien, sigue así! 🔥")
    );
  }

  // Saludo
  if (/^(hola|hey|buenas|hi|holi)/.test(t)) {
    const name = App.state.profile.nombre;
    return reply(`¡Hola${name ? " " + name : ""}! 👋 Soy ${BOT_NAME}. Puedo registrar tus comidas, calcular y cambiar tus metas, y recomendarte libros y videos verificados de salud. ¿En qué te ayudo?`);
  }

  // Fallback
  return reply(
    "Estoy en modo local 🤖 (sin API key). Puedo hacer esto:\n" +
    "• «150 g de avena» → uso la etiqueta que escaneaste\n" +
    "• «Comí arroz con pollo» → registro la comida\n" +
    "• «Calcula mis macros» → metas según tu perfil\n" +
    "• «Cambia mi meta de proteína a 150»\n" +
    "• «Borra la última comida» / «¿Cómo voy hoy?»\n" +
    "• «Recomiéndame un libro / video / consejo»\n\n" +
    "Para conversación libre y análisis de fotos, agrega tu API key de Anthropic en Ajustes ⚙️✨"
  );
}
