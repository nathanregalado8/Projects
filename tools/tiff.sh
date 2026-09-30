#!/bin/sh
# Regenera Tiff Fit (tiff/) con su configuración. Correr después de cambiar index.html.
cd "$(dirname "$0")/.." && python3 tools/crear-variante.py tiff "Tiff Fit" '{"notes": true, "firma": "NR", "verses": true, "bot": "Astro", "lang": "en", "accent": "#8C70CB", "macroColors": {"protein": "#4A78BA", "carbs": "#D8709A", "fat": "#8C70CB"}, "softColors": {"kcal": "#E6DEF5", "protein": "#DCE8F6", "carbs": "#F9DFE8", "fat": "#E9E2F7"}, "skin": "tiff-assets/skin.css", "icons": "tiff-assets/astro/astro-icon", "theme": "#FBF7F3"}'
