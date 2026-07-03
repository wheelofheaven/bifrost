#!/usr/bin/env python3
"""Generate the theme-aware diagram SVGs from per-language string tables.

Reads themes/bifrost/tools/diagram-strings/{lang}.json and writes
themes/bifrost/static/diagrams/{name}.svg      (for lang == "en", the fallback)
themes/bifrost/static/diagrams/{name}.{lang}.svg  (for every other language)

Layout geometry is identical across languages; only the text differs, so long
translations may need font/spacing tolerance — eyeball each language after
regenerating. Run from the www repo root:  python themes/bifrost/tools/gen_diagrams.py
"""
import json, math, glob, os

HERE = os.path.dirname(__file__)
STR_DIR = os.path.join(HERE, "diagram-strings")
OUT = os.path.join(HERE, "..", "static", "diagrams")

def f(v): return f"{v:.1f}"
def esc(s): return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))

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

# ---------------------------------------------------------------- precession
def precession(S):
    p = S["pr"]
    axis_lines = "\n  ".join(
        f'<text x="412" y="{212+16*j}" text-anchor="start" class="dg-label--muted" font-size="13">{esc(l)}</text>'
        for j, l in enumerate(p["axis"]))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 400" role="img" aria-labelledby="pr-t pr-d">
  <title id="pr-t">{esc(p["title"])}</title>
  <desc id="pr-d">{esc(p["desc"])}</desc>
  <g class="dg-label--muted" opacity="0.55">
    <circle cx="118" cy="58" r="1.6"/><circle cx="470" cy="44" r="1.4"/><circle cx="556" cy="120" r="1.7"/>
    <circle cx="602" cy="72" r="1.3"/><circle cx="92" cy="150" r="1.5"/><circle cx="516" cy="184" r="1.4"/><circle cx="150" cy="96" r="1.3"/>
  </g>
  <line x1="300" y1="340" x2="300" y2="60" class="dg-muted" stroke-width="1.5" stroke-dasharray="5 5"/>
  <text x="300" y="48" text-anchor="middle" class="dg-label--muted" font-size="13">{esc(p["ecliptic_normal"])}</text>
  <ellipse cx="300" cy="110" rx="99" ry="34" fill="none" class="dg-accent" stroke-width="2" stroke-dasharray="4 4"/>
  <path d="M 305 141 L 315 146 L 305 151 Z" class="dg-accent--fill"/>
  <line x1="300" y1="340" x2="399" y2="113" class="dg-line" stroke-width="2.5"/>
  {axis_lines}
  <path d="M 300 286 A 54 54 0 0 1 321.6 290.4" fill="none" class="dg-muted" stroke-width="1.4"/>
  <text x="330" y="300" text-anchor="start" class="dg-label" font-size="13">23.4°</text>
  <circle cx="300" cy="340" r="30" class="dg-line dg-surface" stroke-width="2"/>
  <ellipse cx="300" cy="340" rx="30" ry="9" fill="none" class="dg-muted" stroke-width="1.2" transform="rotate(23.4 300 340)"/>
  <circle cx="207" cy="122" r="4" class="dg-label"/>
  <text x="198" y="119" text-anchor="end" class="dg-label" font-size="14">{esc(p["thuban"])}</text>
  <text x="198" y="135" text-anchor="end" class="dg-label--muted" font-size="12">{esc(p["thuban_date"])}</text>
  <circle cx="266" cy="78" r="4" class="dg-label"/>
  <text x="257" y="73" text-anchor="end" class="dg-label" font-size="14">{esc(p["vega"])}</text>
  <text x="257" y="89" text-anchor="end" class="dg-label--muted" font-size="12">{esc(p["vega_date"])}</text>
  <circle cx="399" cy="113" r="5.5" class="dg-accent--fill"/>
  <text x="412" y="110" text-anchor="start" class="dg-label--accent" font-size="14">{esc(p["polaris"])}</text>
  <text x="412" y="126" text-anchor="start" class="dg-label--muted" font-size="12">{esc(p["polaris_sub"])}</text>
</svg>
'''

def _pt(cx, cy, r, a):
    rad = math.radians(a); return cx + r*math.sin(rad), cy - r*math.cos(rad)

ORDER_GY = ["aries","taurus","gemini","cancer","leo","virgo","libra","scorpio","sagittarius","capricorn","aquarius","pisces"]
ORDER_WH = ["capricorn","sagittarius","scorpio","libra","virgo","leo","cancer","gemini","taurus","aries","pisces","aquarius"]

# ---------------------------------------------------------------- great year
def great_year(S):
    Z = S["zodiac"]; g = S["gy"]; cx=cy=260.0; R_out,R_in=206.0,134.0; r=170.0
    o=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 560" role="img" aria-labelledby="gy-t gy-d">',
       f'  <title id="gy-t">{esc(g["title"])}</title>', f'  <desc id="gy-d">{esc(g["desc"])}</desc>',
       f'  <circle cx="260" cy="260" r="206" fill="none" class="dg-muted" stroke-width="1.5"/>',
       f'  <circle cx="260" cy="260" r="134" fill="none" class="dg-muted" stroke-width="1.5"/>',
       '  <g class="dg-muted" stroke-width="1">']
    for i in range(12):
        x1,y1=_pt(cx,cy,R_in,15+30*i); x2,y2=_pt(cx,cy,R_out,15+30*i)
        o.append(f'    <line x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}"/>')
    o.append('  </g>\n  <g text-anchor="middle">')
    for i,sign in enumerate(ORDER_GY):
        x,y=_pt(cx,cy,r,30*i)
        cur = sign=="aquarius"
        cls="dg-label--accent" if cur else "dg-label"; wt=' font-weight="600"' if cur else ''
        o.append(f'    <text x="{f(x)}" y="{f(y+4)}" class="{cls}" font-size="12.5"{wt}>{esc(Z[sign])}</text>')
    o.append('  </g>')
    xp,yp=_pt(cx,cy,R_in-4,315)
    o.append(f'  <line x1="260" y1="260" x2="{f(xp)}" y2="{f(yp)}" class="dg-accent" stroke-width="2"/>')
    o.append(f'  <circle cx="{f(xp)}" cy="{f(yp)}" r="5" class="dg-accent--fill"/>')
    o.append(f'  <text x="108" y="104" text-anchor="end" class="dg-label--accent" font-size="12.5">{esc(g["here"])}</text>')
    x1,y1=_pt(cx,cy,232,44); x2,y2=_pt(cx,cy,232,12)
    o.append(f'  <path d="M {f(x1)} {f(y1)} A 232 232 0 0 0 {f(x2)} {f(y2)}" fill="none" class="dg-accent" stroke-width="1.6"/>')
    tip=_pt(cx,cy,232,10); b1=_pt(cx,cy,237,15); b2=_pt(cx,cy,227,15)
    o.append(f'  <path d="M {f(tip[0])} {f(tip[1])} L {f(b1[0])} {f(b1[1])} L {f(b2[0])} {f(b2[1])} Z" class="dg-accent--fill"/>')
    o.append(f'  <text x="300" y="34" text-anchor="middle" class="dg-label--muted" font-size="10.5">{esc(g["advance"])}</text>')
    cy0=260
    for j,l in enumerate(g["center"]):
        o.append(f'  <text x="260" y="{cy0-20+18*j}" text-anchor="middle" class="dg-label" font-size="15" font-weight="600">{esc(l)}</text>')
    o.append(f'  <text x="260" y="{cy0+2}" text-anchor="middle" class="dg-label--muted" font-size="12">{esc(g["years"])}</text>')
    for j,l in enumerate(g["sub"]):
        o.append(f'  <text x="260" y="{cy0+24+16*j}" text-anchor="middle" class="dg-label--muted" font-size="12">{esc(l)}</text>')
    o.append(f'  <text x="260" y="538" text-anchor="middle" class="dg-label--muted" font-size="11">{esc(g["foot"])}</text>')
    o.append('</svg>')
    return "\n".join(o)+"\n"

# ---------------------------------------------------------------- wheel of heaven
def wheel(S):
    Z=S["zodiac"]; w=S["wh"]; cx=cy=270.0; R_out,R_in=202.0,112.0
    o=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 600" role="img" aria-labelledby="wh-t wh-d">',
       f'  <title id="wh-t">{esc(w["title"])}</title>', f'  <desc id="wh-d">{esc(w["desc"])}</desc>',
       '  <circle cx="270" cy="270" r="202" fill="none" class="dg-muted" stroke-width="1.5"/>',
       '  <circle cx="270" cy="270" r="112" fill="none" class="dg-muted" stroke-width="1.5"/>',
       '  <g class="dg-muted" stroke-width="1">']
    for i in range(12):
        x1,y1=_pt(cx,cy,R_in,15+30*i); x2,y2=_pt(cx,cy,R_out,15+30*i)
        o.append(f'    <line x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}"/>')
    o.append('  </g>\n  <g text-anchor="middle">')
    for i,sign in enumerate(ORDER_WH):
        x,y=_pt(cx,cy,166,30*i); cur=sign=="aquarius"
        cls="dg-label--accent" if cur else "dg-label"; wt=' font-weight="600"' if cur else ''
        o.append(f'    <text x="{f(x)}" y="{f(y)}" class="{cls}" font-size="12"{wt}>{esc(Z[sign])}</text>')
        if sign in w["gloss"]:
            o.append(f'    <text x="{f(x)}" y="{f(y+14)}" class="dg-label--muted" font-size="9.5">{esc(w["gloss"][sign])}</text>')
    o.append('  </g>\n  <g text-anchor="middle">')
    for ang,yr in w["years"].items():
        x,y=_pt(cx,cy,R_out+15,float(ang))
        o.append(f'    <text x="{f(x)}" y="{f(y+3)}" class="dg-label--muted" font-size="8">{esc(yr)}</text>')
    xw,yw=_pt(cx,cy,R_out+15,345)
    o.append(f'    <text x="{f(xw)}" y="{f(yw-2)}" class="dg-label--muted" font-size="8">{esc(w["wrap"][0])}</text>')
    o.append(f'    <text x="{f(xw)}" y="{f(yw+9)}" class="dg-label--muted" font-size="8">{esc(w["wrap"][1])}</text>')
    o.append('  </g>')
    xc,yc=_pt(cx,cy,R_out,315)
    o.append(f'  <circle cx="{f(xc)}" cy="{f(yc)}" r="5" class="dg-accent--fill"/>')
    xl,yl=_pt(cx,cy,R_out+15,315)
    o.append(f'  <text x="{f(xl)}" y="{f(yl-3)}" text-anchor="middle" class="dg-label--accent" font-size="10" font-weight="600">{esc(w["here"])}</text>')
    o.append(f'  <text x="{f(xl)}" y="{f(yl+9)}" text-anchor="middle" class="dg-label--accent" font-size="8.5">{esc(w["here_year"])}</text>')
    x1,y1=_pt(cx,cy,232,-15); x2,y2=_pt(cx,cy,232,15)
    o.append(f'  <path d="M {f(x1)} {f(y1)} A 232 232 0 0 1 {f(x2)} {f(y2)}" fill="none" class="dg-accent" stroke-width="1.6"/>')
    tip=_pt(cx,cy,232,17); b1=_pt(cx,cy,237,12); b2=_pt(cx,cy,227,12)
    o.append(f'  <path d="M {f(tip[0])} {f(tip[1])} L {f(b1[0])} {f(b1[1])} L {f(b2[0])} {f(b2[1])} Z" class="dg-accent--fill"/>')
    o.append(f'  <text x="270" y="16" text-anchor="middle" class="dg-label--muted" font-size="10.5">{esc(w["advance"])}</text>')
    n_c=len(w["center"]); c_y0=257-9*(n_c-1)
    for j,l in enumerate(w["center"]):
        o.append(f'  <text x="270" y="{c_y0+18*j}" text-anchor="middle" class="dg-label" font-size="15" font-weight="600">{esc(l)}</text>')
    for j,l in enumerate(w["sub"]):
        o.append(f'  <text x="270" y="{287+14*j}" text-anchor="middle" class="dg-label--muted" font-size="11">{esc(l)}</text>')
    o.append(f'  <text x="270" y="590" text-anchor="middle" class="dg-label--muted" font-size="11">{esc(w["foot"])}</text>')
    o.append('</svg>')
    return "\n".join(o)+"\n"

# ---------------------------------------------------------------- epistemic pyramid
def pyramid(S):
    e=S["ep"]; cx=310.0; yA,yB=34.0,392.0; hwB=250.0
    def hw(y): return hwB*(y-yA)/(yB-yA)
    bands=[yA+(yB-yA)*k/4 for k in range(5)]
    COL=["#49b5d7","#9d81d9","#d88bc9"]  # base cyan, mauve, lavender (bottom->up)
    tiers=e["tiers"]  # top->bottom: [open, interp, comparative, direct]
    colmap=[None, COL[2], COL[1], COL[0]]
    o=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 430" role="img" aria-labelledby="ep-t ep-d">',
       f'  <title id="ep-t">{esc(e["title"])}</title>', f'  <desc id="ep-d">{esc(e["desc"])}</desc>']
    for k,tier in enumerate(tiers):
        yt=bands[k]; yb=bands[k+1]; wt=hw(yt); wb=hw(yb); color=colmap[k]
        if k==0:
            o.append(f'  <polygon points="{f(cx)},{f(yt)} {f(cx+wb)},{f(yb)} {f(cx-wb)},{f(yb)}" fill="none" class="dg-muted" stroke-width="1.4" stroke-dasharray="5 4"/>')
            o.append(f'  <text x="{f(cx)}" y="{f(yb-10)}" text-anchor="middle" class="dg-label" font-size="13" font-weight="600">{esc(tier["name"])}</text>')
        else:
            o.append(f'  <polygon points="{f(cx-wt)},{f(yt)} {f(cx+wt)},{f(yt)} {f(cx+wb)},{f(yb)} {f(cx-wb)},{f(yb)}" fill="{color}" fill-opacity="0.18" stroke="{color}" stroke-opacity="0.85" stroke-width="1.5"/>')
            ym=(yt+yb)/2
            o.append(f'  <text x="{f(cx)}" y="{f(ym-4)}" text-anchor="middle" class="dg-label" font-size="14" font-weight="600">{esc(tier["name"])}</text>')
            o.append(f'  <text x="{f(cx)}" y="{f(ym+15)}" text-anchor="middle" class="dg-label--muted" font-size="11.5">{esc(tier["gloss"])}</text>')
    o.append(f'  <line x1="54" y1="{f(yB)}" x2="54" y2="{f(yA+6)}" class="dg-muted" stroke-width="1.2"/>')
    o.append(f'  <path d="M 50 {f(yA+14)} L 54 {f(yA+5)} L 58 {f(yA+14)} Z" class="dg-accent--fill"/>')
    o.append(f'  <text x="62" y="{f(yB)}" text-anchor="start" class="dg-axis">{esc(e["axis_bottom"])}</text>')
    o.append(f'  <text x="62" y="{f(yA+18)}" text-anchor="start" class="dg-axis">{esc(e["axis_top"])}</text>')
    o.append('</svg>')
    return "\n".join(o)+"\n"

# ---------------------------------------------------------------- timeline
def timeline(S):
    Z=S["zodiac"]; t=S["tb"]; W=980.0; x0,x1=60.0,920.0; ytop,ybot=118.0,168.0; cw=(x1-x0)/12; gs=22.0
    order=["capricorn","sagittarius","scorpio","libra","virgo","leo","cancer","gemini","taurus","aries","pisces","aquarius"]
    o=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 980 270" role="img" aria-labelledby="tb-t tb-d">',
       f'  <title id="tb-t">{esc(t["title"])}</title>', f'  <desc id="tb-d">{esc(t["desc"])}</desc>', '  <defs>']
    for name,paths in GLYPHS.items():
        o.append(f'    <symbol id="z-{name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">{paths}</symbol>')
    o.append('  </defs>')
    for i,sign in enumerate(order):
        cx0=x0+i*cw; cur=sign=="aquarius"
        if cur:
            o.append(f'  <rect x="{f(cx0)}" y="{f(ytop)}" width="{f(cw)}" height="{f(ybot-ytop)}" fill="var(--color-accent-primary)" fill-opacity="0.16" class="dg-accent" stroke-width="1"/>')
        else:
            o.append(f'  <rect x="{f(cx0)}" y="{f(ytop)}" width="{f(cw)}" height="{f(ybot-ytop)}" class="dg-surface dg-muted" stroke-width="1"/>')
        gcls="dg-glyph--accent" if cur else "dg-glyph"
        o.append(f'  <use href="#z-{sign}" x="{f(cx0+cw/2-gs/2)}" y="{f((ytop+ybot)/2-gs/2)}" width="{f(gs)}" height="{f(gs)}" class="{gcls}"/>')
        tx=cx0+cw/2; ncls="dg-label--accent" if cur else "dg-label"
        o.append(f'  <text x="{f(tx)}" y="{f(ytop-8)}" text-anchor="start" class="{ncls}" font-size="11" transform="rotate(-38 {f(tx)} {f(ytop-8)})">{esc(Z[sign])}</text>')
        if sign in t["events"]:
            o.append(f'  <text x="{f(tx)}" y="{f(ybot+12)}" text-anchor="end" class="dg-label--muted" font-size="10" transform="rotate(-38 {f(tx)} {f(ybot+12)})">{esc(t["events"][sign])}</text>')
    nx=x0+11*cw
    o.append(f'  <line x1="{f(nx)}" y1="{f(ytop-40)}" x2="{f(nx)}" y2="{f(ybot+6)}" class="dg-accent" stroke-width="1.6" stroke-dasharray="4 3"/>')
    o.append(f'  <text x="{f(nx)}" y="{f(ytop-46)}" text-anchor="middle" class="dg-label--accent" font-size="11" font-weight="600">{esc(t["now"])}</text>')
    o.append(f'  <text x="60" y="{f(ybot+42)}" text-anchor="start" class="dg-label--muted" font-size="10.5">{esc(t["start"])}</text>')
    o.append(f'  <text x="920" y="{f(ybot+42)}" text-anchor="end" class="dg-label--muted" font-size="10.5">{esc(t["end"])}</text>')
    o.append(f'  <line x1="60" y1="{f(ybot)}" x2="928" y2="{f(ybot)}" class="dg-muted" stroke-width="1"/>')
    o.append('</svg>')
    return "\n".join(o)+"\n"

BUILDERS = {"precession":precession, "great-year":great_year, "wheel-of-heaven":wheel,
            "epistemic-tiers":pyramid, "world-ages-timeline":timeline}

def main():
    for path in sorted(glob.glob(os.path.join(STR_DIR, "*.json"))):
        S = json.load(open(path))
        lang = S["lang"]
        for name, fn in BUILDERS.items():
            suffix = ".svg" if lang == "en" else f".{lang}.svg"
            out = os.path.join(OUT, name + suffix)
            open(out, "w").write(fn(S))
        print(f"{lang}: wrote {len(BUILDERS)} diagrams")

if __name__ == "__main__":
    main()
