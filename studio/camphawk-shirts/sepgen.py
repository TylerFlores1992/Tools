# Separates a Recraft 3-colour print on light paper into ink masks: dark, mid, light (snow/water
# highlights inside the art) and paper (no ink). Snow and paper are the same white, so paper is found
# by flood-filling from the border through a closed silhouette of the inked shapes.
import sys
from PIL import Image, ImageFilter, ImageDraw
src, out, k = sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 21
im = Image.open(src).convert("RGB").filter(ImageFilter.MedianFilter(3))
W, H = im.size
L = im.convert("L")
light = L.point(lambda v: 255 if v > 200 else 0)
dark = L.point(lambda v: 255 if v < 95 else 0)
# mid = tan/olive: in between, and warmer (R > B)
r, g, b = im.split()
warm = Image.merge("RGB", (r, g, b)).point(lambda v: v)
mid = Image.new("L", (W, H), 0); pm = mid.load(); pi = im.load(); pl = L.load()
for y in range(H):
    for x in range(W):
        v = pl[x, y]
        if 95 <= v <= 200:
            R, G, B = pi[x, y]
            pm[x, y] = 255 if R - B > 18 else 0
# anything inked (not light) — dark-ish greys without warmth count as dark
inked = light.point(lambda v: 255 - v)
pd = dark.load(); pk = inked.load()
for y in range(H):
    for x in range(W):
        if pk[x, y] and not pm[x, y]: pd[x, y] = 255
closed = inked.filter(ImageFilter.MaxFilter(k)).filter(ImageFilter.MinFilter(k))
# flood the paper from the border on the inverted closed silhouette
canvas = closed.point(lambda v: 0 if v else 255).convert("L")
seedval = 128
for x in range(0, W, 8):
    for y in (0, H - 1):
        if canvas.getpixel((x, y)) == 255: ImageDraw.floodfill(canvas, (x, y), seedval)
for y in range(0, H, 8):
    for x in (0, W - 1):
        if canvas.getpixel((x, y)) == 255: ImageDraw.floodfill(canvas, (x, y), seedval)
paper = canvas.point(lambda v: 255 if v == seedval else 0)
# light ink = light pixels not paper
lt = Image.new("L", (W, H), 0); pt = lt.load(); pp = paper.load(); pli = light.load()
# keep light ink only well inside the art: paper grown by 4px eats the fringe along silhouettes
pp = paper.filter(ImageFilter.MaxFilter(9)).load()
for y in range(H):
    for x in range(W):
        if pli[x, y] and not pp[x, y]: pt[x, y] = 255
lt = lt.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))  # drop specks
S = 4
for name, m in (("dark", dark), ("mid", mid), ("light", lt)):
    m = m.resize((W * S, H * S), Image.LANCZOS).filter(ImageFilter.GaussianBlur(2)).point(lambda v: 0 if v > 127 else 255)
    m.save(f"{out}-{name}.png")  # black = ink, for potrace
