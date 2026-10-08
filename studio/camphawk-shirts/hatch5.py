# Round 5 polish, step 2: the one-ink peak built from the three-ink drawing (the reviewer: the old one-ink
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
ink = Image.new("L", (W * S, H * S), 0); d = ImageDraw.Draw(ink)
ink.paste(Image.fromarray(((lab == 0) * 255).astype(np.uint8)).resize((W * S, H * S), Image.NEAREST))
moss = lab == 1
l, n = nd.label(moss); objs = nd.find_objects(l)
WMAX, PITCH = 1.15 * MM, 2.45 * MM
strokes = 0
for i, sl in enumerate(objs, start=1):
    m = l[sl] == i
    ys, xs = np.nonzero(m)
    if len(ys) < 20: continue
    ys = ys + sl[0].start; xs = xs + sl[1].start
    cy, cx = ys.mean(), xs.mean()
    cov = np.cov(np.vstack([xs - cx, ys - cy])); w, v = np.linalg.eigh(cov)
    ux, uy = v[:, 1]                                 # long axis
    if uy < 0: ux, uy = -ux, -uy
    nx, ny = -uy, ux                                 # across the strokes
    # project the area's pixels onto the across-axis to find its extent, then walk strokes across it
    t = (xs - cx) * nx + (ys - cy) * ny; s = (xs - cx) * ux + (ys - cy) * uy
    off = t.min() + PITCH * 0.5 + (i * 0.37 % 1) * PITCH * 0.4
    full = l == i
    while off < t.max():
        # sample along the stroke line, find the runs inside this moss area
        ss = np.arange(s.min() - 5, s.max() + 5, 1.0)
        px = np.round(cx + ux * ss + nx * off).astype(int); py = np.round(cy + uy * ss + ny * off).astype(int)
        ok = (px >= 0) & (px < W) & (py >= 0) & (py < H)
        inside = np.zeros_like(ss, bool); inside[ok] = full[py[ok], px[ok]]
        # runs
        edges = np.flatnonzero(np.diff(np.r_[0, inside.astype(int), 0]))
        for a, b in zip(edges[::2], edges[1::2]):
            L = b - a
            if L < 3 * MM: continue
            s0, s1 = ss[a], ss[b - 1]
            # stay 0.5 mm off the snow (bare shirt) at each end so tips don't touch the paper edge bluntly
            wmax = min(WMAX, L * 0.12)
            pts_l, pts_r = [], []
            for f in np.linspace(0, 1, 24):
                sm = s0 + (s1 - s0) * f; half = wmax / 2 * np.sin(np.pi * f) ** 0.8
                bx, by = cx + ux * sm + nx * off, cy + uy * sm + ny * off
                pts_l.append(((bx + nx * half) * S, (by + ny * half) * S)); pts_r.append(((bx - nx * half) * S, (by - ny * half) * S))
            d.polygon(pts_l + pts_r[::-1], fill=255); strokes += 1
        off += PITCH * (0.9 + 0.2 * ((off * 7.3) % 1))   # slightly uneven spacing, like a hand cut
inkm = np.asarray(ink.resize((W, H), Image.BOX)) >= 128
# print floor: drop ink specks under 1 mm2 and fill shirt holes under 1 mm2
l2, n2 = nd.label(inkm); sz = nd.sum(inkm, l2, range(1, n2 + 1)); inkm &= np.r_[False, sz >= MM * MM][l2]
inside = nd.binary_fill_holes(lab >= 0)
h3, n3 = nd.label(~inkm & inside & (lab != 2)); sz3 = nd.sum(h3 > 0, h3, range(1, n3 + 1)); inkm |= np.r_[False, sz3 < MM * MM][h3]
out = np.zeros((H, W, 4), np.uint8); out[inkm] = FOREST + (255,)
Image.fromarray(out).save("out5/peak-one.png")
print("moss areas", n, "strokes", strokes)
