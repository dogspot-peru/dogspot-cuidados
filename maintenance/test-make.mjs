// Offline integration tests: no request, email, or spreadsheet write leaves this process.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {makeEvent,tryMakeReceipt,makeRelayConfig,MakeRelay,MAKE_CHANNEL} from '../dogspot-make.mjs';

const root=new URL('../',import.meta.url),config=JSON.parse(readFileSync(new URL('email-config.json',root),'utf8'));
const html=readFileSync(new URL('index.html',root),'utf8'),bundle=html.match(/src="\.\/(index-location-[a-f0-9]+\.js)"/)[1],source=readFileSync(new URL(bundle,root),'utf8');
const receipt=(kind='booking')=>({id:kind+':reservation-1',kind,to:'qa@example.org',customerId:'customer-1',customerName:'Cliente QA',createdAt:'2026-11-18T12:00:00.000Z',bookingId:kind==='welcome'?undefined:'reservation-1',details:{petName:'Mascota QA',caregiverName:'Gabriel Rojas',sessions:'20/11/2026 · 09:00 – 13:00',duration:'4 horas en total',total:'S/ 140',payment:'Yape'}});
const section=(start,end)=>{const a=source.indexOf(start,200000),b=source.indexOf(end,a+start.length);assert.ok(a>0&&b>a);return source.slice(a,b);};

test('the three real app constructors retain customer IDs and match the Make schema without private profile fields',()=>{
  const context=vm.createContext({Oe:s=>s.trim().toLowerCase(),ke:s=>s.includes('@'),we:b=>b.sessions,O:s=>s,D:s=>s,Te:()=>4});
  for(const name of ['Ae','je','DogSpotCompletionReceipt']){
    const a=source.indexOf('function '+name+'(',200000),b=source.indexOf('function ',a+10);vm.runInContext(source.slice(a,b),context);
  }
  context.user={id:'customer-1',email:'qa@example.org',name:'Cliente QA',password:'private',address:'private',health:'private'};
  context.booking={id:'reservation-1',total:140,payment:'Yape',sessions:[{date:'2026-11-20',start:'09:00',end:'13:00'}]};
  const expressions=['Ae(user,"welcome:"+user.id)','je(user,booking,"Mascota QA","Gabriel Rojas")','DogSpotCompletionReceipt(user,booking,"Mascota QA","Gabriel Rojas")'];
  for(const [index,expression] of expressions.entries()){
    const notice=vm.runInContext(expression,context),packet=makeEvent(notice);
    assert.equal(packet.type,['welcome','booking','completion'][index]);assert.equal(packet.data.customer_id,'customer-1');assert.equal(packet.data.to_email,'qa@example.org');
    assert.deepEqual(Object.keys(packet.data).sort(),['booking_reference','caregiver_name','customer_id','customer_name','duration','payment_method','pet_name','session_summary','to_email','total'].sort());
    assert.equal(JSON.stringify(packet).includes('private'),false);
  }
  assert.ok(source.includes('i=Ae(r,`welcome:${r.id}`)'));
});

test('payload IDs and timestamps stay stable across retries and invalid kinds are rejected',()=>{
  const notice=receipt(),one=makeEvent(notice),two=makeEvent({...notice,attempts:8,status:'uncertain'});
  assert.deepEqual(one,two);assert.equal(one.occurred_at,notice.createdAt);
  for(const value of [{...notice,kind:'other'},{...notice,id:'completion:different'},{...notice,to:'invalid'},{...notice,createdAt:'invalid'}])assert.throws(()=>makeEvent(value));
  assert.equal(makeRelayConfig({}),null);assert.equal(makeRelayConfig({...config,makeRelay:{enabled:true,webAppUrl:'https://evil.example/exec'}}),null);
});

function mailer(makeResult){
  const stats={makeCalls:0,emailCalls:0};
  const context=vm.createContext({AbortController,URL,Set,Map,Promise,setTimeout,clearTimeout,Date,window:{location:{href:config.appUrl}},Ie:0,Pe:new Set(),Ne:new Map(),Fe:Promise.resolve(),
    ke:s=>s.includes('@'),Me:()=>({}),DogSpotEmailTemplateId:()=>config.bookingTemplateId,DogSpotEmailFailureReason:()=>'',DogSpotTryMakeReceipt:async()=>{stats.makeCalls++;return makeResult;},
    fetch:async()=>{stats.emailCalls++;return {ok:true,text:async()=>'',json:async()=>config};}});
  vm.runInContext(section('function Le(','function Ve('),context);context.notice=receipt();context.config=config;
  return {context,stats,send:()=>vm.runInContext('Be(notice,config)',context)};
}

test('Make dispatch never falls back to EmailJS after queued, uncertain, rejected, or confirmed responses',async()=>{
  for(const result of [{provider:'make',status:'sent'},{provider:'make',status:'uncertain',reason:'make-queued'},{provider:'make',status:'uncertain',reason:'network'},{provider:'make',status:'failed',reason:'authorization'}]){
    const app=mailer(result);await Promise.all([app.send(),app.send()]);assert.equal(app.stats.makeCalls,1);assert.equal(app.stats.emailCalls,0);
  }
  const oldRoute=mailer(null);await oldRoute.send();assert.equal(oldRoute.stats.emailCalls,1);
});

test('client confirms only an acknowledgement for its exact event ID',async()=>{
  const notice=receipt(),send=result=>tryMakeReceipt(notice,config,{send:async()=>result});
  assert.equal(await send(null),null);
  assert.equal((await send({status:'sent',event_id:'other'})).status,'uncertain');
  assert.equal((await send({status:'sent',event_id:notice.id,messageId:'gmail-id'})).messageId,'gmail-id');
  assert.equal((await send(undefined)).status,'uncertain');
});

const gs=readFileSync(new URL('integration/DogSpotMake.gs',root),'utf8');
function server(reply={status:200,body:null}){
  const properties=new Map([['DOGSPOT_MAKE_WEBHOOK_URL','https://hook.us2.make.com/'+'a'.repeat(32)],['DOGSPOT_AUTOMATION_SPREADSHEET_ID','qa-spreadsheet']]),cache=new Map(),calls=[];
  let confirmedRow=null,locked=false;
  const props={getProperty:key=>properties.get(key)??null,getProperties:()=>Object.fromEntries(properties),setProperty:(key,value)=>properties.set(key,value),deleteProperty:key=>properties.delete(key)};
  const sheet={getLastRow:()=>confirmedRow?2:1,getRange:(row,col)=>col===1&&row===2?{
    createTextFinder:id=>({matchEntireCell:()=>({findNext:()=>confirmedRow?.[0]===id?{getRow:()=>2}:null})}),getDisplayValues:()=>[confirmedRow]
  }:{getDisplayValues:()=>[confirmedRow]}};
  const context=vm.createContext({console:{log(){}},PropertiesService:{getScriptProperties:()=>props},CacheService:{getScriptCache:()=>({get:key=>cache.get(key)??null,put:(key,value)=>cache.set(key,value)})},
    SpreadsheetApp:{getActiveSpreadsheet:()=>{throw Error('not available in web apps');},openById:id=>{assert.equal(id,'qa-spreadsheet');return {getSheetByName:()=>sheet};}},LockService:{getScriptLock:()=>({tryLock:()=>{if(locked)return false;locked=true;return true;},releaseLock:()=>{locked=false;}})},
    Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(algorithm,value)=>Array.from(createHash('sha256').update(value).digest())},
    UrlFetchApp:{fetch:(url,options)=>{calls.push({url,options});if(reply.throw)throw Error('offline');return {getResponseCode:()=>reply.status,getContentText:()=>reply.body??JSON.stringify({status:'sent',event_id:JSON.parse(options.payload).event_id})};}},
    HtmlService:{XFrameOptionsMode:{ALLOWALL:'all'},createHtmlOutput:html=>({html,setXFrameOptionsMode(){return this;}})}
  });
  vm.runInContext(gs,context);
  return {context,calls,properties,cache,reply,confirm(packet){confirmedRow=Array(19).fill('');confirmedRow[0]=packet.event_id;confirmedRow[1]=packet.type;confirmedRow[4]=packet.data.to_email;confirmedRow[12]='sent';confirmedRow[16]='gmail-verified';},send(packet){context.packet=packet;return vm.runInContext('dogspotMakeSend(packet)',context);}};
}

test('relay posts the exact packet once, confirms a repeated event without resending, and rejects a recipient mismatch',()=>{
  const service=server(),packet=makeEvent(receipt());
  assert.equal(service.send(packet).status,'sent');assert.equal(service.send(packet).status,'sent');assert.equal(service.calls.length,1);
  assert.deepEqual(JSON.parse(service.calls[0].options.payload),packet);assert.equal(service.calls[0].options.followRedirects,false);
  assert.equal(service.send({...packet,data:{...packet.data,to_email:'other@example.org'}}).status,'failed');assert.equal(service.calls.length,1);
});

test('missing spreadsheet configuration keeps the bridge unavailable and sends nothing',()=>{
  const service=server();service.properties.delete('DOGSPOT_AUTOMATION_SPREADSHEET_ID');
  assert.equal(service.send(makeEvent(receipt())).reason,'make-sheet');assert.equal(service.calls.length,0);
  service.context.input={parameter:{origin:'https://dogspot-peru.github.io',nonce:'test-nonce-123456789',dogspot_make:'1'}};
  const page=vm.runInContext('doGet(input)',service.context).html;
  assert.match(page,/available:false/);
});

test('Accepted is pending; a later matching Gmail log confirms it without another webhook request',()=>{
  const service=server({status:200,body:'Accepted'}),packet=makeEvent(receipt('completion'));
  assert.equal(service.send(packet).reason,'make-queued');assert.equal(service.send(packet).status,'uncertain');assert.equal(service.calls.length,1);
  service.confirm(packet);const confirmed=service.send(packet);assert.equal(confirmed.status,'sent');assert.equal(confirmed.messageId,'gmail-verified');assert.equal(service.calls.length,1);
});

test('a lost response or a mismatched success body does not dispatch the event again',()=>{
  for(const reply of [{throw:true},{status:200,body:JSON.stringify({status:'sent',event_id:'wrong'})},{status:500,body:'Duplicate key error'}]){
    const service=server(reply),packet=makeEvent(receipt());assert.equal(service.send(packet).status,'uncertain');assert.equal(service.send(packet).status,'uncertain');assert.equal(service.calls.length,1);
  }
});

test('known pre-dispatch rejections can retry the same ID and validation or quotas cannot send mail',()=>{
  const service=server({status:401,body:'Unauthorized'}),packet=makeEvent(receipt());assert.equal(service.send(packet).status,'failed');service.reply.status=200;service.reply.body=null;assert.equal(service.send(packet).status,'sent');assert.equal(service.calls.length,2);
  assert.equal(service.send({...packet,type:'invalid'}).status,'failed');assert.equal(service.calls.length,2);
  const limited=server();for(let i=0;i<20;i++)assert.equal(limited.send({...packet,event_id:'booking:event-'+i}).status,'sent');
  assert.equal(limited.send({...packet,event_id:'booking:event-21'}).reason,'quota');assert.equal(limited.calls.length,20);
});

test('Apps Script bridge preserves the previous GET handler and does not reveal the webhook',()=>{
  const service=server();service.context.previousArg=null;vm.runInContext('function dogspotSheetsDoGet(e){previousArg=e;return "previous";}',service.context);
  service.context.input={parameter:{origin:'https://dogspot-peru.github.io',nonce:'test-nonce-123456789',dogspot_make:'1'}};
  const page=vm.runInContext('doGet(input)',service.context).html;assert.equal(page.includes('hook.us2.make.com'),false);assert.ok(page.endsWith('</script>'));
  let listener,remoteCalls=0;const top={postMessage(){}};
  const pageContext=vm.createContext({window:{top,addEventListener:(name,fn)=>{listener=fn;}},google:{script:{run:{withSuccessHandler(){return this;},withFailureHandler(){return this;},dogspotMakeSend(){remoteCalls++;}}}}});
  vm.runInContext(page.match(/<script>([\s\S]*)<\/script>/)[1],pageContext);
  const data={channel:MAKE_CHANNEL,type:'send',nonce:'test-nonce-123456789',requestId:'r',packet:makeEvent(receipt())};
  listener({source:top,origin:'https://evil.example',data});listener({source:top,origin:'https://dogspot-peru.github.io',data:{...data,nonce:'wrong'}});assert.equal(remoteCalls,0);
  listener({source:top,origin:'https://dogspot-peru.github.io',data});assert.equal(remoteCalls,1);
  assert.equal(vm.runInContext('doGet({parameter:{}})',service.context),'previous');
});

test('browser relay accepts only its bound frame, Google origin and connection nonce',{timeout:2000},async()=>{
  let receive,frame,id=0,onPost;const timers=new Map(),posted=new Promise(resolve=>{onPost=resolve;});
  const bridge={postMessage:message=>onPost(message)};
  const host={location:{origin:'https://dogspot-peru.github.io'},crypto:{randomUUID:()=>('nonce-123456789-'+(++id))},addEventListener:(name,fn)=>{receive=fn;},setTimeout:fn=>{const key=++id;timers.set(key,fn);return key;},clearTimeout:key=>timers.delete(key)};
  const doc={createElement:()=>({remove(){}}),body:{append:value=>{frame=value;queueMicrotask(()=>receive({source:bridge,origin:'https://n-test.googleusercontent.com',data:{channel:MAKE_CHANNEL,type:'ready',nonce:new URL(frame.src).searchParams.get('nonce'),available:true}}));}}};
  const relay=new MakeRelay(config.makeRelay,host,doc);assert.equal(await relay.connect(),true);
  const sending=relay.send(makeEvent(receipt()));
  const request=await posted,result={status:'sent',event_id:request.packet.event_id};
  const event={source:bridge,origin:'https://n-test.googleusercontent.com',data:{channel:MAKE_CHANNEL,type:'result',nonce:request.nonce,requestId:request.requestId,result}};
  receive({...event,origin:'https://n-test.googleusercontent.com.evil.example'});receive({...event,source:{}});receive({...event,data:{...event.data,nonce:'wrong'}});assert.equal(relay.pending.size,1);
  receive(event);assert.equal((await sending).status,'sent');assert.equal(relay.pending.size,0);assert.equal(timers.size,0);
});

test('the committed app and server sources contain no concrete Make webhook or private key',()=>{
  for(const file of ['email-config.json','dogspot-make.mjs','integration/DogSpotMake.gs',bundle]){
    assert.doesNotMatch(readFileSync(new URL(file,root),'utf8'),/https:\/\/hook\.(?:us\d+\.)?make\.com\/[a-z0-9]{20,80}/);
  }
});
