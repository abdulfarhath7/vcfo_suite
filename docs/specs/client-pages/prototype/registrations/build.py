# Inline fonts, logo and registration data into one self-contained HTML file.
import base64, json, os
here = os.path.dirname(os.path.abspath(__file__))
root = os.path.abspath(os.path.join(here, '../../../../..'))
F = os.path.join(root, 'public/client-portal/fonts/')
b = lambda p: base64.b64encode(open(p, 'rb').read()).decode()
s = open(os.path.join(here, 'src.html')).read()
rep = {'__F_M500__': b(F+'manrope-500.woff2'), '__F_M600__': b(F+'manrope-600.woff2'),
       '__F_M700__': b(F+'manrope-700.woff2'), '__F_M800__': b(F+'manrope-800.woff2'),
       '__F_SG700__': b(F+'space-grotesk-700.woff2'),
       '__LOGO__': b(os.path.join(here, '../v7-inputs/vcfo-logo-on-dark.webp')),
       '__REGDATA__': json.dumps(json.load(open(os.path.join(here, 'reg-steps.json'))))}
for k, v in rep.items():
    s = s.replace(k, v)
open(os.path.join(here, 'vcfo-registrations-prototype.html'), 'w').write(s)
print(len(s))
