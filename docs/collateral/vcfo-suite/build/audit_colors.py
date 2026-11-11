# Lists every colour used in a built .pptx, with its Spectrum token name; anything off-palette is marked.
# usage: python3 audit_colors.py ../VCFO_Suite_Brochure.pptx
import sys, zipfile, re, json, collections
from lxml import etree
NS = {'a': 'http://schemas.openxmlformats.org/drawingml/2006/main', 'p': 'http://schemas.openxmlformats.org/presentationml/2006/main'}
f = sys.argv[1]
z = zipfile.ZipFile(f)
theme = etree.fromstring(z.read('ppt/theme/theme1.xml'))
cs = theme.find('.//a:clrScheme', NS)
scheme = {}
for el in cs:
    tag = etree.QName(el).localname
    c = el[0]
    scheme[tag] = (c.get('val') or c.get('lastClr')).upper()
alias = {'tx1': 'dk1', 'bg1': 'lt1', 'tx2': 'dk2', 'bg2': 'lt2'}
tokens = json.load(open(__import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)), '../../../design/design-tokens.json')))
tok = {}
for t in tokens['color']['tokens']:
    v = t['value']; v = v.get('light') if isinstance(v, dict) else v
    if isinstance(v, str) and re.fullmatch(r'#[0-9a-fA-F]{6}', v): tok.setdefault(v[1:].upper(), t['name'])
tok.setdefault('FFFFFF', 'surface-raised/white')
def resolve(el):
    s = el.find('a:srgbClr', NS)
    if s is not None: return s.get('val').upper()
    s = el.find('a:schemeClr', NS)
    if s is not None:
        v = s.get('val'); return scheme.get(alias.get(v, v), '?' + v)
    return None
use = collections.defaultdict(lambda: collections.defaultdict(set))
slides = sorted([n for n in z.namelist() if re.match(r'ppt/slides/slide\d+\.xml$', n)], key=lambda n: int(re.findall(r'\d+', n)[0]))
for n in slides:
    i = int(re.findall(r'\d+', n)[0])
    x = etree.fromstring(z.read(n))
    for sf in x.iter('{%s}solidFill' % NS['a']):
        c = resolve(sf)
        if not c: continue
        par = etree.QName(sf.getparent()).localname
        ctx = {'rPr': 'text', 'defRPr': 'text', 'ln': 'line', 'spPr': 'fill', 'tcPr': 'cell-fill', 'lnL': 'cell-line', 'lnR': 'cell-line', 'lnT': 'cell-line', 'lnB': 'cell-line'}.get(par, par)
        use[c][ctx].add(i)
for c in sorted(use, key=lambda c: (c not in tok, c)):
    name = tok.get(c, '*** NOT A TOKEN ***')
    print(f"#{c}  {name:24s} " + '  '.join(f"{k}:{sorted(v)[:6]}{'…' if len(v)>6 else ''}" for k, v in use[c].items()))
