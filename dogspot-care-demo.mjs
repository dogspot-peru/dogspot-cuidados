// Accelerated care walkthrough, isolated from personal accounts and their records.
export const DEMO_INTERVAL_MS = 5000;
export const EXPLORATION_KEY = 'dogspot-exploration-v1';
const personal = state => !!state.user?.email && state.user.email.toLowerCase() !== 'usuario@dogspot.pe';
export const isExploration = state => state.exploration === true || !personal(state);
export const validDemo = (demo,tasks) => !!(demo && demo.version === 1 && typeof demo.runId === 'string' && Number.isInteger(demo.phase) && demo.phase >= 0 && demo.phase <= tasks.length*2 && Number.isFinite(Date.parse(demo.clockAt)) && tasks.length && tasks.every(t=>Number.isFinite(Date.parse(t.demoStartAt)) && Number.isFinite(Date.parse(t.demoEndAt))));
const clock = iso => new Date(iso).toLocaleTimeString('es-PE', {timeZone:'America/Lima', hour:'2-digit', minute:'2-digit', hour12:true});
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
    messages:[], trackingTab:'estado',
    notifications:[{id:`${runId}:start`,time:clock(plan[0].demoStartAt),text:'Inicio del recorrido de cuidado. Verás cada actividad, su horario y su fotografía de referencia.',read:false,tab:'actualizaciones',kind:'demo-started',bookingId:state.currentBookingId ?? 'demo-service'}]
  };
}

export function referencePhoto(pet, task) {
  const species = (pet?.species ?? '').toLowerCase();
  const taskId = task?.baseId ?? task?.id?.split(':')[0];
  if (species.includes('perro') && Object.hasOwn(descriptions,taskId)) return `./luna-${taskId}-v2.jpg`;
  return species.includes('gato') ? './cat-reference.png' : species.includes('conejo') ? './rabbit-reference.png' : /ave|pájaro|pajaro/.test(species) ? './bird-reference.png' : species.includes('perro') ? './luna-evidence-wZL0x3gy.jpg' : './other-reference.svg';
}

export function upgradeDemoPhotos(state) {
  const petFor = bookingId => state.bookings?.find(b=>b.id===bookingId)?.petSnapshot ?? state.pets?.find(p=>p.id===(state.bookings?.find(b=>b.id===bookingId)?.petId ?? state.selectedPetId));
  const upgrade = (service,bookingId) => {
    const pet=petFor(bookingId);
    const tasks=(service.tasks??[]).map(t=>t.demoReference&&t.evidence?{...t,evidence:referencePhoto(pet,t)}:t);
    const messages=(service.messages??[]).map(m=>{
      if(!m.image||!m.id?.startsWith('care-demo:'))return m;
      const phase=Number(m.id.match(/:message:(\d+)$/)?.[1]);
      const task=tasks[Math.floor((phase-1)/2)];
      return task?.demoReference?{...m,image:referencePhoto(pet,task)}:m;
    });
    return {...service,tasks,messages};
  };
  return {...state,...upgrade(state,state.currentBookingId),serviceSnapshots:Object.fromEntries(Object.entries(state.serviceSnapshots??{}).map(([id,service])=>[id,upgrade(service,id)]))};
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
  if (completed) Object.assign(result,{selections:[descriptions[task.baseId ?? task.id] ?? 'Actividad registrada.'],evidence:referencePhoto(pet,task),mediaType:'photo'});
  const notification = {id:`${demo.runId}:${phase}`,time:clock(scheduled),text:`${completed?'Actividad completada':'Actividad en progreso'}: ${task.label}.${completed?' Fotografía de referencia disponible.':''}`,read:false,tab:'actualizaciones',kind:completed?'task-completed':'task-started',species:pet?.species??'Perro',bookingId:state.currentBookingId ?? 'demo-service'};
  const messages = completed ? [...state.messages,{id:`${demo.runId}:message:${phase}`,from:'caregiver',text:`${pet?.name ?? 'Tu mascota'} · ${task.label}: ${descriptions[task.baseId ?? task.id] ?? 'Actividad registrada.'}`,time:clock(scheduled),image:result.evidence}] : state.messages;
  const notifications = [notification,...state.notifications];
  if (finished) notifications.unshift({id:`${demo.runId}:finished`,time:clock(scheduled),text:'Servicio finalizado. Gracias por confiar en DogSpot. Ya puedes revisar el resumen, las fotografías y calificar el cuidado.',read:false,tab:'actualizaciones',kind:'service-completed',bookingId:state.currentBookingId ?? 'demo-service'});
  return {tasks:state.tasks.map((t,i)=>i===index?result:t),messages,notifications,
    careDemo:{...demo,phase,clockAt:scheduled,nextAt:now+DEMO_INTERVAL_MS,running:demo.running&&!finished,finished},
    ...(finished?{active:{...state.active,status:'finalizado'},screen:'summary',bookings:state.bookings.map(b=>b.id===state.currentBookingId?{...b,status:'finalizado',updatedAt:new Date(now).toISOString()}:b)}:{})};
}

// Compatibility for older integrations: controls now live only in the service.
export function renderDemoPanel() { return null; }
