import sys
from PIL import Image
ids = sys.argv[2].split(","); out = sys.argv[1]; kind = sys.argv[3] if len(sys.argv) > 3 else "flat"
ims = [Image.open(f"out4/{i}-{kind}.png").convert("RGB") for i in ids]
H = 760; ims = [im.resize((round(im.width * H / im.height), H)) for im in ims]
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 4
rows = [ims[i:i + cols] for i in range(0, len(ims), cols)]
Wd = max(sum(i.width for i in r) for r in rows)
sheet = Image.new("RGB", (Wd, H * len(rows)), (200, 200, 200))
for ri, r in enumerate(rows):
    x = 0
    for im in r: sheet.paste(im, (x, ri * H)); x += im.width
sheet.thumbnail((2000, 2000)); sheet.save(out)
