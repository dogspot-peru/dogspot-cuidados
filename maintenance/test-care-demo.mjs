import test from 'node:test';
import assert from 'node:assert/strict';
import {startDemo,advanceDemo,isExploration,DEMO_INTERVAL_MS,renderDemoPanel} from '../dogspot-care-demo.mjs';
import {demoCompletionReceipts} from '../dogspot-demo-completion.mjs';
import {createExperience} from '../dogspot-experience.mjs';
import {makeEvent} from '../dogspot-make.mjs';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const template = ['feeding','water','meds','rest'].map(id=>({id,label:id,status:'pendiente'}));
const fixture = () => ({screen:'tracking',exploration:true,user:null,pets:[{id:'p1',name:'Luna',species:'Perro',meds:'Indicación del propietario'}],selectedPetId:'p1',caregiverId:'ana',currentBookingId:'b1',
  bookings:[{id:'b1',petId:'p1',status:'confirmado',sessions:[{date:'2026-11-20',start:'10:00',end:'12:00'}]}],tasks:template,notifications:[],messages:[],active:{status:'confirmado',rated:false}});
const apply = (s,patch)=>({...s,...patch});

test('a chosen booking advances within its own Peru schedule with photos and a final report',()=>{
  let s=fixture();s=apply(s,startDemo(s,template,1000));
  assert.equal(s.careDemo.clockAt,'2026-11-20T15:00:00.000Z');
  assert.equal(s.active.status,'activo');
  const ids = new Set();
  for(let i=1;i<=8;i++){
    s=apply(s,advanceDemo(s,1000+i*DEMO_INTERVAL_MS));
    for(const notification of s.notifications)ids.add(notification.id);
    assert.ok(Date.parse(s.careDemo.clockAt)>=Date.parse('2026-11-20T15:00:00Z'));
    assert.ok(Date.parse(s.careDemo.clockAt)<=Date.parse('2026-11-20T17:00:00Z'));
    assert.equal(s.tasks.filter(t=>t.status==='completada').length,Math.floor(i/2));
  }
  assert.equal(s.active.status,'finalizado');
  assert.equal(s.screen,'summary');
  assert.equal(s.bookings[0].status,'finalizado');
  assert.equal(s.careDemo.clockAt,'2026-11-20T17:00:00.000Z');
  assert.equal(s.careDemo.running,false);
  assert.ok(s.tasks.every(t=>t.evidence&&t.demoReference&&t.mediaType==='photo'));
  assert.equal(s.messages.length,4);
  assert.equal(ids.size,s.notifications.length);
  assert.match(s.notifications[0].text,/Gracias por confiar/);
  assert.deepEqual(advanceDemo(s,999999,true),{});
});

test('a personal account with existing caregiver records cannot overwrite them with a demo',()=>{
  const s={...fixture(),exploration:false,user:{email:'owner@example.com'},tasks:[{id:'feeding',status:'completada',evidence:'uploaded.jpg'}]};
  const before=JSON.stringify(s);
  assert.equal(isExploration(s),false);
  assert.deepEqual(startDemo(s,template),{});
  assert.deepEqual(advanceDemo({...s,careDemo:{running:true,phase:0}},999999,true),{});
  assert.equal(JSON.stringify(s),before);
});

test('pause, manual advance and JSON restoration retain the current activity',()=>{
  let s=fixture();s=apply(s,startDemo(s,template,1000));
  assert.deepEqual(advanceDemo(s,1001),{});
  s.careDemo.running=false;
  assert.deepEqual(advanceDemo(s,99999),{});
  s=apply(s,advanceDemo(s,99999,true));
  assert.equal(s.tasks[0].status,'progreso');
  assert.equal(s.careDemo.running,false);
  s=JSON.parse(JSON.stringify(s));
  s=apply(s,advanceDemo(s,100000,true));
  assert.equal(s.tasks[0].status,'completada');
  assert.equal(s.notifications.filter(n=>n.kind==='task-completed').length,1);
});

test('several contracted dates each keep their tasks and scheduled photographs',()=>{
  let s=fixture();s.bookings[0].sessions.push({date:'2026-11-22',start:'16:00',end:'18:00'});
  s=apply(s,startDemo(s,template,1000));
  assert.equal(s.tasks.length,8);
  assert.equal(new Set(s.tasks.map(t=>t.id)).size,8);
  for(let i=0;i<16;i++)s=apply(s,advanceDemo(s,1000+i,true));
  assert.ok(s.tasks.slice(0,4).every(t=>t.recordedAt.startsWith('2026-11-20')));
  assert.ok(s.tasks.slice(4).every(t=>t.recordedAt.startsWith('2026-11-22')));
  assert.equal(s.careDemo.clockAt,'2026-11-22T23:00:00.000Z');
  assert.equal(s.active.status,'finalizado');
});

test('pets without medication omit it and use their matching reference photo',()=>{
  let s=fixture();s.pets[0]={...s.pets[0],species:'Gato',meds:'No aplica'};
  s=apply(s,startDemo(s,template,1000));
  assert.equal(s.tasks.some(t=>t.baseId==='meds'),false);
  s=apply(s,advanceDemo(s,1001,true));s=apply(s,advanceDemo(s,1002,true));
  assert.equal(s.tasks[0].evidence,'./cat-feeding-demo.png');
});

for (const species of ['Perro','Gato']) test(`registered ${species} completes all activities, using species photos and one owner completion email`,()=>{
  const fullTemplate=['feeding','water','meds','pee','mood','rest','care','notes'].map(id=>({id,label:id,status:'pendiente'}));
  let s={...fixture(),exploration:false,user:{id:'owner-1',name:'Dueño',email:'owner@example.com'},emailReceipts:[]};
  s.pets[0]={...s.pets[0],species,photo:'uploaded-wrong-species.jpg'};
  s.bookings[0]={...s.bookings[0],caregiverId:'ana',petSnapshot:{...s.pets[0]}};
  s=apply(s,startDemo(s,fullTemplate,1000));
  assert.equal(s.exploration,false);
  assert.equal(s.careDemo.ownerId,'owner-1');
  assert.equal(s.careDemo.bookingId,'b1');
  assert.equal(s.tasks.length,8);
  const createReceipt=(user,booking,petName,caregiverName)=>({id:`completion:${booking.id}`,kind:'completion',to:user.email,customerId:user.id,details:{petName,caregiverName},status:'sending'});
  for(let phase=0;phase<16;phase++){
    assert.deepEqual(demoCompletionReceipts(s,[{id:'ana',name:'Ana'}],createReceipt),[]);
    s=apply(s,advanceDemo(s,1001+phase,true));
  }
  assert.equal(s.active.status,'finalizado');
  assert.equal(s.screen,'summary');
  assert.equal(s.tasks.filter(task=>task.status==='completada').length,8);
  assert.equal(new Set(s.tasks.map(task=>task.evidence)).size,8);
  assert.ok(s.tasks.every(task=>task.evidence.startsWith(species==='Gato'?'./cat-':'./luna-')));
  const receipts=demoCompletionReceipts(s,[{id:'ana',name:'Ana'}],createReceipt);
  assert.equal(receipts.length,1);
  assert.equal(receipts[0].id,'completion:b1');
  assert.equal(receipts[0].to,'owner@example.com');
  assert.equal(receipts[0].details.petName,'Luna');
  assert.equal(receipts[0].details.caregiverName,'Ana');
  s.emailReceipts=receipts;
  assert.deepEqual(demoCompletionReceipts(s,[],createReceipt),[]);
  assert.deepEqual(demoCompletionReceipts(JSON.parse(JSON.stringify(s)),[],createReceipt),[]);
  assert.deepEqual(startDemo(s,fullTemplate,9999),{});
});

test('completion finds a finished saved service after switching bookings and never emails a different owner or exploration',()=>{
  let s={...fixture(),exploration:false,user:{id:'owner-1',email:'owner@example.com'},emailReceipts:[]};
  s=apply(s,startDemo(s,template,1000));
  for(let i=0;i<8;i++)s=apply(s,advanceDemo(s,1001+i,true));
  const saved={...s,currentBookingId:'b2',careDemo:null,serviceSnapshots:{b1:{careDemo:s.careDemo}}};
  const receipt=(user,booking)=>({id:`completion:${booking.id}`,to:user.email});
  assert.equal(demoCompletionReceipts(saved,[],receipt).length,1);
  assert.deepEqual(demoCompletionReceipts({...saved,exploration:true},[],receipt),[]);
  assert.deepEqual(demoCompletionReceipts({...saved,user:{id:'owner-2',email:'another@example.com'}},[],receipt),[]);
  assert.deepEqual(advanceDemo({...s,user:{id:'owner-2',email:'another@example.com'},active:{status:'activo'},careDemo:{...s.careDemo,finished:false,phase:0}},9999,true),{});
  assert.deepEqual(advanceDemo({...s,currentBookingId:'b2',active:{status:'activo'},careDemo:{...s.careDemo,finished:false,phase:0}},9999,true),{});
});

test('restarting resets only the selected service and preserves other bookings',()=>{
  let s=fixture();s.bookings.push({id:'other',status:'finalizado'});
  s=apply(s,startDemo(s,template,1000));
  for(let i=0;i<8;i++)s=apply(s,advanceDemo(s,1000+i,true));
  const oldRun=s.careDemo.runId;
  s=apply(s,startDemo(s,template,2000));
  assert.notEqual(s.careDemo.runId,oldRun);
  assert.ok(s.tasks.every(t=>t.status==='pendiente'&&!t.evidence));
  assert.equal(s.bookings[1].status,'finalizado');
});

test('invalid booking sessions cannot produce an invented valid walkthrough',()=>{
  const s=fixture();s.bookings[0].sessions=[{date:'2026-11-20',start:'12:00',end:'10:00'}];
  assert.deepEqual(startDemo(s,template,1000),{});
});

test('the removed global demo panel stays absent before, during and after a service',()=>{
  const react={createElement:(tag,props,...children)=>({tag,props,children})};
  let s={...fixture(),set:()=>{},go:()=>{}};
  for(const screen of ['home','active','tracking','summary','confirm'])assert.equal(renderDemoPanel(react,{...s,screen},()=>template),null);
  s=apply(s,startDemo(s,template,1000));
  assert.equal(renderDemoPanel(react,s,()=>template),null);
  for(let i=0;i<8;i++)s=apply(s,advanceDemo(s,1000+i,true));
  assert.equal(renderDemoPanel(react,s,()=>template),null);
  assert.equal(renderDemoPanel(react,{...s,exploration:false,user:{email:'owner@example.com'}},()=>template),null);
});

test('older invalid walkthrough data cannot advance or recreate the removed panel',()=>{
  const s={...fixture(),careDemo:{running:true},set:()=>{},go:()=>{}};
  const react={createElement:(tag,props,...children)=>({tag,props,children})};
  assert.equal(renderDemoPanel(react,s,()=>template),null);
  assert.deepEqual(advanceDemo(s,10000),{});
});

test('the registered owner sees the demo start button and keeps its pause/resume progress',()=>{
  const react={createElement:(tag,props,...children)=>({tag,props,children}),useState:initial=>[initial,()=>{}]};
  let state={...fixture(),exploration:false,user:{id:'owner-1',email:'owner@example.com'},screen:'active',startService:()=>{state=apply(state,startDemo(state,template,1000));},set:patch=>{state=apply(state,typeof patch==='function'?patch(state):patch);}};
  const caregiver={id:'ana',name:'Ana Torres',photo:'ana',courses:[]};
  const components=createExperience(react,()=>state,[caregiver]);
  const buttons=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(buttons):[...(node.tag==='button'?[node]:[]),...buttons(node.children)];
  let button=buttons(components.Active({open(){}})).find(node=>node.children[0]==='Demo inicial: iniciar cuidado y seguimiento');
  assert.ok(button);button.props.onClick();
  assert.equal(state.screen,'tracking');assert.equal(state.exploration,false);assert.equal(state.careDemo.running,true);
  state=apply(state,advanceDemo(state,1001,true));state.careDemo.running=false;
  button=buttons(components.Active({open(){}})).find(node=>node.children[0]==='Demo inicial: continuar cuidado y seguimiento');
  assert.ok(button);button.props.onClick();assert.equal(state.careDemo.phase,1);assert.equal(state.careDemo.running,true);
});

test('the shipped provider dispatches its automatic demo completion through the existing Make receipt',()=>{
  const root=new URL('../',import.meta.url),html=readFileSync(new URL('index.html',root),'utf8');
  const source=readFileSync(new URL(html.match(/src="\.\/(index-location-[a-f0-9]+\.js)"/)[1],root),'utf8');
  let state={...fixture(),exploration:false,user:{id:'owner-1',name:'Dueño',email:'owner@example.com'},emailReceipts:[]};
  state.bookings[0]={...state.bookings[0],caregiverId:'ana',total:140,payment:'Yape'};
  state=apply(state,startDemo(state,template,1000));
  for(let i=0;i<8;i++)state=apply(state,advanceDemo(state,1001+i,true));
  const sent=[];
  const context=vm.createContext({DogSpotDemoCompletionReceipts:demoCompletionReceipts,DogSpotIsExploration:isExploration,r:true,t:state,d:[{id:'ana',name:'Ana Torres'}],Oe:s=>s.trim().toLowerCase(),ke:s=>s.includes('@'),we:b=>b.sessions,O:s=>s,D:s=>s,Te:()=>4,l:{useEffect:callback=>callback()}});
  context.n=updater=>{context.t=updater(context.t);};
  context.h=receipt=>{sent.push(makeEvent(receipt));receipt.status='sent';receipt.provider='make';};
  const constructorStart=source.indexOf('function DogSpotCompletionReceipt('),constructorEnd=source.indexOf('function Me(',constructorStart);
  vm.runInContext(source.slice(constructorStart,constructorEnd),context);
  const effectStart=source.indexOf('(0,l.useEffect)(()=>{\n  if(!r||DogSpotIsExploration(t))return;'),effectEnd=source.indexOf(';return(0,j.jsx)(Pt.Provider',effectStart);
  assert.ok(effectStart>0&&effectEnd>effectStart);
  const effect=source.slice(effectStart,effectEnd);
  vm.runInContext(effect,context);assert.equal(context.t.emailReceipts.length,1);assert.equal(sent.length,0);
  vm.runInContext(effect,context);assert.equal(sent.length,1);
  assert.equal(sent[0].type,'completion');assert.equal(sent[0].event_id,'completion:b1');assert.equal(sent[0].data.to_email,'owner@example.com');
  vm.runInContext(effect,context);assert.equal(sent.length,1);
  assert.equal(context.t.emailReceipts[0].provider,'make');
});

