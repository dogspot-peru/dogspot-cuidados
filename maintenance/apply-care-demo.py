"""Apply bounded integrations to the shipped bundle while retaining its existing UI."""
from pathlib import Path
import hashlib
import re

root = Path(__file__).resolve().parents[1]
source = root / 'index-runtime-ec842c107c59.js'
text = source.read_text()

def replace(old, new):
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'Expected one integration point, got {count}: {old[:100]}')
    text = text.replace(old, new)

text = 'import {isExploration as DogSpotIsExploration,validDemo as DogSpotValidDemo,startDemo as DogSpotStartDemo,advanceDemo as DogSpotAdvanceDemo,renderDemoPanel as DogSpotRenderDemoPanel,EXPLORATION_KEY as DogSpotExplorationKey} from "./dogspot-care-demo.mjs?v=20261115";\n' + text

replace('t.screen=`splash`,t.editingPetId=null,t.returnTo=null,t}', 't.careDemo=DogSpotValidDemo(t.careDemo,t.tasks)?t.careDemo:null,t.screen=`splash`,t.editingPetId=null,t.returnTo=null,t}')
task_start = text.index('t.tasks=Ot().map(e=>{let t=n.find(t=>t.id===e.id);')
task_end = text.index('let r=t.pets.find(e=>e.id===t.selectedPetId);',task_start)
old_tasks = text[task_start:task_end]
replace(old_tasks,'if(DogSpotValidDemo(e.careDemo,n))t.tasks=n;else{'+old_tasks+'}')

replace('localStorage.setItem(jt,JSON.stringify({...t,screen:', 'localStorage.setItem(t.exploration?DogSpotExplorationKey:jt,JSON.stringify({...t,screen:')
replace('},[t,r]);let u=e=>n(t=>', '},[t,r]);(0,l.useEffect)(()=>{if(!r||!DogSpotIsExploration(t)||!t.careDemo?.running)return;const timer=setInterval(()=>n(current=>{const patch=DogSpotAdvanceDemo(current);return Object.keys(patch).length?{...current,...patch}:current}),1000);return()=>clearInterval(timer)},[r,!!t.careDemo?.running,t.currentBookingId]);let u=e=>n(t=>')
replace('c.current=t,e&&St().recordChanges(e,t)', 'c.current=t,e&&!!e.exploration===!!t.exploration&&e.user?.id===t.user?.id&&St().recordChanges(e,t)')
replace('f=e=>u(t=>{let n=t.bookings.find(e=>e.id===t.currentBookingId);return{screen:e,', 'f=e=>{if(e===`login`&&t.exploration){try{const saved=localStorage.getItem(jt);n({...saved?Mt(JSON.parse(saved)):At,screen:e,exploration:false,careDemo:null});return}catch{n({...At,screen:e,exploration:false});return}}u(t=>{let n=t.bookings.find(e=>e.id===t.currentBookingId);return{screen:e,')
replace('caregiverId:n.caregiverId??t.caregiverId}:{}}}),p=e=>({tasks:', 'caregiverId:n.caregiverId??t.caregiverId}:{}}})},p=e=>({careDemo:e.careDemo??null,tasks:')
replace('n(e=>({...e,...registration,user:r,authCredential:credential,', 'n(e=>({...e,...registration,exploration:false,careDemo:null,user:r,authCredential:credential,')
replace('currentBookingId:r.id,selectedPetId:', 'currentBookingId:r.id,careDemo:null,selectedPetId:')
replace('currentBookingId:e,selectedPetId:r.petId', 'currentBookingId:e,careDemo:a?.careDemo??null,selectedPetId:r.petId')
replace('b=()=>u(e=>({active:{...e.active,status:`activo`}', 'b=()=>u(e=>DogSpotIsExploration(e)?DogSpotStartDemo(e,Ot()):({active:{...e.active,status:`activo`}')
replace('u(e=>e.active.status===`activo`?{active:', 'u(e=>e.active.status===`activo`?{careDemo:e.careDemo?{...e.careDemo,running:false}:null,active:')
replace('set:u,go:f,reset:te,', 'set:u,go:f,enterExploration:()=>{let academic=t;if(t.exploration!==true){try{const saved=localStorage.getItem(DogSpotExplorationKey);academic=saved?Mt(JSON.parse(saved)):DogSpotIsExploration(t)?t:At}catch{academic=At}}n({...academic,user:null,authCredential:null,emailReceipts:[],registrationEmailId:null,exploration:true,screen:`home`})},reset:te,')
replace('te=()=>{localStorage.removeItem(jt),n(At)}','te=()=>{localStorage.removeItem(t.exploration?DogSpotExplorationKey:jt),n({...At,exploration:!!t.exploration})}')
replace('function qi(){let{go:e}=M();', 'function qi(){let{go:e,enterExploration:explore}=M();')
replace('onClick:()=>e(`home`),children:`Explorar la app`', 'onClick:explore,children:`Explorar la app`')
replace('children:(0,j.jsx)(Ca,{open:f})', 'children:(0,j.jsxs)(j.Fragment,{children:[(0,j.jsx)(DogSpotCareDemoPanel,{}),(0,j.jsx)(Ca,{open:f})]})')
replace('function M(){let e=(0,l.useContext)(Pt);if(!e)throw Error(`DogSpotProvider missing`);return e}', 'function M(){let e=(0,l.useContext)(Pt);if(!e)throw Error(`DogSpotProvider missing`);return e}function DogSpotCareDemoPanel(){return DogSpotRenderDemoPanel(l,M(),Ot)}')
replace('children:[e.mediaType===`video`?`Video`:`Foto`,` adjuntado por el cuidador · `,', 'children:[e.demoReference?`Foto de referencia del recorrido académico`:e.mediaType===`video`?`Video`:`Foto`,e.demoReference?` · `:` adjuntado por el cuidador · `,')
replace('children:[e.status===`completada`?`Registro completado`:`Actividad iniciada`,` por `,t]', 'children:[e.demoReference?(e.evidence?`Recorrido académico · Foto de referencia · `:`Recorrido académico · `):e.status===`completada`?`Registro completado por `:`Actividad iniciada por `,t]')
replace('`El servicio de cuidado ha finalizado. Revisa el seguimiento y el resumen en DogSpot.`', '`El servicio de cuidado ha finalizado. Gracias por confiar en DogSpot. Revisa el seguimiento, las fotografías y el resumen de tu servicio en la app.`')

digest = hashlib.sha256(text.encode()).hexdigest()[:12]
target = root / f'index-care-{digest}.js'
target.write_text(text)
index = root / 'index.html'
html = re.sub(r'\./index-(?:runtime|care)-[a-f0-9]+\.js', './'+target.name,index.read_text())
index.write_text(html)
print(target.name)
