import test from 'node:test';
import assert from 'node:assert/strict';
import {startDemo,advanceDemo,isExploration,DEMO_INTERVAL_MS,renderDemoPanel} from '../dogspot-care-demo.mjs';

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
  assert.equal(s.bookings[0].status,'finalizado');
  assert.equal(s.careDemo.clockAt,'2026-11-20T17:00:00.000Z');
  assert.equal(s.careDemo.running,false);
  assert.ok(s.tasks.every(t=>t.evidence&&t.demoReference&&t.mediaType==='photo'));
  assert.equal(s.messages.length,4);
  assert.equal(ids.size,s.notifications.length);
  assert.match(s.notifications[0].text,/Gracias por confiar/);
  assert.deepEqual(advanceDemo(s,999999,true),{});
});

test('a personal account and its genuine task records never advance automatically',()=>{
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
  assert.equal(s.tasks[0].evidence,'./cat-reference.png');
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

test('the UI identifies academic photos and exposes pause, steps and history',()=>{
  const react={createElement:(tag,props,...children)=>({tag,props,children})};
  let s={...fixture(),set:()=>{},go:()=>{}};
  let panel=renderDemoPanel(react,s,()=>template);
  assert.match(JSON.stringify(panel),/datos académicos/);
  assert.match(JSON.stringify(panel),/Iniciar recorrido/);
  s=apply(s,startDemo(s,template,1000));
  panel=renderDemoPanel(react,s,()=>template);
  assert.match(JSON.stringify(panel),/Pausar/);
  assert.match(JSON.stringify(panel),/Siguiente avance/);
  assert.match(JSON.stringify(panel),/Ver historial y fotos/);
  assert.equal(renderDemoPanel(react,{...s,exploration:false,user:{email:'owner@example.com'}},()=>template),null);
});

test('older saved walkthrough data offers a clean restart without invalid dates',()=>{
  const s={...fixture(),careDemo:{running:true},set:()=>{},go:()=>{}};
  const react={createElement:(tag,props,...children)=>({tag,props,children})};
  const panel=JSON.stringify(renderDemoPanel(react,s,()=>template));
  assert.doesNotMatch(panel,/Invalid Date/);
  assert.match(panel,/Iniciar recorrido/);
  assert.deepEqual(advanceDemo(s,10000),{});
});
