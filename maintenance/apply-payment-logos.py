"""Apply the logo presentation to the currently published DogSpot bundle."""
from pathlib import Path
import hashlib
import re

root = Path(__file__).resolve().parents[1]
index = root / 'index.html'
html = index.read_text()
current = re.search(r'src="\./(index-location-[a-f0-9]+\.js)"', html).group(1)
text = (root / current).read_text()

if 'renderPaymentLogo as DogSpotRenderPaymentLogo' not in text:
    def replace(old, new):
        global text
        if text.count(old) != 1:
            raise RuntimeError(f'Expected one logo integration point: {old[:100]}')
        text = text.replace(old, new)

    # Keep the existing controls and payment state; replace only their presentation.
    replace('(0,j.jsx)(`span`,{className:R(`grid h-11 w-11 place-items-center rounded-xl font-extrabold`,e.c,e.k===`Yape`||e.k===`Plin`?`text-white`:`text-navy`),children:e.k[0]})',
            'DogSpotRenderPaymentLogo(l,e.k,{compact:!0,decorative:!0})')
    for heading in ['Pago simulado con ', 'Transferencia ']:
        replace('children:[(0,j.jsxs)(`p`,{className:`text-sm font-bold`,children:[`'+heading+'`,o',
                'children:[(0,j.jsx)(`div`,{className:`dogspot-payment-detail`,children:DogSpotRenderPaymentLogo(l,o)}),(0,j.jsxs)(`p`,{className:`text-sm font-bold`,children:[`'+heading+'`,o')
    replace('(0,j.jsx)(`b`,{className:`text-right`,children:t})]},e))',
            '(0,j.jsx)(`b`,{className:`text-right`,children:e===`Método de pago`?(0,j.jsxs)(`span`,{className:`dogspot-payment-label`,children:[DogSpotRenderPaymentLogo(l,t,{compact:!0,decorative:!0}),t]}):t})]},e))')
    replace('Te(e),` horas · `,It(e.total),` · `,e.payment]',
            'Te(e),` horas · `,It(e.total),` · `,(0,j.jsxs)(`span`,{className:`dogspot-payment-label`,children:[DogSpotRenderPaymentLogo(l,e.payment,{compact:!0,decorative:!0}),e.payment]})]')
    text = 'import {renderPaymentLogo as DogSpotRenderPaymentLogo} from "./dogspot-payment-logos.mjs";\n' + text

digest = hashlib.sha256((root / 'dogspot-payment-logos.mjs').read_bytes()).hexdigest()[:12]
text = re.sub(r'"\./dogspot-payment-logos\.mjs(?:\?v=[a-f0-9]+)?"',
              '"./dogspot-payment-logos.mjs?v='+digest+'"', text)
target = 'index-location-'+hashlib.sha256(text.encode()).hexdigest()[:12]+'.js'
(root / target).write_text(text)
html = html.replace('./'+current, './'+target)
style_digest = hashlib.sha256((root / 'dogspot-payment-logos.css').read_bytes()).hexdigest()[:12]
style = '<link rel="stylesheet" href="./dogspot-payment-logos.css?v='+style_digest+'">'
if 'dogspot-payment-logos.css' in html:
    html = re.sub(r'<link rel="stylesheet" href="\./dogspot-payment-logos\.css[^\"]*">', style, html)
else:
    html = html.replace('</head>', '  '+style+'\n  </head>')
index.write_text(html)
print(target)
