# Round 4 prep: the Still Water peak WITHOUT its reflection (the wife's note: the mirrored peak reads as a
# diamond). Cuts both camp renders at the shoreline, drops the hawk, and writes the silhouette masks the
# new layouts need (filled outline, and one grown by 2 mm for clean gaps where a frame meets the peak).
import numpy as np
from PIL import Image
from scipy import ndimage as nd
SHORE = 1614                       # last row of the shore band (the reflection starts below)
HAWK = (360, 960, 2520, 3300)      # y0 y1 x0 x1 of the hawk in both renders
def disk(r):
    y, x = np.mgrid[-r:r + 1, -r:r + 1]; return x * x + y * y <= r * r
for src, name in [("ref/still-water-one-ink_diamond_300dpi.png", "one"), ("ref/still-water_diamond_300dpi.png", "three")]:
    im = np.asarray(Image.open(src).convert("RGBA")).copy()
    im[SHORE:] = 0
    y0, y1, x0, x1 = HAWK; im[y0:y1, x0:x1] = 0
    Image.fromarray(im).save(f"out4/peak-{name}.png")
    a = im[..., 3] > 128
    sil = nd.binary_fill_holes(nd.binary_closing(np.pad(a, 80), disk(22)))[80:-80, 80:-80]
    sil[SHORE - 30:SHORE] |= a[SHORE - 30:SHORE].any(0)[None, :] & sil[SHORE - 31][None, :]
    Image.fromarray((sil * 255).astype(np.uint8)).save(f"out4/sil-{name}.png")
    gap = nd.binary_dilation(sil, disk(24))
    Image.fromarray((gap * 255).astype(np.uint8)).save(f"out4/silgap-{name}.png")
    print(name, im.shape, "ink x", np.nonzero(a.any(0))[0][[0, -1]], "y", np.nonzero(a.any(1))[0][[0, -1]])
