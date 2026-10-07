# Print check at real size (300 dpi): separates a flat render into inks, then finds knockouts thinner
# than 1 mm and printed lines thinner than 0.3 mm (morphological opening with PIL Min/Max filters).
import sys
from PIL import Image, ImageFilter, ImageChops
path, shirt, *inks = sys.argv[1:]
hexrgb = lambda h: tuple(int(h[i:i+2], 16) for i in (1, 3, 5))
im = Image.open(path).convert("RGB")
pal = [hexrgb(shirt)] + [hexrgb(i) for i in inks]
p = Image.new("P", (1, 1)); p.putpalette(sum(pal, ()) + (0, 0, 0) * (256 - len(pal)))
q = im.quantize(palette=p, dither=Image.Dither.NONE)
DPI = 300; MM = DPI / 25.4
def opened(mask, k):  # remove features narrower than k px
    k = max(3, int(k) | 1)
    return mask.filter(ImageFilter.MinFilter(k)).filter(ImageFilter.MaxFilter(k))
anyink = q.point(lambda v: 255 if v != 0 else 0, "L")
gaps = anyink.point(lambda v: 255 - v)
lost_gap = ImageChops.subtract(gaps, opened(gaps, 1.0 * MM))
out = {"thin knockouts (<1mm)": lost_gap}
for n, h in enumerate(inks, start=1):
    m = q.point(lambda v, n=n: 255 if v == n else 0, "L")
    out[f"thin lines ink {h} (<0.3mm)"] = ImageChops.subtract(m, opened(m, 0.3 * MM))
    m.save(path.replace(".png", f"-sep{n}.png"))
for k, m in out.items():
    px = sum(1 for v in m.getdata() if v > 0)
    print(f"{k}: {px} px ({px / (MM*MM):.1f} mm²)")
# overlay of problems in red on a grey copy
vis = im.convert("L").convert("RGB")
red = Image.new("RGB", im.size, (255, 0, 0))
for m in out.values(): vis.paste(red, mask=m.filter(ImageFilter.MaxFilter(5)))
vis.save(path.replace(".png", "-check.png"))
