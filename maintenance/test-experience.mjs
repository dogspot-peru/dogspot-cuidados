import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {assistantReply,caregiverReply,ownerStatus,extraCaregivers,createExperience} from '../dogspot-experience.mjs';
import {startDemo,advanceDemo,upgradeDemoPhotos,referencePhoto} from '../dogspot-care-demo.mjs';

const tasks=['care','feeding','meds','water','mood','pee','rest','notes'].map(id=>({id,label:({feeding:'Alimentación',water:'Agua e hidratación',meds:'Medicamento indicado',rest:'Descanso'})[id]??id,status:'pendiente'}));
const fixture=()=>({screen:'tracking',exploration:true,user:null,pet:{id:'p',name:'Luna',species:'Perro',meds:'Indicación del propietario'},pets:[{id:'p',name:'Luna',species:'Perro',meds:'Indicación del propietario'}],selectedPetId:'p',currentBookingId:null,caregiverId:'mariana',bookings:[],tasks:structuredClone(tasks),messages:[],notifications:[],active:{status:'activo'},set:()=>{},go:()=>{},trackingTab:'estado'});
const apply=(state,patch)=>({...state,...patch});
const caregivers=[{id:'ana',name:'Ana Torres',bio:'Cuidado de mascotas'},...extraCaregivers];

test('every Luna activity has a separate photo file and image content',()=>{
  const paths=tasks.map(task=>referencePhoto(fixture().pet,task));
  assert.equal(new Set(paths).size,8);
  const hashes=paths.map(path=>createHash('sha256').update(readFileSync(new URL('../'+path,import.meta.url))).digest('hex'));
  assert.equal(new Set(hashes).size,8);
});

test('old saved demo photos are upgraded without touching real uploads or service isolation',()=>{
  const state=fixture();state.tasks=[{id:'feeding',status:'completada',demoReference:true,evidence:'old.jpg'},{id:'rest',status:'completada',evidence:'real-upload.jpg'}];
  state.serviceSnapshots={historical:{tasks:[{id:'water',demoReference:true,evidence:'old.jpg'}],messages:[]}};
  const next=upgradeDemoPhotos(state);
  assert.equal(next.tasks[0].evidence,'./luna-feeding-v2.jpg');
  assert.equal(next.tasks[1].evidence,'real-upload.jpg');
  assert.equal(next.serviceSnapshots.historical.tasks[0].evidence,'./luna-water-v2.jpg');
  assert.equal(state.tasks[0].evidence,'old.jpg');
});

test('saved walkthrough messages receive the corresponding task photograph',()=>{
  const state=fixture();state.tasks=[{id:'feeding',demoReference:true,evidence:'old.jpg'}];state.messages=[{id:'care-demo:initial:1000:message:2',from:'caregiver',image:'old.jpg'},{id:'uploaded',from:'caregiver',image:'real.jpg'}];
  const next=upgradeDemoPhotos(state);
  assert.equal(next.messages[0].image,'./luna-feeding-v2.jpg');assert.equal(next.messages[1].image,'real.jpg');
});

test('ABY responds naturally to greetings and personal small talk',()=>{
  assert.match(assistantReply('¡Hola!',fixture(),caregivers).text,/Hola, Jefferson/);
  assert.match(assistantReply('¿Qué tal?',fixture(),caregivers).text,/gracias por preguntar/);
  assert.match(assistantReply('¿Cómo estás?',fixture(),caregivers).text,/gracias por preguntar/);
  assert.match(assistantReply('¿Quién eres?',fixture(),caregivers).text,/Soy ABY/);
  assert.doesNotMatch(assistantReply('hola',fixture(),caregivers).text,/soporte|suficiente información/);
});

test('ABY reports pending care honestly and reads completed results and images',()=>{
  let state=fixture();assert.match(assistantReply('¿Ya comió?',state,caregivers).text,/pendiente/);
  state.tasks[1]={...state.tasks[1],status:'completada',time:'03:00 p. m.',selections:['Aceptó su alimento'],evidence:'./luna-feeding-v2.jpg',demoReference:true};
  const answer=assistantReply('¿Ya comió?',state,caregivers);
  assert.match(answer.text,/03:00/);assert.match(answer.text,/Aceptó su alimento/);assert.equal(answer.image,'./luna-feeding-v2.jpg');
  assert.match(assistantReply('¿y el agua?',state,caregivers).text,/pendiente/);
});

test('ABY understands pet status questions and the currently selected caregiver',()=>{
  const state=fixture();state.tasks[0]={...state.tasks[0],status:'progreso',demoReference:true};
  assert.match(assistantReply('¿Cómo está mi mascota?',state,caregivers).text,/realizando care/);
  assert.match(assistantReply('¿Quién cuida a Luna?',state,caregivers).text,/Mariana Salazar/);
  state.caregiverId='gabriel';assert.match(assistantReply('mi cuidador',state,caregivers).text,/Gabriel Rojas/);
});

test('ordinary help does not trigger an emergency and genuine emergency words do',()=>{
  assert.doesNotMatch(assistantReply('¿me ayudas?',fixture(),caregivers).text,/veterinario/);
  assert.equal(assistantReply('Mi perro no puede respirar',fixture(),caregivers).action.emergency,true);
});

test('caregiver chat replies to greetings, instructions and recorded tasks from owner view',()=>{
  const state=fixture();assert.match(caregiverReply('Hola',state,caregivers).text,/Soy Mariana/);
  assert.match(caregiverReply('Por favor, mantén su manta',state,caregivers).text,/queda escrita en esta conversación/);
  assert.match(caregiverReply('¿Ya comió?',state,caregivers).text,/pendiente/);
  assert.match(caregiverReply('Gracias',state,caregivers).text,/Con gusto/);
});

test('status reflects the active stage and changes its image between activities',()=>{
  let state=fixture();state=apply(state,startDemo(state,tasks,1000));
  state=apply(state,advanceDemo(state,1001,true));
  let status=ownerStatus(state);assert.equal(status.current.baseId,'care');assert.equal(status.photo,'./luna-care-v2.jpg');assert.equal(status.completed,0);
  state=apply(state,advanceDemo(state,1002,true));state=apply(state,advanceDemo(state,1003,true));
  status=ownerStatus(state);assert.equal(status.current.baseId,'feeding');assert.equal(status.photo,'./luna-feeding-v2.jpg');assert.equal(status.completed,1);
});

test('completion notifications carry the pet species for the correct sound',()=>{
  let state=fixture();state=apply(state,startDemo(state,tasks,1000));state=apply(state,advanceDemo(state,1001,true));state=apply(state,advanceDemo(state,1002,true));
  assert.equal(state.notifications[0].kind,'task-completed');assert.equal(state.notifications[0].species,'Perro');
});

test('two additional caregivers include full profiles, portraits and extended availability',()=>{
  assert.equal(extraCaregivers.length,2);
  assert.equal(new Set(extraCaregivers.map(c=>c.id)).size,2);
  for(const caregiver of extraCaregivers){assert.ok(caregiver.bio&&caregiver.approach&&caregiver.training);assert.ok(caregiver.courses.length>=2);assert.equal(caregiver.availability.weekdays.length,7);assert.equal(caregiver.availability.start,'07:00');assert.equal(caregiver.availability.end,'23:00');assert.ok(readFileSync(new URL('../'+caregiver.photo,import.meta.url)).length>1000);}
});

test('the chat only exposes the owner composer, including in exploration without a booking',()=>{
  const react={createElement:(tag,props,...children)=>({tag,props,children}),useState:initial=>[initial,()=>{}],useRef:()=>({current:null}),useEffect:()=>{}};
  const components=createExperience(react,fixture,caregivers);
  const chat=JSON.stringify(components.Messages({open:()=>{}}));
  assert.match(chat,/Vista del dueño/);assert.match(chat,/Mensaje al cuidador/);assert.doesNotMatch(chat,/Vista de Mariana|Escribes como|Escribe la respuesta del cuidador/);
});
