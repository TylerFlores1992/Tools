# Production prep for the round 5 back (2026-10-08), from the print technician's review. Works on the ink
# labels of a 300 dpi render (-1 shirt, 0.. inks) and writes them back:
#  1. shirt voids inside the art under 1.5 mm2, and shirt gaps under 0.6 mm between inks, take the ink around
#     them (the three-ink joins showed about 200 pinholes of shirt);
#  2. above the type, any knockout narrower than 1 mm closes (the hawk's eye and brow cuts were 0.24-0.36 mm);
#  3. every ink is opened by 0.2 mm, so no part of it is thinner than 0.4 mm (dash and flame tips, horizon
#     slivers); what that removes goes to the nearest remaining ink or the shirt;
#  4. ink pieces under 1 mm2 go.
# args: labels.npy typeTop out.npy
import sys
import numpy as np
from scipy import ndimage as nd
MM = 300 / 25.4
lab = np.load(sys.argv[1]).astype(np.int16); top = int(sys.argv[2])
inks = sorted(int(k) for k in np.unique(lab) if k >= 0)
def disk(r):
    r = max(1, int(round(r))); y, x = np.mgrid[-r:r + 1, -r:r + 1]; return x * x + y * y <= r * r
def give_nearest(lab, holes, allowed):
    """Pixels in `holes` take the label of the nearest pixel whose label is in `allowed`."""
    src = np.isin(lab, allowed) & ~holes
    _, (iy, ix) = nd.distance_transform_edt(~src, return_indices=True)
    lab[holes] = lab[iy[holes], ix[holes]]
inkm = lab >= 0
# 1a. pinholes: shirt components enclosed by ink, under 1.5 mm2
sh, n = nd.label(~inkm); sz = nd.sum(~inkm, sh, range(1, n + 1))
edge = set(np.unique(np.r_[sh[0], sh[-1], sh[:, 0], sh[:, -1]]))
small = np.zeros(n + 1, bool); small[1:] = sz < 1.5 * MM * MM
for e in edge: small[e] = False
holes = small[sh]
# 1b. thin shirt gaps between inks: what a 0.3 mm closing of all ink fills in
closed = nd.binary_closing(np.pad(inkm, 20), disk(0.3 * MM))[20:-20, 20:-20]
holes |= closed & ~inkm
# 2. above the type: knockouts under 1 mm close
art = np.zeros_like(inkm); art[:top] = True
closed1 = nd.binary_closing(np.pad(inkm, 30), disk(0.5 * MM))[30:-30, 30:-30]
holes |= closed1 & ~inkm & art
print("filled shirt pixels", int(holes.sum()))
give_nearest(lab, holes, inks)
# 3. no ink thinner than 0.4 mm
for k in inks:
    m = lab == k
    keep = nd.binary_opening(np.pad(m, 10), disk(0.2 * MM))[10:-10, 10:-10]
    lost = m & ~keep
    if lost.any():
        lab[lost] = -2                                     # placeholder
        give_nearest(lab, lab == -2, [-1] + [j for j in inks if j != k])
    print(f"ink {k}: thinned {int(lost.sum())} px")
# 4. specks under 1 mm2 (any ink)
for k in inks:
    m = lab == k; l, n = nd.label(m); sz = nd.sum(m, l, range(1, n + 1))
    tiny = np.r_[False, sz < MM * MM][l]
    if tiny.any(): lab[tiny] = -2; give_nearest(lab, lab == -2, [-1] + [j for j in inks if j != k])
    print(f"ink {k}: {int((sz < MM * MM).sum())} specks dropped")
np.save(sys.argv[3], lab.astype(np.int8))
