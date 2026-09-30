/* ==========================================================
   Idioma: la app se escribe en español; si el idioma es inglés,
   este archivo traduce en vivo todo lo que aparece en pantalla
   (texto, placeholders, avisos) con el diccionario de abajo.
   Idioma por defecto: window.APP.lang (o español). Se cambia en Ajustes.
   ========================================================== */
const I18N = (() => {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(window.APP?.store || "jimmiteobot_v2") || "null")?.lang; } catch {}
  const lang = saved || window.APP?.lang || "es";
  return { lang, en: lang === "en", locale: lang === "en" ? "en-US" : "es" };
})();

const EN = {
  // navegación y encabezado
  "Hoy": "Today", "hoy": "today", "Log": "Log", "Comer": "Eat", "Bot": "Bot", "Ajustes": "Settings", "Ajus": "Set", "tes": "tings",
  "Día anterior": "Previous day", "Día siguiente": "Next day", "Cambiar fecha": "Change date", "días": "days", "Enviar": "Send",
  // Hoy
  "PARA TI": "FOR YOU", "CALORÍAS DE HOY": "TODAY'S CALORIES", "meta": "goal", "· te quedan": "· left", "Carbos": "Carbs", "Grasa": "Fat", "Proteína": "Protein",
  "PESO CORPORAL": "BODY WEIGHT", "Registrar peso de hoy": "Log today's weight", "sin registros": "no entries", "esta semana": "this week",
  "estable": "steady", "primer registro ✓": "first entry ✓", "último registro": "last entry",
  "Comidas de hoy": "Today's meals", "+ Agregar": "+ Add", "Aún no registras comidas.": "No meals logged yet.",
  "Toca": "Tap", "abajo, usa": "below, use", "o pídeselo al bot.": "or ask the bot.",
  // Comer
  "REGISTRAR COMIDA": "LOG A MEAL", "¿Qué vas a": "What are you", "comer?": "eating?", "kcal libres hoy": "kcal left today", "kcal por encima": "kcal over",
  "Escanear producto": "Scan product", "etiqueta + báscula": "label + scale", "Foto del plato": "Photo of your plate", "cuando comes fuera": "when eating out",
  "EXACTO": "EXACT", "ESTIMADO": "ESTIMATE", "Tus productos": "Your products", "ver todos": "see all", "pesar →": "weigh →",
  "Nuevo producto": "New product", "Escanea tu primer producto": "Scan your first product", "foto de la etiqueta": "photo of the label",
  "¿Sin etiqueta ni foto?": "No label or photo?", "Registrar a mano →": "Log it manually →",
  // hoja registrar producto
  "⚖️ Por peso": "⚖️ By weight", "🔢 Por unidades": "🔢 By units", "toca el número para escribirlo, o desliza": "tap the number to type it, or slide",
  "🍳 Pesado cocinado": "🍳 Weighed cooked", "🎯 Quiero X kcal": "🎯 I want X kcal", "kcal → te digo cuánto": "kcal → I'll tell you how much",
  "→ sírvete": "→ serve yourself", "→ come": "→ eat", "Datos de la etiqueta": "Label data", "VALORES POR (G)": "VALUES PER (G)",
  "CALORÍAS": "CALORIES", "PROTEÍNA (G)": "PROTEIN (G)", "CARBOS (G)": "CARBS (G)", "GRASA (G)": "FAT (G)",
  "1 UNIDAD = ? G": "1 UNIT = ? G", "NOMBRE UNIDAD": "UNIT NAME", "La etiqueta es del producto": "The label is for the", "crudo/seco": "raw/dry",
  "RENDIMIENTO: 1 g CRUDO → ? g COCIDO": "YIELD: 1 g RAW → ? g COOKED", "Borrar producto guardado": "Delete saved product",
  "Cancelar": "Cancel", "REGISTRAR": "LOG IT", "✅ etiqueta revisada": "✅ label checked", "escribe los gramos o desliza la barra": "type the grams or slide the bar",
  "pon cuántas unidades": "enter how many units", "Falta cuántos gramos es 1 unidad.": "Missing how many grams 1 unit weighs.",
  "Ponlo abajo en Datos de la etiqueta (sale en «Serving size»).": "Add it below in Label data (it's in “Serving size”).",
  "¿Qué es? (ej. pollo horneado)": "What is it? (e.g. baked chicken)", "unidad": "unit", "galleta": "cookie", "galletas": "cookies",
  "g": "g", "kcal": "kcal", "cocido": "cooked", "crudo": "raw",
  // hoja productos
  "Foto de la etiqueta, o elige uno que ya escaneaste (no gasta API).": "Photo of the label, or pick one you already scanned (no API cost).",
  "📷 ESCANEAR ETIQUETA": "📷 SCAN LABEL", "Ya escaneados": "Already scanned", "BUSCAR": "SEARCH", "pollo, arroz, papa…": "chicken, rice, potato…",
  "No lo encuentro. Escanea su etiqueta.": "Can't find it. Scan its label.", "Cerrar": "Close", "Etiqueta a mano": "Enter label manually",
  // foto del plato
  "Para comidas sin etiqueta. Es una estimación: cuéntame lo que sepas y la afino.": "For meals without a label. It's an estimate: tell me what you know and I'll refine it.",
  "tacos de pollo con guacamole, 3 unidades…": "chicken tacos with guacamole, 3 pieces…", "porción grande": "large portion", "porción pequeña": "small portion",
  "frito": "fried", "con salsa": "with sauce", "con queso": "with cheese", "compartido": "shared", "GRAMOS": "GRAMS", "(opcional, si lo pesaste)": "(optional, if you weighed it)",
  "ANALIZAR": "ANALYZE", "Revisa la estimación": "Review the estimate", "Estimación ajustada": "Adjusted estimate",
  "Sin etiqueta esto es una estimación. Corrige lo que sepas antes de registrar.": "Without a label this is an estimate. Fix what you know before logging.",
  "¿Algo no cuadra? ej. menos papas, sin aceite": "Something off? e.g. fewer fries, no oil", "AJUSTAR": "ADJUST", "NOMBRE": "NAME",
  "Confianza media: si sabes qué lleva el plato, díselo abajo.": "Medium confidence: if you know what's in it, say so below.",
  "Confianza baja: si sabes qué lleva el plato, díselo abajo.": "Low confidence: if you know what's in it, say so below.",
  "⚠️ No leí la etiqueta con total seguridad. Compárala.": "⚠️ I'm not fully sure about the reading. Compare it with the label.",
  // agregar / editar comida
  "Agregar comida": "Add meal", "Editar comida": "Edit meal", "Ajusta calorías y macros a tu porción.": "Adjust calories and macros to your portion.",
  "Arroz con pollo": "Chicken and rice", "AGREGAR": "ADD", "GUARDAR": "SAVE", "Eliminar esta comida": "Delete this meal",
  // peso
  "Registrar peso": "Log weight", "Gráfica de peso": "Weight chart",
  // Log
  "Tu progreso": "Your progress", "Días registrados": "Logged days", "prom.": "avg.", "Kcal": "Kcal", "Prot": "Prot", "Calorías": "Calories",
  "Registra tu peso en Hoy para ver tu progreso.": "Log your weight in Today to see your progress.", "Todavía no hay días con registros.": "No logged days yet.",
  // Ajustes
  "Metas diarias": "Daily goals", "Proteína (g)": "Protein (g)", "Carbos (g)": "Carbs (g)", "Grasa (g)": "Fat (g)",
  "Tu perfil": "Your profile", "Nombre": "Name", "Tu nombre": "Your name", "Objetivo": "Goal", "Perder": "Lose", "Mantener": "Maintain", "Ganar": "Gain",
  "PESO": "WEIGHT", "PESO (": "WEIGHT (", "ALTURA": "HEIGHT", "ALTURA (CM)": "HEIGHT (CM)", "ALTURA (FT/IN)": "HEIGHT (FT/IN)", "EDAD": "AGE", "SEXO": "SEX",
  "Hombre": "Male", "Mujer": "Female", "ACTIVIDAD": "ACTIVITY", "Sedentario": "Sedentary", "Ligera": "Light", "Moderada": "Moderate", "Alta": "High", "RITMO": "PACE",
  "⚡ Calcular mis macros": "⚡ Calculate my macros", "Completa peso, altura y edad para calcular tus macros.": "Fill in weight, height and age to calculate your macros.",
  "Completa peso, altura y edad ⚠️": "Fill in weight, height and age ⚠️",
  "Avanzado": "Advanced", "unidades, API y datos": "units, API and data", "IDIOMA · LANGUAGE": "LANGUAGE · IDIOMA",
  "sin configurar": "not set", "Editar": "Edit", "⬇ Exportar": "⬇ Export", "⬆ Importar": "⬆ Import", "Borrar todos los datos": "Delete all data",
  "IA activada: análisis de fotos y chat inteligente.": "AI on: photo analysis and smart chat.", "Modo local: comandos básicos sin conexión.": "Local mode: basic offline commands.",
  "Cerebro del bot": "Bot brain", "API KEY": "API KEY",
  "Pega tu API key de Anthropic para activar el análisis de fotos y el chat inteligente. Se guarda solo en este dispositivo.": "Paste your Anthropic API key to turn on photo analysis and smart chat. It's only stored on this device.",
  "Se eliminarán comidas, pesos, metas y el chat de este dispositivo. No se puede deshacer.": "Meals, weights, goals and chat on this device will be deleted. This can't be undone.",
  "BORRAR TODO": "DELETE ALL",
  // chat
  "en línea · listo para ayudarte": "online · ready to help", "Escríbele a tu coach…": "Message your coach…",
  "¿Cómo voy hoy?": "How am I doing today?", "Calcula mis macros": "Calculate my macros", "Un libro": "A book", "Consejo": "Tip",
  "Dame un consejo de salud": "Give me a health tip", "Recomiéndame un libro": "Recommend me a book",
  "Listo.": "Done.", "¡Anotado con la etiqueta! ⚖️": "Logged from the label! ⚖️", "¡Anotado en tu gráfica de peso! 📈": "Added to your weight chart! 📈",
  "¡Anotado! 🍽️ (macros aproximados de tabla USDA)": "Logged! 🍽️ (approximate macros from USDA table)", "¡Hecho! Meta actualizada. 💪": "Done! Goal updated. 💪",
  "Fecha actualizada 📅": "Date updated 📅",
  "Para calcular tus macros necesito tu peso, altura y edad. Complétalos en Ajustes ⚙️ y vuelve a pedírmelo.": "To calculate your macros I need your weight, height and age. Fill them in Settings ⚙️ and ask me again.",
  "No tengo ese alimento en mi tabla local 😅. Dímelo así: «agrega Nombre, 350 kcal, 20 proteína, 40 carbos, 10 grasa» — o activa la API key en Ajustes para que la IA estime cualquier comida.": "I don't have that food in my local table 😅. Tell me like this: “add Name, 350 kcal, 20 protein, 40 carbs, 10 fat” — or add the API key in Settings so the AI can estimate any meal.",
  "Estoy en modo local 🤖 (sin API key). Puedo hacer esto:": "I'm in local mode 🤖 (no API key). I can do this:",
  "Para conversación libre y análisis de fotos, agrega tu API key de Anthropic en Ajustes ⚙️✨": "For free chat and photo analysis, add your Anthropic API key in Settings ⚙️✨",
  "Consejo: prioriza la proteína en tu próxima comida 💪": "Tip: prioritize protein in your next meal 💪", "¡Vas muy bien, sigue así! 🔥": "You're doing great, keep it up! 🔥",
  // avisos
  "Comida actualizada ✏️": "Meal updated ✏️", "Comida eliminada 🗑️": "Meal deleted 🗑️", "Producto borrado 🗑️": "Product deleted 🗑️",
  "Datos exportados 💾": "Data exported 💾", "Datos importados ✅": "Data imported ✅", "⚠️ No pude leer ese archivo": "⚠️ Couldn't read that file",
  "Todo borrado. Empezamos de cero 🌱": "All deleted. Fresh start 🌱", "Ingresa un peso válido ⚠️": "Enter a valid weight ⚠️",
  "Agrega tu API key en Ajustes para analizar fotos 🤖": "Add your API key in Settings to analyze photos 🤖",
  "No pude identificar comida 😅": "I couldn't identify food 😅", "No pude ajustarlo 😅": "I couldn't adjust it 😅",
  "No pude leer la etiqueta 😅 Intenta de más cerca y con luz": "I couldn't read the label 😅 Try closer and with good light",
  "Escribe los gramos ⚖️": "Type the grams ⚖️", "Escribe los gramos de la báscula ⚖️": "Type the grams from the scale ⚖️",
  "Analizando…": "Analyzing…", "Analizando tu comida…": "Analyzing your food…", "Analizando tu plato…": "Analyzing your plate…",
  "Leyendo y revisando la etiqueta…": "Reading and checking the label…", "IA activada ✨": "AI on ✨", "Modo local activo": "Local mode on",
};

// Textos con números o nombres: [patrón en español, traducción]
const EN_PATTERNS = [
  [/^hoy · (.+)$/, "today · $1"],
  [/^(.+) · Tu coach de nutrición$/, "$1 · Your nutrition coach"],
  [/^Peso en (kg|lb)$/, "Weight in $1"],
  [/^Altura en centímetros$/, "Height in centimeters"],
  [/^Altura en pies y pulgadas$/, "Height in feet and inches"],
  [/^DE (\d+) KCAL$/, "OF $1 KCAL"],
  [/^META (\d+)$/, "GOAL $1"],
  [/^\+(\d+) kcal registradas (.*)$/, "+$1 kcal logged $2"],
  [/^REGISTRAR (\d+) KCAL$/, "LOG $1 KCAL"],
  [/^te quedarían (-?\d+) kcal hoy$/, "you'd have $1 kcal left today"],
  [/^te pasarías (\d+) kcal$/, "you'd go $1 kcal over"],
  [/^Ajusté: (\d+) →$/, "Adjusted: $1 →"],
  [/^(\d+(?:\.\d+)?) (.+) = (\d+(?:\.\d+)?) g según la etiqueta$/, "1 $2 = $3 g per the label"],
  [/^(.+) · (\d+(?:\.\d+)?) g cocido$/, "$1 · $2 g cooked"],
  [/^(.+) · (\d+(?:\.\d+)?) g crudo$/, "$1 · $2 g raw"],
  [/^(\d+) kcal \/ (\d+(?:\.\d+)?) g crudo$/, "$1 kcal / $2 g raw"],
  [/^Datos de la etiqueta · (.+)$/, "Label data · $1"],
  [/^(\d+) kcal · (\d+) comidas?$/, (m, a, b) => `${a} kcal · ${b} meal${b === "1" ? "" : "s"}`],
  [/^([▲▼]) (.+) en (\d+) registros$/, "$1 $2 over $3 entries"],
  [/^Peso · (\d+) semanas$/, "Weight · $1 weeks"],
  [/^(.+) · 7 días$/, (m, a) => `${EN[a] || a} · 7 days`],
  [/^gasto ~(\d+) kcal\/día · sugerido:$/, "burn ~$1 kcal/day · suggested:"],
  [/^Metas: (.+) ⚡$/, "Goals: $1 ⚡"],
  [/^(\d+(?:\.\d+)?) kg\/sem$/, "$1 kg/wk"],
  [/^Escríbele a (.+)…$/, "Message $1…"],
  [/^⚖️ Peso registrado: (.+)$/, "⚖️ Weight logged: $1"],
  [/^Peso registrado: (.+)$/, "Weight logged: $1"],
  [/^⚖️ Registré «(.+)» — (.+)$/, "⚖️ Logged “$1” — $2"],
  [/^✅ Registré «(.+)» — (.+) \(estimado por foto\)$/, "✅ Logged “$1” — $2 (photo estimate)"],
  [/^✅ Registré «(.+)» — (.+)$/, "✅ Logged “$1” — $2"],
  [/^🗑️ Eliminé «(.+)» \((\d+) kcal\)$/, "🗑️ Deleted “$1” ($2 kcal)"],
  [/^🎯 Nueva meta de (.+): (.+)$/, (m, a, b) => `🎯 New ${({ calorías: "calorie", proteína: "protein", carbos: "carb", grasa: "fat" })[a] || a} goal: ${b}`],
  [/^📅 Fecha cambiada a (.+)$/, "📅 Date changed to $1"],
  [/^⚠️ Las calorías \((\d+)\) no cuadran con los macros \((\d+)\)\. Revisa los datos\.$/, "⚠️ Calories ($1) don't match the macros ($2). Check the data."],
  [/^⚠️ Las calorías no cuadran con los macros \((.+)\)\.$/, "⚠️ Calories don't match the macros ($1)."],
  [/^⚠️ Los macros suman más que la porción \((.+)\)\.$/, "⚠️ The macros add up to more than the serving ($1)."],
  [/^⚠️ (\d+) kcal en (.+) es imposible\. Revisa la porción\.$/, "⚠️ $1 kcal in $2 is impossible. Check the serving."],
  [/^⚠️ El desglose suma (\d+) kcal pero el total dice (\d+)\. Revisa\.$/, "⚠️ The breakdown adds up to $1 kcal but the total says $2. Check it."],
  [/^No tengo «(.+)» guardado 🏷️\..*$/, "I don't have “$1” saved 🏷️. Scan its label once (Eat → Scan product) and then just tell me the grams."],
  [/^¡Hola(.*)! 👋 Soy (.+?)\.[\s\S]*$/, "Hi$1! 👋 I'm $2. I can log your meals and weight, calculate and change your goals, and recommend verified books and videos. How can I help?"],
  [/^📊 Hoy llevas (\d+) de (\d+) kcal \((?:te quedan (\d+)|¡(\d+) por encima!)\)\.$/, (m, a, b, c, d) => `📊 Today you're at ${a} of ${b} kcal (${c ? `${c} left` : `${d} over!`}).`],
  [/^🥩 Proteína (.+) · 🍚 Carbos (.+) · 🥑 Grasa (.+)$/, "🥩 Protein $1 · 🍚 Carbs $2 · 🥑 Fat $3"],
  [/^• «150 g de avena» → .*$/, "• “150 g of oats” → I use the label you scanned"],
  [/^• «Comí arroz con pollo» → .*$/, "• “I ate chicken and rice” → I log the meal"],
  [/^• «Calcula mis macros» → .*$/, "• “Calculate my macros” → goals from your profile"],
  [/^• «Cambia mi meta de proteína a 150»$/, "• “Change my protein goal to 150”"],
  [/^• «Borra la última comida» \/ «¿Cómo voy hoy\?»$/, "• “Delete the last meal” / “How am I doing today?”"],
  [/^• «Recomiéndame un libro \/ video \/ consejo»$/, "• “Recommend a book / video / tip”"],
  [/^(\d+(?:\.\d+)?) (galletas?|unidad(?:es)?)$/, (m, n, u) => `${n} ${({ galleta: "cookie", galletas: "cookies", unidad: "unit", unidades: "units" })[u]}`],
];

// «P 5 · C 27 · G 3» → en inglés la grasa es F (fat)
const fixFat = (x) => x.replace(/(C \d+(?:\.\d+)?g? · )G (\d)/g, "$1F $2").replace(/(\d+C · \d+)G\b/g, "$1F");
function trEN(text) {
  if (!I18N.en || !text) return text;
  const r = trEN0(text);
  return /C \d|\dC · /.test(r) ? fixFat(r) : r;
}
function trEN0(text) {
  const lead = text.match(/^\s*/)[0], trail = text.match(/\s*$/)[0], core = text.trim();
  if (!core) return text;
  if (core in EN) return lead + EN[core] + trail;
  for (const [re, rep] of EN_PATTERNS) if (re.test(core)) return lead + core.replace(re, rep) + trail;
  if (core.includes("\n")) {
    const out = core.split("\n").map((l) => (l.trim() ? trEN0(l) : l)).join("\n");
    return out === core ? text : lead + out + trail;
  }
  return text;
}
// para código: t("texto en español")
const t = (s) => trEN(s);

(() => {
  if (!I18N.en) return;
  document.documentElement.lang = "en";
  const ATTRS = ["placeholder", "aria-label", "title"];
  const doText = (n) => { const v = trEN(n.data); if (v !== n.data) n.data = v; };
  const doEl = (el) => {
    if (el.nodeType !== 1 || el.closest?.("script, style")) return;
    for (const a of ATTRS) { const v = el.getAttribute(a); if (v) { const w = trEN(v); if (w !== v) el.setAttribute(a, w); } }
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n;
    while ((n = tw.nextNode())) {
      if (n.nodeType === 3) doText(n);
      else if (n.tagName === "SCRIPT" || n.tagName === "STYLE") continue;
      else for (const a of ATTRS) { const v = n.getAttribute(a); if (v) { const w = trEN(v); if (w !== v) n.setAttribute(a, w); } }
    }
  };
  const start = () => {
    doEl(document.body);
    document.title = trEN(document.title);
    new MutationObserver((ms) => {
      for (const m of ms) {
        if (m.type === "characterData") doText(m.target);
        else if (m.type === "attributes") doEl(m.target);
        else m.addedNodes.forEach((x) => (x.nodeType === 3 ? doText(x) : doEl(x)));
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
