# Production prep for the Still Water back (rounds 5-7, 2026-10-08), from the print technicians' reviews. Works
# on the ink labels of a 300 dpi render (-1 shirt, 0.. inks) and writes them back. The type (rows from typeTop
# down) is left as set: the hole and gap fills of steps 1-2 closed the tagline's A and B counters in round 5.
#  1. above the type, shirt voids inside the art under 1.5 mm2, and shirt gaps under 0.6 mm between inks,
#     take the ink around them (the three-ink joins showed about 200 pinholes of shirt);
#  2. above the type, any knockout narrower than 1 mm closes (the hawk's eye and brow cuts were 0.24-0.36 mm);
#  3. every ink is opened by a true 0.2 mm disc (2.36 px; round 6 rounded it to 2 px and left 0.34 mm necks),
#     so no part of it is thinner than 0.4 mm; what that removes goes to the nearest remaining ink or the shirt;
#  4. above the type, ink pieces under 2 mm2 or narrower than 0.8 mm at their widest go (they lift off DTF
#     film at the peel); anywhere, specks under 1 mm2 go.
# Steps 1-4 repeat until a pass changes nothing (at most 8), since thinning can open new pinholes and filling
# can leave new necks; round 7 stopped after three passes with 20 small leftovers.
# args: labels.npy typeTop out.npy
import sys
import numpy as np
from scipy import ndimage as nd
MM = 300 / 25.4
lab = np.load(sys.argv[1]).astype(np.int16); top = int(sys.argv[2])
inks = sorted(int(k) for k in np.unique(lab) if k >= 0)
def disk(r):
    n = int(np.ceil(r)); y, x = np.mgrid[-n:n + 1, -n:n + 1]; return x * x + y * y <= r * r
def give_nearest(lab, holes, allowed):
    """Pixels in `holes` take the label of the nearest pixel whose label is in `allowed`."""
    src = np.isin(lab, allowed) & ~holes
    _, (iy, ix) = nd.distance_transform_edt(~src, return_indices=True)
    lab[holes] = lab[iy[holes], ix[holes]]
art = np.zeros(lab.shape, bool); art[:top] = True
last = None
for rnd in range(8):
    changed = 0
    inkm = lab >= 0
    # 1a. pinholes: shirt components enclosed by ink, under 1.5 mm2
    sh, n = nd.label(~inkm); sz = nd.sum(~inkm, sh, range(1, n + 1))
    edge = set(np.unique(np.r_[sh[0], sh[-1], sh[:, 0], sh[:, -1]]))
    small = np.zeros(n + 1, bool); small[1:] = sz < 1.5 * MM * MM
    for e in edge: small[e] = False
    holes = small[sh] & art
    # 1b. thin shirt gaps between inks: what a 0.3 mm closing of all ink fills in
    closed = nd.binary_closing(np.pad(inkm, 20), disk(0.3 * MM))[20:-20, 20:-20]
    holes |= closed & ~inkm & art
    # 2. above the type: knockouts under 1 mm close
    closed1 = nd.binary_closing(np.pad(inkm, 30), disk(0.5 * MM))[30:-30, 30:-30]
    holes |= closed1 & ~inkm & art
    # where strokes nearly touch, the fill makes a bridge thinner than 0.4 mm that step 3 then removes, and the
    # passes cycle; when a pass refills exactly what the last one did, those bridges are thickened to 0.5 mm
    if last is not None and np.array_equal(holes, last):
        holes = holes | (nd.binary_dilation(holes, disk(3)) & ~inkm & art); print("  thickening cycling bridges")
    last = holes.copy()
    print(f"round {rnd + 1}: filled shirt pixels", int(holes.sum())); changed += int(holes.sum())
    if holes.any(): give_nearest(lab, holes, inks)
    # 3. no ink thinner than 0.4 mm
    for k in inks:
        m = lab == k
        keep = nd.binary_opening(np.pad(m, 10), disk(0.2 * MM))[10:-10, 10:-10]
        lost = m & ~keep; changed += int(lost.sum())
        if lost.any():
            lab[lost] = -2                                     # placeholder
            give_nearest(lab, lab == -2, [-1] + [j for j in inks if j != k])
        print(f"  ink {k}: thinned {int(lost.sum())} px")
    # 4. small and narrow pieces
    for k in inks:
        m = lab == k; l, n = nd.label(m); idx = range(1, n + 1)
        sz = nd.sum(m, l, idx); wide = 2 * nd.maximum(nd.distance_transform_edt(np.pad(m, 1))[1:-1, 1:-1], l, idx)
        ys = np.array([s[0].start for s in nd.find_objects(l)]) if n else np.zeros(0)
        bad = (sz < MM * MM) | ((ys < top) & ((sz < 2 * MM * MM) | (wide < 0.8 * MM)))
        changed += int(bad.sum())
        if bad.any(): lab[np.r_[False, bad][l]] = -2; give_nearest(lab, lab == -2, [-1] + [j for j in inks if j != k])
        print(f"  ink {k}: {int(bad.sum())} small or narrow pieces dropped")
    if not changed: break
np.save(sys.argv[3], lab.astype(np.int8))
