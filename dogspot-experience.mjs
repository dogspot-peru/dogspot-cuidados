import {isExploration,referencePhoto} from './dogspot-care-demo.mjs?v=4deb738a6f4e';

export const extraCaregivers = [
  {id:'mariana',name:'Mariana Salazar',initials:'MS',photo:'./caregiver-mariana.jpg',courses:['Bienestar y manejo respetuoso de mascotas','Acompañamiento de mascotas en recuperación'],experience:'3 años de experiencia declarada',bio:'Acompañamiento paciente a domicilio, con atención a la alimentación, el descanso y las indicaciones de cada familia.',specialties:['Rutinas de alimentación','Recuperación y reposo','Comunicación con el dueño'],approach:'Organiza cada visita según la ficha de la mascota y comparte el avance de las actividades con fotografías y observaciones claras.',training:'Perfil académico. Certificados y experiencia pendientes de verificación.',availability:{weekdays:[0,1,2,3,4,5,6],start:'07:00',end:'23:00'}},
  {id:'gabriel',name:'Gabriel Rojas',initials:'GR',photo:'./caregiver-gabriel.jpg',courses:['Cuidado y acompañamiento de mascotas mayores','Registro y comunicación de cuidados'],experience:'4 años de experiencia declarada',bio:'Cuidado atento de mascotas adultas y mayores, respetando sus tiempos, su comodidad y las instrucciones del propietario.',specialties:['Mascotas mayores','Higiene y comodidad','Cuidados indicados por el propietario'],approach:'Revisa las instrucciones antes de la visita, registra cada actividad y mantiene informado al dueño durante el cuidado.',training:'Perfil académico. Certificados y experiencia pendientes de verificación.',availability:{weekdays:[0,1,2,3,4,5,6],start:'07:00',end:'23:00'}}
];

const normal = value => String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[¿?¡!.,;:]/g,' ').replace(/\s+/g,' ').trim();
const baseId = task => task.baseId ?? task.id?.split(':')[0];
const when = task => task?.time ?? 'sin hora registrada';
const resultText = task => [...(task?.selections??[]),task?.observation??''].filter(Boolean).join(' ');
const nameOf = state => state.pet?.name ?? state.bookings?.find(b=>b.id===state.currentBookingId)?.petSnapshot?.name ?? state.pets?.find(p=>p.id===state.selectedPetId)?.name ?? 'tu mascota';
const firstName = state => state.user?.name?.trim().split(/\s+/)[0] ?? 'Jefferson';
const latestTask = state => [...state.tasks??[]].filter(t=>t.status==='completada').sort((a,b)=>Date.parse(b.recordedAt??0)-Date.parse(a.recordedAt??0))[0];
const taskFor = (state,id) => [...state.tasks??[]].reverse().find(t=>baseId(t)===id&&t.status==='completada') ?? state.tasks?.find(t=>baseId(t)===id);
const taskIntent = q => /comi|comio|comer|alimento|alimentacion|comida/.test(q)?'feeding':/agua|hidrat|bebio|bebiendo/.test(q)?'water':/medic|pastilla|tableta|dosis/.test(q)?'meds':/dorm|descans|reposo|sueno/.test(q)?'rest':/animo|comporta|juega|jugar|triste|content/.test(q)?'mood':/orina|defeca|necesidad|bano|higiene/.test(q)?'pee':/cuidado especial|manta|comodidad/.test(q)?'care':null;

export function ownerStatus(state) {
  const tasks=state.tasks??[],completed=tasks.filter(t=>t.status==='completada'),current=tasks.find(t=>t.status==='progreso'),latest=latestTask(state),next=tasks.find(t=>t.status==='pendiente');
  const focus=current??latest;
  const photo=focus?.evidence ?? (focus?.demoReference?referencePhoto(state.pet??state.pets?.find(p=>p.id===state.selectedPetId),focus):null);
  return {completed:completed.length,total:tasks.length,current,latest,next,focus,photo,
    title:state.active?.status==='finalizado'?'Cuidado finalizado':current?`${current.label} en curso`:latest?`${latest.label} registrada`:'Esperando el inicio del cuidado',
    description:current?`El siguiente registro de ${nameOf(state)} aparecerá al completar esta actividad.`:latest?resultText(latest):'Aquí verás cómo avanza su cuidado, la actividad actual y la última fotografía.',
    indicators:['feeding','water','meds','rest'].map(id=>({id,task:taskFor(state,id)})).filter(item=>item.task)};
}

function activityAnswer(state,id) {
  const task=taskFor(state,id),name=nameOf(state);
  if(!task)return {text:`${name} no tiene esa indicación registrada para este servicio. Si la necesita, añádela a su ficha antes de reservar.`,action:{label:'Ver seguimiento',s:'tracking'}};
  if(task.status==='completada')return {text:`Sí, ya hay un registro de ${task.label.toLowerCase()} de ${name} a las ${when(task)}. ${resultText(task)}`,image:task.evidence,demoReference:task.demoReference,action:{label:'Ver este cuidado',s:'tracking'}};
  if(task.status==='progreso')return {text:`Ahora mismo está en progreso: ${task.label.toLowerCase()}. Cuando se complete verás su resultado y la fotografía en el seguimiento.`,action:{label:'Ver estado actual',s:'tracking'}};
  return {text:`Todavía no hay un registro completado de ${task.label.toLowerCase()} de ${name}. Está pendiente en el plan de cuidado; te avisaremos cuando se registre.`,action:{label:'Ver tareas pendientes',s:'tracking'}};
}

export function assistantReply(message,state,caregivers=[]) {
  const q=normal(message),name=nameOf(state),first=firstName(state),status=ownerStatus(state),caregiver=caregivers.find(c=>c.id===state.caregiverId);
  if(/emergencia|no (puede )?respirar|convulsion|desmay|sangrado|se ahoga/.test(q))return {text:`Si ${name} presenta una emergencia, contacta de inmediato al cuidador y a un veterinario. Puedo abrir la ayuda de emergencia.`,action:{label:'Abrir emergencia',emergency:true}};
  const intent=taskIntent(q);
  if(intent)return activityAnswer(state,intent);
  if(/foto|imagen|fotografia|video/.test(q)) {
    const task=latestTask(state);
    return task?.evidence?{text:`Esta es la última fotografía de ${name} en el seguimiento: ${task.label}, ${when(task)}.`,image:task.evidence,demoReference:task.demoReference,action:{label:'Abrir historial de fotos',s:'tracking'}}:{text:`Aún no hay una foto de una actividad completada de ${name}. Aparecerá cuando se registre el primer cuidado.`,action:{label:'Ver seguimiento',s:'tracking'}};
  }
  if(/como (esta|va|sigue|se encuentra)\b|estado|mi mascota|mi perro|mi perrita|mi gat|seguimiento|novedad/.test(q)||q===normal(name)) {
    const text=state.active?.status==='finalizado'?`El cuidado de ${name} ya terminó. Se registraron ${status.completed} de ${status.total} actividades. Puedes revisar las fotos y el resumen final.`:status.current?`Ahora están realizando ${status.current.label.toLowerCase()} con ${name}. Ya van ${status.completed} de ${status.total} actividades completadas.${status.latest?` El último registro fue ${status.latest.label.toLowerCase()} a las ${when(status.latest)}.`:''}`:status.latest?`El último avance de ${name} es ${status.latest.label.toLowerCase()}, a las ${when(status.latest)}. ${resultText(status.latest)} Ya van ${status.completed} de ${status.total} actividades.`:`Aún no hay actividades registradas de ${name}. Cuando comience el cuidado podrás ver su estado y las fotos aquí.`;
    return {text,action:{label:'Ver estado de '+name,s:'tracking'}};
  }
  if(/que sigue|siguiente|falta|pendiente|termina|finaliza/.test(q))return {text:status.next?`La siguiente actividad pendiente de ${name} es ${status.next.label.toLowerCase()}. Ya hay ${status.completed} de ${status.total} actividades completadas.`:`Ya se completaron las actividades registradas. Puedes consultar el resumen del cuidado de ${name}.`,action:{label:status.next?'Ver plan de cuidado':'Ver resumen',s:status.next?'tracking':'summary'}};
  if(/precio|cuanto|costo|tarifa|cobran|pago|yape|plin/.test(q))return {text:'El cuidado cuesta S/35 por hora, con visitas de 2 a 8 horas. Por ejemplo, 2 horas son S/70 y 4 horas son S/140. También puedes elegir varias jornadas con su propio horario. El traslado dentro de la cobertura está incluido.',action:{label:'Elegir fecha y horario',s:'hire'}};
  if(/contrat|reserv|fecha|horario|disponib/.test(q))return {text:`Puedes elegir la fecha, el horario y la persona que cuidará a ${name}. Hay cinco perfiles disponibles y puedes comparar su experiencia declarada, sus horarios y sus reseñas antes de elegir.`,action:{label:'Reservar cuidado',s:'hire'}};
  if(/cuidador|quien (cuida|esta con|es el)|persona|contact|llamar|mensaje|hablar con/.test(q))return {text:caregiver?`${caregiver.name} es la persona elegida para el cuidado de ${name}. ${caregiver.bio} ¿Quieres abrir su conversación?`:'Puedes comparar los cinco perfiles al contratar y elegir al cuidador que mejor se adapte a tu horario.',action:{label:caregiver?'Hablar con '+caregiver.name.split(' ')[0]:'Ver cuidadores',s:caregiver?'messages':'hire'}};
  if(/trujillo|donde|cobertura|ciudad/.test(q))return {text:'DogSpot está orientado al cuidado a domicilio en Trujillo. Antes de confirmar, revisa la dirección, las referencias y el horario de tu reserva.',action:{label:'Ver mi perfil',s:'profile'}};
  if(/gracias|muchas gracias|te agradezco/.test(q))return {text:`De nada, ${first}. Aquí estoy para ayudarte con ${name}. Puedes preguntarme por su comida, el agua, las fotos o el siguiente cuidado.`};
  if(/como estas|que tal|como te va|todo bien/.test(q))return {text:`Todo bien, ${first}, gracias por preguntar. Estoy lista para ayudarte. ¿Quieres que revisemos cómo va ${name} o necesitas organizar un servicio?`};
  if(/^(hola|holi|buenas|buenos dias|buenas tardes|buenas noches|hey|buen dia)( |$)/.test(q))return {text:`Hola, ${first}. Soy ABY. Qué gusto verte por aquí. ¿Quieres saber cómo va ${name}, mirar sus fotos o reservar un cuidado?`};
  if(/quien eres|que haces|que puedes|ayuda|ayudame/.test(q))return {text:`Soy ABY, tu ayudante en DogSpot. Puedo revisar los registros de ${name}, decirte qué cuidado está en curso, mostrarte la última foto, orientarte con los precios y abrir el chat de tu cuidador. ¿Qué necesitas ahora?`};
  if(/adios|hasta luego|nos vemos|chau/.test(q))return {text:`Hasta luego, ${first}. Cuando regreses podemos revisar los avances de ${name}.`};
  return {text:`Cuéntame un poquito más, ${first}. ¿Quieres consultar el estado de ${name}, alguna actividad, sus fotografías o una reserva? Por ejemplo: “¿ya comió?” o “¿qué cuidado falta?”.`};
}

export function caregiverReply(message,state,caregivers=[]) {
  const q=normal(message),caregiver=caregivers.find(c=>c.id===state.caregiverId),name=nameOf(state),first=caregiver?.name.split(' ')[0]??'tu cuidador';
  const answer=assistantReply(message,state,caregivers);
  if(/^(hola|buenas|buenos dias|buenas tardes|buenas noches)( |$)/.test(q))return {text:`Hola, ${firstName(state)}. Soy ${first}. Por aquí puedes preguntarme cómo va ${name} o dejar una indicación para su cuidado.`};
  if(/gracias/.test(q))return {text:`Con gusto. Seguiremos compartiendo los avances de ${name} por aquí para que puedas revisarlos.`};
  if(/no le|por favor|recuerda|ten cuidado|indicacion|dale|avisame|mantener/.test(q))return {text:`Gracias por avisarme. La indicación queda escrita en esta conversación de ${name}: “${message.trim()}”.`};
  if(taskIntent(q)||/foto|imagen|como (esta|va|sigue)\b|estado|siguiente|que sigue|falta/.test(q))return {...answer,action:undefined};
  if(/que tal|como estas/.test(q))return {text:`Bien, gracias. Por aquí pendiente del seguimiento de ${name}. ¿Hay algo en particular que quieras revisar?`};
  return {text:`Te leo, ${firstName(state)}. Puedes dejarme la indicación concreta o preguntarme por la alimentación, el descanso o la última foto de ${name}.`};
}

export function createExperience(React,useState,caregivers,ui={}) {
  const h=React.createElement;
  const C={ink:'#20314f',muted:'#65768b',aqua:'#58b4dc',pale:'#edf7ff',border:'#d8e6ef',lavender:'#f3edff'};
  const card=(children,style={})=>h('section',{style:{padding:16,border:'1px solid '+C.border,borderRadius:22,background:'#fff',...style}},children);
  const btn=(label,onClick,style={},disabled=false)=>h('button',{type:'button',onClick,disabled,style:{minHeight:44,borderRadius:14,padding:'10px 12px',fontSize:13,fontWeight:800,border:'1px solid '+C.border,color:C.ink,background:C.pale,cursor:'pointer',opacity:disabled?.45:1,...style}},label);
  const heading=(title,back,right)=>h('header',{style:{display:'flex',alignItems:'center',gap:10,padding:'14px 20px'}},btn('←',back,{width:40,minHeight:40,padding:8}),h('h1',{style:{fontFamily:'Baloo 2,system-ui',fontSize:24,fontWeight:800,flex:1,margin:0}},title),right);
  const text=(value,style={})=>h('p',{style:{margin:'6px 0',fontSize:13,lineHeight:1.55,...style}},value);
  const image=(task,style={})=>task?.evidence?h(task.mediaType==='video'?'video':'img',{src:task.evidence,alt:task.demoReference?'Foto de referencia: '+task.label:'Registro de '+task.label,controls:task.mediaType==='video'||undefined,loading:'lazy',style:{width:'100%',aspectRatio:'4/3',objectFit:'cover',borderRadius:16,...style}}):null;
  const badge=(label,background=C.pale)=>h('span',{style:{display:'inline-block',fontSize:11,fontWeight:800,padding:'5px 9px',borderRadius:20,background}},label);
  const stateLabel=t=>t?.status==='completada'?'Registrado':t?.status==='progreso'?'En progreso':'Pendiente';
  const caregiverFor=state=>caregivers.find(c=>c.id===state.caregiverId)??caregivers[0];
  const stackStyle={display:'grid',gap:12,padding:'0 20px 20px'};

  function Status({state,onEvidence}) {
    const model=ownerStatus(state),name=nameOf(state),caregiver=caregiverFor(state);
    const visual=model.photo??(isExploration(state)?referencePhoto(state.pet??state.pets?.[0],{id:'care'}):null);
    return h('div',{style:{display:'grid',gap:12},'aria-label':'Estado actual de la mascota'},
      card([h('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}},h('h2',{style:{margin:0,fontSize:22,fontWeight:900}},'Así va '+name),badge(state.active.status==='finalizado'?'Finalizado':state.active.status==='confirmado'?'Por iniciar':'En cuidado')),
        text('Actividad actual',{fontSize:11,textTransform:'uppercase',color:C.muted,marginTop:12}),h('h3',{style:{fontSize:18,fontWeight:900,margin:'3px 0 10px'}},model.title),
        visual&&h('button',{type:'button',onClick:()=>model.focus?.evidence&&onEvidence(model.focus.id),disabled:!model.focus?.evidence,style:{display:'block',width:'100%',padding:0,border:0,background:'transparent'}},h('img',{src:visual,alt:'Estado actual de '+name,style:{width:'100%',aspectRatio:'4/3',objectFit:'cover',borderRadius:17}})),
        text(model.description),visual&&isExploration(state)&&text('Fotografía de referencia del recorrido académico',{fontSize:10,color:C.muted}),
        text(model.focus?`Actualizado a las ${when(model.focus)} · ${caregiver.name}`:'Las actualizaciones aparecerán al iniciar el cuidado.',{fontSize:11,color:C.muted})]),
      h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}},...model.indicators.map(({id,task})=>card([text(({feeding:'Alimentación',water:'Hidratación',meds:'Medicamento',rest:'Descanso'})[id],{fontWeight:900,margin:0}),text(stateLabel(task),{fontWeight:800,color:task.status==='completada'?'#22735e':C.muted}),task.time&&text(task.time,{fontSize:11,color:C.muted})],{padding:13}))),
      card([h('h3',{style:{fontSize:16,fontWeight:900,margin:0}},state.active.status==='finalizado'?'Reporte del cuidado':'Próximo cuidado'),text(state.active.status==='finalizado'?`${model.completed} actividades completadas. Revisa las fotografías y el resumen de la jornada.`:model.next?.label??'No quedan tareas pendientes.'),model.next?.demoStartAt&&text(new Date(model.next.demoStartAt).toLocaleTimeString('es-PE',{timeZone:'America/Lima',hour:'numeric',minute:'2-digit'}),{color:C.muted,fontSize:12}),btn(state.active.status==='finalizado'?'Ver resumen':'Ver todas las tareas',()=>state.active.status==='finalizado'?state.go('summary'):state.set({trackingTab:'cuidados'}))]),
      h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}},btn('Hablar con '+caregiver.name.split(' ')[0],()=>state.go('messages')),btn('Preguntar a ABY',()=>state.go('assistant'))));
  }

  function Tracking({onEvidence,onEmergency}) {
    const state=useState(),model=ownerStatus(state),caregiver=caregiverFor(state),tab=state.trackingTab??'estado';
    const history=[...state.tasks].filter(t=>t.time||t.recordedAt).sort((a,b)=>Date.parse(b.recordedAt??0)-Date.parse(a.recordedAt??0));
    return h('div',null,heading('Seguimiento',()=>state.go('active')),h('div',{style:stackStyle},
      card([h('div',{style:{display:'flex',alignItems:'center',gap:10}},h('img',{src:caregiver.photo==='ana'?'./ana-torres-wTL3UHn2.jpg':caregiver.photo,alt:caregiver.name,style:{width:44,height:44,objectFit:'cover',borderRadius:14}}),h('div',null,text(nameOf(state),{fontWeight:900,fontSize:20,margin:0}),text('Al cuidado de '+caregiver.name,{fontSize:12,color:C.muted,margin:0}))),text(`${model.completed} de ${model.total} actividades completadas`,{fontWeight:800}),h('div',{role:'progressbar','aria-label':'Actividades del cuidado','aria-valuemin':0,'aria-valuemax':Math.max(1,model.total),'aria-valuenow':model.completed,style:{height:7,borderRadius:10,background:'#e5edf4',overflow:'hidden'}},h('div',{style:{height:'100%',width:`${model.total?model.completed/model.total*100:0}%`,background:C.aqua}}))]),
      h('nav',{'aria-label':'Vistas del seguimiento',style:{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:4,padding:5,borderRadius:18,background:'#e6f2fc',position:'sticky',top:0,zIndex:4}},...['estado','actualizaciones','cuidados'].map(id=>btn(({estado:'Estado',actualizaciones:'Actualizaciones',cuidados:'Cuidados'})[id],()=>state.set({trackingTab:id}),{padding:'8px 3px',fontSize:12,background:tab===id?'#fff':'transparent',border:0,boxShadow:tab===id?'0 2px 8px #20314f12':'none'}))),
      tab==='estado'&&h(Status,{state,onEvidence}),
      tab==='actualizaciones'&&h('section',{'aria-label':'Historial de actividades',style:{display:'grid',gap:12}},h('h2',{style:{fontSize:19,fontWeight:900,margin:'3px 0'}},'Historial de '+nameOf(state)),!history.length&&card(text('Todavía no hay avances. Al iniciar el cuidado verás aquí cada actividad con su hora y fotografía.')), ...history.map(task=>card([h('div',{style:{display:'flex',justifyContent:'space-between',gap:8}},text(task.time??'',{fontSize:11,color:C.muted,margin:0}),badge(stateLabel(task),task.status==='completada'?'#e8f7ee':C.lavender)),h('h3',{style:{fontSize:17,fontWeight:900,margin:'8px 0'}},task.label),task.evidence&&h('button',{type:'button','aria-label':'Ver foto de '+task.label,onClick:()=>onEvidence(task.id),style:{padding:0,border:0,width:'100%',background:'transparent'}},image(task)),text(resultText(task)||'Actividad en progreso.'),task.demoReference&&text('Foto de referencia · Recorrido académico',{fontSize:10,color:C.muted}),task.evidence&&btn('Ampliar fotografía',()=>onEvidence(task.id))]))),
      tab==='cuidados'&&h('section',{'aria-label':'Plan del cuidado',style:{display:'grid',gap:10}},h('h2',{style:{fontSize:19,fontWeight:900,margin:'3px 0'}},'Plan de cuidado'),...state.tasks.map(task=>card([h('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}},h('div',null,text(task.label,{fontWeight:900,margin:0}),text(task.time??'Aún sin registro',{fontSize:11,color:C.muted})),badge(stateLabel(task))),task.status==='completada'&&text(resultText(task),{fontSize:12}),task.evidence&&btn('Ver fotografía',()=>onEvidence(task.id))],{padding:14}))),
      btn(state.notificationSound?'Sonidos de tareas: activados':'Sonidos de tareas: desactivados',()=>{state.set({notificationSound:!state.notificationSound});if(!state.notificationSound)ui.enableSound?.();},{fontSize:12}),
      h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}},btn('Mensaje al cuidador',()=>state.go('messages')),btn('Emergencia',onEmergency,{background:'#fff0ef',color:'#a34242'})),
      text(isExploration(state)?'Vista del dueño · Recorrido académico con fotografías por actividad.':'Los registros y sus archivos se conservan en este dispositivo.',{fontSize:11,color:C.muted})));
  }

  function Active({open}) {
    const state=useState(),caregiver=caregiverFor(state),booking=state.bookings.find(b=>b.id===state.currentBookingId),[showProfile,setShowProfile]=React.useState(false);
    return h('div',null,heading('Tu servicio',()=>state.go('home')),h('div',{style:stackStyle},
      card([h('h2',{style:{fontSize:24,fontWeight:900,margin:0}},nameOf(state)),text('Cuidador: '+caregiver.name),text(booking?`${booking.date} · ${booking.start} – ${booking.end}`:'Horario inicial: 2:00 p. m. – 6:00 p. m.'),badge(state.active.status==='finalizado'?'Finalizado':state.active.status==='activo'?'En curso':'Confirmado')]),
      state.active.status==='confirmado'&&btn('Demo inicial: iniciar cuidado y seguimiento',()=>{state.startService();state.set({screen:'tracking',trackingTab:'estado'});},{background:C.aqua,color:'#fff'}),
      btn('Ver estado de '+nameOf(state),()=>state.set({screen:'tracking',trackingTab:'estado'}),{background:C.aqua,color:'#fff'}),
      btn('Historial y fotografías',()=>state.set({screen:'tracking',trackingTab:'actualizaciones'})),
      h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}},btn('Mensaje a '+caregiver.name.split(' ')[0],()=>state.go('messages')),btn('Consultar a ABY',()=>state.go('assistant'))),
      btn('Ver perfil de '+caregiver.name,()=>setShowProfile(!showProfile)),
      showProfile&&card([h('img',{src:caregiver.photo==='ana'?'./ana-torres-wTL3UHn2.jpg':caregiver.photo,alt:caregiver.name,style:{width:70,height:70,objectFit:'cover',borderRadius:20}}),h('h3',{style:{fontSize:18,fontWeight:900,margin:'8px 0'}},caregiver.name),text(caregiver.bio),text(caregiver.experience,{fontWeight:800}),...caregiver.courses.map(course=>text('• '+course,{fontSize:12})),text(caregiver.training,{fontSize:10,color:C.muted})]),
      state.active.status==='finalizado'&&btn('Ver resumen final',()=>state.go('summary')),
      btn('Emergencia',()=>open('emergency'),{background:'#fff0ef',color:'#a34242'})));
  }

  function Assistant({open}) {
    const state=useState(),[input,setInput]=React.useState(''),[typing,setTyping]=React.useState(false),end=React.useRef(null),timer=React.useRef(null);
    const messages=state.assistantMessages??[{from:'bot',text:`Hola, ${firstName(state)}. Soy ABY. Puedo ayudarte a revisar cómo va ${nameOf(state)}, mirar sus fotos o elegir un servicio. ¿Qué necesitas?`}];
    React.useEffect(()=>{end.current?.scrollIntoView({behavior:'smooth'});},[messages.length,typing]);
    React.useEffect(()=>()=>clearTimeout(timer.current),[]);
    const send=value=>{
      const valueText=value.trim();if(!valueText||typing)return;
      const reply=assistantReply(valueText,state,caregivers);
      const outgoing=[...messages,{from:'user',text:valueText}];
      state.set({assistantMessages:outgoing});setInput('');setTyping(true);ui.recordMessage?.(valueText,state,'ABY');
      timer.current=setTimeout(()=>{state.set(current=>({assistantMessages:[...(current.assistantMessages??outgoing),{from:'bot',...reply}]}));setTyping(false);},450);
    };
    return h('div',{style:{display:'flex',flexDirection:'column',minHeight:'100%'}},heading('ABY',()=>state.go('home')),
      h('div',{style:{padding:'0 20px 12px'}},card([h('div',{style:{display:'flex',alignItems:'center',gap:12}},h('img',{src:'./aby.png',alt:'ABY',style:{width:58,height:58,objectFit:'cover',borderRadius:20}}),h('div',null,h('h2',{style:{margin:0,fontSize:21,fontWeight:900}},'Hola, soy ABY'),text('Tu ayudante para cuidar de quien más quieres.',{fontSize:12,margin:0}))),text('Conversación basada en la información de DogSpot y los registros de tu mascota.',{fontSize:10,color:C.muted})],{background:C.lavender})),
      h('div',{role:'log','aria-label':'Conversación con ABY','aria-live':'polite',style:{display:'grid',gap:13,padding:'0 20px',flex:1}},...messages.map((message,index)=>h('div',{key:index,style:{display:'flex',justifyContent:message.from==='user'?'flex-end':'flex-start'}},h('div',{style:{maxWidth:'90%',padding:'12px 14px',borderRadius:18,background:message.from==='user'?'#dcefff':'#f5f6fb',fontSize:13,lineHeight:1.6}},text(message.text,{margin:0}),message.image&&h('img',{src:message.image,alt:'Fotografía del seguimiento',loading:'lazy',style:{width:'100%',borderRadius:12,marginTop:10}}),message.image&&message.demoReference&&text('Foto de referencia del recorrido',{fontSize:10,color:C.muted}),message.action&&btn(message.action.label,()=>message.action.emergency?open('emergency'):state.go(message.action.s),{marginTop:10,fontSize:12})))),typing&&text('ABY está escribiendo…',{color:C.muted,fontSize:12}),h('div',{ref:end})),
      h('div',{style:{position:'sticky',bottom:0,padding:'12px 16px',background:'#fff'}},h('div',{style:{display:'flex',gap:7,overflowX:'auto',paddingBottom:8}},...['Hola','¿Cómo está mi mascota?','¿Ya comió?','Muéstrame una foto','¿Cuánto cuesta?'].map(q=>btn(q,()=>send(q),{minHeight:34,padding:'6px 10px',fontSize:11,whiteSpace:'nowrap',flexShrink:0},typing))),h('form',{onSubmit:e=>{e.preventDefault();send(input);},style:{display:'flex',gap:8}},h('input',{'aria-label':'Pregunta para ABY',placeholder:'Escribe tu pregunta…',value:input,maxLength:2000,onChange:e=>setInput(e.target.value),style:{minWidth:0,flex:1,border:'1px solid '+C.border,borderRadius:14,padding:'12px',fontSize:13}}),h('button',{'aria-label':'Enviar a ABY',disabled:!input.trim()||typing,type:'submit',style:{border:0,borderRadius:14,padding:'10px 14px',background:C.aqua,color:C.ink,fontWeight:900}},'Enviar'))));
  }

  function Messages({open}) {
    const state=useState(),caregiver=caregiverFor(state),[input,setInput]=React.useState(''),[typing,setTyping]=React.useState(false),timer=React.useRef(null),end=React.useRef(null),academic=isExploration(state);
    const messages=state.messages.filter(m=>m.from!=='ai');
    React.useEffect(()=>{end.current?.scrollIntoView({behavior:'smooth'});},[messages.length,typing]);
    React.useEffect(()=>()=>clearTimeout(timer.current),[]);
    const send=value=>{
      const valueText=value.trim();if(!valueText||typing)return;
      const bookingId=state.currentBookingId;
      state.set(current=>({messages:[...current.messages,{id:crypto.randomUUID(),from:'user',text:valueText,time:new Date().toLocaleTimeString('es-PE',{timeZone:'America/Lima',hour:'numeric',minute:'2-digit'})}]}));setInput('');
      if(academic){setTyping(true);timer.current=setTimeout(()=>{state.set(current=>current.currentBookingId===bookingId?{messages:[...current.messages,{id:crypto.randomUUID(),from:'caregiver',...caregiverReply(valueText,current,caregivers),time:new Date().toLocaleTimeString('es-PE',{timeZone:'America/Lima',hour:'numeric',minute:'2-digit'})}]}:{});setTyping(false);},550);}
    };
    return h('div',{style:{minHeight:'100%',display:'flex',flexDirection:'column'}},heading(caregiver.name,()=>state.go('home')),
      h('div',{style:{padding:'0 20px 12px'}},card([text('Chat del cuidado de '+nameOf(state),{fontWeight:900,margin:0}),text(academic?'Vista del dueño · Conversación del recorrido académico':'Vista del dueño · Mensajes guardados en este dispositivo',{fontSize:11,color:C.muted})])),
      h('div',{role:'log','aria-label':'Conversación con el cuidador','aria-live':'polite',style:{display:'grid',gap:12,padding:'0 20px',flex:1}},!messages.length&&text(`Hola, puedes escribir a ${caregiver.name.split(' ')[0]} para consultar por ${nameOf(state)}.`),...messages.map((message,index)=>h('div',{key:message.id??index,style:{display:'flex',justifyContent:message.from==='user'?'flex-end':'flex-start'}},h('div',{style:{maxWidth:'90%',borderRadius:18,padding:'12px 14px',fontSize:13,lineHeight:1.55,background:message.from==='user'?'#dcefff':'#f0f8f5'}},text(message.from==='user'?'Tú':caregiver.name,{fontSize:10,fontWeight:900,margin:'0 0 4px'}),text(message.text,{margin:0}),message.image&&h('img',{src:message.image,alt:'Foto compartida en el seguimiento',loading:'lazy',style:{width:'100%',borderRadius:12,marginTop:9}}),message.image&&academic&&text('Foto de referencia del recorrido',{fontSize:10,color:C.muted}),text(message.time??'',{fontSize:10,color:C.muted,margin:'5px 0 0'})))),typing&&text(caregiver.name.split(' ')[0]+' está escribiendo…',{fontSize:12,color:C.muted}),h('div',{ref:end})),
      h('div',{style:{position:'sticky',bottom:0,padding:'12px 16px',background:'#fff'}},h('div',{style:{display:'flex',gap:7,overflowX:'auto',paddingBottom:8}},...['Hola','¿Cómo está Luna?','¿Ya comió?','¿Me mandas una foto?'].map(q=>btn(q.replace('Luna',nameOf(state)),()=>send(q.replace('Luna',nameOf(state))),{minHeight:34,padding:'6px 10px',fontSize:11,whiteSpace:'nowrap',flexShrink:0},typing))),h('form',{onSubmit:e=>{e.preventDefault();send(input);},style:{display:'flex',gap:8}},h('input',{'aria-label':'Mensaje al cuidador',placeholder:'Escribe tu mensaje…',maxLength:2000,value:input,onChange:e=>setInput(e.target.value),style:{minWidth:0,flex:1,border:'1px solid '+C.border,borderRadius:14,padding:12,fontSize:13}}),h('button',{'aria-label':'Enviar mensaje',disabled:!input.trim()||typing,type:'submit',style:{border:0,borderRadius:14,padding:'10px 14px',background:C.aqua,fontWeight:900}},'Enviar')),btn('Consultar a ABY',()=>state.go('assistant'),{width:'100%',marginTop:8,fontSize:11,minHeight:32,padding:5,background:'transparent'})));
  }
  return {Tracking,Active,Assistant,Messages};
}
