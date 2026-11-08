#!/usr/bin/env python3
"""Generate the theme-aware diagram SVGs from per-language string tables.

Reads themes/bifrost/tools/diagram-strings/{lang}.json and writes
themes/bifrost/static/diagrams/{name}.svg          (lang == "en", the fallback)
themes/bifrost/static/diagrams/{name}.{lang}.svg   (every other language)

One visual family (2026-11 redesign): every colour is a CSS class resolved by
sass/components/_diagram.scss, so the figures recolour with the light/dark
toggle. The twelve precessional ages carry the Bifrost rainbow — the same
hue for the same age in every diagram (`dg-age-0` = Capricorn, the project's
opening, through `dg-age-11` = Aquarius, the present). Labels are horizontal,
nothing crosses a label, and the current age is the one solid accent.

Wide figures can ship a phone variant ({name}-narrow…svg); the diagram
shortcode swaps them with a media query.

Run from the www repo root:  python3 themes/bifrost/tools/gen_diagrams.py
Then eyeball every language: long translations are wrapped, not measured.
"""
import json, math, glob, os, unicodedata

HERE = os.path.dirname(__file__)
STR_DIR = os.path.join(HERE, "diagram-strings")
OUT = os.path.join(HERE, "..", "static", "diagrams")

def f(v): return f"{v:.1f}"
def esc(s): return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))

# Chronological order of the ages: index = rainbow position.
CHRON = ["capricorn","sagittarius","scorpio","libra","virgo","leo","cancer","gemini","taurus","aries","pisces","aquarius"]
def age(sign): return CHRON.index(sign)

# zodiac glyph paths — identical designs to macros/zodiac.html
GLYPHS = {
 "capricorn":'<path d="M4 7 V17 M4 7 L9 13 L13 7 Q17 7 17 13 Q17 18 13 18 Q9 18 9 14"/>',
 "sagittarius":'<line x1="5" y1="19" x2="19" y2="5"/><polyline points="13 5 19 5 19 11"/><line x1="9" y1="12" x2="12" y2="15"/>',
 "scorpio":'<path d="M4 18 V7 L8 12 L12 7 V18 L16 12 V18 H21"/><path d="M19 16 L21 18 L19 20"/>',
 "libra":'<path d="M6 13 Q6 8 12 8 Q18 8 18 13"/><line x1="3" y1="14" x2="21" y2="14"/><line x1="3" y1="18" x2="21" y2="18"/>',
 "virgo":'<path d="M5 19 V7 L9 13 L13 7 V19 Q15 14 18 14 Q21 14 19 19 Q17 22 15 19"/>',
 "leo":'<circle cx="8" cy="16" r="3"/><path d="M11 16 Q11 8 14 6 Q19 5 19 11 Q19 14 17 16 Q15 17 17 19"/>',
 "cancer":'<line x1="4" y1="9" x2="14" y2="9"/><circle cx="16" cy="11" r="2"/><line x1="20" y1="15" x2="10" y2="15"/><circle cx="8" cy="13" r="2"/>',
 "gemini":'<line x1="5" y1="5" x2="19" y2="5"/><line x1="5" y1="19" x2="19" y2="19"/><line x1="9" y1="5" x2="9" y2="19"/><line x1="15" y1="5" x2="15" y2="19"/>',
 "taurus":'<circle cx="12" cy="15" r="4"/><path d="M5 8 Q12 13 19 8"/>',
 "aries":'<path d="M5 18 V11 Q5 5 9 5 Q12 5 12 12 Q12 5 15 5 Q19 5 19 11 V18"/>',
 "pisces":'<path d="M7 5 Q4 12 7 19"/><path d="M17 5 Q20 12 17 19"/><line x1="7" y1="12" x2="17" y2="12"/>',
 "aquarius":'<path d="M3 9 L7 7 L11 9 L15 7 L19 9"/><path d="M3 15 L7 13 L11 15 L15 13 L19 15"/>',
}

def glyph_defs(prefix):
    o = ['  <defs>']
    for name, paths in GLYPHS.items():
        o.append(f'    <symbol id="{prefix}-{name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">{paths}</symbol>')
    o.append('  </defs>')
    return o

def text_w(s, size):
    """Rough rendered width: CJK/Hangul full-width, Latin/Cyrillic/Hebrew ~0.56em."""
    w = 0.0
    for ch in s:
        w += 1.0 if unicodedata.east_asian_width(ch) in ("W", "F") else 0.56
    return w * size

def wrap(s, max_w, size, lines=2):
    """Split on spaces into at most `lines` lines that fit max_w (best effort)."""
    if text_w(s, size) <= max_w or " " not in s:
        return [s]
    words = s.split(" "); best = [s]; best_w = 1e9
    for i in range(1, len(words)):
        a, b = " ".join(words[:i]), " ".join(words[i:])
        w = max(text_w(a, size), text_w(b, size))
        if w < best_w: best, best_w = [a, b], w
    return best

def _pt(cx, cy, r, a):
    rad = math.radians(a); return cx + r*math.sin(rad), cy - r*math.cos(rad)

def arc(cx, cy, r, a0, a1):
    x0, y0 = _pt(cx, cy, r, a0); x1, y1 = _pt(cx, cy, r, a1)
    large = 1 if (a1 - a0) % 360 > 180 else 0
    return f"M {f(x0)} {f(y0)} A {r} {r} 0 {large} 1 {f(x1)} {f(y1)}"

def sector(cx, cy, r0, r1, a0, a1):
    p0 = _pt(cx, cy, r1, a0); p1 = _pt(cx, cy, r1, a1); p2 = _pt(cx, cy, r0, a1); p3 = _pt(cx, cy, r0, a0)
    return (f"M {f(p0[0])} {f(p0[1])} A {r1} {r1} 0 0 1 {f(p1[0])} {f(p1[1])} "
            f"L {f(p2[0])} {f(p2[1])} A {r0} {r0} 0 0 0 {f(p3[0])} {f(p3[1])} Z")

def arrowhead(cx, cy, r, a, clockwise):
    """Small filled triangle on the circle of radius r at angle a, pointing along the arc."""
    d = 1 if clockwise else -1
    tip = _pt(cx, cy, r, a + 3*d); b1 = _pt(cx, cy, r + 4, a - 2*d); b2 = _pt(cx, cy, r - 4, a - 2*d)
    return f'M {f(tip[0])} {f(tip[1])} L {f(b1[0])} {f(b1[1])} L {f(b2[0])} {f(b2[1])} Z'

# ---------------------------------------------------------------- the two zodiac wheels
ORDER_GY = ["aries","taurus","gemini","cancer","leo","virgo","libra","scorpio","sagittarius","capricorn","aquarius","pisces"]
ORDER_WH = CHRON

def zodiac_wheel(S, kind):
    """Shared geometry for the Great Year and the Wheel of Heaven, so the two read
    as siblings: rainbow rim, tinted sectors, glyph + name (+ gloss), a hub with
    the title, the direction of the ages inside the hub, and one 'now' marker."""
    Z = S["zodiac"]
    if kind == "gy":
        T = S["gy"]; order = ORDER_GY; clockwise = False; pid = "gy"
        title, years, sub, gloss = T["center"], T["years"], T["sub"], {}
        here, here_year = T["here"], None
    else:
        T = S["wh"]; order = ORDER_WH; clockwise = True; pid = "wh"
        title, years, sub, gloss = T["center"], None, T["sub"], T["gloss"]
        here, here_year = T["here"], T["here_year"]
    W, H = 640, 640; cx = cy = 320.0
    R_rim, R_out, R_in = 232.0, 224.0, 126.0
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" aria-labelledby="{pid}-t {pid}-d" class="dg dg--wheel">',
         f'  <title id="{pid}-t">{esc(T["title"])}</title>', f'  <desc id="{pid}-d">{esc(T["desc"])}</desc>']
    o += glyph_defs(f"{pid}-z")
    # sectors
    o.append('  <g>')
    for i, sign in enumerate(order):
        a = 30*i; cur = sign == "aquarius"
        cls = f"dg-age dg-age-{age(sign)}" + (" dg-age--now" if cur else "")
        o.append(f'    <path d="{sector(cx, cy, R_in, R_out, a-15, a+15)}" class="{cls}"/>')
    o.append('  </g>')
    # rainbow rim
    o.append('  <g class="dg-rim">')
    for i, sign in enumerate(order):
        a = 30*i
        o.append(f'    <path d="{arc(cx, cy, R_rim, a-14, a+14)}" class="dg-rim-{age(sign)}"/>')
    o.append('  </g>')
    # hairlines
    o.append(f'  <circle cx="{cx:g}" cy="{cy:g}" r="{R_in:g}" class="dg-hair" fill="none"/>')
    o.append('  <g class="dg-hair">')
    for i in range(12):
        x1, y1 = _pt(cx, cy, R_in, 15+30*i); x2, y2 = _pt(cx, cy, R_out, 15+30*i)
        o.append(f'    <line x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}"/>')
    o.append('  </g>')
    # glyph, name, gloss — stacked vertically around one anchor so nothing
    # collides on the 3 and 9 o'clock sectors
    o.append('  <g text-anchor="middle">')
    for i, sign in enumerate(order):
        a = 30*i; cur = sign == "aquarius"; g = gloss.get(sign)
        glines = wrap(g, 84, 10.5) if g else []
        ax, ay = _pt(cx, cy, 176, a)
        gs = 18; block = gs + 6 + 14 + (13*len(glines) + 2 if glines else 0)
        top = ay - block/2
        o.append(f'    <use href="#{pid}-z-{sign}" x="{f(ax-gs/2)}" y="{f(top)}" width="{gs}" height="{gs}" class="dg-glyph dg-ink-{age(sign)}"/>')
        ncls = "dg-label dg-label--now" if cur else "dg-label"
        o.append(f'    <text x="{f(ax)}" y="{f(top+gs+6+11)}" class="{ncls}" font-size="13.5">{esc(Z[sign])}</text>')
        for j, l in enumerate(glines):
            o.append(f'    <text x="{f(ax)}" y="{f(top+gs+6+14+13+13*j)}" class="dg-label--muted" font-size="10.5">{esc(l)}</text>')
    o.append('  </g>')
    # rim years (wheel of heaven only)
    if kind == "wh":
        o.append('  <g class="dg-mono">')
        def rim_label(ang, lines):
            x, y = _pt(cx, cy, R_rim + 14, ang)
            s = math.sin(math.radians(ang)); c = math.cos(math.radians(ang))
            anchor = "middle" if abs(s) < 0.3 else ("start" if s > 0 else "end")
            dy = -4 if c > 0.3 else (10 if c < -0.3 else 3.5)
            for j, l in enumerate(lines):
                o.append(f'    <text x="{f(x)}" y="{f(y + dy + 12*j - (12*(len(lines)-1) if c > 0.3 else 0))}" text-anchor="{anchor}">{esc(l)}</text>')
        for ang, yr in T["years"].items():
            rim_label(float(ang), [yr])
        rim_label(345, T["wrap"])
        o.append('  </g>')
    # now marker on the Pisces|Aquarius boundary (315° in both orders)
    mx, my = _pt(cx, cy, R_rim, 315)
    o.append(f'  <circle cx="{f(mx)}" cy="{f(my)}" r="11" class="dg-now-halo"/>')
    o.append(f'  <circle cx="{f(mx)}" cy="{f(my)}" r="5.5" class="dg-now"/>')
    lx, ly = _pt(cx, cy, R_rim+22, 315)
    o.append(f'  <text x="{f(lx-2)}" y="{f(ly-4)}" text-anchor="end" class="dg-label--now" font-size="13" font-weight="600">{esc(here)}</text>')
    if here_year:
        o.append(f'  <text x="{f(lx-2)}" y="{f(ly+10)}" text-anchor="end" class="dg-mono dg-mono--now">{esc(here_year)}</text>')
    # direction of the ages, inside the hub, clear of the title
    r_dir = R_in - 16
    a0, a1 = (-26, 26)
    o.append(f'  <path d="{arc(cx, cy, r_dir, a0, a1)}" class="dg-dir" fill="none"/>')
    o.append(f'  <path d="{arrowhead(cx, cy, r_dir, a1 if clockwise else a0, clockwise)}" class="dg-dir-head"/>')
    adv = T["advance"].replace("→", "").strip()
    o.append(f'  <text x="{cx:g}" y="{f(cy - r_dir + 20)}" text-anchor="middle" class="dg-mono">{esc(adv)}</text>')
    # hub text
    n_t = len(title); y0 = cy + 4 - 13*(n_t-1) - (8 if years else 0)
    for j, l in enumerate(title):
        o.append(f'  <text x="{cx:g}" y="{f(y0+26*j)}" text-anchor="middle" class="dg-label dg-title" font-size="23" font-weight="600">{esc(l)}</text>')
    yy = y0 + 26*(n_t-1) + 24
    if years:
        o.append(f'  <text x="{cx:g}" y="{f(yy)}" text-anchor="middle" class="dg-mono">{esc(years)}</text>'); yy += 22
    for j, l in enumerate(sub):
        o.append(f'  <text x="{cx:g}" y="{f(yy+16*j)}" text-anchor="middle" class="dg-label--muted" font-size="12.5">{esc(l)}</text>')
    # foot
    o.append(f'  <text x="{cx:g}" y="{H-14}" text-anchor="middle" class="dg-mono">{esc(T["foot"])}</text>')
    o.append('</svg>')
    return "\n".join(o) + "\n"

def great_year(S): return zodiac_wheel(S, "gy")
def wheel(S): return zodiac_wheel(S, "wh")

# ---------------------------------------------------------------- precession
def precession(S):
    p = S["pr"]; W, H = 660, 440
    stars = [(96,64,1.6),(470,40,1.4),(560,128,1.8),(606,74,1.3),(84,170,1.5),(520,196,1.4),(150,104,1.3),(620,250,1.2),(40,300,1.4),(590,360,1.5),(110,390,1.2),(470,300,1.1)]
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" aria-labelledby="pr-t pr-d" class="dg dg--precession">',
         f'  <title id="pr-t">{esc(p["title"])}</title>', f'  <desc id="pr-d">{esc(p["desc"])}</desc>',
         '  <g class="dg-star">' + "".join(f'<circle cx="{x}" cy="{y}" r="{r}"/>' for x, y, r in stars) + '</g>']
    ex, ey, Rx, Ry = 300, 120, 104, 34     # pole circle
    gx, gy, gr = 300, 362, 32              # Earth
    # faint cone: Earth to both ends of the circle
    o.append(f'  <path d="M {gx} {gy} L {ex-Rx} {ey} M {gx} {gy} L {ex+Rx} {ey}" class="dg-hair" fill="none"/>')
    o.append(f'  <ellipse cx="{ex}" cy="{ey}" rx="{Rx}" ry="{Ry}" class="dg-cone" />')
    # ecliptic normal
    o.append(f'  <line x1="{gx}" y1="{gy}" x2="{ex}" y2="62" class="dg-muted-line" stroke-dasharray="5 5"/>')
    o.append(f'  <text x="{ex}" y="48" text-anchor="middle" class="dg-mono">{esc(p["ecliptic_normal"])}</text>')
    # the precessional circle (accent) with direction
    o.append(f'  <ellipse cx="{ex}" cy="{ey}" rx="{Rx}" ry="{Ry}" class="dg-accent-line" fill="none" stroke-dasharray="5 5"/>')
    o.append(f'  <path d="M {ex+2} {ey+Ry-5} L {ex+13} {ey+Ry} L {ex+2} {ey+Ry+5} Z" class="dg-now"/>')
    # rotation axis to Polaris
    px, py = ex + 99, ey - 10
    o.append(f'  <line x1="{gx}" y1="{gy}" x2="{px}" y2="{py}" class="dg-axis-line"/>')
    for j, l in enumerate(p["axis"]):
        ly = 236 + 17*j; lx = gx + (px - gx) * (gy - ly) / (gy - py) + 14
        o.append(f'  <text x="{f(lx)}" y="{ly}" class="dg-label--muted" font-size="13">{esc(l)}</text>')
    # tilt angle
    o.append(f'  <path d="M {gx} {gy-58} A 58 58 0 0 1 {f(gx+58*math.sin(math.radians(23.4)))} {f(gy-58*math.cos(math.radians(23.4)))}" fill="none" class="dg-muted-line"/>')
    o.append(f'  <text x="{gx+30}" y="{gy-64}" class="dg-label" font-size="13.5" font-weight="600">23.4°</text>')
    # Earth
    o.append(f'  <circle cx="{gx}" cy="{gy}" r="{gr}" class="dg-earth"/>')
    o.append(f'  <ellipse cx="{gx}" cy="{gy}" rx="{gr}" ry="9" fill="none" class="dg-hair" transform="rotate(23.4 {gx} {gy})"/>')
    # stars on the circle
    tx, ty = ex - Rx + 6, ey + 12      # Thuban (left, front)
    vx, vy = ex - 40, ey - Ry + 2      # Vega (back, upper left)
    o.append(f'  <circle cx="{tx}" cy="{ty}" r="4.5" class="dg-star-mark"/>')
    o.append(f'  <text x="{tx-12}" y="{ty+2}" text-anchor="end" class="dg-label" font-size="15">{esc(p["thuban"])}</text>')
    o.append(f'  <text x="{tx-12}" y="{ty+19}" text-anchor="end" class="dg-mono">{esc(p["thuban_date"])}</text>')
    o.append(f'  <circle cx="{vx}" cy="{vy}" r="4.5" class="dg-star-mark"/>')
    o.append(f'  <text x="{vx-10}" y="{vy-26}" text-anchor="end" class="dg-label" font-size="15">{esc(p["vega"])}</text>')
    o.append(f'  <text x="{vx-10}" y="{vy-10}" text-anchor="end" class="dg-mono">{esc(p["vega_date"])}</text>')
    o.append(f'  <circle cx="{px}" cy="{py}" r="11" class="dg-now-halo"/>')
    o.append(f'  <circle cx="{px}" cy="{py}" r="5.5" class="dg-now"/>')
    o.append(f'  <text x="{px+18}" y="{py-2}" class="dg-label--now" font-size="15" font-weight="600">{esc(p["polaris"])}</text>')
    o.append(f'  <text x="{px+18}" y="{py+15}" class="dg-mono">{esc(p["polaris_sub"])}</text>')
    o.append('</svg>')
    return "\n".join(o) + "\n"

# ---------------------------------------------------------------- world-ages timeline
def age_bounds(S):
    """Start/end label for each age in CHRON order, from the wheel's rim years."""
    w = S["wh"]; t = S["tb"]
    b = [w["wrap"][0]] + [w["years"][str(a)] for a in range(15, 286, 30)] + [w["here_year"], t["end"].lstrip("~")]
    return [(b[i], b[i+1]) for i in range(12)]

def event_lines(s, max_w, size):
    if " · " in s:
        parts = s.split(" · ")
        return [parts[0], " · ".join(parts[1:])]
    return wrap(s, max_w, size)

def timeline(S):
    Z = S["zodiac"]; t = S["tb"]
    W, H = 980, 226; x0, x1 = 40.0, 940.0; cw = (x1-x0)/12
    ytop, ybot = 96.0, 156.0; gs = 22.0
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" aria-labelledby="tb-t tb-d" class="dg dg--timeline">',
         f'  <title id="tb-t">{esc(t["title"])}</title>', f'  <desc id="tb-d">{esc(t["desc"])}</desc>']
    o += glyph_defs("tb-z")
    for i, sign in enumerate(CHRON):
        cx0 = x0 + i*cw; cur = sign == "aquarius"; tx = cx0 + cw/2
        cls = f"dg-age dg-age-{i}" + (" dg-age--now" if cur else "")
        o.append(f'  <rect x="{f(cx0+1.5)}" y="{f(ytop)}" width="{f(cw-3)}" height="{f(ybot-ytop)}" rx="6" class="{cls}"/>')
        o.append(f'  <rect x="{f(cx0+1.5)}" y="{f(ytop)}" width="{f(cw-3)}" height="4" rx="2" class="dg-bar-{i}"/>')
        o.append(f'  <use href="#tb-z-{sign}" x="{f(tx-gs/2)}" y="{f((ytop+ybot)/2-gs/2+2)}" width="{gs}" height="{gs}" class="dg-glyph dg-ink-{i}"/>')
        ncls = "dg-label dg-label--now" if cur else "dg-label"
        name = Z[sign]; size = 12.0 if text_w(name, 12) <= cw - 6 else 10.5
        o.append(f'  <text x="{f(tx)}" y="{f(ytop-12)}" text-anchor="middle" class="{ncls}" font-size="{size:g}">{esc(name)}</text>')
        if sign in t["events"]:
            for j, l in enumerate(event_lines(t["events"][sign], cw - 4, 10.5)):
                o.append(f'  <text x="{f(tx)}" y="{f(ybot+20+13*j)}" text-anchor="middle" class="dg-label--muted" font-size="10.5">{esc(l)}</text>')
    nx = x0 + 11*cw
    o.append(f'  <line x1="{f(nx)}" y1="{f(ytop-40)}" x2="{f(nx)}" y2="{f(ybot+4)}" class="dg-accent-line" stroke-dasharray="4 3"/>')
    o.append(f'  <circle cx="{f(nx)}" cy="{f(ytop-40)}" r="4" class="dg-now"/>')
    o.append(f'  <text x="{f(nx-8)}" y="{f(ytop-36)}" text-anchor="end" class="dg-mono dg-mono--now">{esc(t["now"])}</text>')
    o.append(f'  <text x="{f(x0)}" y="{f(H-12)}" text-anchor="start" class="dg-mono">{esc(t["start"])}</text>')
    o.append(f'  <text x="{f(x1)}" y="{f(H-12)}" text-anchor="end" class="dg-mono">{esc(t["end"])}</text>')
    o.append('</svg>')
    return "\n".join(o) + "\n"

def timeline_narrow(S):
    """Phone variant: the same twelve ages as a vertical list."""
    Z = S["zodiac"]; t = S["tb"]; bounds = age_bounds(S)
    W = 360; row = 52; top = 40; H = top + 12*row + 46
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" aria-labelledby="tbn-t tbn-d" class="dg dg--timeline-narrow">',
         f'  <title id="tbn-t">{esc(t["title"])}</title>', f'  <desc id="tbn-d">{esc(t["desc"])}</desc>']
    o += glyph_defs("tbn-z")
    o.append(f'  <text x="16" y="24" class="dg-mono">{esc(t["start"])}</text>')
    for i, sign in enumerate(CHRON):
        y = top + i*row; cur = sign == "aquarius"
        cls = f"dg-age dg-age-{i}" + (" dg-age--now" if cur else "")
        o.append(f'  <rect x="10" y="{y+2}" width="{W-20}" height="{row-4}" rx="8" class="{cls}"/>')
        o.append(f'  <rect x="10" y="{y+2}" width="4" height="{row-4}" rx="2" class="dg-bar-{i}"/>')
        o.append(f'  <use href="#tbn-z-{sign}" x="26" y="{y+row/2-11}" width="22" height="22" class="dg-glyph dg-ink-{i}"/>')
        ncls = "dg-label dg-label--now" if cur else "dg-label"
        o.append(f'  <text x="60" y="{y+row/2-2}" class="{ncls}" font-size="14" font-weight="{600 if cur else 500}">{esc(Z[sign])}</text>')
        a, b = bounds[i]
        o.append(f'  <text x="60" y="{y+row/2+14}" class="dg-mono">{esc(a)} – {esc(b)}</text>')
        ev = t["events"].get(sign)
        if ev:
            lines = event_lines(ev, 128, 11.5)
            y0 = y + row/2 + 4 - 7*(len(lines)-1)
            for j, l in enumerate(lines):
                o.append(f'  <text x="{W-20}" y="{y0+14*j}" text-anchor="end" class="dg-label--muted" font-size="11.5">{esc(l)}</text>')
    o.append(f'  <text x="16" y="{H-14}" class="dg-mono dg-mono--now">{esc(t["now"])}</text>')
    o.append('</svg>')
    return "\n".join(o) + "\n"

BUILDERS = {"precession": precession, "great-year": great_year, "wheel-of-heaven": wheel,
            "world-ages-timeline": timeline,
            "world-ages-timeline-narrow": timeline_narrow}

def main():
    for path in sorted(glob.glob(os.path.join(STR_DIR, "*.json"))):
        S = json.load(open(path))
        lang = S["lang"]
        for name, fn in BUILDERS.items():
            suffix = ".svg" if lang == "en" else f".{lang}.svg"
            with open(os.path.join(OUT, name + suffix), "w") as fh:
                fh.write(fn(S))
        print(f"{lang}: wrote {len(BUILDERS)} diagrams")

if __name__ == "__main__":
    main()
