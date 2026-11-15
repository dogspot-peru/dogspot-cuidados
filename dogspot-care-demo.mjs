// Accelerated care walkthrough, isolated from personal accounts and their records.
export const DEMO_INTERVAL_MS = 5000;
export const EXPLORATION_KEY = 'dogspot-exploration-v1';
const personal = state => !!state.user?.email && state.user.email.toLowerCase() !== 'usuario@dogspot.pe';
export const isExploration = state => state.exploration === true || !personal(state);
export const validDemo = (demo,tasks) => !!(demo && demo.version === 1 && typeof demo.runId === 'string' && Number.isInteger(demo.phase) && demo.phase >= 0 && demo.phase <= tasks.length*2 && Number.isFinite(Date.parse(demo.clockAt)) && tasks.length && tasks.every(t=>Number.isFinite(Date.parse(t.demoStartAt)) && Number.isFinite(Date.parse(t.demoEndAt))));
const clock = iso => new Date(iso).toLocaleTimeString('es-PE', {timeZone:'America/Lima', hour:'2-digit', minute:'2-digit', hour12:true});
const dateLabel = iso => new Date(iso).toLocaleDateString('es-PE', {timeZone:'America/Lima', day:'2-digit', month:'2-digit', year:'numeric'});
const dateToday = () => new Intl.DateTimeFormat('en-CA', {timeZone:'America/Lima', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date());
const descriptions = {
  feeding: 'Aceptó la porción de alimento indicada por su propietario.',
  water: 'Se renovó el agua y se observó su hidratación.',
  meds: 'Se registró el cumplimiento de la indicación proporcionada por el propietario.',
  pee: 'Se realizó la limpieza y se registraron sus necesidades.',
  mood: 'Se observó un comportamiento tranquilo durante el acompañamiento.',
  rest: 'Descansó en un espacio cómodo, respetando la indicación de reposo.',
  care: 'Se siguieron los cuidados especiales de su ficha.',
  notes: 'Se completó la revisión de la jornada y el reporte para el propietario.'
};

function sessionsFor(booking) {
  const raw = booking?.sessions?.length ? booking.sessions : booking?.date && booking?.start && booking?.end ? [booking] : [{date:dateToday(), start:'14:00', end:'18:00'}];
  return raw.filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s.date) && /^\d{2}:\d{2}$/.test(s.start) && /^\d{2}:\d{2}$/.test(s.end))
    .map(s => ({date:s.date, start:s.start, end:s.end, from:Date.parse(`${s.date}T${s.start}:00-05:00`), to:Date.parse(`${s.date}T${s.end}:00-05:00`)}))
    .filter(s => Number.isFinite(s.from) && s.to > s.from).sort((a,b) => a.from-b.from);
}

export function startDemo(state, template, now = Date.now()) {
  if (!isExploration(state)) return {};
  const booking = state.bookings.find(b => b.id === state.currentBookingId);
  const pet = booking?.petSnapshot ?? state.pets.find(p => p.id === (booking?.petId ?? state.selectedPetId));
  const hasMedication = !!pet?.meds?.trim() && !/^no aplica$/i.test(pet.meds.trim());
  const tasks = template.filter(t => t.id !== 'meds' || hasMedication);
  const sessions = sessionsFor(booking);
  if (!sessions.length || !tasks.length) return {};
  const plan = sessions.flatMap((session, visit) => tasks.map((task, index) => ({
    id:sessions.length === 1 ? task.id : `${task.id}:visit:${visit}`, baseId:task.id,
    label:sessions.length === 1 ? task.label : `${task.label} · Jornada ${visit+1}`,
    status:'pendiente', visit,
    demoStartAt:new Date(session.from + (session.to-session.from) * index/tasks.length).toISOString(),
    demoEndAt:new Date(session.from + (session.to-session.from) * (index+1)/tasks.length).toISOString()
  })));
  const runId = `care-demo:${state.currentBookingId ?? 'initial'}:${now}`;
  return {tasks:plan, careDemo:{version:1,runId,phase:0,running:true,nextAt:now+DEMO_INTERVAL_MS,clockAt:new Date(sessions[0].from).toISOString(),sessions,finished:false},
    active:{...state.active,status:'activo',rated:false,rating:undefined,comment:undefined},
    bookings:state.bookings.map(b => b.id === state.currentBookingId ? {...b,status:'activo',updatedAt:new Date(now).toISOString()} : b),
    messages:[], trackingTab:'actualizaciones',
    notifications:[{id:`${runId}:start`,time:clock(plan[0].demoStartAt),text:'Inicio del recorrido de cuidado. Verás cada actividad, su horario y su fotografía de referencia.',read:false,tab:'actualizaciones',kind:'demo-started',bookingId:state.currentBookingId ?? 'demo-service'}]
  };
}

function referencePhoto(pet) {
  if (pet?.photo?.trim()) return pet.photo;
  const species = (pet?.species ?? '').toLowerCase();
  return species.includes('gato') ? './cat-reference.png' : species.includes('conejo') ? './rabbit-reference.png' : /ave|pájaro|pajaro/.test(species) ? './bird-reference.png' : species.includes('perro') ? './luna-evidence-wZL0x3gy.jpg' : './other-reference.svg';
}

export function advanceDemo(state, now = Date.now(), force = false) {
  const demo = state.careDemo;
  if (!isExploration(state) || !validDemo(demo,state.tasks) || demo.finished || state.active.status !== 'activo' || (!demo.running && !force) || (!force && now < demo.nextAt)) return {};
  const index = Math.floor(demo.phase/2);
  const task = state.tasks[index];
  if (!task) return {careDemo:{...demo,running:false,finished:true}};
  const completed = demo.phase % 2 === 1;
  const booking = state.bookings.find(b => b.id === state.currentBookingId);
  const pet = booking?.petSnapshot ?? state.pets.find(p => p.id === state.selectedPetId);
  const scheduled = completed ? task.demoEndAt : task.demoStartAt;
  const phase = demo.phase+1;
  const finished = phase >= state.tasks.length*2;
  const result = {...task,status:completed?'completada':'progreso',time:clock(scheduled),recordedAt:scheduled,capturedAt:new Date(now).toISOString(),demoReference:true,bookingId:state.currentBookingId ?? 'demo-service',caregiverId:state.caregiverId};
  if (completed) Object.assign(result,{selections:[descriptions[task.baseId ?? task.id] ?? 'Actividad registrada.'],evidence:referencePhoto(pet),mediaType:'photo'});
  const notification = {id:`${demo.runId}:${phase}`,time:clock(scheduled),text:`${completed?'Actividad completada':'Actividad en progreso'}: ${task.label}.${completed?' Fotografía de referencia disponible.':''}`,read:false,tab:'actualizaciones',kind:completed?'task-completed':'task-started',bookingId:state.currentBookingId ?? 'demo-service'};
  const messages = completed ? [...state.messages,{id:`${demo.runId}:message:${phase}`,from:'caregiver',text:`${pet?.name ?? 'Tu mascota'} · ${task.label}: ${descriptions[task.baseId ?? task.id] ?? 'Actividad registrada.'}`,time:clock(scheduled),image:result.evidence}] : state.messages;
  const notifications = [notification,...state.notifications];
  if (finished) notifications.unshift({id:`${demo.runId}:finished`,time:clock(scheduled),text:'Servicio finalizado. Gracias por confiar en DogSpot. Ya puedes revisar el resumen, las fotografías y calificar el cuidado.',read:false,tab:'actualizaciones',kind:'service-completed',bookingId:state.currentBookingId ?? 'demo-service'});
  return {tasks:state.tasks.map((t,i)=>i===index?result:t),messages,notifications,
    careDemo:{...demo,phase,clockAt:scheduled,nextAt:now+DEMO_INTERVAL_MS,running:demo.running&&!finished,finished},
    ...(finished?{active:{...state.active,status:'finalizado'},bookings:state.bookings.map(b=>b.id===state.currentBookingId?{...b,status:'finalizado',updatedAt:new Date(now).toISOString()}:b)}:{})};
}

export function renderDemoPanel(React, state, template) {
  if (!isExploration(state) || !['home','active','tracking','summary','confirm'].includes(state.screen)) return null;
  const h = React.createElement;
  const demo = validDemo(state.careDemo,state.tasks) ? state.careDemo : null;
  const done = state.tasks.filter(t=>t.status==='completada').length;
  const selected = state.tasks.find(t=>t.status==='progreso');
  const buttonStyle = {minHeight:40,borderRadius:14,border:'1px solid #adcadb',background:'#fff',padding:'8px 10px',fontWeight:800,color:'#20314f',fontSize:12,cursor:'pointer'};
  const button = (label,onClick,disabled=false) => h('button',{type:'button',style:{...buttonStyle,opacity:disabled?.45:1},onClick,disabled},label);
  const start = () => state.set(current=>({...startDemo(current,template()),screen:'tracking'}));
  return h('section',{'aria-label':'Recorrido de cuidado',style:{margin:'12px 20px',padding:14,border:'1px solid #bdd5e6',borderRadius:22,background:'#edf6ff',color:'#20314f'}},
    h('p',{style:{margin:'0 0 5px',fontWeight:900,fontSize:14}},'Demo inicial · Cuidado y seguimiento'),
    h('p',{style:{margin:'0 0 10px',fontSize:12,lineHeight:1.5}},'Cuenta de exploración con datos académicos. El horario avanza en segundos; las fotos son de referencia.'),
    demo && h('div',null,
      h('p',{style:{margin:'6px 0',fontSize:13,fontWeight:900},'aria-live':'polite'},`${dateLabel(demo.clockAt)} · ${clock(demo.clockAt)} · ${done}/${state.tasks.length} actividades`),
      h('p',{style:{margin:'4px 0 10px',fontSize:12}},demo.finished?'Servicio finalizado. Reporte y fotografías disponibles.':selected?`En progreso: ${selected.label}`:demo.running?'Preparando la siguiente actividad…':'Recorrido en pausa'),
      h('progress',{'aria-label':'Avance del recorrido',value:done,max:Math.max(1,state.tasks.length),style:{width:'100%',accentColor:'#48a2b8'}})),
    h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:10}},
      !demo ? button('Iniciar recorrido',start) : demo.finished ? button('Reiniciar recorrido',start) : button(demo.running?'Pausar':'Continuar',()=>state.set(current=>({careDemo:{...current.careDemo,running:!current.careDemo.running,nextAt:Date.now()+DEMO_INTERVAL_MS}}))),
      demo && !demo.finished ? button('Siguiente avance',()=>state.set(current=>advanceDemo(current,Date.now(),true))) : button('Reservar otro horario',()=>state.go('hire')),
      demo && button('Ver historial y fotos',()=>state.set({screen:'tracking',trackingTab:'actualizaciones'})),
      demo?.finished && button('Ver resumen',()=>state.go('summary'))),
    !demo && h('p',{style:{margin:'10px 0 0',fontSize:11}},'Puedes usar el horario inicial o contratar un servicio y elegir la fecha, hora y cuidador.'));
}
