# Inlines fonts/*.woff2 as data URIs into fonts.css (Chromium's setContent can't load file:// fonts).
import base64, os
names = {"alfa-slab-one": "Alfa Slab One", "bebas-neue": "Bebas Neue", "yellowtail": "Yellowtail", "rye": "Rye", "oswald": "Oswald", "zilla-slab": "Zilla Slab", "josefin-sans": "Josefin Sans", "arvo": "Arvo", "fraunces": "Fraunces", "ultra": "Ultra", "big-shoulders-display": "Big Shoulders Display", "dm-serif-display": "DM Serif Display", "sancreek": "Sancreek", "kaushan-script": "Kaushan Script", "roboto-slab": "Roboto Slab", "barlow-condensed": "Barlow Condensed"}
out = []
for f in sorted(os.listdir("fonts")):
    base, w = f[:-6].rsplit("-", 1)
    b = base64.b64encode(open("fonts/" + f, "rb").read()).decode()
    out.append(f"@font-face{{font-family:'{names[base]}';font-weight:{w};src:url(data:font/woff2;base64,{b}) format('woff2')}}")
open("fonts.css", "w").write("\n".join(out))
