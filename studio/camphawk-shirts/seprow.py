# Like sepgen.py, for art whose silhouette is convex per row (the mountain+reflection diamond):
# paper = outside each row's leftmost..rightmost inked pixel.
import sys, numpy as np
from PIL import Image, ImageFilter
src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB").filter(ImageFilter.MedianFilter(3))
a = np.asarray(im, dtype=np.int16); L = np.asarray(im.convert("L"), dtype=np.int16)
light = L > 200
mid = (L >= 70) & (L <= 200) & ((a[..., 0] - a[..., 2]) > 30)   # olive/khaki: warm
dark = (~light) & (~mid)
inside = np.zeros_like(light)
for y in range(L.shape[0]):
    xs = np.where(~light[y])[0]
    if len(xs) > 1: inside[y, xs[0] + 6: xs[-1] - 5] = True
# paper also reaches into notches (e.g. between a sub-peak and the main slope): flood from the border
from PIL import ImageDraw
fl = Image.fromarray(np.where(light, 255, 0).astype(np.uint8))
for x in range(0, fl.width, 16):
    for y in (0, fl.height - 1):
        if fl.getpixel((x, y)) == 255: ImageDraw.floodfill(fl, (x, y), 128)
for y in range(0, fl.height, 16):
    for x in (0, fl.width - 1):
        if fl.getpixel((x, y)) == 255: ImageDraw.floodfill(fl, (x, y), 128)
paper = np.asarray(fl) == 128
lt = light & inside & ~paper
# lakeflat-2 only: a sky pocket beside the small left sub-peak (and its reflection) is sealed by a
# hairline, so the flood can't reach it; it is sky, not snow
if "lakeflat-2" in src:
    lt[205:265, 315:375] = False; lt[760:820, 315:375] = False
S = 4
for name, m in (("dark", dark), ("mid", mid), ("light", lt)):
    img = Image.fromarray(np.where(m, 0, 255).astype(np.uint8))
    img = img.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))  # drop specks
    img.resize((img.width * S, img.height * S), Image.LANCZOS).filter(ImageFilter.GaussianBlur(2)).point(lambda v: 0 if v < 128 else 255).save(f"{out}-{name}.png")
