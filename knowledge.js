/* ==========================================================
   JIMMITEOBOT — Base de conocimiento verificada
   Todos los libros, videos y datos son reales y citables.
   ========================================================== */

const KNOWLEDGE = {
  books: [
    { title: "Hábitos Atómicos", author: "James Clear", year: 2018,
      why: "El bestseller sobre cómo cambios del 1% construyen hábitos de salud que duran. Ideal si te cuesta ser constante con la comida o el ejercicio." },
    { title: "Por qué dormimos", author: "Matthew Walker", year: 2017,
      why: "Neurocientífico de Berkeley explica por qué dormir 7–9 horas regula el hambre, el peso y el rendimiento." },
    { title: "Comer para no morir (How Not to Die)", author: "Dr. Michael Greger", year: 2015,
      why: "Revisión de evidencia sobre cómo la alimentación basada en plantas ayuda a prevenir las enfermedades más comunes." },
    { title: "El código de la obesidad", author: "Dr. Jason Fung", year: 2016,
      why: "Nefrólogo explica el papel de la insulina en el aumento de peso y por qué las dietas de solo 'contar calorías' a veces fallan." },
    { title: "Outlive: The Science and Art of Longevity", author: "Dr. Peter Attia", year: 2023,
      why: "Cómo usar ejercicio, nutrición y sueño como medicina preventiva para vivir más y mejor." },
    { title: "En defensa de la comida", author: "Michael Pollan", year: 2008,
      why: "Su regla famosa: «Come comida. No demasiada. Sobre todo plantas.» Un clásico contra los ultraprocesados." },
    { title: "Spark: The Revolutionary New Science of Exercise and the Brain", author: "Dr. John J. Ratey", year: 2008,
      why: "Psiquiatra de Harvard muestra cómo el ejercicio mejora memoria, ánimo y concentración." },
    { title: "Respira (Breath)", author: "James Nestor", year: 2020,
      why: "Investigación periodística sobre cómo respirar bien impacta el estrés, el sueño y la salud." },
    { title: "Salt Sugar Fat", author: "Michael Moss", year: 2013,
      why: "Premio Pulitzer: cómo la industria diseña los ultraprocesados para que no puedas parar de comerlos." },
  ],

  videos: [
    { title: "Sugar: The Bitter Truth", source: "Dr. Robert Lustig · UCSF (YouTube, 2009)",
      why: "La conferencia clásica (más de 25 millones de vistas) sobre el efecto del azúcar y la fructosa en el metabolismo." },
    { title: "Kurzgesagt – In a Nutshell", source: "Canal de YouTube",
      why: "Videos animados con fuentes citadas: prueba los de ayuno, azúcar, sobrepeso y sistema inmune." },
    { title: "Huberman Lab", source: "Dr. Andrew Huberman · Stanford (podcast/YouTube)",
      why: "Protocolos basados en ciencia sobre sueño, luz solar, ejercicio y nutrición." },
    { title: "Jeff Nippard", source: "Canal de YouTube",
      why: "Entrenamiento y nutrición 'science-based': hipertrofia, proteína y técnica con estudios citados." },
    { title: "What makes a good life?", source: "TED · Dr. Robert Waldinger (2015)",
      why: "El estudio de Harvard de 85+ años: las buenas relaciones también son salud. Uno de los TED más vistos de la historia." },
    { title: "FoundMyFitness", source: "Dra. Rhonda Patrick (YouTube/podcast)",
      why: "Ciencia profunda de micronutrientes, sauna, omega-3 y envejecimiento." },
  ],

  tips: [
    { text: "Para ganar músculo se recomiendan 1.6–2.2 g de proteína por kg de peso al día.", source: "International Society of Sports Nutrition" },
    { text: "Apunta a 25–38 g de fibra al día: frutas, verduras, avena y legumbres.", source: "Institute of Medicine (EE. UU.)" },
    { text: "La OMS recomienda al menos 150 minutos de ejercicio moderado por semana.", source: "Organización Mundial de la Salud" },
    { text: "Dormir 7–9 horas regula la grelina y la leptina, las hormonas del hambre.", source: "National Sleep Foundation / Matthew Walker" },
    { text: "Limita los azúcares libres a menos del 10% de tus calorías diarias.", source: "Organización Mundial de la Salud" },
    { text: "Come al menos 5 porciones (≈400 g) de frutas y verduras al día.", source: "Organización Mundial de la Salud" },
    { text: "Un déficit de ~500 kcal/día equivale a perder aproximadamente 0.5 kg por semana de forma sostenible.", source: "CDC / Mayo Clinic" },
    { text: "La proteína es el macronutriente más saciante: ayuda a controlar el apetito entre comidas.", source: "American Journal of Clinical Nutrition" },
    { text: "Beber agua antes de las comidas puede ayudar a comer menos y mantenerte hidratado.", source: "Estudios en Obesity (2010, Davy et al.)" },
    { text: "El músculo se construye con constancia: entrenar fuerza 2–3 veces por semana ya genera resultados.", source: "American College of Sports Medicine" },
  ],
};

/* Alimentos comunes con macros aproximados (por porción típica).
   Valores redondeados a partir de datos de USDA FoodData Central. */
const FOODS = [
  { keys: ["arroz"], name: "Arroz blanco cocido (1 taza)", kcal: 205, protein: 4, carbs: 45, fat: 0 },
  { keys: ["pollo", "pechuga"], name: "Pechuga de pollo (150 g)", kcal: 248, protein: 47, carbs: 0, fat: 5 },
  { keys: ["huevo"], name: "Huevo (1 unidad)", kcal: 72, protein: 6, carbs: 0, fat: 5 },
  { keys: ["arepa"], name: "Arepa de maíz (1 unidad)", kcal: 220, protein: 5, carbs: 40, fat: 5 },
  { keys: ["frijol", "frijoles", "caraotas"], name: "Frijoles cocidos (1 taza)", kcal: 245, protein: 15, carbs: 45, fat: 1 },
  { keys: ["aguacate", "palta"], name: "Aguacate (1/2 unidad)", kcal: 160, protein: 2, carbs: 9, fat: 15 },
  { keys: ["platano", "plátano", "tajada"], name: "Plátano maduro (1 unidad)", kcal: 218, protein: 2, carbs: 57, fat: 0 },
  { keys: ["banana", "banano", "cambur", "guineo"], name: "Banana (1 unidad)", kcal: 105, protein: 1, carbs: 27, fat: 0 },
  { keys: ["manzana"], name: "Manzana (1 unidad)", kcal: 95, protein: 0, carbs: 25, fat: 0 },
  { keys: ["avena"], name: "Avena cocida (1 taza)", kcal: 166, protein: 6, carbs: 28, fat: 4 },
  { keys: ["leche"], name: "Leche entera (1 vaso)", kcal: 149, protein: 8, carbs: 12, fat: 8 },
  { keys: ["yogur", "yogurt"], name: "Yogur griego (1 taza)", kcal: 146, protein: 20, carbs: 8, fat: 4 },
  { keys: ["pan"], name: "Pan (2 rebanadas)", kcal: 160, protein: 6, carbs: 30, fat: 2 },
  { keys: ["pasta", "espagueti", "spaghetti"], name: "Pasta cocida (1 taza)", kcal: 220, protein: 8, carbs: 43, fat: 1 },
  { keys: ["carne", "res", "bistec"], name: "Carne de res magra (150 g)", kcal: 270, protein: 39, carbs: 0, fat: 12 },
  { keys: ["salmon", "salmón"], name: "Salmón (150 g)", kcal: 280, protein: 30, carbs: 0, fat: 18 },
  { keys: ["atun", "atún"], name: "Atún en lata (1 lata)", kcal: 130, protein: 28, carbs: 0, fat: 1 },
  { keys: ["papa", "patata"], name: "Papa cocida (1 mediana)", kcal: 161, protein: 4, carbs: 37, fat: 0 },
  { keys: ["brocoli", "brócoli"], name: "Brócoli (1 taza)", kcal: 55, protein: 4, carbs: 11, fat: 0 },
  { keys: ["ensalada"], name: "Ensalada mixta (1 plato)", kcal: 80, protein: 3, carbs: 10, fat: 3 },
  { keys: ["queso"], name: "Queso (50 g)", kcal: 180, protein: 11, carbs: 1, fat: 15 },
  { keys: ["tortilla"], name: "Tortilla de maíz (2 unidades)", kcal: 125, protein: 3, carbs: 25, fat: 2 },
  { keys: ["lentejas"], name: "Lentejas cocidas (1 taza)", kcal: 230, protein: 18, carbs: 40, fat: 1 },
  { keys: ["almendras"], name: "Almendras (30 g)", kcal: 173, protein: 6, carbs: 6, fat: 15 },
  { keys: ["mani", "maní", "cacahuate"], name: "Mantequilla de maní (2 cdas)", kcal: 190, protein: 8, carbs: 7, fat: 16 },
  { keys: ["proteina", "proteína", "whey", "batido"], name: "Batido de proteína (1 scoop)", kcal: 120, protein: 24, carbs: 3, fat: 1 },
  { keys: ["cafe", "café"], name: "Café con leche (1 taza)", kcal: 70, protein: 4, carbs: 6, fat: 4 },
  { keys: ["jugo", "zumo"], name: "Jugo de naranja (1 vaso)", kcal: 110, protein: 2, carbs: 26, fat: 0 },
  { keys: ["pizza"], name: "Pizza (1 porción)", kcal: 285, protein: 12, carbs: 36, fat: 10 },
  { keys: ["hamburguesa"], name: "Hamburguesa (1 unidad)", kcal: 540, protein: 25, carbs: 40, fat: 30 },
  { keys: ["empanada"], name: "Empanada frita (1 unidad)", kcal: 290, protein: 8, carbs: 28, fat: 16 },
  { keys: ["sopa"], name: "Sopa casera (1 plato)", kcal: 150, protein: 8, carbs: 18, fat: 5 },
];

function findFood(text) {
  const t = text.toLowerCase();
  return FOODS.find((f) => f.keys.some((k) => t.includes(k))) || null;
}

function randomOf(list) {
  return list[Math.floor(Math.random() * list.length)];
}
