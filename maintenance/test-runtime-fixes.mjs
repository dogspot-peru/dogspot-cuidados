// Offline regression checks. No email, database write, or browser session is used.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {registrationState, migrateRegisteredPets, localAccount, accountBase, saveAccountTransition, receiptResultForAccount} from '../dogspot-onboarding.mjs';
import {webcrypto} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {prepareSavedState, verifyCredential, emailTemplateId, emailFailureReason, storedQueue} from '../dogspot-runtime.mjs';
import {validDemo,startDemo,advanceDemo,upgradeDemoPhotos} from '../dogspot-care-demo.mjs';
import {withExtraCaregiverReviews} from '../dogspot-experience.mjs';
import {areaError,areaFields,profileAddress,locationError,locationSnapshot,locationNotes} from '../dogspot-location.mjs';

const root = new URL('../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const name = html.match(/src="\.\/(index-(?:runtime|care|location)-[a-f0-9]+\.js)"/)[1];
const source = readFileSync(new URL(name, root), 'utf8');
const original = readFileSync(new URL('index-copy-e2117d823cf8.js', root), 'utf8');
const slice = (start, end, text = source) => {
  const first = text.indexOf(start, 200000), last = text.indexOf(end, first);
  assert.ok(first >= 0 && last > first, `Missing application section: ${start}`);
  return text.slice(first, last);
};
const checks = [];
async function check(name, run) {await run(); checks.push(name); console.log('PASS', name);}

// Use the existing registration algorithm so login cannot drift away from it.
const cryptoContext = vm.createContext({Uint8Array, TextEncoder, window: {crypto: webcrypto}});
vm.runInContext(slice('var Ke=', 'var A='), cryptoContext);
const credential = await vm.runInContext('Ye("Mascota123")', cryptoContext);
await check('stored registration hash accepts only the correct password', async () => {
  assert.equal(await verifyCredential('Mascota123', credential, webcrypto), true);
  assert.equal(await verifyCredential('incorrecta', credential, webcrypto), false);
  assert.equal(await verifyCredential('Mascota123', {...credential, iterations: 1}, webcrypto), false);
  assert.equal(await verifyCredential('Mascota123', null, webcrypto), false);
});

const aliases = {DogSpotLocalAccount:localAccount,DogSpotAccountBase:accountBase,DogSpotSaveAccountTransition:saveAccountTransition,DogSpotReceiptResultForAccount:receiptResultForAccount,DogSpotWithExtraCaregiverReviews:withExtraCaregiverReviews,DogSpotUpgradeDemoPhotos:upgradeDemoPhotos,DogSpotValidDemo:validDemo,DogSpotRegistrationState: registrationState, DogSpotMigrateRegisteredPets: migrateRegisteredPets, DogSpotPrepareSavedState: prepareSavedState, DogSpotVerifyCredential: verifyCredential, DogSpotEmailTemplateId: emailTemplateId, DogSpotEmailFailureReason: emailFailureReason, DogSpotStoredQueue: storedQueue};
const common = {crypto: webcrypto, Uint8Array, TextEncoder, URL, AbortController, Intl, setTimeout, clearTimeout, ...aliases,DogSpotAreaError:areaError,DogSpotAreaFields:areaFields,DogSpotProfileAddress:profileAddress,DogSpotLocationError:locationError,DogSpotLocationSnapshot:locationSnapshot,DogSpotLocationNotes:locationNotes};
const restoreContext = vm.createContext({...common, f: [], m: array => array, Ot: () => [{id: 'meds', label: 'Medicamento', status: 'pendiente'}, {id: 'water', label: 'Agua', status: 'pendiente'}]});
vm.runInContext(slice('function Ve(', 'var He='), restoreContext);
const restoration = 'var ' + slice('kt={id:`luna`', 'var Nt=');
vm.runInContext(restoration, restoreContext);
const restore = value => {restoreContext.saved = value; return vm.runInContext('Mt(saved)', restoreContext);};
await check('restoring a multi-day walkthrough preserves its schedule and completed photos',()=>{
  let state={user:null,exploration:true,pets:[{id:'p',name:'Luna',species:'Perro',meds:'No aplica'}],selectedPetId:'p',currentBookingId:'b',caregiverId:'ana',bookings:[{id:'b',petId:'p',sessions:[{date:'2026-11-20',start:'10:00',end:'12:00'},{date:'2026-11-22',start:'14:00',end:'16:00'}]}],tasks:[],active:{status:'confirmado'},notifications:[],messages:[]};
  state={...state,...startDemo(state,[{id:'water',label:'Agua'},{id:'rest',label:'Descanso'}],1000)};
  state={...state,...advanceDemo(state,1001,true)};
  state={...state,...advanceDemo(state,1002,true)};
  const restored=restore(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.tasks.length,4);
  assert.equal(restored.careDemo.phase,2);
  assert.equal(restored.tasks[0].status,'completada');
  assert.equal(restored.tasks[0].evidence,state.tasks[0].evidence);
  assert.equal(restored.tasks[2].demoStartAt,state.tasks[2].demoStartAt);
});
await check('legacy and malformed state restores without discarding valid records', () => {
  const state = restore({user: {id: 'customer', name: 'Cliente', email: 'cliente@example.org'}, pets: [null, {id: 'older-pet', name: 'Luna'}], active: null, tasks: [null], bookings: [null, {id: 'booking-1', petId: 'older-pet'}], notifications: null, serviceSnapshots: {'booking-1': {tasks: null, active: null}}, messages: [null, {from: 'ana', text: 'Conservado'}], authCredential: credential});
  assert.equal(state.pets.length, 1);
  assert.equal(state.pets[0].name, 'Luna');
  assert.equal(state.pets[0].meds, '');
  assert.equal(state.bookings[0].id, 'booking-1');
  assert.equal(state.messages[0].text, 'Conservado');
  assert.equal(state.messages[0].from, 'caregiver');
  assert.equal(state.authCredential.derived, credential.derived);
  assert.equal(state.user.id, 'customer');
  assert.equal(state.screen, 'splash');
  assert.doesNotThrow(() => restore(null));
  assert.doesNotThrow(() => restore({pets: [], active: null, serviceSnapshots: null}));
});

await check('old sessions receive both caregivers comments without losing or duplicating saved reviews',()=>{
  const savedReview={id:'owner-review',bookingId:'booking-old',caregiverId:'mariana',rating:3,comment:'Comentario conservado',customer:'Cliente',createdAt:'2026-11-16T15:00:00-05:00',source:'session'};
  const state=restore({reviews:[savedReview]});
  assert.equal(state.reviews.filter(review=>review.caregiverId==='mariana').length,4);
  assert.equal(state.reviews.filter(review=>review.caregiverId==='gabriel').length,3);
  assert.equal(state.reviews.find(review=>review.id==='owner-review').comment,savedReview.comment);
  assert.equal(restore(JSON.parse(JSON.stringify(state))).reviews.length,state.reviews.length);
  assert.match(source,/f\.push\(\.\.\.DogSpotExtraCaregiverReviews\)/);
});

const user = {id: 'customer-1', name: 'Cliente', email: 'cliente@example.org', phone: '000000000',district:'Trujillo',neighborhood:'Centro'};
async function clickLogin(email, password, account = user, savedCredential = credential, localAccounts = {}) {
  const values = [email, password, false, '', false];
  let index = 0, patch = null, error = '';
  const context = vm.createContext({...common, wt: 'usuario@dogspot.pe', Tt: 'dogspot123', mi: '', Oe: value => value.trim().toLowerCase(),
    ui: 'ui', V: 'field', z: 'button', R: () => '', un: 'visible', dn: 'hidden',
    l: {useState: initial => {const position = index++; return [values[position] ?? initial, value => {values[position] = value; if (position === 3) error = value;}];}},
    j: {jsx: (type, props) => ({type, props}), jsxs: (type, props) => ({type, props})},
    M: () => ({user: account, authCredential: savedCredential, set: value => {patch = value;}, go() {},
      accountForEmail: email => localAccount({user:account,authCredential:savedCredential,localAccounts},email),
      signInAccount: email => {const current={user:account,authCredential:savedCredential,localAccounts};const found=localAccount(current,email);patch={...accountBase(current,found.user,{}),screen:'home'};},
      enterExploration:()=>{patch={user:null,authCredential:null,exploration:true,screen:'home'};}}),
    St: () => ({recordActivity() {}})
  });
  const component = slice('function Ea({open:e})', 'function Da()');
  vm.runInContext(component, context);
  const tree = vm.runInContext('Ea({open(){}})', context);
  const find = node => {
    if (!node || typeof node !== 'object') return null;
    if (node.type === 'button' && node.props.children === 'Iniciar sesión') return node;
    for (const child of [node.props?.children].flat()) {const result = find(child); if (result) return result;}
  };
  await find(tree).props.onClick();
  return {patch, error};
}
await check('login rejects an arbitrary password for the saved email', async () => {
  const result = await clickLogin('cliente@example.org', 'incorrecta');
  assert.equal(result.patch, null);
  assert.match(result.error, /incorrectos/);
});
await check('login accepts the correct password with normalized email', async () => {
  const result = await clickLogin('  CLIENTE@EXAMPLE.ORG ', 'Mascota123');
  assert.equal(result.patch.screen, 'home');
  assert.equal(result.patch.user.id, user.id);
});
await check('example credentials do not open a registered local profile', async () => {
  const result=await clickLogin('usuario@dogspot.pe', 'dogspot123');
  assert.equal(result.patch.user,null);
  assert.equal(result.patch.authCredential,null);
  assert.equal(result.patch.exploration,true);
  assert.equal((await clickLogin('usuario@dogspot.pe', 'dogspot123', null, null)).patch.screen, 'home');
});
await check('old accounts without a verifiable password receive recovery guidance', async () => {
  const result = await clickLogin('cliente@example.org', 'cualquiera', user, null);
  assert.equal(result.patch, null);
  assert.match(result.error, /registro anterior/);
});

function provider(initial, storage = {setItem() {}, removeItem() {}}) {
  let state = initial, count = 0, registration = null;
  const context = vm.createContext({...common, localStorage:storage,Mt:value=>value,At: initial, kt: {}, f: [], d: [], jt: 'state', Pt: {Provider: 'Provider'},
    l: {useState: () => count++ === 0 ? [state, change => {state = typeof change === 'function' ? change(state) : change;}] : [false, () => {}], useRef: value => ({current: value}), useEffect() {}},
    j: {jsx: (type, props) => props.value},
    Oe: value => value.trim().toLowerCase(), Ae: () => null, je: () => null, Be: async () => ({status: 'unavailable'}),
    St: () => ({recordRegistration: (...args) => {registration = args;}, recordBooking() {}}),DogSpotCompletionReceipt:()=>null,
    Ot: () => [{id: 'meds', status: 'pendiente'}, {id: 'water', status: 'pendiente'}], Lt: () => '09:00'
  });
  vm.runInContext(slice('function m(e,t)', 'var h='), context);
  vm.runInContext(slice('function Ft({children:e})', 'function M()'), context);
  return {api: vm.runInContext('Ft({children:null})', context), state: () => state, registration: () => registration};
}
const defaults = {user, authCredential: null, pets: [{id: 'pet-b', name: 'Mascota B', meds: ''}], selectedPetId: 'removed-a', bookings: [{id: 'booking-a', petId: 'removed-a', caregiverId: 'ana', status: 'finalizado', petSnapshot: {id: 'removed-a', name: 'Mascota A', meds: ''}}], currentBookingId: 'booking-a', serviceSnapshots: {}, reviews: [], emailReceipts: [], notifications: [], tasks: [], messages: [], active: {status: 'finalizado', rated: false}};
await check('registering an older local email preserves its identity and saves only its hash', () => {
  const p = provider(defaults);
  p.api.registerUser({name: 'Nombre actualizado', email: ' CLIENTE@EXAMPLE.ORG ', phone: '000000000',district:'Trujillo',neighborhood:'Centro'}, credential);
  assert.equal(p.state().user.id, user.id);
  assert.equal(p.state().authCredential.derived, credential.derived);
  assert.equal(p.registration()[2].derived, credential.derived);
  assert.equal(JSON.stringify(p.state()).includes('Mascota123'), false);
});
await check('historical services keep their own pet after its profile was deleted', () => {
  const p = provider(defaults);
  assert.equal(p.api.pet.name, 'Mascota A');
  p.api.openBooking('booking-a', 'summary');
  assert.equal(p.state().tasks.some(task => task.id === 'meds'), false);
});

await check('queued records survive config fetch failure followed by a new event', async () => {
  const context = vm.createContext({...common, pt: 'pending', mt: 'channel', ht: 500, gt: 30000, vt: () => true,
    yt: (event, origin) => event?.origin === origin ? event : null});
  const classSource = slice('var bt=class', ',xt;function St()');
  vm.runInContext(classSource + ';', context);
  let stored = JSON.stringify([{id: 'old-event', origin: 'https://dogspot.example', type: 'booking', data: {}}]);
  const host = {crypto: webcrypto, location: {origin: 'https://dogspot.example', href: 'https://dogspot.example/'}, innerWidth: 390, addEventListener() {}, localStorage: {getItem: () => stored, setItem: (key, value) => {stored = value;}}, fetch: async () => {throw Error('offline');}};
  context.host = host;
  const bridge = vm.runInContext('new bt(host,{})', context);
  bridge.flush = () => Promise.resolve();
  await bridge.enqueue('activity', {}, 'new-event');
  assert.deepEqual(JSON.parse(stored).map(event => event.id), ['old-event', 'new-event']);
  const inaccessibleStorage = {...host, get localStorage() {throw Error('blocked');}};
  context.host = inaccessibleStorage;
  assert.doesNotThrow(() => vm.runInContext('new bt(host,{})', context));
});
await check('completion emails use their configured template and retain compatibility', () => {
  const config = {welcomeTemplateId: 'welcome', bookingTemplateId: 'booking', completionTemplateId: 'completion'};
  assert.equal(emailTemplateId(config, 'completion'), 'completion');
  assert.equal(emailTemplateId({...config, completionTemplateId: undefined}, 'completion'), 'booking');
  assert.equal(emailTemplateId(config, 'booking'), 'booking');
  assert.equal(emailFailureReason(400, 'The Public Key is invalid'), 'public-key');
  assert.equal(emailFailureReason(404, 'The service ID does not exist'), 'missing-service');
  assert.equal(emailFailureReason(404, 'The template ID not found'), 'missing-template');
  assert.equal(emailFailureReason(401, 'Gmail authentication failed'), 'authorization');
});
await check('existing integration settings and protected service control are retained', () => {
  assert.equal(readFileSync(new URL('email-config.json', root), 'utf8').includes('dogspot.peru@gmail.com'), true);
  for (const marker of ['startService:b', 'function DogSpotCompletionReceipt(', 'dogspot-state-v1', 'dogspot-sheets-pending-v1']) assert.ok(source.includes(marker));
  assert.equal(original.includes('r&&i===r.email'), true);
  assert.equal(source.includes('r&&i===r.email'), false);
});
await check('registered accounts remove only the unchanged reference pet', () => {
  const reference = {id: 'luna', name: 'Luna', meds: ''};
  assert.equal(migrateRegisteredPets({user, pets: [reference], bookings: []}, reference).pets.length, 0);
  assert.equal(migrateRegisteredPets({user, pets: [{...reference, id:'registered-pet'}], bookings: []}, reference).pets.length, 1);
  assert.equal(migrateRegisteredPets({user, pets: [{...reference, photo:'local'}], bookings: []}, reference).pets.length, 1);
  assert.equal(migrateRegisteredPets({user, pets: [reference], bookings: [{petId:'luna'}]}, reference).pets.length, 1);
});
await check('new registration starts without the exploration pet and keeps mail independent', () => {
  const p = provider({...defaults,user:null,bookings:[],currentBookingId:null,pets:[{id:'luna',name:'Luna'}]});
  p.api.registerUser(user, credential);
  assert.equal(p.state().pets.length, 0);
  assert.equal(p.state().selectedPetId, '');
  assert.equal(p.state().screen, 'registration-confirmation');
  assert.equal(p.state().authCredential.derived, credential.derived);
  assert.equal(p.registration().length, 3);
});
await check('registration cannot bypass the coverage requirement through the provider API',()=>{
  const p=provider(defaults);
  assert.throws(()=>p.api.registerUser({...user,district:'El Porvenir'},credential),/El Porvenir/);
  assert.equal(p.state(),defaults);
});
await check('new reservations reject missing or excluded points and freeze accepted locations',()=>{
  const p=provider(defaults),location={district:'Trujillo',neighborhood:'Centro',address:'Dirección QA 123',reference:'Timbre 2',lat:-8.1116,lng:-79.0287,confirmedAt:'2026-11-17T20:00:00.000Z'};
  const booking={id:'new-booking',petId:'pet-b',caregiverId:'ana',status:'confirmado',payment:'Yape'};
  assert.equal(p.api.addBooking(booking),false);
  assert.equal(p.api.addBooking({...booking,serviceLocation:{...location,lat:-8.08,lng:-79.005}}),false);
  assert.equal(p.state().bookings.length,defaults.bookings.length);
  p.api.addBooking({...booking,serviceLocation:location});
  location.address='Changed profile';location.lat=0;
  assert.equal(p.state().bookings[0].serviceLocation.address,'Dirección QA 123');
  assert.equal(p.state().bookings[0].serviceLocation.lat,-8.1116);
  assert.equal(p.state().screen,'confirm');
});
await check('manual completion opens the summary and ratings remain tied to one finished booking and caregiver',()=>{
  const prior={id:'prior',bookingId:'other-booking',caregiverId:'ana',rating:4,comment:'Conservar',source:'session'};
  const p=provider({...defaults,caregiverId:'gabriel',active:{status:'activo',rated:false},reviews:[prior],bookings:[{...defaults.bookings[0],caregiverId:'gabriel',status:'activo'},{id:'other-booking',status:'confirmado'}]});
  p.api.rateService(5,'Aún no termina');assert.equal(p.state().reviews.length,1);
  p.api.finishService();assert.equal(p.state().screen,'summary');assert.equal(p.state().active.status,'finalizado');assert.equal(p.state().bookings[1].status,'confirmado');
  p.api.rateService(5,'Buen cuidado');p.api.rateService(4,'Comentario editado');
  assert.equal(p.state().reviews.length,2);
  const review=p.state().reviews.find(review=>review.bookingId==='booking-a');
  assert.equal(review.caregiverId,'gabriel');assert.equal(review.rating,4);assert.equal(review.comment,'Comentario editado');assert.equal(p.state().active.rated,true);assert.equal(p.state().reviews[0].comment,'Conservar');
});
await check('finished unrated services automatically open the existing star and comment form',()=>{
  function summary(state){
    const context=vm.createContext({...common,M:()=>state,d:[{id:'gabriel',name:'Gabriel Rojas'}],
      l:{useState:initial=>[initial,()=>{}]},j:{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},
      DogSpotLocation:{LocationSummary:'location'},Xi:{activo:'Activo',finalizado:'Finalizado'},pi:'heading',B:'card',gi:'badge',Mi:'caregiver',z:'button',pn:'check',rn:'saved',An:'star',hi:'dialog',mi:'',R:(...values)=>values.join(' '),we:()=>[],It:n=>n,Te:()=>2,O:s=>s,D:s=>s,ge:s=>s,me:()=>''});
    vm.runInContext(slice('function Zi(){','function Qi(){'),context);
    return vm.runInContext('Zi()',context);
  }
  function nodes(node){return !node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)];}
  const state={...defaults,caregiverId:'gabriel',pet:{name:'Luna'},go(){},rateService(){},startService(){}};
  let tree=nodes(summary(state));assert.equal(tree.find(node=>node.type==='dialog').props.open,true);
  assert.equal(tree.filter(node=>node.type==='button'&&node.props['aria-label']?.endsWith('estrellas')).length,5);
  assert.equal(tree.find(node=>node.type==='textarea').props.maxLength,2000);
  assert.equal(nodes(summary({...state,reviews:[{bookingId:'booking-a',caregiverId:'gabriel',rating:5,comment:'Guardada'}]})).find(node=>node.type==='dialog').props.open,false);
  assert.equal(nodes(summary({...state,active:{status:'activo'}})).find(node=>node.type==='dialog').props.open,false);
  assert.doesNotMatch(source,/DogSpotCareDemoPanel/);
});
const secondUser={id:'customer-2',name:'Otra persona',email:'otra@example.org',phone:'000000001',district:'Trujillo',neighborhood:'Centro'};
const secondCredential=await vm.runInContext('Ye("OtraMascota456")',cryptoContext);
const privateFirst={...defaults,user,authCredential:credential,pets:[{id:'first-pet',name:'Mascota primera',meds:''}],selectedPetId:'first-pet',
  bookings:[{id:'first-booking',petId:'first-pet',status:'activo'}],currentBookingId:'first-booking',
  tasks:[{id:'water',label:'Agua',status:'completada'}],messages:[{id:'first-message',text:'Mensaje de la primera cuenta'}],
  notifications:[{id:'first-notice',text:'Aviso de la primera cuenta'}],reviews:[{id:'first-review',source:'session',comment:'Comentario propio'}],
  emailReceipts:[{id:'welcome:customer-1',to:user.email,kind:'welcome',status:'sending'}],assistantMessages:[{text:'Consulta privada'}],
  serviceSnapshots:{'other-service':{tasks:[{id:'private-task'}],messages:[]}},active:{status:'activo',rated:false}};
let registeredSecond;
await check('another email can register on the same phone without inheriting the first account data',()=>{
  const saved=new Map(),p=provider(privateFirst,{setItem:(key,value)=>saved.set(key,value)});
  p.api.registerUser({...secondUser,id:undefined},secondCredential);
  const next=p.state();registeredSecond=next;
  assert.equal(next.user.email,secondUser.email);
  assert.notEqual(next.user.id,user.id);
  for(const field of ['pets','bookings','tasks','messages','notifications','emailReceipts'])assert.equal(next[field].length,0,field);
  assert.equal(next.reviews.some(review=>review.id==='first-review'),false);
  assert.equal(next.assistantMessages,null);
  assert.equal(Object.keys(next.serviceSnapshots).length,0);
  const previous=localAccount(next,' CLIENTE@EXAMPLE.ORG ');
  assert.equal(previous.user.id,user.id);
  assert.equal(previous.pets[0].id,'first-pet');
  assert.equal(previous.bookings[0].id,'first-booking');
  assert.equal(previous.authCredential.derived,credential.derived);
  assert.equal(previous.messages[0].id,'first-message');
  assert.equal(previous.reviews[0].id,'first-review');
  assert.equal(previous.localAccounts,undefined);
  const persisted=JSON.parse(saved.get('state'));
  assert.equal(persisted.user.email,secondUser.email);
  assert.equal(persisted.localAccounts[user.email].pets[0].id,'first-pet');
  assert.equal(JSON.stringify(persisted).includes('OtraMascota456'),false);
  assert.equal(JSON.stringify(persisted).includes('Mascota123'),false);
});
await check('switching between saved accounts restores each identity and service history',()=>{
  const restored=restore(JSON.parse(JSON.stringify(registeredSecond)));
  const p=provider(restored);
  p.api.signInAccount('CLIENTE@EXAMPLE.ORG');
  const first=p.state();
  assert.equal(first.user.id,user.id);
  assert.equal(first.pets[0].id,'first-pet');
  assert.equal(first.bookings[0].id,'first-booking');
  assert.equal(first.authCredential.derived,credential.derived);
  assert.equal(first.localAccounts[user.email],undefined);
  assert.equal(localAccount(first,secondUser.email).user.id,registeredSecond.user.id);
  const p2=provider(first);p2.api.signInAccount(secondUser.email);
  assert.equal(p2.state().user.id,registeredSecond.user.id);
  assert.equal(p2.state().pets.length,0);
  assert.equal(p2.state().authCredential.derived,secondCredential.derived);
  assert.equal(localAccount(p2.state(),user.email).bookings[0].id,'first-booking');
});
await check('archived account login verifies that account password rather than the active account password',async()=>{
  const archive=registeredSecond.localAccounts;
  const wrong=await clickLogin(user.email,'OtraMascota456',registeredSecond.user,secondCredential,archive);
  assert.equal(wrong.patch,null);assert.match(wrong.error,/incorrectos/);
  const correct=await clickLogin(' CLIENTE@EXAMPLE.ORG ','Mascota123',registeredSecond.user,secondCredential,archive);
  assert.equal(correct.patch.user.id,user.id);
  assert.equal(correct.patch.pets[0].id,'first-pet');
  const unknown=await clickLogin('desconocido@example.org','OtraMascota456',registeredSecond.user,secondCredential,archive);
  assert.equal(unknown.patch,null);assert.match(unknown.error,/incorrectos/);
});
await check('creating an account cannot replace the password of an existing active or archived email',()=>{
  for(const current of [privateFirst,registeredSecond]){
    const p=provider(current);
    assert.throws(()=>p.api.registerUser({...user,email:' CLIENTE@EXAMPLE.ORG '},secondCredential),/ya está registrado/);
    assert.equal(p.state(),current);assert.equal(p.registration(),null);
    assert.equal(localAccount(p.state(),user.email).authCredential.derived,credential.derived);
  }
});
await check('failed local persistence leaves the previous profile in place and sends no registration',()=>{
  const blocked={setItem(){throw Error('quota');},removeItem(){}};
  const p=provider(privateFirst,blocked);
  assert.throws(()=>p.api.registerUser(secondUser,secondCredential),/cuenta anterior se conserva/);
  assert.equal(p.state(),privateFirst);assert.equal(p.registration(),null);
  const p2=provider(registeredSecond,blocked);
  assert.throws(()=>p2.api.signInAccount(user.email),/cuenta anterior se conserva/);
  assert.equal(p2.state(),registeredSecond);
});
await check('a late email result updates its archived owner without entering the other account inbox',()=>{
  const receipt=privateFirst.emailReceipts[0];
  const updated=receiptResultForAccount(registeredSecond,receipt,{status:'sent',provider:'make'});
  assert.equal(updated.user.id,registeredSecond.user.id);
  assert.equal(updated.emailReceipts.length,0);
  assert.equal(localAccount(updated,user.email).emailReceipts[0].status,'sent');
  assert.equal(localAccount(updated,user.email).authCredential.derived,credential.derived);
  assert.equal(privateFirst.emailReceipts[0].status,'sending');
  assert.equal(receiptResultForAccount(registeredSecond,{...receipt,to:'unknown@example.org'},{status:'sent'}),registeredSecond);
});
await check('exploration is not archived as a personal account and account storage stays flat',()=>{
  const current={...privateFirst,user:{email:'usuario@dogspot.pe'},authCredential:null,exploration:true};
  const next=accountBase(current,secondUser,defaults);
  assert.equal(Object.keys(next.localAccounts).length,0);
  assert.equal(next.pets.length,0);
  const invalid={...registeredSecond,localAccounts:{bad:{user:null},[user.email]:{...privateFirst,localAccounts:{recursive:{user}}}}};
  assert.equal(localAccount(invalid,'bad'),null);
  assert.equal(localAccount(invalid,user.email).localAccounts,undefined);
  assert.doesNotThrow(()=>JSON.stringify(accountBase(invalid,user,defaults)));
});
await check('profile email changes reject an address already used by another saved account',()=>{
  const profile=slice('function Ka()', 'const DogSpotLocation=');
  assert.match(profile,/if\(v&&accountForEmail\(r.email\)\)return f\(/);
});
console.log(`${checks.length} offline regression checks passed for ${name}.`);
