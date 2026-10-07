# One-ink cleanup at 300 dpi: drop hatch fragments shorter than 3 mm or smaller than 1 mm², then merge
# with the base (outlines, dark shapes, hawk, type). Writes the ink mask and coloured renders.
import numpy as np
from PIL import Image
from scipy import ndimage as nd
MM = 300 / 25.4
base = np.asarray(Image.open("out2/one-base.png").convert("L")) < 128
hatch = np.asarray(Image.open("out2/one-hatch.png").convert("L")) < 128
hatch &= ~base                         # only the parts that show
lab, n = nd.label(hatch)
objs = nd.find_objects(lab); areas = nd.sum(hatch, lab, range(1, n + 1))
keep = np.zeros(n + 1, bool)
for i, (sl, a) in enumerate(zip(objs, areas), start=1):
    h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
    keep[i] = a >= 1.0 * MM * MM and np.hypot(h, w) >= 3.0 * MM
clean = keep[lab]
print(f"hatch pieces {n}, removed {n - keep[1:].sum()}")
ink = base | clean
# also drop any knockout islands under 1mm² (they fill in anyway; better to print them solid on purpose)
holes, m = nd.label(~ink); hs = nd.sum(~ink, holes, range(1, m + 1))
small = np.zeros(m + 1, bool); small[1:] = hs < 1.0 * MM * MM
ink |= small[holes]
# knockouts narrower than ~1 mm fill in on press anyway: fill them in the file (opening with a 1 mm disk)
r = int(round(0.5 * MM)); yy, xx = np.mgrid[-r:r + 1, -r:r + 1]; disk = xx * xx + yy * yy <= r * r
opened = ~nd.binary_opening(np.pad(~ink, r + 1, constant_values=True), structure=disk)[r + 1:-(r + 1), r + 1:-(r + 1)]
cut = int(ink.shape[0] * 0.82)  # the illustration only; the type is clean vector and stays as drawn
ink[:cut] = opened[:cut]
Image.fromarray(np.where(ink, 0, 255).astype(np.uint8)).save("out2/one-ink.png")
def colour(mask, ink_rgb, bg):
    out = np.zeros(mask.shape + (4,), np.uint8); out[mask] = ink_rgb + (255,)
    if bg: out[~mask] = bg + (255,)
    return Image.fromarray(out)
colour(ink, (0x24, 0x38, 0x2A), (0xE9, 0xE2, 0xD0)).convert("RGB").save("out2/one-print.png")
colour(ink, (0x24, 0x38, 0x2A), None).save("out2/one-alpha.png")
c = np.asarray(Image.open("out2/one-chest.png").convert("L")) < 128
colour(c, (0x24, 0x38, 0x2A), (0xE9, 0xE2, 0xD0)).convert("RGB").save("out2/one-chest-print.png")
