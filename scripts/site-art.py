"""Generate the Earth range pixel atlas with all 8 facilities across 4 upgrade tiers."""
from PIL import Image, ImageDraw
from pathlib import Path
from random import Random

root = Path(__file__).resolve().parents[1]
out = root / "public/art/site.png"
docs_out = root / "docs/art/site.png"
W, H = 80, 104
# 8 columns x 6 rows = 48 frames:
# 0..7   terrain tiles
# 8..43  9 facilities x 4 tiers (command, pad, refinery, tanks, office, vab, tracking, lab, foundry)
# 44     road lamp
# 45     Tier 2 locked/unbuilt construction pad footprint
atlas = Image.new("RGBA", (W * 8, H * 6))


def frame(index):
    global im, d
    im = Image.new("RGBA", (W, H))
    d = ImageDraw.Draw(im)
    return Random(index + 172)


def put(index):
    atlas.paste(im, (index % 8 * W, index // 8 * H))


def iso(x, y, z=0):
    return (round(40 + x - y), round(80 + (x + y) * 0.5 - z))


def face(coords, color):
    d.polygon([iso(*p) for p in coords], fill=color)


def line(a, b, c, w=1):
    d.line((iso(*a), iso(*b)), fill=c, width=w)


def box(x, y, w, h, z, ht, colors):
    a, b = x + w, y + h
    top = z + ht
    face([(x, b, z), (a, b, z), (a, b, top), (x, b, top)], colors[1])
    face([(a, y, z), (a, b, z), (a, b, top), (a, y, top)], colors[2])
    face([(x, y, top), (a, y, top), (a, b, top), (x, b, top)], colors[0])


def tank(x, y, z, w, h, tint="#869da0"):
    cx, cy = iso(x, y, z)
    r = max(2, w // 3)
    d.ellipse((cx - w, cy - r, cx + w, cy + r), fill="#546c72")
    d.rectangle((cx - w, cy - h, cx + w, cy), fill=tint)
    for k, c in [(1, "#b8ccc4"), (3, "#a5bab4"), (w, "#749297"), (w * 2 - 2, "#517077")]:
        if k < w * 2:
            d.line((cx - w + k, cy - h, cx - w + k, cy), fill=c, width=2)
    for dy in [2, max(3, h - 2)]:
        d.arc((cx - w, cy - dy - r, cx + w, cy - dy + r), 0, 180, fill="#3f5a62")
    d.ellipse((cx - w, cy - h - r, cx + w, cy - h + r), fill="#cdd8c7", outline="#89a4a0")


# Terrain tiles (frames 0..7)
for i in range(8):
    r = frame(i)
    if i == 7:
        d.line((20, 77, 29, 77, 31, 76, 39, 76), fill="#426875")
        d.line((47, 85, 52, 85), fill="#40606c")
        put(i)
        continue
    green = ["#6f927c", "#749280", "#7c9881", "#708f7a"]
    box(-16, -16, 32, 32, -7, 7, (green[i % 4], "#595c53", "#455250"))
    for _ in range(83):
        x = r.randint(-15, 15)
        y = r.randint(-15, 15)
        line(
            (x, y, 0),
            (min(x + 1, 15), y, 0),
            r.choice(["#89927b", "#818d75", "#738471", "#6b7f6c"]),
        )
    if i == 4:
        face([(-16, -10, 0), (16, -10, 0), (16, 10, 0), (-16, 10, 0)], "#626e6c")
        line((-16, 10, 0), (16, 10, 0), "#a8b3a4")
        line((-16, -10, 0), (16, -10, 0), "#a8b3a4")
        for x in range(-16, 16, 9):
            line((x, 0, 0), (x + 4, 0, 0), "#b5ad90")
    if i == 6:
        for x, y, h in [(-6, -6, 17), (5, -4, 20), (-9, 4, 13), (3, 8, 19)]:
            cx, cy = iso(x, y)
            d.line((cx, cy, cx, cy - 8), fill="#5c6154", width=2)
            for dh in (0, 4, 8):
                width = 7 - dh // 3
                d.polygon(
                    [(cx, cy - h + dh // 2), (cx - width, cy - 5 - dh // 2), (cx + width, cy - 5 - dh // 2)],
                    fill="#416e63",
                )
                d.polygon(
                    [(cx, cy - h + dh // 2), (cx - width, cy - 5 - dh // 2), (cx - 1, cy - 6 - dh // 2)],
                    fill="#638b70",
                )
    if i == 5:
        for x, y, w, h in [(-5, -6, 8, 8), (4, 1, 7, 6), (-8, 5, 6, 4)]:
            cx, cy = iso(x, y)
            d.polygon(
                [(cx - w, cy), (cx - w + 2, cy - h), (cx + 2, cy - h - 2), (cx + w, cy - 2), (cx + 3, cy + 1)],
                fill="#92978b",
            )
            d.polygon([(cx + 2, cy - h - 2), (cx + w, cy - 2), (cx + 3, cy + 1)], fill="#667977")
    put(i)


# 8 Earth facilities x 4 tiers (frames 8..39)
steel = ("#a4adb0", "#637982", "#485f6a")
light = ("#d3d4bc", "#a4ac9c", "#84978e")
dark = ("#6b787d", "#4c5c66", "#374754")
warm = ("#d6c49e", "#a98c64", "#7e6547")

for typ in range(9):
    for tier in range(4):
        idx = 8 + typ * 4 + tier
        frame(idx)
        box(-13, -13, 26, 26, 0, 2, ("#bac0af", "#6d8284", "#52666d"))

        if typ == 0:  # Mission Control (command)
            box(-11, -10, 22, 20, 2, 8 + tier, steel)
            box(-10, -9, 20, 18, 10 + tier, 2, light)
            box(-8, -8, 14, 15, 12 + tier, 6 + tier, ("#b7c2b9", "#677d80", "#4d666e"))
            for x in [-8, -4, 0, 4]:
                line((x, 10, 7), (x + 2, 10, 7), "#90d0ce", 2)
            cx, cy = iso(-3, -4, 21 + tier * 2)
            d.line((cx + 2, cy + 5, cx + 1, cy - 1), fill="#546a72", width=3)
            d.polygon([(cx - 8, cy - 5), (cx + 8, cy - 12), (cx + 6, cy - 5), (cx, cy - 1), (cx - 5, cy - 2)], fill="#e0dbc4")
            d.line((cx - 8, cy - 5, cx + 8, cy - 12), fill="#849ba1")

        elif typ == 1:  # Launchpad (pad)
            box(-13, -13, 26, 26, 2, 3, ("#636f73", "#495861", "#374958"))
            for k in [-11, -5, 1, 7]:
                line((k, 11, 5), (k + 3, 11, 5), "#e5b16f", 2)
            tower_h = 34 + tier * 4
            x, y = iso(-9, 6, 5)
            d.rectangle((x - 3, y - tower_h, x + 3, y), fill="#475864")
            for k in range(5, tower_h, 6):
                d.line((x - 3, y - k, x + 3, y - k - 4), fill="#c5a789")
                d.line((x - 3, y - k - 4, x + 3, y - k - 4), fill="#d7bc97")
            for k in [16, 26]:
                d.line((x, y - k, x + 10, y - k), fill="#a4a6a0", width=2)
            rx, ry = iso(4, -1, 5)
            rh = 34 + tier * 4
            rw = 4 + (1 if tier >= 2 else 0)
            d.polygon(
                [(rx, ry - rh), (rx + rw, ry - rh + 9), (rx + rw, ry - 6), (rx + rw + 3, ry - 1), (rx - rw - 3, ry - 1), (rx - rw, ry - 6), (rx - rw, ry - rh + 9)],
                fill="#d8dfd2",
            )
            d.rectangle((rx + 2, ry - rh + 10, rx + 3, ry - 4), fill="#8ca1a1")
            d.line((rx - rw + 1, ry - rh // 2, rx + rw - 1, ry - rh // 2), fill="#e39c65", width=3)

        elif typ == 2:  # Propellant Refinery (refinery)
            box(-11, -9, 13, 18, 2, 8 + tier, dark)
            tank(5, -5, 2, 5, 16 + tier * 3, "#92a9ab")
            tank(6, 5, 2, 4, 12 + tier * 2, "#7f9a9d")
            # Flare stack with warm flame tip
            fx, fy = iso(-9, -7, 10 + tier)
            d.line((fx, fy, fx, fy - 18 - tier * 2), fill="#6f8085", width=2)
            d.ellipse((fx - 2, fy - 22 - tier * 2, fx + 2, fy - 17 - tier * 2), fill="#ffbd75")
            line((-10, 9, 2), (9, 9, 2), "#d59962", 2)

        elif typ == 3:  # Cryo Tank Farm (tanks)
            positions = [(-7, -5), (6, 1), (-4, 7)] if tier < 2 else [(-7, -6), (6, -5), (-5, 6), (6, 6)]
            for tx, ty in positions:
                tank(tx, ty, 2, 5 if tier >= 2 else 6, 14 + tier * 3)
            line((-10, 10, 2), (8, 10, 2), "#7ad9d2", 2)

        elif typ == 4:  # Contract Office (office)
            box(-11, -10, 22, 18, 2, 10 + tier * 2, warm)
            box(-12, -11, 24, 20, 12 + tier * 2, 2, light)
            for k in [-8, -3, 2, 7]:
                line((k, 8, 7), (k + 2, 8, 7), "#83c5c9", 2)
                if tier >= 1:
                    line((k, 8, 11), (k + 2, 8, 11), "#ffcf8c", 2)
            if tier >= 2:
                box(-5, -5, 10, 10, 14 + tier * 2, 3, steel)

        elif typ == 5:  # Vehicle Assembly Building (vab)
            vh = 22 + tier * 4
            box(-11, -11, 22, 22, 2, vh, steel)
            box(-12, -12, 24, 24, 2 + vh, 2, light)
            # Tall dark hangar bay door on front-left face
            face([(-6, 11, 2), (4, 11, 2), (4, 11, vh - 2), (-6, 11, vh - 2)], "#2d3d49")
            for stripe in range(6, vh - 3, 5):
                line((-5, 11, stripe), (3, 11, stripe), "#4c6270", 1)
            # Orange accent band near roof
            line((-11, 11, vh - 1), (11, 11, vh - 1), "#e8a264", 2)

        elif typ == 6:  # Tracking Station (tracking)
            box(-10, -9, 20, 18, 2, 6 + tier, dark)
            # Primary parabolic dish
            cx, cy = iso(-4, -3, 12 + tier)
            d.line((cx, cy + 6, cx, cy), fill="#657a82", width=3)
            d.pieslice((cx - 10, cy - 12, cx + 10, cy + 6), 170, 355, fill="#dfe3d5", outline="#7f9aa3")
            d.line((cx, cy - 3, cx + 4, cy - 11), fill="#ffbd82", width=2)
            # Secondary dish on higher tiers
            if tier >= 1:
                cx2, cy2 = iso(6, 4, 11 + tier)
                d.line((cx2, cy2 + 5, cx2, cy2), fill="#657a82", width=2)
                d.pieslice((cx2 - 7, cy2 - 8, cx2 + 7, cy2 + 4), 175, 355, fill="#c9d7d2", outline="#728e96")

        elif typ == 7:  # Research Lab (lab)
            box(-12, -10, 22, 20, 2, 9 + tier, light)
            box(-13, -11, 24, 22, 11 + tier, 2, steel)
            cx, cy = iso(-3, -2, 13 + tier)
            d.pieslice((cx - 9, cy - 13, cx + 9, cy + 9), 180, 360, fill="#9cc9cc", outline="#618794")
            d.arc((cx - 4, cy - 12, cx + 4, cy + 9), 180, 360, fill="#dbe3d8")
            for k in [-8, -3, 2]:
                line((k, 10, 7), (k + 3, 10, 7), "#577a81", 2)

        else:  # Solar Foundry (foundry) - golden solar arrays + crucible core
            box(-11, -10, 20, 18, 2, 7 + tier, dark)
            # Central amber crucible core
            box(-5, -5, 10, 10, 9 + tier, 5 + tier, ("#f5c57a", "#c98b43", "#94612c"))
            # Angled deep-blue solar wing arrays flanking the foundry
            for sx in [-11, 4]:
                face([(sx, -11, 5 + tier), (sx + 7, -11, 5 + tier), (sx + 7, 10, 8 + tier), (sx, 10, 8 + tier)], "#2b5272")
                for gy in range(-8, 10, 5):
                    line((sx + 1, gy, 6 + tier), (sx + 6, gy, 6 + tier), "#6ea6c9", 1)
            # Warm foundry glow strips
            for k in [-7, -2, 3]:
                line((k, 9, 5), (k + 2, 9, 5), "#ffcf85", 2)

        # Level badge pips (1..4 golden pips along front rim)
        for i in range(tier + 1):
            box(10 - i * 4, 12, 2, 2, 2, 2, ("#ffcf85", "#c8935c", "#855d43"))
        if tier >= 2:
            ax, ay = iso(-11, -9, 2)
            d.line((ax, ay, ax, ay - 26 - tier * 2), fill="#a7b3aa")
            d.point((ax, ay - 27 - tier * 2), fill="#ffb270")
        put(idx)


# Frame 40: Road lamp fixture
frame(44)
cx, cy = iso(0, 0)
d.line((cx, cy, cx, cy - 11), fill="#5b7377", width=2)
d.line((cx, cy - 11, cx + 4, cy - 13), fill="#aabbb1", width=2)
d.line((cx + 4, cy - 13, cx + 6, cy - 13), fill="#f4d295", width=2)
put(44)

# Frame 41: Tier 2 unbuilt/locked construction pad footprint
frame(45)
box(-12, -12, 24, 24, 0, 1, ("#7b8b8e", "#56676c", "#425258"))
for px, py in [(-11, -11), (9, -11), (-11, 9), (9, 9)]:
    box(px, py, 2, 2, 1, 3, ("#e8b878", "#b3834c", "#7d5932"))
line((-9, 0, 1), (9, 0, 1), "#a5b8ba", 1)
line((0, -9, 1), (0, 9, 1), "#a5b8ba", 1)
put(45)

atlas.save(out)
if docs_out.parent.exists():
    atlas.save(docs_out)
print(f"Generated {out} ({atlas.size[0]}x{atlas.size[1]})")
