"""Bounded location integration against the existing published DogSpot build."""
from pathlib import Path
import re
import hashlib

root = Path(__file__).resolve().parents[1]
source = root / 'index-care-bd066729cc06.js'
text = source.read_text()
def replace(old, new):
    global text
    if text.count(old) != 1:
        raise RuntimeError(f'Expected one location integration point: {old[:110]} ({text.count(old)})')
    text = text.replace(old, new)
def in_function(name, old, new):
    global text
    start = text.index('function '+name+'(', 225000)
    end = text.find('function ', start + 10)
    if end < 0:
        end = len(text)
    part = text[start:end]
    if part.count(old) != 1:
        raise RuntimeError(f'{name}: expected one integration point: {old[:80]}')
    text = text[:start] + part.replace(old, new) + text[end:]

care_digest = hashlib.sha256((root/'dogspot-care-demo.mjs').read_bytes()).hexdigest()[:12]
experience_file = root/'dogspot-experience.mjs'
experience_file.write_text(re.sub(r'(?<=dogspot-care-demo\.mjs\?v=)[a-f0-9]+',care_digest,experience_file.read_text()))
digest = hashlib.sha256((root/'dogspot-location.mjs').read_bytes()).hexdigest()[:12]
experience_digest = hashlib.sha256((root/'dogspot-experience.mjs').read_bytes()).hexdigest()[:12]
text = re.sub(r'(?<=dogspot-experience\.mjs\?v=)[a-f0-9]+', experience_digest, text)
text = re.sub(r'(?<=dogspot-care-demo\.mjs\?v=)[a-f0-9]+', care_digest, text)
make_digest = hashlib.sha256((root/'dogspot-make.mjs').read_bytes()).hexdigest()[:12]
onboarding_digest = hashlib.sha256((root/'dogspot-onboarding.mjs').read_bytes()).hexdigest()[:12]
text = re.sub(r'(?<=dogspot-onboarding\.mjs\?v=)[a-f0-9]+', onboarding_digest, text)
text = 'import {tryMakeReceipt as DogSpotTryMakeReceipt,makeReceiptMessage as DogSpotMakeReceiptMessage} from "./dogspot-make.mjs?v='+make_digest+'";\n'+text
text = 'import {createLocationFeature as DogSpotCreateLocationFeature,areaError as DogSpotAreaError,areaFields as DogSpotAreaFields,profileAddress as DogSpotProfileAddress,locationError as DogSpotLocationError,locationSnapshot as DogSpotLocationSnapshot,locationNotes as DogSpotLocationNotes} from "./dogspot-location.mjs?v='+digest+'";\n'+text

# The relay is exclusive after dispatch; no fallback can create a second email.
in_function('ze', 'let r=Math.max(0,1100-(Date.now()-Ie));', 'const makeResult=await DogSpotTryMakeReceipt(e,n);if(makeResult){if(makeResult.status===`sent`)Pe.add(e.id);return makeResult;}let r=Math.max(0,1100-(Date.now()-Ie));')
in_function('Ae', 'kind:`welcome`,to:', 'kind:`welcome`,customerId:e.id,to:')
in_function('je', 'kind:`booking`,to:', 'kind:`booking`,customerId:e.id,to:')
in_function('DogSpotCompletionReceipt', 'kind:`completion`,to:', 'kind:`completion`,customerId:e.id,to:')
replace('i=Ae(r,`welcome:${crypto.randomUUID()}`)', 'i=Ae(r,`welcome:${r.id}`)')
in_function('da', 'ua[e.status]', 'e.provider===`make`&&e.status===`sent`?`Correo enviado mediante Make`:ua[e.status]')
for status in ['unavailable','failed','uncertain']:
    in_function('da', 'e.status===`'+status+'`&&', 'e.status===`'+status+'`&&e.provider!==`make`&&')
in_function('da', 'e.status!==`sent`&&e.status!==`sending`&&a&&', 'e.provider===`make`&&![`sent`,`sending`].includes(e.status)&&(0,j.jsx)(`p`,{className:`text-sm text-muted-foreground`,children:DogSpotMakeReceiptMessage(e)}),e.status!==`sent`&&e.status!==`sending`&&a&&')
in_function('da', '` Intentar enviar correo`', 'e.provider===`make`?` Verificar envío`:` Intentar enviar correo`')

# Complete the newer caregiver profiles in both fresh and already saved sessions.
replace('extraCaregivers as DogSpotExtraCaregivers,', 'extraCaregivers as DogSpotExtraCaregivers,extraCaregiverReviews as DogSpotExtraCaregiverReviews,withExtraCaregiverReviews as DogSpotWithExtraCaregiverReviews,')
replace('d.push(...DogSpotExtraCaregivers);', 'd.push(...DogSpotExtraCaregivers);f.push(...DogSpotExtraCaregiverReviews);')
in_function('Mt', 't.reviews=Array.isArray(e.reviews)?t.reviews:[...f]', 't.reviews=DogSpotWithExtraCaregiverReviews(Array.isArray(e.reviews)?t.reviews:[...f])')

# A single start button belongs to the service; tracking has no global demo bar.
replace('renderDemoPanel as DogSpotRenderDemoPanel,', '')
replace('function DogSpotCareDemoPanel(){return DogSpotRenderDemoPanel(l,M(),Ot)}', '')
in_function('Sa', 'children:(0,j.jsxs)(j.Fragment,{children:[(0,j.jsx)(DogSpotCareDemoPanel,{}),(0,j.jsx)(Ca,{open:f})]})', 'children:(0,j.jsx)(Ca,{open:f})')

# Both manual completion and the walkthrough enter this summary screen.
# Unrated services open the existing rating form immediately; saved reviews stay closed.
in_function('Zi', '[y,b]=(0,l.useState)(!1)', '[y,b]=(0,l.useState)(t.status===`finalizado`&&!m)')
in_function('Zi', 'children:`Reactivar servicio de ejemplo`', 'children:`Volver a mi servicio`')
in_function('Zi', 'onClick:()=>{u(),e(`home`)}', 'onClick:()=>e(`active`)')

# Existing registration keeps its password protection and validation.
in_function('Da', '{name:``,phone:``,email:``,pw:``}', '{name:``,phone:``,email:``,pw:``,district:``,neighborhood:``}')
in_function('Da', 'p=async t=>{if(t.preventDefault(),', 'p=async t=>{t.preventDefault();let locationProblem=DogSpotAreaError(n);if(locationProblem){a(!0);d(locationProblem);return;}if(')
in_function('Da', 'e({name:n.name,email:n.email,phone:n.phone},t)', 'e({name:n.name,email:n.email,phone:n.phone,...DogSpotAreaFields(n)},t)')
in_function('Da', '(0,j.jsx)(V,{label:`Correo`,', '(0,j.jsx)(DogSpotLocation.AreaFields,{value:n,onChange:r}),(0,j.jsx)(V,{label:`Correo`,')
replace('g=(e,credential)=>{const registration=', 'g=(e,credential)=>{const locationProblem=DogSpotAreaError(e);if(locationProblem)throw new Error(locationProblem);e={...e,...DogSpotAreaFields(e)};const registration=')

# Independent saved accounts on one shared phone. Keep password verification and
# the original state key; archive other profiles without moving database rows.
replace('registrationState as DogSpotRegistrationState}', 'registrationState as DogSpotRegistrationState,localAccount as DogSpotLocalAccount,accountBase as DogSpotAccountBase,saveAccountTransition as DogSpotSaveAccountTransition,receiptResultForAccount as DogSpotReceiptResultForAccount}')
in_function('Ft', 'let r={...((t.user&&Oe(t.user.email)===Oe(e.email))?t.user:{}),...e,id:t.user&&Oe(t.user.email)===Oe(e.email)?t.user.id??crypto.randomUUID():crypto.randomUUID(),', 'const previous=DogSpotLocalAccount(t,e.email);let r={...(previous?.user??{}),...e,id:previous?.user?.id??crypto.randomUUID(),')
in_function('Ft', 'n(e=>({...e,...registration,exploration:false,careDemo:null,assistantMessages:null,user:r,authCredential:credential,emailReceipts:i?[i,...e.emailReceipts]:e.emailReceipts,registrationEmailId:i?.id??null,screen:`registration-confirmation`}))', 'const base=DogSpotAccountBase(t,r,At,Mt),next={...base,...registration,exploration:false,careDemo:null,assistantMessages:null,user:r,authCredential:credential,emailReceipts:i?[i,...base.emailReceipts]:base.emailReceipts,registrationEmailId:i?.id??null,screen:`registration-confirmation`};DogSpotSaveAccountTransition(next,localStorage,jt);n(next)')
in_function('Ft', 'n(n=>({...n,emailReceipts:n.emailReceipts.map(n=>n.id===e.id?{...n,...t,completedAt:new Date().toISOString()}:n)}))', 'n(current=>DogSpotReceiptResultForAccount(current,e,t))')
in_function('Ft', 'pet:S,set:u,go:f,', 'pet:S,set:u,go:f,accountForEmail:email=>DogSpotLocalAccount(t,email),signInAccount:email=>{const saved=DogSpotLocalAccount(t,email);if(!saved)throw new Error(`Correo o contraseña incorrectos. Revisa tus datos.`);const next={...DogSpotAccountBase(t,saved.user,At,Mt),exploration:false,screen:`home`};DogSpotSaveAccountTransition(next,localStorage,jt);n(next);},')
in_function('Ft', 'n({...At,exploration:!!t.exploration})', 'n({...At,localAccounts:t.localAccounts??{},exploration:!!t.exploration})')
in_function('Ea', 'let{set:t,go:n,user:r,authCredential:credential}=M()', 'let{set:t,go:n,user:r,authCredential:credential,accountForEmail,signInAccount,enterExploration}=M()')
in_function('Ea', 'El acceso y la contraseña se guardan en este navegador. También puedes explorar sin crear una cuenta.', 'Puedes crear varias cuentas en este navegador. Inicia sesión con el correo y la contraseña de la cuenta que quieras usar.')
in_function('Ea', 'const email=Oe(i),localAccount=!!r&&Oe(r.email)!==wt;', 'const email=Oe(i),account=accountForEmail(email),localAccount=!!account;')
in_function('Ea', 'if(localAccount&&email===Oe(r.email)&&!credential)', 'if(localAccount&&!account.authCredential)')
in_function('Ea', 'const accepted=localAccount?email===Oe(r.email)&&await DogSpotVerifyCredential(o,credential):email===wt&&o===Tt;', 'const accepted=localAccount?await DogSpotVerifyCredential(o,account.authCredential):email===wt&&o===Tt;')
in_function('Ea', '},{user:r,screen:`login`})', '},{user:account?.user??null,screen:`login`})')
in_function('Ea', 't({user:r??{name:`Jefferson`,email:wt,phone:`987 654 321`},screen:`home`});', 'if(localAccount)signInAccount(email);else enterExploration();')
in_function('Ea', 'catch{f(`No se pudo comprobar la contraseña. Vuelve a intentarlo desde el enlace HTTPS de DogSpot.`)}', 'catch(error){f(error instanceof Error?error.message:`No se pudo comprobar la contraseña. Vuelve a intentarlo desde el enlace HTTPS de DogSpot.`)}')
in_function('Ka', 'let{user:e,set:t,go:n}=M()', 'let{user:e,set:t,go:n,accountForEmail}=M()')
in_function('Ka', 'if(v&&c.trim()!==s)', 'if(v&&accountForEmail(r.email))return f(`Ese correo pertenece a otra cuenta guardada en este navegador. Usa otro correo o inicia sesión en esa cuenta.`);if(v&&c.trim()!==s)')

# Existing accounts can complete or edit their zone without re-registering.
in_function('Ka', 'references:e?.references??``,photo:e?.photo}', 'references:e?.references??``,photo:e?.photo,...DogSpotAreaFields(e)}')
in_function('Ka', 'if(v&&c.trim()!==s)', 'const locationProblem=DogSpotAreaError(r);if(locationProblem)return f(locationProblem);if(v&&c.trim()!==s)')
in_function('Ka', 'photo:r.photo},screen:`profile`}', 'photo:r.photo,...DogSpotAreaFields(r)},screen:`profile`}')
in_function('Ka', '(0,j.jsx)(V,{label:`Dirección del domicilio · Opcional`,', '(0,j.jsx)(DogSpotLocation.AreaFields,{value:r,onChange:i}),(0,j.jsx)(V,{label:`Dirección del domicilio · Opcional`,')
in_function('Ka', 'Ej.: Av. Los Pinos 123, Miraflores', 'Ej.: Av. América Sur 123, Trujillo')
in_function('Ga', '(0,j.jsxs)(z,{variant:`secondary`,onClick:()=>e(`edit-profile`)', '(0,j.jsx)(DogSpotLocation.ProfileArea,{}),(0,j.jsxs)(z,{variant:`secondary`,onClick:()=>e(`edit-profile`)')

# An explicit address step precedes the caregiver and payment steps.
in_function('Ui', 'le=()=>({petId:f,', 'le=()=>({serviceLocation:n?.serviceLocation,petId:f,')
in_function('Ui', 'draft:le(),screen:`caregivers`', 'draft:le(),locationReturnTo:`caregivers`,screen:`service-location`')
in_function('Ui', 'c===3?`Conocer y elegir cuidador`', 'c===3?`Confirmar domicilio en el mapa`')
in_function('Ni', 'onBack:()=>e(`hire`)', 'onBack:()=>t({locationReturnTo:`caregivers`,screen:`service-location`})')
in_function('Ca', 'let{screen:t}=M();', 'let{screen:t,locationReturnTo:locationNext}=M();')
in_function('Ca', 'case`caregivers`:', 'case`service-location`:return(0,j.jsx)(DogSpotLocation.LocationScreen,{nextScreen:locationNext??`caregivers`});case`caregivers`:')
in_function('Ca', 'case`payment`:return(0,j.jsx)(Ma,{});', 'case`payment`:return(0,j.jsx)(DogSpotLocatedPayment,{});')
replace('function M(){let e=', 'function DogSpotLocatedPayment(){const state=M();return(0,j.jsx)(state.draft&&DogSpotLocationError(state.draft.serviceLocation)?DogSpotLocation.LocationScreen:Ma,{nextScreen:`payment`});}function M(){let e=')
in_function('Ma', 'let e=Ee(y,2,8,5)??De(g.id,g.availability,y,i);', 'let e=DogSpotLocationError(t.serviceLocation)||(Ee(y,2,8,5)??De(g.id,g.availability,y,i));')
in_function('Ma', 'petId:t.petId,date:t.date,', 'petId:t.petId,serviceLocation:DogSpotLocationSnapshot(t.serviceLocation),date:t.date,')
in_function('Ma', 'ee.map(e=>(0,j.jsxs)(B,', '(0,j.jsx)(DogSpotLocation.LocationSummary,{location:t.serviceLocation,editable:!0}),ee.map(e=>(0,j.jsxs)(B,')
replace('v=e=>{let r={...e,updatedAt:', 'v=e=>{if(DogSpotLocationError(e.serviceLocation))return false;let r={...e,serviceLocation:DogSpotLocationSnapshot(e.serviceLocation),updatedAt:')

# The location is a snapshot of this booking, never a live link to a mutable profile.
in_function('Na', '(0,j.jsx)(B,{className:`mt-5 space-y-2`', '(0,j.jsx)(DogSpotLocation.LocationSummary,{}),(0,j.jsx)(B,{className:`mt-5 space-y-2`')
in_function('Zi', '(0,j.jsxs)(`div`,{className:`space-y-4 px-5`,children:[', '(0,j.jsxs)(`div`,{className:`space-y-4 px-5`,children:[(0,j.jsx)(DogSpotLocation.LocationSummary,{}),')
replace('d.push(...DogSpotExtraCaregivers);f.push(...DogSpotExtraCaregiverReviews);const DogSpotExperience=', 'const DogSpotLocation=DogSpotCreateLocationFeature(l,M);d.push(...DogSpotExtraCaregivers);f.push(...DogSpotExtraCaregiverReviews);const DogSpotExperience=')
replace('DogSpotCreateExperience(l,M,d,{enableSound:', 'DogSpotCreateExperience(l,M,d,{LocationSummary:DogSpotLocation.LocationSummary,enableSound:')

# Existing private Sheets records keep their schema, with location in the notes too.
in_function('et', 'address:A(e.address,1e3),', 'address:DogSpotProfileAddress(e),district:A(e.district,80),neighborhood:A(e.neighborhood,120),')
in_function('tt', 'references:A(t.references,2e3),', 'district:A(t.district,80),neighborhood:A(t.neighborhood,120),references:A(t.references,2e3),')
in_function('at', 'notes:A(e.notes),', 'notes:A([e.notes,DogSpotLocationNotes(e.serviceLocation)].filter(Boolean).join(`\n`)),serviceLocation:DogSpotLocationSnapshot(e.serviceLocation),')
in_function('ot', 'notes:A(t.notes),', 'notes:A(t.notes),serviceLocation:DogSpotLocationSnapshot(t.serviceLocation),')

target = root / ('index-location-'+hashlib.sha256(text.encode()).hexdigest()[:12]+'.js')
target.write_text(text)
index = root/'index.html'
index.write_text(re.sub(r'\./index-(?:care|location)-[a-f0-9]+\.js', './'+target.name, index.read_text()))
print(target.name)
