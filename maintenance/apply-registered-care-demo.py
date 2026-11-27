"""Add registered-account walkthroughs and their existing completion email route."""
from pathlib import Path
import hashlib
import re

root = Path(__file__).resolve().parents[1]
source = root / 'index-location-423130e1f99a.js'
text = source.read_text()

def replace(old, new):
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'Expected one integration point, got {count}: {old[:90]}')
    text = text.replace(old, new)

text = 'import {demoCompletionReceipts as DogSpotDemoCompletionReceipts} from "./dogspot-demo-completion.mjs?v=registered-care-20261127";\n' + text
text = text.replace('./dogspot-care-demo.mjs?v=99cd0e8fa12c', './dogspot-care-demo.mjs?v=registered-care-20261127')
replace('./dogspot-experience.mjs?v=ad58cbd97a52', './dogspot-experience.mjs?v=registered-care-20261127')
replace('if(!r||!DogSpotIsExploration(t)||!t.careDemo?.running)return;', 'if(!r||!t.careDemo?.running)return;')
replace('b=()=>u(e=>DogSpotIsExploration(e)?DogSpotStartDemo(e,Ot()):({active:{...e.active,status:`activo`},bookings:e.bookings.map(t=>t.id===e.currentBookingId?{...t,status:`activo`,updatedAt:new Date().toISOString()}:t)}))', 'b=()=>u(e=>DogSpotStartDemo(e,Ot()))')
replace('id:``,name:`Tu mascota`};return(0,j.jsx)(Pt.Provider', '''id:``,name:`Tu mascota`};(0,l.useEffect)(()=>{
  if(!r||DogSpotIsExploration(t))return;
  const missing=DogSpotDemoCompletionReceipts(t,d,DogSpotCompletionReceipt);
  if(missing.length){n(current=>{
    const additions=DogSpotDemoCompletionReceipts(current,d,DogSpotCompletionReceipt);
    return additions.length?{...current,emailReceipts:[...additions,...current.emailReceipts]}:current;
  });return;}
  for(const receipt of t.emailReceipts)if(receipt.kind===`completion`&&receipt.status===`sending`&&receipt.to===Oe(t.user.email))h(receipt);
},[r,t.emailReceipts,t.bookings,t.careDemo,t.serviceSnapshots,t.user?.id,t.exploration]);return(0,j.jsx)(Pt.Provider''')

digest = hashlib.sha256(text.encode()).hexdigest()[:12]
target = root / f'index-location-{digest}.js'
target.write_text(text)
index = root / 'index.html'
index.write_text(index.read_text().replace('./'+source.name, './'+target.name))
print(target.name)
