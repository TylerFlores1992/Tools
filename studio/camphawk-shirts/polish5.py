# Round 5 polish (2026-10-08), step 1: the three-ink peak, cleaned. Fills every speck of bare shirt and every
# ink island under 1.5 mm2 inside the peak with the ink around it (the reviewer's "light flecks at the moss
# tips"), and takes the old camp out (it is redrawn bigger in round5.mjs). Writes out5/peak-three.png and the
# ink labels out5/labels.npy (-1 shirt, 0 forest, 1 moss, 2 mist) that the one-ink version is built from.
import numpy as np
from PIL import Image
from scipy import ndimage as nd
MM = 300 / 25.4
INKS = [(0x2A, 0x3B, 0x2E), (0x4E, 0x5C, 0x3B), (0xE2, 0xE6, 0xDC)]
a = np.asarray(Image.open("out4/peak-three.png").convert("RGBA")).astype(int)
lab = np.full(a.shape[:2], -1)
for k, c in enumerate(INKS): lab[(a[..., 3] > 128) & (np.abs(a[..., :3] - np.array(c)).sum(-1) < 40)] = k
inside = nd.binary_fill_holes(a[..., 3] > 128)
# the old camp: forest on the snowfield at the foot of the peak becomes snow
z = (slice(1425, 1614), slice(1585, 2175)); lab[z][lab[z] == 0] = 2
for _ in range(3):                                   # repeat: filling can create new tiny islands
    changed = 0
    for k in [-1, 0, 1, 2]:
        m = (lab == k) & inside
        l, n = nd.label(m); s = nd.sum(m, l, range(1, n + 1)); objs = nd.find_objects(l)
        for i in np.nonzero(s < 1.5 * MM * MM)[0] + 1:
            sl = objs[i - 1]
            sl = (slice(max(sl[0].start - 3, 0), sl[0].stop + 3), slice(max(sl[1].start - 3, 0), sl[1].stop + 3))
            blob = (l[sl] == i); ring = nd.binary_dilation(blob, iterations=2) & ~blob
            vals = lab[sl][ring]; vals = vals[vals != k]
            if len(vals): lab[sl][blob] = np.bincount(vals + 1).argmax() - 1; changed += 1
    print("filled", changed)
    if not changed: break
out = np.zeros(a.shape, np.uint8)
for k, c in enumerate(INKS): out[lab == k] = c + (255,)
Image.fromarray(out).save("out5/peak-three.png")
np.save("out5/labels.npy", lab.astype(np.int8))
print("forest/moss/mist px", [(lab == k).sum() for k in range(3)])
