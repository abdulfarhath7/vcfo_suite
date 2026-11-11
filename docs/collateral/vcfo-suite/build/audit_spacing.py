# usage: python3 audit_spacing.py ../VCFO_Suite_Brochure.pptx [v]   (v prints the gaps slide by slide)
"""Gaps between neighbouring boxes on each slide (inches). A neighbour is the nearest box to the
right (overlapping vertically) or below (overlapping horizontally)."""
import sys, collections
from pptx import Presentation
p = Presentation(sys.argv[1]); PW = p.slide_width / 914400
verbose = len(sys.argv) > 2
allg = collections.Counter()
for i, s in enumerate(p.slides, 1):
    boxes = []
    for sh in s.shapes:
        if sh.shape_type != 1: continue
        try:
            if sh.fill.type != 1: continue
        except Exception: continue
        x, y, w, h = (v / 914400 for v in (sh.left, sh.top, sh.width, sh.height))
        if w < 0.45 or h < 0.28 or w >= PW - 0.05: continue
        if sh.has_text_frame and sh.text_frame.text.strip(): continue
        boxes.append((round(x, 3), round(y, 3), round(w, 3), round(h, 3)))
    boxes = sorted(set(boxes))
    # drop boxes nested inside another box
    top = [b for b in boxes if not any(o != b and o[0] <= b[0] + 1e-3 and o[1] <= b[1] + 1e-3 and o[0] + o[2] >= b[0] + b[2] - 1e-3 and o[1] + o[3] >= b[1] + b[3] - 1e-3 for o in boxes)]
    gs = []
    for b in top:
        x0, y0, x1, y1 = b[0], b[1], b[0] + b[2], b[1] + b[3]
        right = [o[0] - x1 for o in top if o[0] >= x1 - 1e-3 and min(y1, o[1] + o[3]) - max(y0, o[1]) > 0.1]
        below = [o[1] - y1 for o in top if o[1] >= y1 - 1e-3 and min(x1, o[0] + o[2]) - max(x0, o[0]) > 0.1]
        if right and min(right) < 0.6: gs.append(('h', round(min(right), 2)))
        if below and min(below) < 0.6: gs.append(('v', round(min(below), 2)))
    c = collections.Counter(gs); allg.update(g for _, g in gs)
    if verbose: print(f"slide {i:2d}: " + '  '.join(f"{d}{g:.2f}×{n}" for (d, g), n in sorted(c.items())))
print('all gaps:', ' '.join(f"{g:.2f}×{n}" for g, n in sorted(allg.items())))
