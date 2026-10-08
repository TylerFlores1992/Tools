# Finishing for the round 5 kit: prep5 rules, then trim to the art plus 3 mm, then write
#  - the composite 300 dpi PNG (tagged 300 dpi; DTF and DTG print this, inks butted, no overlap);
#  - one black-on-white separation per ink for screens, trapped: lighter inks spread under darker ones
#    (moss and mist 0.3 mm under forest, mist 0.25 mm under moss, true discs) so a slip in registration shows
#    no shirt; pinholes in a separation over a darker ink are filled; tagged 300 dpi;
#  - one untrapped mask per ink (out5/final/{name}-ink{k}.png) that the all-inks SVG is traced from (round 6
#    traced the trapped films, so the spread light inks painted over forest edges).
# args: name inks(comma hex, darkest first) typeTop
import sys, subprocess, json
import numpy as np
from PIL import Image
from scipy import ndimage as nd
MM = 300 / 25.4
name, inks, top = sys.argv[1], sys.argv[2].split(","), int(sys.argv[3])
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
seps = []
for k in range(len(inks)):
    s = lab == k
    darker = np.isin(lab, list(range(k)))                 # inks are listed darkest first
    for j in range(k):
        spread = 0.3 if j == 0 else 0.25
        s = s | (nd.binary_dilation(lab == k, disk(spread * MM)) & (lab == j))
    hl, hn = nd.label(~s); hs = nd.sum(~s, hl, range(1, hn + 1))
    pin = np.r_[False, hs < 0.5 * MM * MM][hl] & darker  # film pinholes over a darker ink
    s |= pin
    Image.fromarray(np.where(s, 0, 255).astype(np.uint8)).save(f"out5/final/{name}-sep{k + 1}.png", dpi=(300, 300))
    Image.fromarray(np.where(lab == k, 0, 255).astype(np.uint8)).save(f"out5/final/{name}-ink{k + 1}.png", dpi=(300, 300))
    print(f"  sep {k + 1}: {int(pin.sum())} pinhole px filled")
    seps.append(int(s.sum()))
json.dump({"w": int(lab.shape[1]), "h": int(lab.shape[0]), "inks": seps}, open(f"out5/final/{name}-size.json", "w"))
print(name, f"trimmed to {lab.shape[1] / 300:.2f} x {lab.shape[0] / 300:.2f} in", "ink area in2", [round(v / 90000, 1) for v in seps])
