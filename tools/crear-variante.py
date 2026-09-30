#!/usr/bin/env python3
"""Crea (o actualiza) otra versión de la app en una subcarpeta, con su propio
nombre y sus propios datos, usando el MISMO código (app.js, bot.js, estilos).

    python3 tools/crear-variante.py <carpeta> "<Nombre de la app>" ['{"notes": true, "firma": "NR"}']

El tercer argumento (opcional) agrega opciones: notes = frases del día de
frases.js, firma = quién las firma.

Vuelve a correrlo después de cambiar index.html para que la variante lo copie.
"""
import json, re, sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
folder, name = sys.argv[1], sys.argv[2]
extra = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}
# opciones del generador (no van a window.APP):
#   skin  = hoja de estilos extra (ruta desde la raíz), cargada después de styles.css
#   icons = carpeta con icon-180/192/512 (<prefijo>-180.png, etc.)
skin = extra.pop("skin", None)
icons = extra.pop("icons", None)
theme = extra.pop("theme", None)   # color de la barra del teléfono / fondo al abrir
out = root / folder
out.mkdir(exist_ok=True)
store = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_") + "_v1"

html = (root / "index.html").read_text()
# los recursos compartidos viven un nivel arriba
html = re.sub(r'(href|src)="(?!https?:|data:|#|\.\./)([^"]+\.(?:css|js|png|json)(?:\?[^"]*)?)"', r'\1="../\2"', html)
html = html.replace('href="../manifest.json"', 'href="manifest.json"')
html = re.sub(r'window\.APP = window\.APP \|\| \{[^}]*\};', "window.APP = " + json.dumps({"name": name, "store": store, **extra}, ensure_ascii=False) + ";", html)
html = re.sub(r"<title>[^<]*</title>", f"<title>{name} · Tu coach de nutrición</title>", html)
html = re.sub(r'(name="apple-mobile-web-app-title" content=")[^"]*"', rf'\g<1>{name}"', html)
if theme:
    html = re.sub(r'(<meta name="theme-color" content=")[^"]*"', rf'\g<1>{theme}"', html)
if skin:
    html = re.sub(r'(<link rel="stylesheet" href="\.\./styles\.css[^"]*">)', rf'\1\n  <link rel="stylesheet" href="../{skin}">', html)
if icons:
    html = re.sub(r'<link rel="apple-touch-icon" href="[^"]*">', f'<link rel="apple-touch-icon" href="../{icons}-180.png">', html)
    html = re.sub(r'<link rel="icon" href="[^"]*">', f'<link rel="icon" type="image/png" href="../{icons}-192.png">', html)
(out / "index.html").write_text(html)

manifest = json.loads((root / "manifest.json").read_text())
manifest.update(name=f"{name} — Coach de nutrición", short_name=name)
for icon in manifest["icons"]:
    icon["src"] = f"../{icons}-{icon['sizes'].split('x')[0]}.png" if icons else "../" + icon["src"].lstrip("./")
if theme:
    manifest.update(background_color=theme, theme_color=theme)
if extra.get("lang") == "en":
    manifest.update(name=f"{name} — Nutrition coach", description="Log meals and weight, calculate your macros and chat with your coach.", lang="en")
(out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
print(f"Listo: {folder}/ → «{name}» (datos en '{store}')")
