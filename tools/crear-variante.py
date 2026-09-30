#!/usr/bin/env python3
"""Crea (o actualiza) otra versión de la app en una subcarpeta, con su propio
nombre y sus propios datos, usando el MISMO código (app.js, bot.js, estilos).

    python3 tools/crear-variante.py <carpeta> "<Nombre de la app>"

Vuelve a correrlo después de cambiar index.html para que la variante lo copie.
"""
import json, re, sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
folder, name = sys.argv[1], sys.argv[2]
out = root / folder
out.mkdir(exist_ok=True)
store = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_") + "_v1"

html = (root / "index.html").read_text()
# los recursos compartidos viven un nivel arriba
html = re.sub(r'(href|src)="(?!https?:|data:|#|\.\./)([^"]+\.(?:css|js|png|json)(?:\?[^"]*)?)"', r'\1="../\2"', html)
html = html.replace('href="../manifest.json"', 'href="manifest.json"')
html = re.sub(r'window\.APP = window\.APP \|\| \{[^}]*\};', f'window.APP = {{ name: {json.dumps(name)}, store: {json.dumps(store)} }};', html)
html = re.sub(r"<title>[^<]*</title>", f"<title>{name} · Tu coach de nutrición</title>", html)
html = re.sub(r'(name="apple-mobile-web-app-title" content=")[^"]*"', rf'\g<1>{name}"', html)
(out / "index.html").write_text(html)

manifest = json.loads((root / "manifest.json").read_text())
manifest.update(name=f"{name} — Coach de nutrición", short_name=name)
for icon in manifest["icons"]:
    icon["src"] = "../" + icon["src"].lstrip("./")
(out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
print(f"Listo: {folder}/ → «{name}» (datos en '{store}')")
