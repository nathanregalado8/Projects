# 🤖 JimmiteoBot 2.0

Tu coach de nutrición con IA — rediseño completo de la app original de "foto de tu comida".

![tema oscuro futurista, animaciones fluidas](https://img.shields.io/badge/estilo-futurista%20%E2%9C%A8-8b5cf6)

## ✨ Qué hay de nuevo

La app original tenía una sola pantalla (subir foto → analizar). Ahora es una app completa:

| Pestaña | Qué hace |
|---|---|
| **☀️ Hoy** | Anillo animado de calorías, barras de macros (proteína/carbos/grasa), **pesa y escanea** (báscula + foto de la etiqueta), productos guardados y lista de comidas editable |
| **📈 Log** | Gráfica de los últimos 7 días con línea de meta + historial de días registrados |
| **🤖 Bot** | Chat con JimmiteoBot: puede **editar la app por ti** (registrar comidas, cambiar metas, cambiar fechas, sumar agua) y recomienda **libros y videos reales** de salud con fuentes verificadas |
| **⚙️ Ajustes** | Perfil con cálculo de gasto energético (Mifflin-St Jeor), metas editables, API key, exportar/importar datos |

## ⚖️ Pesa y registra

Tres botones en **Hoy**, uno por caso:

| Botón | Para qué | Precisión |
|---|---|---|
| **⚖️ Pesar alimento** | Whole foods ya cocidos (pollo, papa, arroz, huevo…) con la tabla USDA por 100 g, o tus productos guardados. Eliges, pones gramos, registras. Sin IA. | La más alta |
| **🏷️ Etiqueta nueva** | Producto empacado: la IA lee la etiqueta 3 veces, marca discrepancias y chequea `4P+4C+9G ≈ kcal`. Si la etiqueta es cruda y lo pesaste cocinado, convierte con el rendimiento USDA. Queda guardado. | Alta |
| **📸 Foto del plato** | Comidas fuera o platos mixtos: 3 estimaciones, mediana y rango. | Estimación |

En el chat también: *«150 g de pechuga de pollo»*, *«180 g de arroz goya cocido»*.

## 🧠 El bot

Funciona en **dos modos**:

- **Modo local (sin configuración):** entiende comandos en español — *«comí arroz con pollo»*, *«cambia mi meta de proteína a 150»*, *«agrega un vaso de agua»*, *«¿cómo voy hoy?»*, *«recomiéndame un libro»*. Usa una tabla de alimentos con macros aproximados de USDA FoodData Central.
- **Modo IA (con API key de Anthropic):** conversación libre con Claude, análisis de fotos de comida por visión y edición de la app mediante *tool use* (el modelo llama herramientas como `add_meal`, `set_goal`, `set_date`).

Todo el contenido que recomienda es **verídico**: libros reales (Hábitos Atómicos, Por qué dormimos, Outlive…), videos/canales reales (Huberman Lab, Kurzgesagt, la conferencia de Robert Lustig…) y datos de salud con fuente (OMS, ISSN, National Sleep Foundation…). El prompt del bot le prohíbe inventar títulos o estudios.

## 🚀 Cómo usarla

Es una web app estática — no necesita instalación ni build:

```bash
# opción 1: abrir directo
open index.html

# opción 2: servir localmente
python3 -m http.server 8080
# → http://localhost:8080
```

Para activar la IA: **Ajustes → Cerebro del bot** y pega tu API key de [console.anthropic.com](https://console.anthropic.com). La key se guarda solo en `localStorage` de tu dispositivo y nunca se incluye en los exports.

## 🎨 Diseño

- Tema oscuro futurista con *glassmorphism*, blobs de gradiente animados y micro-interacciones.
- Paleta de datos validada para daltonismo sobre fondo oscuro: cian `#0891b2`, violeta `#8b5cf6`, ámbar `#d97706`, rosa `#f43f5e`, lima `#65a30d`.
- Animaciones: anillo de progreso, contadores, entrada de mensajes, indicador de escritura, transiciones de vista. Respeta `prefers-reduced-motion`.
- Mobile-first, funciona también en escritorio.

## 📁 Estructura

```
index.html    → estructura y vistas
styles.css    → tema, animaciones
app.js        → estado (localStorage), render, interacciones
bot.js        → cerebro del bot: acciones, NLU local y Claude API
knowledge.js  → base de conocimiento verificada + tabla de alimentos
```
