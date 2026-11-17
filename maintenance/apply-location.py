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

digest = hashlib.sha256((root/'dogspot-location.mjs').read_bytes()).hexdigest()[:12]
experience_digest = hashlib.sha256((root/'dogspot-experience.mjs').read_bytes()).hexdigest()[:12]
text = re.sub(r'(?<=dogspot-experience\.mjs\?v=)[a-f0-9]+', experience_digest, text)
text = 'import {createLocationFeature as DogSpotCreateLocationFeature,areaError as DogSpotAreaError,areaFields as DogSpotAreaFields,profileAddress as DogSpotProfileAddress,locationError as DogSpotLocationError,locationSnapshot as DogSpotLocationSnapshot,locationNotes as DogSpotLocationNotes} from "./dogspot-location.mjs?v='+digest+'";\n'+text

# Existing registration keeps its password protection and validation.
in_function('Da', '{name:``,phone:``,email:``,pw:``}', '{name:``,phone:``,email:``,pw:``,district:``,neighborhood:``}')
in_function('Da', 'p=async t=>{if(t.preventDefault(),', 'p=async t=>{t.preventDefault();let locationProblem=DogSpotAreaError(n);if(locationProblem){a(!0);d(locationProblem);return;}if(')
in_function('Da', 'e({name:n.name,email:n.email,phone:n.phone},t)', 'e({name:n.name,email:n.email,phone:n.phone,...DogSpotAreaFields(n)},t)')
in_function('Da', '(0,j.jsx)(V,{label:`Correo`,', '(0,j.jsx)(DogSpotLocation.AreaFields,{value:n,onChange:r}),(0,j.jsx)(V,{label:`Correo`,')
replace('g=(e,credential)=>{const registration=', 'g=(e,credential)=>{const locationProblem=DogSpotAreaError(e);if(locationProblem)throw new Error(locationProblem);e={...e,...DogSpotAreaFields(e)};const registration=')

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
replace('d.push(...DogSpotExtraCaregivers);const DogSpotExperience=', 'const DogSpotLocation=DogSpotCreateLocationFeature(l,M);d.push(...DogSpotExtraCaregivers);const DogSpotExperience=')
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
