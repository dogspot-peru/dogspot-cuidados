/**
 * Add this file to the SAME Apps Script project already used by DogSpot.
 * Rename its previous doGet function to dogspotSheetsDoGet first.
 * Set DOGSPOT_MAKE_WEBHOOK_URL in Script Properties. Never put it in GitHub.
 */
function doGet(e) {
  if(e&&e.parameter&&e.parameter.dogspot_make==='1')return dogspotMakePage_(e);
  if(typeof dogspotSheetsDoGet==='function')return dogspotSheetsDoGet(e);
  return HtmlService.createHtmlOutput('DogSpot: conexión de confirmaciones.');
}

function dogspotMakeVerifySetup() {
  var result={webhookConfigured:!!dogspotMakeSettings_(),automationSheetFound:!!dogspotMakeSheet_()};
  console.log(JSON.stringify(result));return result;
}

function dogspotMakeSettings_() {
  var properties=PropertiesService.getScriptProperties(),url=String(properties.getProperty('DOGSPOT_MAKE_WEBHOOK_URL')||'').trim();
  if(!/^https:\/\/hook\.(?:us[0-9]+\.|eu[0-9]+\.)?make\.com\/[a-z0-9]{20,80}$/.test(url))return null;
  return {url:url,key:properties.getProperty('DOGSPOT_MAKE_API_KEY')||''};
}

function dogspotMakeSheet_() {
  try{
    var id=PropertiesService.getScriptProperties().getProperty('DOGSPOT_AUTOMATION_SPREADSHEET_ID');
    var spreadsheet=id?SpreadsheetApp.openById(id):SpreadsheetApp.getActiveSpreadsheet();
    return spreadsheet?spreadsheet.getSheetByName('Automatizaciones'):null;
  }catch(error){return null;}
}

function dogspotMakeSentRow_(packet) {
  try{
    var sheet=dogspotMakeSheet_();if(!sheet||sheet.getLastRow()<2)return null;
    var match=sheet.getRange(2,1,sheet.getLastRow()-1,1).createTextFinder(packet.event_id).matchEntireCell(true).findNext();
    if(!match)return null;
    var row=sheet.getRange(match.getRow(),1,1,19).getDisplayValues()[0];
    if(String(row[1])!==packet.type||String(row[4]).trim().toLowerCase()!==packet.data.to_email||String(row[12]).trim().toLowerCase()!=='sent'||!String(row[16]).trim())return null;
    return {status:'sent',event_id:packet.event_id,messageId:String(row[16]).slice(0,180)};
  }catch(error){return null;}
}

function dogspotMakePacket_(value) {
  var kinds=['welcome','booking','completion'];
  if(!value||value.schema_version!==1||kinds.indexOf(value.type)<0||typeof value.event_id!=='string'||value.event_id.indexOf(value.type+':')!==0||!/^\w[\w:.-]{2,179}$/.test(value.event_id)||!isFinite(Date.parse(value.occurred_at)))throw Error('invalid-event');
  var data=value.data||{},result={},limits={customer_id:180,to_email:254,customer_name:160,booking_reference:180,pet_name:160,caregiver_name:160,session_summary:5000,duration:160,total:160,payment_method:100};
  Object.keys(limits).forEach(function(key){result[key]=String(data[key]||'').trim().slice(0,limits[key]);});
  result.to_email=result.to_email.toLowerCase();
  if(!/^\S+@\S+\.\S+$/.test(result.to_email)||!result.customer_name)throw Error('invalid-event');
  return {schema_version:1,event_id:value.event_id,type:value.type,occurred_at:new Date(value.occurred_at).toISOString(),data:result};
}

function dogspotMakeDigest_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value,Utilities.Charset.UTF_8).map(function(byte){return ('0'+((byte+256)%256).toString(16)).slice(-2);}).join('');
}

function dogspotMakeCacheKey_(eventId) {return 'DOGSPOT_MAKE_EVENT_'+dogspotMakeDigest_(eventId);}

function dogspotMakeRateAllowed_(email) {
  var cache=CacheService.getScriptCache(),hour=Math.floor(Date.now()/3600000),globalKey='DOGSPOT_MAKE_RATE_'+hour,emailKey=globalKey+'_'+dogspotMakeDigest_(email);
  var globalCount=Number(cache.get(globalKey)||0),emailCount=Number(cache.get(emailKey)||0);
  if(globalCount>=200||emailCount>=20)return false;
  cache.put(globalKey,String(globalCount+1),3600);cache.put(emailKey,String(emailCount+1),3600);return true;
}

function dogspotMakeStore_(key,result) {
  var properties=PropertiesService.getScriptProperties(),all=properties.getProperties();
  var keys=Object.keys(all).filter(function(name){return name.indexOf('DOGSPOT_MAKE_EVENT_')===0;});
  if(keys.length>=400&&!all[key]){
    keys.sort(function(a,b){try{return JSON.parse(all[a]).at-JSON.parse(all[b]).at;}catch(error){return 0;}}).slice(0,100).forEach(function(name){properties.deleteProperty(name);});
  }
  properties.setProperty(key,JSON.stringify({at:Date.now(),status:result.status,reason:result.reason||'',messageId:result.messageId||'',identity:result.identity||''}));
}

function dogspotMakeSend(value) {
  var packet;try{packet=dogspotMakePacket_(value);}catch(error){return {status:'failed',reason:'invalid-event'};}
  var settings=dogspotMakeSettings_();if(!settings)return {status:'unavailable',reason:'make-not-configured'};
  var confirmed=dogspotMakeSentRow_(packet);if(confirmed)return confirmed;
  var identity=dogspotMakeDigest_(JSON.stringify([packet.type,packet.data.to_email,packet.data.customer_id,packet.data.booking_reference]));
  var properties=PropertiesService.getScriptProperties(),key=dogspotMakeCacheKey_(packet.event_id),lock=LockService.getScriptLock();
  if(!lock.tryLock(5000))return {status:'uncertain',reason:'make-claimed'};
  try{
    var stored;try{stored=JSON.parse(properties.getProperty(key)||'null');}catch(error){stored=null;}
    if(stored&&stored.identity!==identity)return {status:'failed',reason:'invalid-event'};
    if(stored&&stored.status==='sent')return {status:'sent',event_id:packet.event_id,messageId:stored.messageId||''};
    if(stored&&stored.status!=='failed')return {status:'uncertain',reason:stored.reason==='make-queued'?'make-queued':'make-claimed'};
    if(!dogspotMakeRateAllowed_(packet.data.to_email))return {status:'failed',reason:'quota'};
    dogspotMakeStore_(key,{status:'pending',identity:identity});
  }finally{lock.releaseLock();}
  var result;
  try{
    var headers={};if(settings.key)headers['x-make-apikey']=settings.key;
    var response=UrlFetchApp.fetch(settings.url,{method:'post',contentType:'application/json',payload:JSON.stringify(packet),headers:headers,followRedirects:false,muteHttpExceptions:true});
    var status=response.getResponseCode(),body=String(response.getContentText()||'').trim(),ack=null;
    try{ack=JSON.parse(body);}catch(error){}
    if(status>=200&&status<300&&ack&&ack.status==='sent'&&ack.event_id===packet.event_id)result={status:'sent',event_id:packet.event_id};
    else if(status>=200&&status<300&&body==='Accepted')result={status:'uncertain',reason:'make-queued'};
    else if(status===429)result={status:'failed',reason:'quota'};
    else if(status===400&&/queue is full/i.test(body))result={status:'failed',reason:'queue-full'};
    else if(status===401||status===403)result={status:'failed',reason:'authorization'};
    else if(status===400||status===404||status===410)result={status:'failed',reason:'configuration'};
    else result={status:'uncertain',reason:'make-claimed'};
  }catch(error){result={status:'uncertain',reason:'network'};}
  if(result.status!=='sent')result=dogspotMakeSentRow_(packet)||result;
  if(lock.tryLock(5000)){try{dogspotMakeStore_(key,Object.assign({},result,{identity:identity}));}finally{lock.releaseLock();}}
  return result;
}

function dogspotMakePage_(e) {
  var origin='https://dogspot-peru.github.io',query=e.parameter||{},nonce=String(query.nonce||'');
  if(query.origin!==origin||!/^[\w-]{16,100}$/.test(nonce))return HtmlService.createHtmlOutput('DogSpot: solicitud inválida.');
  var ready=!!dogspotMakeSettings_();
  var html='<!doctype html><meta charset="utf-8"><title>DogSpot · Confirmaciones</title><script>(function(){'+
    'var origin='+JSON.stringify(origin)+',nonce='+JSON.stringify(nonce)+',channel="dogspot-make-v1";'+
    'function reply(requestId,result){window.top.postMessage({channel:channel,type:"result",nonce:nonce,requestId:requestId,result:result},origin);}'+
    'window.addEventListener("message",function(event){var data=event.data;if(event.source!==window.top||event.origin!==origin||!data||data.channel!==channel||data.type!=="send"||data.nonce!==nonce||typeof data.requestId!=="string")return;'+
    'google.script.run.withSuccessHandler(function(result){reply(data.requestId,result);}).withFailureHandler(function(){reply(data.requestId,{status:"uncertain",reason:"network"});}).dogspotMakeSend(data.packet);});'+
    'window.top.postMessage({channel:channel,type:"ready",nonce:nonce,available:'+JSON.stringify(ready)+'},origin);})();<\/script>';
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
