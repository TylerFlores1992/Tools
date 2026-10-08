# Finishing for the round 5 kit: prep5 rules, then trim to the art plus 3 mm, then write
#  - the composite 300 dpi PNG (tagged 300 dpi; DTF and DTG print this, inks butted, no overlap);
#  - one black-on-white separation per ink for screens, trapped: lighter inks spread under darker ones
#    (moss and mist 4 px = 0.34 mm under forest, mist 3 px = 0.25 mm under moss, as discs of radius n + 0.5 so
#    the reach is whole pixels; round 7's true 0.3 mm disc reached only 3 px), never within 0.3 mm of bare
#    shirt; pinholes in a separation over a darker ink are filled; tagged 300 dpi;
#  - the screen films (kit/{name}_film{k}-{ink}.png, 1-bit): each separation on a 0.5 in margin with three
#    identical registration crosshairs and a label (ink, hex, print order, right reading). These PNGs are the
#    masters (round 9: the traced SVGs bring back a few hundred px of sub-0.4 mm tips the PNGs don't have);
#  - one untrapped mask per ink (out5/final/{name}-ink{k}.png) that the all-inks SVG is traced from (round 6
#    traced the trapped films, so the spread light inks painted over forest edges).
# args: name inks(comma name:hex, darkest first) typeTop
import sys, subprocess, json
import numpy as np
from PIL import Image
from scipy import ndimage as nd
MM = 300 / 25.4
name, top = sys.argv[1], int(sys.argv[3])
names, inks = zip(*(p.split(":") for p in sys.argv[2].split(",")))
lab = np.load(f"out5/final/{name}-labels.npy")
subprocess.run(["python3", "prep5.py", f"out5/final/{name}-labels.npy", str(top), f"out5/final/{name}-prep.npy"], check=True)
lab = np.load(f"out5/final/{name}-prep.npy").astype(np.int16)
ys, xs = np.nonzero(lab >= 0); m = int(round(3 * MM))
y0, y1, x0, x1 = max(ys.min() - m, 0), min(ys.max() + m + 1, lab.shape[0]), max(xs.min() - m, 0), min(xs.max() + m + 1, lab.shape[1])
lab = lab[y0:y1, x0:x1]
hexrgb = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
out = np.zeros(lab.shape + (4,), np.uint8)
for k, h in enumerate(inks): out[lab == k] = hexrgb(h) + (255,)
Image.fromarray(out).save(f"kit/{name}_300dpi.png", dpi=(300, 300))
def disk(r):
    n = int(np.ceil(r)); y, x = np.mgrid[-n:n + 1, -n:n + 1]; return x * x + y * y <= r * r
from PIL import ImageDraw, ImageFont
FONT = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 40)
def film(sep, k):
    """The separation on a 0.5 in margin, with three registration crosshairs and a label."""
    m = 150; h, w = sep.shape; im = Image.new("L", (w + 2 * m, h + 2 * m), 255); im.paste(Image.fromarray(sep), (m, m))
    d = ImageDraw.Draw(im)
    for cx, cy in [((w + 2 * m) // 2, m // 2), (m // 2, (h + 2 * m) // 2), (w + m + m // 2, (h + 2 * m) // 2)]:
        d.ellipse([cx - 32, cy - 32, cx + 32, cy + 32], outline=0, width=7); d.line([cx - 60, cy, cx + 60, cy], fill=0, width=7); d.line([cx, cy - 60, cx, cy + 60], fill=0, width=7)
    order = len(inks) - k                                  # lightest first: mist, moss, forest
    d.text((m, h + m + 40), f"{name}  |  film {k + 1} of {len(inks)}: {names[k]} {inks[k]}  |  print {order} of {len(inks)}  |  RIGHT READING", font=FONT, fill=0)
    im.save(f"out5/final/{name}-film{k + 1}.png", dpi=(300, 300))
    im.convert("1").save(f"kit/{name}_film{k + 1}-{names[k]}.png", dpi=(300, 300))   # the master film: 1-bit, 300 dpi
    return im.size
inside = nd.distance_transform_edt(lab != -1) > 0.3 * MM      # at least 0.3 mm from bare shirt
reach = lambda mm: int(np.ceil(mm * MM - 1e-9)) + 0.5            # whole pixels: 0.3 mm -> 4 px, 0.25 mm -> 3 px
seps, films = [], []
for k in range(len(inks)):
    s = lab == k
    darker = np.isin(lab, list(range(k)))                 # inks are listed darkest first
    for j in range(k):
        spread = 0.3 if j == 0 else 0.25
        s = s | (nd.binary_dilation(lab == k, disk(reach(spread))) & (lab == j) & inside)
    hl, hn = nd.label(~s); hs = nd.sum(~s, hl, range(1, hn + 1))
    pin = np.r_[False, hs < 0.5 * MM * MM][hl] & darker  # film pinholes over a darker ink
    # knockouts under thin dark detail (the forest gouges in the moss) left 0.3 mm hairlines on the film that a
    # screen can't hold: under darker ink, any knockout narrower than 1 mm closes, so the light ink runs under it
    pin |= nd.binary_closing(np.pad(s, 12), disk(0.5 * MM))[12:-12, 12:-12] & ~s & darker & inside   # 0.3 mm off shirt
    s |= pin
    sep = np.where(s, 0, 255).astype(np.uint8)
    Image.fromarray(sep).save(f"out5/final/{name}-sep{k + 1}.png", dpi=(300, 300)); films.append(film(sep, k))
    Image.fromarray(np.where(lab == k, 0, 255).astype(np.uint8)).save(f"out5/final/{name}-ink{k + 1}.png", dpi=(300, 300))
    print(f"  sep {k + 1}: {int(pin.sum())} pinhole px filled")
    seps.append(int(s.sum()))
json.dump({"w": int(lab.shape[1]), "h": int(lab.shape[0]), "inks": seps, "film": films[0]}, open(f"out5/final/{name}-size.json", "w"))
print(name, f"trimmed to {lab.shape[1] / 300:.2f} x {lab.shape[0] / 300:.2f} in", "ink area in2", [round(v / 90000, 1) for v in seps])
