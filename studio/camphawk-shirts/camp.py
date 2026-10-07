# The camp for Still Water (owner's ask, 2026-10-07): a linocut ridge tent and a campfire on the far shore at
# the base of the peak, either side of the peak's axis, and mirrored in the lake. The tent is Recraft's
# (ref/recraft-camp.png, from gen/campb-1); its own fire turned to mush at an inch, so the fire is drawn here:
# one flame with two tongues over crossed logs. The doorway and the fire's heart are knockouts (the natural
# shirt on the one-ink print, mist ink on the three-ink), so both read as lit.
#
# Cleaned for print at real size: white gaps under 1 mm close (they fill in on press), ink under 0.4 mm and
# specks under 1 mm² go, every gap the design means to keep is 1.5 mm or more, and the camp keeps clear water
# from the mountain. The reflection is shortened and broken into a few tapering strokes so it weighs less
# than the tent. Writes out2/camp-*.png; campkit.mjs turns them into the print files.
# args: [tent width in inches] [x of the peak's axis at 300 dpi] [fire scale]
import sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as nd

TENT_IN = float(sys.argv[1]) if len(sys.argv) > 1 else 1.1
AXIS = int(sys.argv[2]) if len(sys.argv) > 2 else 1725      # the peak's apex is at x 1724.5 in both renders
FIRE_K = float(sys.argv[3]) if len(sys.argv) > 3 else 0.9   # the fire's scale (it is drawn at 14 x 16.5 mm)
SRC = "ref/recraft-camp.png"
MM = 300 / 25.4
U = 4 * MM                  # 1 mm at the 4x working resolution
GROUND, TENT_X1 = 549, 1022 # source row where the drawn ground starts; column where the tent ends (its fire is dropped)
TENT_SRC = (300, 1020)      # source columns of the tent's two feet

def disk(r):
    r = max(1, int(round(r))); y, x = np.mgrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r

def keep_big(ink, area):
    lab, n = nd.label(ink); keep = nd.sum(ink, lab, range(1, n + 1)) >= area
    return np.concatenate([[False], keep])[lab]

def down(ink4):
    """4x mask → 300 dpi, edges averaged then thresholded (the tracer smooths them)."""
    a = Image.fromarray((ink4 * 255).astype(np.uint8))
    return np.asarray(a.resize((a.width // 4, a.height // 4), Image.BOX)) >= 128

def tent4():
    g = Image.open(SRC).convert("L").crop((0, 0, TENT_X1, GROUND))
    k = 4 * TENT_IN * 300 / (TENT_SRC[1] - TENT_SRC[0])
    g = g.resize((round(g.width * k), round(g.height * k)), Image.LANCZOS)
    ink = keep_big(np.asarray(g) < 128, U * U)
    ink = nd.binary_opening(ink, disk(0.2 * U))                         # ink under 0.4 mm goes
    ink = nd.binary_closing(np.pad(ink, 60), disk(0.55 * U))[60:-60, 60:-60]   # gaps under 1.1 mm close
    ink = nd.binary_opening(ink, disk(0.25 * U))
    ink = keep_big(ink, 4 * U * U)
    ys, xs = np.nonzero(ink); ink = ink[ys.min():, xs.min():xs.max() + 1]
    # one lit doorway: the pole that split it goes, and the top is blunt (a knockout under 1.2 mm fills in)
    # seal the base for a moment so the doorway (open at the bottom) counts as a hole
    sealed = ink.copy(); cols = np.nonzero(ink[-int(0.8 * U):].any(0))[0]
    sealed[-int(0.5 * U):, cols.min():cols.max() + 1] = True
    hull = nd.binary_fill_holes(sealed)
    door_holes = hull & ~sealed
    # one clean triangle: the hull of the doorway's two halves (the pole between them goes)
    from scipy.spatial import ConvexHull
    py, px = np.nonzero(keep_big(door_holes, 4 * U * U)); pts = np.c_[px, py]
    tri = Image.new("1", (hull.shape[1], hull.shape[0]), 0)
    ImageDraw.Draw(tri).polygon([tuple(pts[i]) for i in ConvexHull(pts).vertices], fill=1)
    door = np.asarray(tri) & hull
    door = nd.binary_opening(door, disk(0.8 * U))                       # a blunt top, no tip to fill in
    door = keep_big(door, 4 * U * U)
    hull = np.maximum.accumulate(hull, axis=0)        # solid below its outline: no bays under the eaves
    # the walls flare out into the shore at 45 degrees instead of dropping straight down (no plinth)
    hull = np.pad(hull, ((0, 0), (int(4 * U), int(4 * U))))
    Hh = hull.shape[0]; cols = np.nonzero(hull.any(0))[0]
    for x, step in ((cols.min(), -1), (cols.max(), 1)):
        h = Hh - np.argmax(hull[:, x])                 # wall height at the edge
        for k in range(1, min(int(2.5 * U), h)):
            hull[Hh - (h - k):, x + step * k] = True
    door = np.pad(door, ((0, 0), (int(4 * U), int(4 * U))))
    ink = hull & ~door
    # pole tips at both ends of the ridge, so it reads as a ridge tent and not a hut
    H, W = ink.shape
    top = np.array([np.argmax(ink[:, x]) if ink[:, x].any() else H for x in range(W)])
    ridge = np.nonzero(top <= top.min() + 0.8 * U)[0]
    pad = int(1.8 * U)
    ink = np.pad(ink, ((pad, 0), (0, 0)))
    img = Image.fromarray(ink); d = ImageDraw.Draw(img)
    for x in (ridge.min() + 0.5 * U, ridge.max() - 0.5 * U):
        y = top[int(x)] + pad
        d.rounded_rectangle([x - 0.45 * U, y - 1.6 * U, x + 0.45 * U, y + U], radius=0.35 * U, fill=True)
    out = np.asarray(img); xs = np.nonzero(out.any(0))[0]
    return out[:, xs.min():xs.max() + 1]

def teardrop(cx, by, w, h, lean=0.0, curl=0.0):
    """A flame tongue: round at the bottom, a tapered tip that leans and curls."""
    L, R = [], []
    for i in range(41):
        u = i / 40
        hw = (w / 2) * (np.sqrt(max(0.0, 1 - ((0.32 - u) / 0.32) ** 2)) if u < 0.32 else ((1 - u) / 0.68) ** 1.25)
        x = cx + lean * h * u * u + curl * h * np.sin(np.pi * u) * u
        y = by - h * u
        L.append((x - hw, y)); R.append((x + hw, y))
    return L + R[::-1]

def spline(P, n=12):
    """Closed Catmull-Rom curve through P; a point given twice becomes a sharp tip."""
    out, m = [], len(P)
    for i in range(m):
        p0, p1, p2, p3 = (np.array(P[(i + k) % m], float) for k in (-1, 0, 1, 2))
        for t in np.linspace(0, 1, n, endpoint=False):
            out.append(tuple(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                                   + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)))
    return out

def fire4():
    """The campfire at 4x, laid out in mm so every gap survives the press: a flame of three tongues spread
    wide enough that their notches stay open, a heart 2.4 mm wide, then 1.6 mm or more of light, then two
    crossed logs whose lower ends rest on the shore."""
    W, H = int(14 * U), int(16.5 * U); cx = W / 2; g = H - 0.7 * U    # g: the log ends' centre line
    img = Image.new("1", (W, H), 0); d = ImageDraw.Draw(img)
    t, half, rise = 1.4 * U, 5.4 * U, 4.0 * U
    for a, b in (((cx - half, g), (cx + half, g - rise)), ((cx + half, g), (cx - half, g - rise))):
        d.line([a, b], fill=1, width=int(t))           # square-cut log ends
    d.polygon([(cx - half, g), (cx, g - rise / 2), (cx + half, g)], fill=1)   # embers: the X's lower half solid
    # the flame, one silhouette in mm from its base (y up): sharp tips, round notches and bottom
    fb = H - 5.2 * U
    pts = [(0, 0), (2.0, 0.3), (3.0, 1.3), (3.3, 2.8), (3.1, 4.2), (3.6, 5.3), (3.9, 6.8), (3.9, 6.8), (2.8, 6.0),
           (2.0, 5.6), (1.6, 6.6), (1.0, 8.0), (-0.2, 9.8), (-0.2, 9.8), (-0.6, 8.4), (-1.6, 6.6), (-2.6, 5.4),
           (-3.1, 4.0), (-3.3, 2.6), (-2.9, 1.3), (-1.9, 0.3)]
    d.polygon(spline([(cx + x * U, fb - y * U) for x, y in pts]), fill=1)
    d.polygon(teardrop(cx + 0.05 * U, fb - 0.9 * U, 2.5 * U, 3.9 * U, lean=0.04), fill=0)   # the heart
    ink = np.asarray(img).copy()
    # cut by hand, like the tent and the mountain: every edge wanders by about 0.1 mm
    sd = nd.distance_transform_edt(ink) - nd.distance_transform_edt(~ink)
    noise = nd.gaussian_filter(np.random.default_rng(11).standard_normal(ink.shape), 0.6 * U)
    ink = sd + noise / noise.std() * 0.09 * U > 0
    ys, xs = np.nonzero(ink)
    return ink[ys.min():, xs.min():xs.max() + 1]

def kit(path, inks):
    A = np.asarray(Image.open(path).convert("RGBA")).astype(int)
    dark = np.zeros(A.shape[:2], bool)
    for c in inks: dark |= (A[..., 3] > 128) & (np.abs(A[..., :3] - c).sum(-1) < 40)
    return A, dark

FOREST1, FOREST3, MOSS, MIST = (0x24, 0x38, 0x2A), (0x2A, 0x3B, 0x2E), (0x4E, 0x5C, 0x3B), (0xE2, 0xE6, 0xDC)
jobs = [("one", "ref/still-water-one-ink_base_300dpi.png", [FOREST1], FOREST1, 1580, 1608),
        ("three", "ref/still-water_base_300dpi.png", [FOREST3, MOSS], FOREST3, 1619, 1639)]

# the group: fire, 2 mm of air, tent (mirrored so its doorway faces the fire); bottoms aligned
T, F = tent4()[:, ::-1], fire4()
F = np.asarray(Image.fromarray(F).resize((int(F.shape[1] * FIRE_K), int(F.shape[0] * FIRE_K)), Image.NEAREST))
gap4 = int(2.0 * U)
H4 = max(T.shape[0], F.shape[0]); W4 = T.shape[1] + gap4 + F.shape[1]
W4 += (-W4) % 4; H4 += (-H4) % 4
g4 = np.zeros((H4, W4), bool)
g4[H4 - F.shape[0]:, :F.shape[1]] = F
g4[H4 - T.shape[0]:, F.shape[1] + gap4:F.shape[1] + gap4 + T.shape[1]] = T
art = down(g4)
ys, xs = np.nonzero(art); art = art[ys.min():, xs.min():xs.max() + 1]
ah, aw = art.shape
print(f"camp {aw} x {ah} px = {aw / 300:.2f} x {ah / 300:.2f} in (tent {TENT_IN} in wide)")

_wl = {}
def place(dark, top, bot, x0):
    """The camp (dipping 6 px into the waterline) and its reflection: mirrored, squashed to 60%, and broken into
    a few strokes that thin with depth, the deeper ones breaking into dashes."""
    H, W = dark.shape
    up = np.zeros((H, W), bool); dn = np.zeros((H, W), bool)
    yb = top + 6
    up[yb - ah:yb, x0:x0 + aw] = art
    # what the press will do anyway, done in the file: any knockout under 1.1 mm in and around the camp
    # (a flame notch, the tip of the fire's heart, the corner between the logs and the shore) prints solid
    near = np.zeros((H, W), bool); near[yb - ah - 20:bot + 4, x0 - 20:x0 + aw + 20] = True
    both = dark | up
    closed = nd.binary_closing(both, disk(0.55 * MM)) & near
    up |= closed & ~dark & ~up & nd.binary_dilation(up, disk(0.7 * MM))   # only the camp's own gaps
    rh = int(ah * 0.6)
    flip = np.asarray(Image.fromarray((art[::-1] * 255).astype(np.uint8)).resize((aw, rh), Image.BOX)) >= 128
    y0 = bot + 1
    dn[y0:y0 + rh, x0:x0 + aw] = flip
    keep = np.zeros((H, W), bool)
    y = y0 + int(1.2 * MM)
    strokes = [(1.4, 1.2), (1.1, 1.4), (0.9, 1.6), (0.8, 0)]
    rng = np.random.default_rng(7)
    for i, (th_mm, gap_mm) in enumerate(strokes):
        th = int(th_mm * MM); band = np.roll(dn[y:y + th], (2, -3, 2, -1)[i], axis=1)
        if i >= 2:                                   # deeper strokes break into dashes, 1.3 mm breaks
            x = x0 + int(rng.uniform(3, 7) * MM)
            while x < x0 + aw:
                band[:, x:x + int(1.3 * MM)] = False; x += int(rng.uniform(5, 9) * MM)
        keep[y:y + th] = band
        y += th + int(gap_mm * MM)
    dn = keep
    if id(dark) not in _wl:                          # a full 1.2 mm of water under the wavy line, everywhere
        line = np.zeros_like(dark); line[top - 12:bot + 13] = dark[top - 12:bot + 13]
        _wl[id(dark)] = nd.distance_transform_edt(~line) >= 1.2 * MM
    dn &= _wl[id(dark)]
    lab, n = nd.label(dn)                            # no lumps: a stroke piece is a dash 4 mm long or more
    for i, sl in enumerate(nd.find_objects(lab), start=1):
        if sl[1].stop - sl[1].start < 4 * MM: dn[sl][lab[sl] == i] = False
    # firelight on water: under the fire, two short glints instead of a mirrored flame (which breaks into crumbs)
    fw = F.shape[1] // 4; fc = x0 + fw // 2
    dn[:, x0:x0 + fw + int(1.0 * MM)] = False
    gl = Image.fromarray(dn); dg = ImageDraw.Draw(gl)
    for gy, gw in ((y0 + 2.2 * MM, 0.62 * fw), (y0 + 5.0 * MM, 0.34 * fw)):
        dg.rounded_rectangle([fc - gw / 2, gy, fc + gw / 2, gy + 1.0 * MM], radius=0.5 * MM, fill=True)
    dn = np.asarray(gl).copy()
    dn = nd.binary_opening(dn, disk(0.35 * MM))       # round stroke ends, no slivers
    dn = keep_big(dn, 2.0 * MM * MM)                  # no crumbs
    return up, dn

_dist = {}
def clearance(dark, top, bot, up, dn):
    """Smallest gap (mm) from the camp to any existing ink other than the waterline band."""
    if id(dark) not in _dist:
        other = dark.copy(); other[top - 12:bot + 13] = False
        _dist[id(dark)] = nd.distance_transform_edt(~other)
    cm = (up | dn); cm[top - 12:bot + 13] = False
    return _dist[id(dark)][cm].min() / MM

# the fire burns just left of the peak's axis and the tent stands just right (where the slope leaves more
# room): the axis runs through the air between them
x0 = AXIS - (F.shape[1] + gap4 // 2) // 4
for name, path, inks, ink, top, bot in jobs:
    A, dark = kit(path, inks)
    up, dn = place(dark, top, bot, x0)
    print(name, f"group x {x0}-{x0 + aw}, clearance {clearance(dark, top, bot, up, dn):.1f} mm")
    out = A.copy().astype(np.uint8)
    out[up | dn] = ink + (255,)    # the holes keep what was there: shirt (one-ink) or mist ink (three-ink)
    Image.fromarray(out).save(f"out2/camp-{name}.png")

# separations for campkit.mjs: black = ink, one file per ink, from the finished renders
for name, inks in [("one", [FOREST1]), ("three", [FOREST3, MOSS, MIST])]:
    A = np.asarray(Image.open(f"out2/camp-{name}.png").convert("RGBA")).astype(int)
    for i, c in enumerate(inks, start=1):
        m = (A[..., 3] > 128) & (np.abs(A[..., :3] - c).sum(-1) < 40)
        Image.fromarray(np.where(m, 0, 255).astype(np.uint8)).save(f"out2/camp-{name}-sep{i}.png")
