"""Integrate the owner experience into the existing published app deterministically."""
from pathlib import Path
import hashlib,json,re,runpy

root=Path(__file__).resolve().parents[1]
runpy.run_path(str(root/'maintenance/apply-care-demo.py'))
html=(root/'index.html').read_text()
source=re.search(r'src="\./(index-care-[a-f0-9]+\.js)"',html).group(1)
text=(root/source).read_text()

def replace(old,new):
    global text
    if text.count(old)!=1:raise RuntimeError(f'Expected one integration point: {old[:100]} ({text.count(old)})')
    text=text.replace(old,new)

def function(start,end,new):
    global text
    a=text.index(start,300000);b=text.index(end,a+len(start))
    text=text[:a]+new+text[b:]

helper=hashlib.sha256((root/'dogspot-care-demo.mjs').read_bytes()).hexdigest()[:12]
experience=(root/'dogspot-experience.mjs').read_text()
experience=re.sub(r'\./dogspot-care-demo\.mjs\?v=[^\'"]+',f'./dogspot-care-demo.mjs?v={helper}',experience)
(root/'dogspot-experience.mjs').write_text(experience)
experience_hash=hashlib.sha256(experience.encode()).hexdigest()[:12]
text=text.replace('./dogspot-care-demo.mjs?v=20261115',f'./dogspot-care-demo.mjs?v={helper}')
text=f'import {{createExperience as DogSpotCreateExperience,extraCaregivers as DogSpotExtraCaregivers,ownerStatus as DogSpotOwnerStatus}} from "./dogspot-experience.mjs?v={experience_hash}";\nimport {{upgradeDemoPhotos as DogSpotUpgradeDemoPhotos}} from "./dogspot-care-demo.mjs?v={helper}";\n'+text
replace('t.returnTo=null,t}', 't.returnTo=null,DogSpotUpgradeDemoPhotos(t)}')
replace('exploration:false,careDemo:null,user:r,','exploration:false,careDemo:null,assistantMessages:null,user:r,')
replace('case`caregiver-tasks`:return(0,j.jsx)(Li,{onNotify:xa});','case`caregiver-tasks`:return(0,j.jsx)(Ia,{open:e});')
replace('a.gain.value=.45,i.buffer=r','a.gain.value=.22,i.buffer=r')
replace('function ka(){let{go:e,','function ka(){let DogSpotHomeState=M(),DogSpotHome=DogSpotOwnerStatus(DogSpotHomeState);let{go:e,')
replace('let p=!!u&&(u.petId??d.id)===t.id;','let p=(!!u||DogSpotIsExploration(DogSpotHomeState)&&!!DogSpotHomeState.careDemo)&&(u?.petId??d.id)===t.id;')
replace('onClick:()=>e(u?`tracking`:`hire`)','onClick:()=>DogSpotIsExploration(DogSpotHomeState)||u?i({screen:`tracking`,trackingTab:`estado`}):e(`hire`)')
replace('children:[`Revisa el estado de `,d.name]','children:[DogSpotHome.title,` · `,d.name]')
replace('(0,j.jsx)(`p`,{className:`text-sm text-muted-foreground`,children:`Aquí verás únicamente las actividades que tu cuidador registre con fecha, hora y evidencia real.`})','DogSpotHome.photo&&(0,j.jsx)(`img`,{src:DogSpotHome.photo,alt:`Último avance de ${d.name}`,className:`mt-3 w-full rounded-2xl`,style:{aspectRatio:`4/3`,objectFit:`cover`}}),(0,j.jsx)(`p`,{className:`text-sm text-muted-foreground`,children:DogSpotHome.description})')
function('function Ba({open:e})','var Va=', 'function Ba({open:e}){return(0,j.jsx)(DogSpotExperience.Assistant,{open:e})}')
function('function Ha({open:e})','function Ua()', 'function Ha({open:e}){return(0,j.jsx)(DogSpotExperience.Messages,{open:e})}')
function('function Fa({open:e})','function Ia(', 'function Fa({open:e}){return(0,j.jsx)(DogSpotExperience.Active,{open:e})}')
function('function va({onEvidence:e,onEmergency:t})','function ya()', 'function va({onEvidence:e,onEmergency:t}){return(0,j.jsx)(DogSpotExperience.Tracking,{onEvidence:e,onEmergency:t})}')
replace('(0,u.createRoot)(document.getElementById(`root`)).render(', 'd.push(...DogSpotExtraCaregivers);const DogSpotExperience=DogSpotCreateExperience(l,M,d,{enableSound:()=>aa().catch(()=>{}),recordMessage:(text,state,channel)=>St().recordMessage({from:`user`,text,time:Lt()},channel,state)});(0,u.createRoot)(document.getElementById(`root`)).render(')
digest=hashlib.sha256(text.encode()).hexdigest()[:12]
target=root/f'index-care-{digest}.js';target.write_text(text)
(root/'index.html').write_text(html.replace('./'+source,'./'+target.name))
print(json.dumps({'bundle':target.name,'care_module':helper,'experience_module':experience_hash}))
