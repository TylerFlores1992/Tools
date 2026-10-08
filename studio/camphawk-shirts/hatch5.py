# Round 5 polish, step 2: the one-ink peak built from the three-ink drawing, and the three-ink peak carved (the reviewer: the old one-ink
# hatching read as auto-traced capsules). Forest stays solid ink, snow becomes bare shirt, and each moss area
# becomes hand-cut gouge strokes: lenses pointed at both ends, laid along that area's own long axis (the way
# the rock face runs), 1.15 mm wide at most with 1.3 mm of shirt between them. Writes out5/peak-one.png.
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd
MM = 300 / 25.4
FOREST = (0x24, 0x38, 0x2A)
lab = np.load("out5/labels.npy")
H, W = lab.shape
S = 2                                               # draw at 2x, then average down: smooth stroke edges
moss = lab == 1
l, n = nd.label(moss); objs = nd.find_objects(l)
def gouges(pitch, wmax_mm, seed):
    """Tapered strokes (lenses, sharp at both ends) along each moss area's long axis, as a 2x mask."""
    img = Image.new("L", (W * S, H * S), 0); d = ImageDraw.Draw(img); count = 0
    WMAX = wmax_mm * MM
    for i, sl in enumerate(objs, start=1):
        m = l[sl] == i
        ys, xs = np.nonzero(m)
        if len(ys) < 20: continue
        ys = ys + sl[0].start; xs = xs + sl[1].start
        cy, cx = ys.mean(), xs.mean()
        w, v = np.linalg.eigh(np.cov(np.vstack([xs - cx, ys - cy])))
        ux, uy = v[:, 1]
        if uy < 0: ux, uy = -ux, -uy
        nx, ny = -uy, ux
        t = (xs - cx) * nx + (ys - cy) * ny; s = (xs - cx) * ux + (ys - cy) * uy
        off = t.min() + pitch * 0.5 + ((i * 0.37 + seed) % 1) * pitch * 0.4
        full = l == i
        while off < t.max():
            ss = np.arange(s.min() - 5, s.max() + 5, 1.0)
            px = np.round(cx + ux * ss + nx * off).astype(int); py = np.round(cy + uy * ss + ny * off).astype(int)
            ok = (px >= 0) & (px < W) & (py >= 0) & (py < H)
            inside = np.zeros_like(ss, bool); inside[ok] = full[py[ok], px[ok]]
            edges = np.flatnonzero(np.diff(np.r_[0, inside.astype(int), 0]))
            for a0, b0 in zip(edges[::2], edges[1::2]):
                L = b0 - a0
                if L < 3 * MM: continue
                s0, s1 = ss[a0], ss[b0 - 1]
                wm = min(WMAX, L * 0.12)
                pl, pr = [], []
                for f in np.linspace(0, 1, 28):
                    sm = s0 + (s1 - s0) * f; half = wm / 2 * np.sin(np.pi * f) ** 1.3   # sharper points
                    bx, by = cx + ux * sm + nx * off, cy + uy * sm + ny * off
                    pl.append(((bx + nx * half) * S, (by + ny * half) * S)); pr.append(((bx - nx * half) * S, (by - ny * half) * S))
                d.polygon(pl + pr[::-1], fill=255); count += 1
            off += pitch * (0.9 + 0.2 * ((off * 7.3) % 1))
    return np.asarray(img.resize((W, H), Image.BOX)) >= 128, count
# three-ink: a few dark gouges cut into the moss (forest ink), so this shirt is carved too
g3, c3 = gouges(4.4 * MM, 1.0, 0.5)
lab3 = lab.copy(); lab3[g3 & (lab == 1)] = 0
out3 = np.zeros((H, W, 4), np.uint8)
for k, c in enumerate([(0x2A, 0x3B, 0x2E), (0x4E, 0x5C, 0x3B), (0xE2, 0xE6, 0xDC)]): out3[lab3 == k] = c + (255,)
Image.fromarray(out3).save("out5/peak-three.png")
# one-ink: forest solid, snow bare, moss as ink gouges on bare shirt
g1, strokes = gouges(3.8 * MM, 1.35, 0.0)
ink = Image.fromarray((((lab == 0) | g1) * 255).astype(np.uint8)).resize((W * S, H * S), Image.NEAREST)
inkm = np.asarray(ink.resize((W, H), Image.BOX)) >= 128
# print floor, set here above the kit prep's own (2 mm2, 0.8 mm) so no later rule picks which marks survive
# (round 9's technician found the prep deleting 4 hatch dashes and filling 3 cuts): ink marks under 2.5 mm2 or
# under 0.9 mm at their widest go, and shirt cuts under 2.5 mm2 fill
l2, n2 = nd.label(inkm); idx = range(1, n2 + 1); sz = nd.sum(inkm, l2, idx)
wide = 2 * nd.maximum(nd.distance_transform_edt(np.pad(inkm, 1))[1:-1, 1:-1], l2, idx)
inkm &= np.r_[False, (sz >= 2.5 * MM * MM) & (wide >= 0.9 * MM)][l2]
inside = nd.binary_fill_holes(lab >= 0)
h3, n3 = nd.label(~inkm & inside & (lab != 2)); sz3 = nd.sum(h3 > 0, h3, range(1, n3 + 1)); inkm |= np.r_[False, sz3 < 2.5 * MM * MM][h3]
out = np.zeros((H, W, 4), np.uint8); out[inkm] = FOREST + (255,)
Image.fromarray(out).save("out5/peak-one.png")
print("moss areas", n, "one-ink strokes", strokes, "three-ink gouges", c3)
