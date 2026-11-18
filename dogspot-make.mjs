// The private Make webhook stays in Apps Script properties, never in this app.
export const MAKE_CHANNEL='dogspot-make-v1';
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
const kinds=new Set(['welcome','booking','completion']);

export function makeEvent(receipt) {
  if(!receipt||!kinds.has(receipt.kind)||!/^\S+@\S+\.\S+$/.test(receipt.to??'')||!Number.isFinite(Date.parse(receipt.createdAt)))throw Error('invalid-receipt');
  const id=clean(receipt.id,180);
  if(!id.startsWith(receipt.kind+':')||!/^\w[\w:.-]{2,179}$/.test(id))throw Error('invalid-event-id');
  const details=receipt.details??{};
  return {schema_version:1,event_id:id,type:receipt.kind,occurred_at:new Date(receipt.createdAt).toISOString(),data:{
    customer_id:clean(receipt.customerId,180),to_email:clean(receipt.to,254).toLowerCase(),customer_name:clean(receipt.customerName,160),
    booking_reference:clean(receipt.bookingId,180),pet_name:clean(details.petName,160),caregiver_name:clean(details.caregiverName,160),
    session_summary:clean(details.sessions,5000),duration:clean(details.duration,160),total:clean(details.total,160),payment_method:clean(details.payment,100)
  }};
}

export function makeRelayConfig(config) {
  const relay=config?.makeRelay;
  if(config?.enabled!==true||relay?.enabled!==true||typeof relay.webAppUrl!=='string')return null;
  try {const url=new URL(relay.webAppUrl);return /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url.href)?{webAppUrl:url.href}:null;}catch{return null;}
}

export class MakeRelay {
  constructor(config,host=window,doc=document) {
    this.config=config;this.host=host;this.doc=doc;this.pending=new Map();this.receive=this.receive.bind(this);host.addEventListener('message',this.receive);
  }
  receive(event) {
    const message=event.data;
    if(!message||message.channel!==MAKE_CHANNEL||!event.source||!/^https:\/\/[a-z0-9-]+\.googleusercontent\.com$/.test(event.origin))return;
    if(message.type==='ready'&&message.nonce===this.connectionNonce&&this.ready){
      this.bridge=event.source;this.bridgeOrigin=event.origin;this.available=message.available===true;this.ready(this.available);return;
    }
    if(event.source!==this.bridge||event.origin!==this.bridgeOrigin||message.type!=='result')return;
    const pending=this.pending.get(message.requestId);
    if(!pending||message.nonce!==this.connectionNonce)return;
    this.host.clearTimeout(pending.timer);this.pending.delete(message.requestId);pending.resolve(message.result);
  }
  async connect() {
    if(this.connectPromise)return this.connectPromise;
    this.connectionNonce=this.host.crypto.randomUUID();
    this.connectPromise=new Promise(resolve=>{
      const finish=available=>{this.host.clearTimeout(timer);this.ready=null;resolve(available);};
      const timer=this.host.setTimeout(()=>{this.frame?.remove();finish(false);},8000);
      this.ready=finish;
      const url=new URL(this.config.webAppUrl);url.searchParams.set('dogspot_make','1');url.searchParams.set('origin',this.host.location.origin);url.searchParams.set('nonce',this.connectionNonce);
      this.frame=this.doc.createElement('iframe');this.frame.hidden=true;this.frame.title='Conexión de confirmaciones de DogSpot';this.frame.referrerPolicy='origin';this.frame.src=url.href;
      this.doc.body.append(this.frame);
    });
    return this.connectPromise;
  }
  async send(packet) {
    let available;try{available=await this.connect();}catch{return null;}
    if(!available)return null; // No Make request has been sent: the existing mail route can still be used.
    return new Promise(resolve=>{
      const requestId=this.host.crypto.randomUUID();
      const timer=this.host.setTimeout(()=>{this.pending.delete(requestId);resolve({status:'uncertain',reason:'timeout'});},65000);
      this.pending.set(requestId,{resolve,timer});
      try{this.bridge.postMessage({channel:MAKE_CHANNEL,type:'send',nonce:this.connectionNonce,requestId,packet},this.bridgeOrigin);}
      catch{this.host.clearTimeout(timer);this.pending.delete(requestId);resolve({status:'uncertain',reason:'network'});}
    });
  }
}

const relays=new Map();
export function getMakeRelay(config) {
  const settings=makeRelayConfig(config);if(!settings)return null;
  if(!relays.has(settings.webAppUrl))relays.set(settings.webAppUrl,new MakeRelay(settings));
  return relays.get(settings.webAppUrl);
}

export async function tryMakeReceipt(receipt,config,relay=getMakeRelay(config)) {
  if(!makeRelayConfig(config)||!relay)return null;
  let packet;try{packet=makeEvent(receipt);}catch{return {provider:'make',status:'failed',reason:'invalid-event'};}
  let result;
  try{result=await relay.send(packet);}catch{return {provider:'make',status:'uncertain',reason:'network'};}
  if(result===null)return null;
  const safe={provider:'make',status:['sent','failed','uncertain','unavailable'].includes(result?.status)?result.status:'uncertain',reason:clean(result?.reason,80)};
  if(safe.status==='sent'&&result?.event_id!==packet.event_id)return {provider:'make',status:'uncertain',reason:'make-response'};
  if(safe.status==='sent'){safe.eventId=packet.event_id;if(result.messageId)safe.messageId=clean(result.messageId,180);}
  return safe;
}

export function makeReceiptMessage(receipt) {
  const reason=receipt?.reason;
  if(reason==='make-queued')return 'Make recibió el aviso y lo dejó en cola. Activa el escenario de DogSpot y luego verifica el envío desde aquí.';
  if(reason==='make-claimed')return 'Este evento ya fue recibido. Revisa el historial de Make y tu correo; verificar de nuevo conserva el mismo identificador y no crea otro envío.';
  if(reason==='make-not-configured')return 'Falta guardar el webhook en las propiedades del proyecto de Apps Script.';
  if(reason==='make-sheet')return 'Falta indicar la hoja de cálculo de Automatizaciones en las propiedades del proyecto de Apps Script.';
  if(reason==='quota'||reason==='queue-full')return 'Make alcanzó un límite temporal. Tu registro o servicio permanece guardado; puedes verificar el envío más tarde.';
  if(reason==='authorization')return 'Make rechazó la autorización del webhook. Revisa la conexión del escenario.';
  if(reason==='configuration'||reason==='invalid-event')return 'Make no pudo procesar los datos del aviso. Revisa la configuración del escenario.';
  return 'El aviso se envió a la conexión de Make, pero todavía no hay confirmación del correo. Revisa Make o tu bandeja y usa Verificar envío; se conservará el mismo evento.';
}
