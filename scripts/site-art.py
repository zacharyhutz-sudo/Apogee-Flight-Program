"""Generate the vibrant Earth range pixel atlas with all 10 facilities across 4 upgrade tiers."""
from PIL import Image, ImageDraw
from pathlib import Path
from random import Random

root = Path(__file__).resolve().parents[1]
out = root / "public/art/site.png"
docs_out = root / "docs/art/site.png"
W, H = 80, 104
# 8 columns x 7 rows = 56 frames:
# 0..7   terrain tiles
# 8..43  9 facilities x 4 tiers (command, pad, refinery, tanks, office, vab, tracking, lab, foundry)
# 44     road lamp
# 45     Tier 2 locked/unbuilt construction pad footprint
# 46..49 credit bank tiers
atlas = Image.new("RGBA", (W * 8, H * 7))


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


# Terrain tiles (frames 0..7) — vibrant coastal island meadow & cerulean sea
for i in range(8):
    r = frame(i)
    if i == 7:
        d.line((18, 77, 29, 77, 32, 76, 41, 76), fill="#55b4cf")
        d.line((46, 85, 54, 85), fill="#449cb8")
        put(i)
        continue
    green = ["#81bd57", "#86c25b", "#79b653", "#88c15a"]
    box(-16, -16, 32, 32, -7, 7, (green[i % 4], "#c29662", "#976f50"))
    for _ in range(34):
        x = r.randint(-15, 15)
        y = r.randint(-15, 15)
        line(
            (x, y, 0),
            (min(x + 1, 15), y, 0),
            r.choice(["#96cd65", "#76b34c", "#a9d56f", "#67a550"]),
        )
    if i in (1, 3):
        for fx, fy in [(-6, 9), (-4, 8), (8, -5)]:
            px, py = iso(fx, fy)
            d.point((px, py), fill="#47875a")
            d.line((px, py - 1, px + 1, py - 1), fill="#fff2a3" if i == 1 else "#ffc39c")
    if i == 4:
        face([(-16, -10, 0), (16, -10, 0), (16, 10, 0), (-16, 10, 0)], "#4b5863")
        line((-16, 10, 0), (16, 10, 0), "#cfd8d4")
        line((-16, -10, 0), (16, -10, 0), "#cfd8d4")
        for x in range(-16, 16, 9):
            line((x, 0, 0), (x + 4, 0, 0), "#f5c85b")
    if i == 6:
        # Broad coastal tree crowns with a sunlit upper-left edge and cool undersides.
        for x, y, h, leaf, light in [(-7, -7, 17, "#26826c", "#66bc78"),
                                    (5, -5, 21, "#388e53", "#a2ce62"),
                                    (-8, 5, 14, "#328259", "#6bb859"),
                                    (4, 8, 16, "#508e48", "#abd167")]:
            cx, cy = iso(x, y)
            d.ellipse((cx - 3, cy - 1, cx + 7, cy + 2), fill="#689f48")
            d.rectangle((cx - 1, cy - 8, cx + 1, cy), fill="#765646")
            crown_y = cy - h + 8
            d.ellipse((cx - 7, crown_y - 5, cx + 7, crown_y + 5), fill="#24694f")
            d.ellipse((cx - 8, crown_y - 7, cx + 5, crown_y + 2), fill=leaf)
            d.ellipse((cx - 6, crown_y - 9, cx + 1, crown_y - 3), fill=light)
    if i == 5:
        for x, y, w, h in [(-5, -6, 8, 8), (4, 1, 7, 6), (-8, 5, 6, 4)]:
            cx, cy = iso(x, y)
            d.polygon(
                [(cx - w, cy), (cx - w + 2, cy - h), (cx + 2, cy - h - 2), (cx + w, cy - 2), (cx + 3, cy + 1)],
                fill="#c2b69e",
            )
            d.polygon([(cx + 2, cy - h - 2), (cx + w, cy - 2), (cx + 3, cy + 1)], fill="#8a8272")
    put(i)


# Earth range facilities. The skyline carries the building's identity at map scale.
steel = ("#9aafba", "#647e90", "#40566a")
ivory = ("#fff0cf", "#d4cbb4", "#949e9d")
navy = ("#465e73", "#304958", "#233442")
gold = ("#ffdc79", "#e99944", "#995b39")
ink = "#263847"


def control(tier):
    # A narrow concrete core supports the cantilevered, glazed control room.
    box(-11, -9, 19, 18, 2, 7, steel)
    box(-6, -5, 10, 9, 9, 10 + 3 * tier, ivory)
    z = 19 + 3 * tier
    box(-11, -9, 21, 18, z, 2, navy)
    box(-10, -8, 19, 16, z + 2, 7, ("#77e6ec", "#3399b6", "#206780"))
    for x in (-8, -2, 5):
        line((x, 8, z + 3), (x, 8, z + 8), "#a7e7df")
    for y in (-5, 2, 7):
        line((9, y, z + 2), (9, y, z + 8), "#244960")
    box(-12, -10, 23, 20, z + 9, 2, ivory)
    box(-5, -4, 9, 8, z + 11, 2, steel)
    px, py = iso(2, -3, z + 13)
    d.line((px, py, px, py - 8 - tier), fill=ink, width=2)
    d.rectangle((px - 1, py - 10 - tier, px + 1, py - 8 - tier), fill="#ff7755")
    if tier >= 2:
        line((-7, -4, z + 11), (-7, -4, z + 18), "#61717a")


def launchpad(tier):
    box(-14, -13, 28, 26, 2, 3, navy)
    for k in range(-12, 12, 7):
        line((k, 12, 5), (k + 3, 12, 5), "#ffbf56", 2)
    # An open red service gantry stands apart from the ivory vehicle.
    x, y = iso(-8, 6, 5)
    h = 32 + 3 * tier
    for side in (-4, 4):
        d.line((x + side, y, x + side, y - h), fill="#934739", width=3)
        d.line((x + side - 1, y, x + side - 1, y - h), fill="#ff996a")
    for offset in range(0, h - 5, 7):
        d.line((x - 3, y - offset, x + 3, y - offset - 6), fill="#ed7752", width=2)
    for offset in (h - 1, h - 15):
        d.rectangle((x - 5, y - offset - 1, x + 13, y - offset + 1), fill="#b45242")
        d.line((x - 5, y - offset - 2, x + 12, y - offset - 2), fill="#ffd499")
    rx, ry = iso(5, -2, 5)
    nose = ry - 36 - 4 * tier
    d.polygon([(rx - 7, ry), (rx - 7, ry - 6), (rx - 4, ry - 14), (rx - 4, nose + 9), (rx, nose),
               (rx + 4, nose + 9), (rx + 4, ry - 14), (rx + 8, ry - 5), (rx + 8, ry), (rx, ry - 4)],
              fill="#f6ebd0", outline=ink)
    d.rectangle((rx + 2, nose + 10, rx + 3, ry - 6), fill="#9aafba")
    d.rectangle((rx - 3, nose + 12, rx + 3, nose + 15), fill="#ca583e")
    d.rectangle((rx - 3, ry - 11, rx + 3, ry - 9), fill=ink)
    if tier >= 2:
        for side in (-6, 6):
            d.line((rx + side, ry - 17, rx + side, ry - 4), fill="#d78a53", width=3)
            d.point((rx + side, ry - 18), fill="#fff2d7")


def refinery(tier):
    # Offset hot copper columns leave the central collection indicator clear.
    for cx, base, h, radius in [(53, 76, 27 + 2 * tier, 4), (24, 78, 19 + 2 * tier, 3)]:
        top = base - h
        d.rectangle((cx - radius, top, cx + radius, base), fill="#ae5338", outline=ink)
        d.rectangle((cx - radius + 1, top + 2, cx - 1, base - 2), fill="#eb8a4c")
        for lvl in range(top + 4, base - 2, 7):
            d.rectangle((cx - radius - 1, lvl, cx + radius + 1, lvl + 1), fill="#684840")
            d.line((cx - radius - 1, lvl, cx, lvl), fill="#ffd283")
        d.ellipse((cx - radius - 1, top - 2, cx + radius + 1, top + 2), fill="#ffd591", outline="#6b5049")
    d.line([(25, 66), (25, 59 - tier), (31, 56 - tier), (38, 59 - tier), (38, 69)], fill=ink, width=4)
    d.line([(25, 65), (25, 59 - tier), (31, 56 - tier), (38, 59 - tier), (38, 69)], fill="#efa95e", width=2)
    box(-8, -4, 18, 14, 2, 8, ("#9e7660", "#a75e41", "#6a493e"))
    box(-9, -5, 20, 16, 10, 2, navy)
    for x in (-6, -2, 2):
        line((x, 10, 5), (x + 2, 10, 6), "#ffd277", 2)
    for i in range(tier + 1):
        line((-6 + i * 4, 0, 13), (-6 + i * 4, 5, 13), "#a9b8ae", 2)


def cryo_vessel(cx, cy, r):
    # Elevated pressure spheres, with cold highlights and an equatorial seam.
    for offset in (-r // 2, r // 2):
        d.rectangle((cx + offset - 1, cy + r // 2, cx + offset + 1, cy + r + 4), fill="#466775")
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill="#4f9fa5", outline="#345867")
    d.ellipse((cx - r + 1, cy - r + 1, cx + r - 2, cy + r - 3), fill="#94dcd2")
    d.ellipse((cx - r + 3, cy - r + 2, cx, cy - 1), fill="#e0f5da")
    d.arc((cx - r, cy - 3, cx + r, cy + 3), 0, 180, fill="#348e98")
    d.rectangle((cx - 2, cy - r - 2, cx + 1, cy - r), fill="#517d88")


def tanks(tier):
    cryo_vessel(46, 67 - tier, 7 + tier // 2)
    if tier >= 2:
        cryo_vessel(26, 70, 6)
    cryo_vessel(33, 73 - tier, 9 + tier // 2)
    if tier >= 1:
        cryo_vessel(49, 76, 6)


def office(tier):
    # The terracotta gable and striped canvas canopy identify the public entrance.
    z = 12 + tier * 2
    box(-11, -8, 22, 16, 2, z - 2, ("#f9dca6", "#e5b27f", "#b78265"))
    face([(11, -8, z), (11, 8, z), (11, 0, z + 9)], "#ffe2ad")
    face([(-13, -10, z), (13, -10, z), (13, 0, z + 10), (-13, 0, z + 10)], "#b74f45")
    face([(-13, 0, z + 10), (13, 0, z + 10), (13, 10, z), (-13, 10, z)], "#e77754")
    line((-13, 0, z + 10), (13, 0, z + 10), "#ffb374", 2)
    line((-13, 10, z), (13, 10, z), "#873f3e", 2)
    for x in (-8, -3):
        line((x, 8, 6), (x, 8, 9), "#376777", 3)
    box(3, 8, 4, 1, 2, 6, navy)
    for i in range(5):
        x = -1 + i * 2
        face([(x, 8, 10), (x + 2, 8, 10), (x + 2, 12, 8), (x, 12, 8)], "#fff0c6" if i % 2 == 0 else "#c65048")
    x, y = iso(-11, -5, z + 6)
    d.line((x, y, x, y - 10 - tier), fill=ink, width=2)
    d.polygon([(x + 1, y - 10 - tier), (x + 10 + tier, y - 9 - tier), (x + 1, y - 5 - tier)], fill="#ffda6f")
    if tier >= 2:
        box(3, -5, 4, 3, z + 5, 6, ivory)


def hangar(tier):
    # Extrude the hangar's round end along the x axis. The nearer end faces right.
    z = 19 + tier * 3
    box(-12, -10, 24, 20, 2, z - 2, ("#aabcc3", "#748aa1", "#40576d"))
    arch = [(-10, 0), (-9, 4), (-6, 8), (-2, 10), (2, 10), (6, 8), (9, 4), (10, 0)]
    shades = ["#a1b5bd", "#cfdbd5", "#fff1d4", "#eadfc7", "#d0cebd", "#b4bcb6", "#92a5a5"]
    for ((y1, a), (y2, b)), col in zip(zip(arch, arch[1:]), shades):
        face([(-12, y1, z + a), (12, y1, z + a), (12, y2, z + b), (-12, y2, z + b)], col)
    face([(12, y, z + dz) for y, dz in arch], "#7b8c98")
    for x in (-10, -4, 3, 9):
        line((x, 10, 3), (x, 10, z), "#b3bdb5", 2)
    face([(12, -7, 2), (12, 7, 2), (12, 7, z + 1), (12, 4, z + 5), (12, -4, z + 5), (12, -7, z + 1)], ink)
    for height in range(6, z + 1, 4):
        line((12, -6, height), (12, 6, height), "#617c8b")
    for y in (-8, 8):
        line((12, y, 3), (12, y, z), "#f3b553", 2)
    line((-12, 10, z - 3), (12, 10, z - 3), "#efb854", 2)


def tracking(tier):
    box(-10, -8, 19, 17, 2, 5, steel)
    cx, cy = 40, 61 - tier * 2
    d.polygon([(cx - 8, 77), (cx - 2, cy - 1), (cx + 3, cy - 1), (cx + 8, 77)], fill="#66788c", outline=ink)
    d.line((cx - 5, 74, cx + 1, cy + 4), fill="#d9c8a8", width=2)
    # Stepped bowl opens upward to the right. The feed sits in the open sky.
    r = 14 + tier
    rim = [(cx - r, cy - 6), (cx - r + 6, cy - 6), (cx + 6, cy + 2), (cx + r, cy + 8)]
    d.polygon(rim + [(cx + 5, cy + 10), (cx - 3, cy + 8), (cx - 10, cy + 3)], fill="#9cabb4", outline=ink)
    d.polygon([(cx - r, cy - 6), (cx - r + 5, cy - 8), (cx + 4, cy - 2), (cx + r, cy + 6), (cx + r, cy + 8),
               (cx + 4, cy + 5), (cx - 7, cy)], fill="#fff0d3", outline="#c4c9b8")
    d.line([(cx - r + 2, cy - 6), (cx + 5, cy - 13), (cx + r - 1, cy + 6)], fill="#526e7d")
    d.line((cx, cy, cx + 5, cy - 13), fill="#748797", width=2)
    d.rectangle((cx + 4, cy - 15, cx + 7, cy - 12), fill="#e87a4f")
    if tier >= 2:
        box(6, -8, 5, 8, 2, 6, ivory)


def lab(tier):
    box(-12, -10, 24, 20, 2, 7, ivory)
    box(-12, -10, 24, 20, 9, 2, ("#a6a7c7", "#8368a2", "#5c537f"))
    # A triangulated glass roof over a low science wing.
    cx, cy = 38, 68 - tier
    r = 12 + tier
    vertices = [(cx - r, cy), (cx - r + 3, cy - 8), (cx - 4, cy - r), (cx + 4, cy - r),
                (cx + r - 2, cy - 7), (cx + r, cy + 1), (cx + 5, cy + 4), (cx - 6, cy + 3),
                (cx - 4, cy - 4), (cx + 5, cy - 5)]
    for a, b, c, color in [(0, 1, 8, "#a386cf"), (1, 2, 8, "#dfbdee"), (2, 3, 8, "#f8dcf7"),
                        (3, 9, 8, "#c5acf2"), (3, 4, 9, "#a48ad8"), (4, 5, 9, "#795eaf"),
                        (5, 6, 9, "#684b98"), (6, 8, 9, "#9679ce"), (6, 7, 8, "#8066b5"), (7, 0, 8, "#b298e5")]:
        d.polygon([vertices[a], vertices[b], vertices[c]], fill=color)
    d.line([vertices[0], vertices[7], vertices[6], vertices[5]], fill="#5e547f", width=2)
    for x in (-9, -4, 1, 6):
        line((x, 10, 5), (x + 2, 10, 5), "#4c8696", 2)
    if tier >= 2:
        box(7, -8, 4, 6, 11, 4, steel)


def solar_panel(x, y, w, length, z):
    box(x + w // 2 - 1, y + length // 2 - 1, 2, 3, 2, z - 1, steel)
    def panel_point(a, b):
        return (x + a, y + b, z + 6 * (1 - b / length))
    corners = [panel_point(0, 0), panel_point(w, 0), panel_point(w, length), panel_point(0, length)]
    face(corners, "#2d539a")
    for b in range(3, length, 4):
        line(panel_point(0, b), panel_point(w, b), "#6899cf")
    line(panel_point(w / 2, 0), panel_point(w / 2, length), "#8cc8da")
    for i in range(4):
        line(corners[i - 1], corners[i], "#b1cbd0" if i in (1, 2) else "#394d72")


def foundry(tier):
    # Two tilted photovoltaic wings flank a glowing furnace mouth.
    solar_panel(4, -13, 10, 18 + tier, 10 + tier)
    box(-7, -6, 14, 14, 2, 11 + tier, ("#da9b52", "#95563e", "#724637"))
    box(-7, -6, 14, 14, 13 + tier, 2, gold)
    box(-3, -3, 6, 6, 15 + tier, 4 + tier, navy)
    box(-4, -4, 8, 8, 19 + 2 * tier, 2, gold)
    box(-2, -2, 4, 4, 21 + 2 * tier, 0, navy)
    mouth = [(-5, 8, 3), (4, 8, 3), (4, 8, 8), (2, 8, 11), (-2, 8, 11), (-5, 8, 8)]
    face(mouth, ink)
    face([(-3, 8, 4), (2, 8, 4), (2, 8, 7), (0, 8, 9), (-3, 8, 7)], "#ff9a47")
    line((-2, 8, 5), (1, 8, 5), "#ffed8e", 2)
    solar_panel(-14, -4, 8, 17 + tier, 8 + tier)


def bank(tier):
    # Low armored bunker with a brass combination wheel on its broad facade.
    z = 14 + 2 * tier
    box(-12, -9, 24, 18, 2, z - 2, navy)
    for x in (-11, 8):
        box(x, 8, 3, 3, 2, z - 2, steel)
    box(-13, -10, 26, 20, z, 2, gold)
    box(-10, -8, 20, 16, z + 2, 2, steel)
    for i in range(1 + tier):
        x = -6 + (i % 2) * 6
        y = -5 + (i // 2) * 6
        box(x, y, 5, 4, z + 4, 2, gold)
    cx, cy = iso(0, 10, z // 2 + 2)
    d.ellipse((cx - 7, cy - 6, cx + 7, cy + 7), fill=ink)
    d.ellipse((cx - 6, cy - 6, cx + 6, cy + 5), fill="#c7873e", outline="#ffe492")
    d.ellipse((cx - 4, cy - 4, cx + 4, cy + 3), fill="#40515b")
    for dx, dy in ((0, -4), (-3, 2), (3, 2)):
        d.line((cx, cy, cx + dx, cy + dy), fill="#ffd172", width=2)
    d.point((cx, cy), fill="#fff0b4")


facilities = [(8, control), (12, launchpad), (16, refinery), (20, tanks), (24, office),
              (28, hangar), (32, tracking), (36, lab), (40, foundry), (46, bank)]
for first_frame, draw_facility in facilities:
    for tier in range(4):
        frame(first_frame + tier)
        face([(-12, -10, 0), (15, -10, 0), (16, 12, 0), (13, 15, 0), (-12, 15, 0)], "#506d60")
        box(-13, -13, 26, 26, 0, 2, ("#d6d9cc", "#869da3", "#607780"))
        draw_facility(tier)
        for pip in range(tier + 1):
            box(10 - pip * 4, 12, 2, 2, 2, 2, gold)
        put(first_frame + tier)


# Frame 44: Road lamp fixture
frame(44)
cx, cy = iso(0, 0)
d.line((cx, cy, cx, cy - 11), fill="#5b7377", width=2)
d.line((cx, cy - 11, cx + 4, cy - 13), fill="#c7d4cf", width=2)
d.line((cx + 4, cy - 13, cx + 6, cy - 13), fill="#ffe082", width=2)
put(44)

# Frame 45: Tier 2 unbuilt/locked construction pad footprint
frame(45)
box(-12, -12, 24, 24, 0, 1, ("#8ea3a8", "#61777d", "#485c63"))
for px, py in [(-11, -11), (9, -11), (-11, 9), (9, 9)]:
    box(px, py, 2, 2, 1, 3, ("#ffcf70", "#d9822b", "#8f4e14"))
line((-9, 0, 1), (9, 0, 1), "#c4d6d9", 1)
line((0, -9, 1), (0, 9, 1), "#c4d6d9", 1)
put(45)


atlas.save(out)
if docs_out.parent.exists():
    atlas.save(docs_out)
print(f"Generated vibrant {out} ({atlas.size[0]}x{atlas.size[1]})")

# Resource silhouettes share the same pixels in the world and in the HUD.
for resource in ("credits", "propellant"):
    icon = Image.new("RGBA", (16, 16))
    pen = ImageDraw.Draw(icon)
    if resource == "credits":
        for x, y in [(1, 8), (4, 5), (2, 2)]:
            pen.rounded_rectangle((x, y + 1, x + 10, y + 5), 2, fill="#ae622e")
            pen.ellipse((x, y, x + 10, y + 4), fill="#f8c45d", outline="#e19a40")
            pen.line((x + 3, y + 1, x + 7, y + 1), fill="#fff2ab")
            pen.point((x + 3, y + 4), fill="#ffdf8a")
    else:
        pen.rectangle((6, 1, 10, 3), fill="#d2ede2")
        pen.rounded_rectangle((3, 3, 12, 14), 3, fill="#78dfc9")
        pen.rectangle((9, 5, 12, 12), fill="#329e98")
        pen.line((5, 5, 5, 11), fill="#d7f4de")
        pen.rectangle((3, 7, 12, 8), fill="#205a68")
        pen.line((5, 13, 10, 13), fill="#48aa9c")
    icon.save(out.parent / (resource + ".png"))
