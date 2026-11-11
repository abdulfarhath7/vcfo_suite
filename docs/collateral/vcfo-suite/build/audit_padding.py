# Run after build.sh: python3 audit_padding.py ../VCFO_Suite_Brochure.pptx ../VCFO_Suite_Brochure.pdf
"""Padding audit: for every filled box on every slide, measure the gap between the box edge and
its content (rendered words from the PDF, plus pictures and smaller shapes inside it).
Flags a box when the bottom (or any) gap is clearly smaller than its left gap, or content spills out.
usage: python3 audit.py deck.pptx deck.pdf"""
import re, sys, subprocess, html
from pptx import Presentation
from pptx.util import Emu

pptx, pdf = sys.argv[1], sys.argv[2]
prs = Presentation(pptx)
PW, PH = prs.slide_width / 914400, prs.slide_height / 914400

out = subprocess.run(['pdftotext', '-bbox-layout', pdf, '-'], capture_output=True, text=True).stdout
pages = re.split(r'<page ', out)[1:]
words_by_page = []
for pg in pages:
    ws = []
    for m in re.finditer(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>', pg):
        x0, y0, x1, y1 = (float(v) / 72 for v in m.groups()[:4])
        ws.append((x0, y0, x1, y1, html.unescape(m.group(5))))
    words_by_page.append(ws)

def inch(v): return v / 914400

issues = 0
for si, slide in enumerate(prs.slides):
    words = words_by_page[si]
    shapes = []
    for sh in slide.shapes:
        if sh.left is None: continue
        x, y, w, h = inch(sh.left), inch(sh.top), inch(sh.width), inch(sh.height)
        kind = 'pic' if sh.shape_type == 13 else ('box' if sh.shape_type == 1 else 'other')
        filled = False
        if kind == 'box':
            try: filled = sh.fill.type == 1
            except Exception: filled = False
        shapes.append(dict(x=x, y=y, w=w, h=h, kind=kind, filled=filled, name=sh.name, text=sh.has_text_frame and sh.text_frame.text.strip()))
    boxes = [s for s in shapes if s['kind'] == 'box' and s['filled'] and s['w'] > 0.5 and s['h'] > 0.3
             and not (s['w'] >= PW - 0.05 and s['h'] >= 0.5) and not s['text']]
    for b in boxes:
        x0, y0, x1, y1 = b['x'], b['y'], b['x'] + b['w'], b['y'] + b['h']
        inside = lambda ex0, ey0, ex1, ey1: x0 <= (ex0 + ex1) / 2 <= x1 and y0 <= (ey0 + ey1) / 2 <= y1
        els = [(w[0], w[1], w[2], w[3]) for w in words if inside(*w[:4])]
        for s in shapes:
            if s is b: continue
            if s['kind'] == 'pic' or (s['kind'] == 'box' and s['filled'] and s['h'] > 0.12 and s['w'] < b['w'] - 0.05):
                ex0, ey0, ex1, ey1 = s['x'], s['y'], s['x'] + s['w'], s['y'] + s['h']
                if x0 - 0.01 <= ex0 and ex1 <= x1 + 0.01 and y0 - 0.01 <= ey0 and (ey0 + ey1) / 2 <= y1:
                    els.append((ex0, ey0, ex1, ey1))
        if not els: continue
        cx0 = min(e[0] for e in els); cy0 = min(e[1] for e in els); cx1 = max(e[2] for e in els); cy1 = max(e[3] for e in els)
        L, T, R, B = cx0 - x0, cy0 - y0, x1 - cx1, y1 - cy1
        ref = min(L, T) if min(L, T) > 0.05 else max(L, T)
        bad = []
        if B < 0.03: bad.append('content touches/spills bottom')
        elif B < 0.75 * ref: bad.append('bottom gap smaller than sides')
        if T < 0.05: bad.append('top tight')
        if L < 0.04: bad.append('left tight')
        if R < 0.03: bad.append('right tight')
        if bad:
            issues += 1
            first = next((w[4] for w in words if inside(*w[:4])), '')
            print(f"slide {si+1:2d}  box@({x0:.2f},{y0:.2f}) {b['w']:.2f}x{b['h']:.2f}  L={L:.2f} T={T:.2f} R={R:.2f} B={B:.2f}  {', '.join(bad)}  [{first}...]")
print('issues:', issues)
