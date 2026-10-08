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
# a snow stripe on the right face ended in a straight vertical cut (x 2148, y 847-915, from the source art).
# Round 6 cut it on a diagonal inside a box, which left a ruler-flat edge at the box's top (round 9 review);
# now the stripe's end tapers to a point at the middle of the old cut, inside a cone about its own axis
T = np.array([2148.0, 881.0]); ax = np.array([-0.62, -0.78]); ax /= np.hypot(*ax)
yy, xx = np.mgrid[760:930, 1990:2160]
vx, vy = xx - T[0], yy - T[1]; along = vx * ax[0] + vy * ax[1]; across = np.abs(vx * ax[1] - vy * ax[0])
cone = (along < 0) | ((along < 110) & (across > along * 0.42))
blk = lab[760:930, 1990:2160]; ml, _ = nd.label(blk == 2); stripe = ml == ml[881 - 760, 2140 - 1990]   # that stripe only
blk[cone & stripe] = 0
# round 7 review: the lower-left snowfield's four forest tongues read as one repeated swoosh (same curve, length
# and spacing). One is cut back by about 40%, the long low one is broken by a 2.2 mm gap of snow, and one is
# drawn out about 6 mm further, tapering.
def band(tip, d, a0, a1, half, taper=False):
    """Pixels along axis d from tip (a0..a1 px along, within `half` px across; narrowing to the far end if taper)."""
    d = np.array(d) / np.hypot(*d); y0, x0 = int(tip[1] - 200), int(tip[0] - 200)
    yy, xx = np.mgrid[y0:y0 + 400, x0:x0 + 400]
    al, ac = (xx - tip[0]) * d[0] + (yy - tip[1]) * d[1], np.abs((xx - tip[0]) * -d[1] + (yy - tip[1]) * d[0])
    w = half * (np.clip((a1 - al) / (a1 - a0), 0, 1) ** 0.8 if taper else 1)
    return (slice(y0, y0 + 400), slice(x0, x0 + 400)), (al >= a0) & (al <= a1) & (ac <= w)
def taper_back(tip, d, cut, run, half):
    """Cut a forest tongue back by `cut` px from its tip, the new end narrowing to a knife point over `run` px
    (round 8's rounded cut-back and the 2.2 mm break read as square notches, round 9 review)."""
    sl, m = band(tip, d, -10, cut + run, half); d = np.array(d) / np.hypot(*d)
    yy, xx = np.mgrid[sl]; al = (xx - tip[0]) * d[0] + (yy - tip[1]) * d[1]; ac = np.abs((xx - tip[0]) * -d[1] + (yy - tip[1]) * d[0])
    gone = m & ((al < cut) | (ac > half * (al - cut) / run)); blk = lab[sl]; blk[gone & (blk == 0)] = 2
taper_back((920, 1375), (0.82, -0.57), 70, 90, 22)          # cut back about 40%, ending in a point
sl, m = band((1246, 1281), (-0.82, 0.57), -6, 72, 11, True); blk = lab[sl]; blk[m & (blk == 2)] = 0  # drawn out
out = np.zeros(a.shape, np.uint8)
for k, c in enumerate(INKS): out[lab == k] = c + (255,)
Image.fromarray(out).save("out5/peak-three.png")
np.save("out5/labels.npy", lab.astype(np.int8))
print("forest/moss/mist px", [(lab == k).sum() for k in range(3)])
