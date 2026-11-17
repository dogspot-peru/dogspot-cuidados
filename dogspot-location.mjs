import coverage from './dogspot-coverage-data.mjs';

export const DISTRICTS = coverage.features.map(f => f.properties.name);
export const EXCLUDED_DISTRICT = 'El Porvenir';
const clean = (value, max = 160) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const areaLabel = value => [...new Set([value.neighborhood,value.district,'Trujillo'].filter(Boolean))].join(' · ');
export const areaFields = value => ({district: clean(value?.district, 80), neighborhood: clean(value?.neighborhood, 120)});
export function profileAddress(value) {
  const address=clean(value?.address,1000),zone=Object.values(areaFields(value)).reverse().filter(Boolean).join(', ');
  return clean(zone&&!address.endsWith(zone)?[address,zone].filter(Boolean).join(', '):address,1000);
}
export function areaError(value) {
  const {district, neighborhood} = areaFields(value);
  if (district === EXCLUDED_DISTRICT) return 'Por ahora no tenemos cobertura en El Porvenir.';
  if (!DISTRICTS.includes(district)) return 'Selecciona tu distrito de la provincia de Trujillo.';
  if (neighborhood.length < 2) return 'Escribe tu urbanización, barrio o sector.';
  return '';
}
function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    const cross = (x - xi) * (yj - yi) - (y - yi) * (xj - xi);
    if (Math.abs(cross) < 1e-12 && x >= Math.min(xi, xj) - 1e-10 && x <= Math.max(xi, xj) + 1e-10 && y >= Math.min(yi, yj) - 1e-10 && y <= Math.max(yi, yj) + 1e-10) return true;
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
export function containsPoint(geometry, lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
  return polygons.some(rings => inRing(lng, lat, rings[0]) && !rings.slice(1).some(hole => inRing(lng, lat, hole)));
}
export function districtAt(lat, lng) {
  const matches = coverage.features.filter(f => containsPoint(f.geometry, lat, lng));
  // Exclusion wins at shared edges; it cannot be bypassed with the district selector.
  return matches.find(f => f.properties.name === EXCLUDED_DISTRICT)?.properties.name ?? matches[0]?.properties.name ?? null;
}
export function pointError(point) {
  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return 'Marca la entrada del domicilio en el mapa.';
  const district = districtAt(point.lat, point.lng);
  return district === EXCLUDED_DISTRICT ? 'Este punto está en El Porvenir, fuera de nuestra cobertura.' : !district ? 'Este punto está fuera de la provincia de Trujillo.' : '';
}
export function locationError(value) {
  const problem = areaError(value) || pointError(value);
  if (problem) return problem;
  if (districtAt(value.lat, value.lng) !== value.district) return 'El distrito debe coincidir con el punto marcado en el mapa.';
  if (clean(value.address, 300).length < 5) return 'Escribe la calle, avenida o manzana y el número o lote.';
  if (!value.confirmedAt || !Number.isFinite(Date.parse(value.confirmedAt))) return 'Confirma el punto de atención antes de continuar.';
  return '';
}
export function locationSnapshot(value) {
  if (locationError(value)) return null;
  return {...areaFields(value), province: 'Trujillo', address: clean(value.address, 300), reference: clean(value.reference, 500), lat: value.lat, lng: value.lng, confirmedAt: value.confirmedAt};
}
export function mapsLink(value, directions = false) {
  if (!value || pointError(value)) return '';
  const q = encodeURIComponent(value.lat.toFixed(6) + ',' + value.lng.toFixed(6));
  return directions ? 'https://www.google.com/maps/dir/?api=1&destination=' + q + '&travelmode=driving' : 'https://www.google.com/maps/search/?api=1&query=' + q;
}
export function locationNotes(value) {
  const v = locationSnapshot(value);
  return v ? ['Domicilio del servicio: ' + [v.address, v.neighborhood, v.district, 'Trujillo'].join(', '), v.reference ? 'Referencia: ' + v.reference : '', 'Punto: ' + v.lat.toFixed(6) + ', ' + v.lng.toFixed(6), mapsLink(v)].filter(Boolean).join('\n') : '';
}

let leafletPromise;
function loadLeaflet() {
  if (window.L?.map) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = new URL('./vendor/leaflet/leaflet.css', import.meta.url).href; document.head.append(css);
    const script = document.createElement('script'); script.src = new URL('./vendor/leaflet/leaflet.js', import.meta.url).href;
    script.onload = () => resolve(window.L); script.onerror = () => {leafletPromise = null; script.remove(); reject(new Error('map-load'));}; document.head.append(script);
  });
  return leafletPromise;
}

export function createLocationFeature(React, useApp) {
  const h = React.createElement;
  const input = {width:'100%',minWidth:0,minHeight:48,padding:'12px 14px',border:'2px solid #d8e6ef',borderRadius:15,background:'#fff',color:'#20314f',fontSize:16,boxSizing:'border-box'};
  const button = {minHeight:46,padding:'11px 15px',borderRadius:15,border:'1px solid #d8e6ef',background:'#edf7ff',color:'#20314f',fontWeight:800,fontSize:14,cursor:'pointer'};
  const text = {fontSize:13,lineHeight:1.5,color:'#65768b',margin:0};
  const link = {...button,display:'inline-flex',alignItems:'center',justifyContent:'center',textDecoration:'none'};
  function Field({label,children,hint}) {return h('label',{style:{display:'grid',gap:7,fontSize:14,fontWeight:800,color:'#20314f'}},label,children,hint&&h('span',{style:{...text,fontWeight:400}},hint));}
  function CoverageNote() {return h('p',{style:{...text,padding:12,borderRadius:14,background:'#f3edff',color:'#65518e'}},'Atendemos en la provincia de Trujillo. El Porvenir está fuera de cobertura.');}
  function AreaFields({value,onChange,service=false}) {
    return h('div',{style:{display:'grid',gap:14}},h(Field,{label:service?'Distrito del servicio':'Distrito donde vives'},
      h('select',{style:input,required:true,value:value.district??'',onChange:e=>onChange({...value,district:e.target.value})},h('option',{value:''},'Selecciona tu distrito'),...DISTRICTS.map(name=>h('option',{key:name,value:name,disabled:name===EXCLUDED_DISTRICT},name===EXCLUDED_DISTRICT?name+' · Sin cobertura':name)))),
      h(Field,{label:'Urbanización, barrio o sector'},h('input',{style:input,required:true,maxLength:120,autoComplete:'address-level3',placeholder:'Ej.: San Andrés, Las Quintanas o tu sector',value:value.neighborhood??'',onChange:e=>onChange({...value,neighborhood:e.target.value})})),h(CoverageNote));
  }
  function MapPicker({point,district,onPick}) {
    const node = React.useRef(null), map = React.useRef(null), marker = React.useRef(null), pick = React.useRef(onPick);
    const [error,setError] = React.useState(''), [retry,setRetry] = React.useState(0), [ready,setReady] = React.useState(0);
    pick.current = onPick;
    React.useEffect(()=>{
      let cancelled=false;
      loadLeaflet().then(L=>{
        if(cancelled||!node.current)return;
        const instance=L.map(node.current,{center:[-8.1116,-79.0287],zoom:14,minZoom:8,maxZoom:19,scrollWheelZoom:false});map.current=instance;
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'}).addTo(instance);
        const blocked=coverage.features.find(f=>f.properties.name===EXCLUDED_DISTRICT);
        L.geoJSON(blocked,{style:{color:'#bf3657',weight:2,fillColor:'#e35b77',fillOpacity:.20},interactive:false}).addTo(instance);
        marker.current=L.marker([point?.lat??-8.1116,point?.lng??-79.0287],{draggable:true,keyboard:true,title:'Punto de atención: mueve el marcador',icon:L.divIcon({className:'dogspot-location-pin',iconSize:[34,44],iconAnchor:[17,42],html:'<svg width="34" height="44" viewBox="0 0 34 44" aria-hidden="true"><path d="M17 1C8 1 1 8 1 17c0 12 16 26 16 26s16-14 16-26C33 8 26 1 17 1Z" fill="#6b58a5" stroke="white" stroke-width="2"/><circle cx="17" cy="17" r="6" fill="white"/></svg>'})});
        if(point)marker.current.addTo(instance);
        const choose=latlng=>pick.current({lat:latlng.lat,lng:latlng.lng});
        instance.on('click',e=>choose(e.latlng));marker.current.on('dragend',()=>choose(marker.current.getLatLng()));
        setTimeout(()=>{if(!cancelled)instance.invalidateSize();},0);setError('');setReady(n=>n+1);
      }).catch(()=>{if(!cancelled)setError('No se pudo cargar el mapa. Revisa tu conexión o ingresa las coordenadas del punto.');});
      return()=>{cancelled=true;map.current?.remove();map.current=null;marker.current=null;};
    },[retry]);
    React.useEffect(()=>{if(map.current&&marker.current&&point){marker.current.setLatLng([point.lat,point.lng]).addTo(map.current);map.current.setView([point.lat,point.lng],Math.max(15,map.current.getZoom()));}else if(map.current&&marker.current)marker.current.remove();},[point,retry,ready]);
    React.useEffect(()=>{if(!map.current||point)return;const f=coverage.features.find(f=>f.properties.name===district);if(f)map.current.fitBounds(window.L.geoJSON(f).getBounds(),{padding:[12,12],maxZoom:14});},[district,point,retry,ready]);
    return h('div',null,h('div',{ref:node,'aria-label':'Mapa para marcar el domicilio del servicio',style:{height:280,width:'100%',borderRadius:18,border:'1px solid #d8e6ef',isolation:'isolate',position:'relative',zIndex:0,overflow:'hidden',background:'#edf7ff'}}),
      error&&h('div',{role:'alert',style:{...text,marginTop:8}},error,h('button',{type:'button',style:{...button,marginTop:8},onClick:()=>setRetry(n=>n+1)},'Reintentar mapa')),
      h('p',{style:{...text,marginTop:7}},'Toca el mapa o mueve el pin hasta la entrada del domicilio. La zona roja no tiene cobertura.'));
  }
  function LocationScreen({nextScreen='caregivers'}) {
    const state=useApp(),draft=state.draft;
    const [value,setValue]=React.useState(()=>({...areaFields(state.user),address:state.user?.address??'',reference:state.user?.references??'',...(draft?.serviceLocation??{})}));
    const [point,setPoint]=React.useState(()=>draft?.serviceLocation?{lat:draft.serviceLocation.lat,lng:draft.serviceLocation.lng}:null);
    const [error,setError]=React.useState(''),[gps,setGps]=React.useState(false),[manual,setManual]=React.useState(false),[coords,setCoords]=React.useState({lat:'',lng:''});
    const updatePoint=p=>{setPoint(p);const name=districtAt(p.lat,p.lng);setValue(v=>({...v,district:name??''}));setError(pointError(p));};
    const locate=()=>{
      if(!navigator.geolocation){setError('Tu navegador no ofrece ubicación. Puedes marcar el punto en el mapa.');return;}
      setGps(true);setError('');navigator.geolocation.getCurrentPosition(p=>{setGps(false);updatePoint({lat:p.coords.latitude,lng:p.coords.longitude});},()=>{setGps(false);setError('No pudimos obtener tu ubicación. Toca el mapa para marcar el domicilio.');},{enableHighAccuracy:true,timeout:12000,maximumAge:30000});
    };
    const save=()=>{
      const candidate={...value,...point,confirmedAt:new Date().toISOString()},problem=locationError(candidate);
      if(problem){setError(problem);return;}
      const location=locationSnapshot(candidate);
      state.set({draft:{...draft,serviceLocation:location},locationReturnTo:null,screen:nextScreen});
    };
    if(!draft)return h('div',{style:{padding:20}},h('h2',null,'Primero prepara tu reserva'),h('button',{style:button,onClick:()=>state.go('hire')},'Reservar cuidado'));
    return h('div',null,h('header',{style:{display:'flex',alignItems:'center',gap:12,padding:'14px 20px'}},h('button',{type:'button','aria-label':'Volver a la reserva',style:button,onClick:()=>state.go(nextScreen==='payment'&&locationSnapshot(draft.serviceLocation)?'payment':'hire')},'←'),h('div',null,h('h1',{style:{fontSize:22,fontWeight:900,margin:0}},'¿Dónde será el cuidado?'),h('p',{style:text},'Confirma el domicilio de esta reserva.'))),
      h('div',{style:{padding:'0 20px 24px',display:'grid',gap:16}},h(AreaFields,{value,service:true,onChange:v=>{if(v.district!==value.district)setPoint(null);setValue(v);setError('');}}),
        h(Field,{label:'Dirección exacta',hint:'Calle o avenida y número; o manzana y lote. Agrega piso o departamento si corresponde.'},h('input',{style:input,required:true,maxLength:300,autoComplete:'street-address',placeholder:'Ej.: Av. América Sur 123, departamento 201',value:value.address,onChange:e=>setValue(v=>({...v,address:e.target.value}))})),
        h(Field,{label:'Referencia para llegar · Opcional'},h('textarea',{style:{...input,minHeight:76},rows:2,maxLength:500,placeholder:'Ej.: frente al parque, portón azul, timbre 201',value:value.reference,onChange:e=>setValue(v=>({...v,reference:e.target.value}))})),
        h('button',{type:'button',style:button,disabled:gps,onClick:locate},gps?'Buscando tu ubicación…':'Usar mi ubicación actual'),
        h(MapPicker,{point,district:value.district,onPick:updatePoint}),
        point&&h('p',{role:'status',style:{...text,padding:12,borderRadius:14,background:pointError(point)?'#fff0f3':'#edf8f1',color:pointError(point)?'#aa2649':'#246841'}},pointError(point)||'Punto marcado en '+value.district+' · '+point.lat.toFixed(6)+', '+point.lng.toFixed(6)),
        h('button',{type:'button',style:{...button,background:'transparent'},onClick:()=>setManual(v=>!v)},manual?'Ocultar coordenadas':'Ingresar coordenadas de Maps'),
        manual&&h('div',{style:{display:'grid',gap:10}},h('p',{style:text},'Puedes copiar la latitud y longitud del punto que elegiste en Google Maps.'),h(Field,{label:'Latitud'},h('input',{style:input,inputMode:'decimal',placeholder:'Ej.: -8.1116',value:coords.lat,onChange:e=>setCoords(v=>({...v,lat:e.target.value}))})),h(Field,{label:'Longitud'},h('input',{style:input,inputMode:'decimal',placeholder:'Ej.: -79.0287',value:coords.lng,onChange:e=>setCoords(v=>({...v,lng:e.target.value}))})),h('button',{type:'button',style:button,onClick:()=>{const lat=coords.lat.trim(),lng=coords.lng.trim();if(!lat||!lng||!Number.isFinite(Number(lat))||!Number.isFinite(Number(lng))){setError('Ingresa una latitud y longitud válidas.');return;}updatePoint({lat:Number(lat),lng:Number(lng)});}},'Marcar estas coordenadas')),
        h('p',{style:text},'Revisa que el pin coincida con la entrada. El distrito se comprueba con el punto del mapa y la ubicación se guarda con esta reserva.'),
        error&&h('p',{role:'alert',style:{...text,color:'#aa2649',fontWeight:700}},error),
        h('button',{type:'button',style:{...button,background:'#6b58a5',color:'white',borderColor:'#6b58a5'},onClick:save},nextScreen==='payment'?'Confirmar domicilio y volver al pago':'Confirmar domicilio y elegir cuidador')));
  }
  function LocationSummary({location:given,editable=false}) {
    const state=useApp(),booking=state.bookings.find(b=>b.id===state.currentBookingId),location=given??booking?.serviceLocation;
    const [message,setMessage]=React.useState('');
    if(!locationSnapshot(location))return null;
    const copy=async()=>{try{await navigator.clipboard.writeText(locationNotes(location));setMessage('Dirección y enlace copiados. Puedes enviarlos al cuidador asignado.');}catch{setMessage('Puedes abrir el punto en Maps y compartir su enlace con el cuidador asignado.');}};
    return h('section',{'aria-label':'Domicilio del servicio',style:{padding:16,margin:'12px 20px',border:'1px solid #d8e6ef',borderRadius:20,background:'#f8faff',textAlign:'left',display:'grid',gap:8}},
      h('h2',{style:{margin:0,fontSize:17,fontWeight:900,color:'#20314f'}},'Domicilio del servicio'),h('p',{style:{margin:0,fontWeight:800,color:'#20314f',overflowWrap:'anywhere'}},location.address),h('p',{style:text},areaLabel(location)),location.reference&&h('p',{style:text},'Referencia: '+location.reference),
      h('div',{style:{display:'flex',flexWrap:'wrap',gap:8}},h('a',{style:link,href:mapsLink(location),target:'_blank',rel:'noopener noreferrer'},'Ver punto en Maps'),h('a',{style:{...link,background:'#6b58a5',color:'white'},href:mapsLink(location,true),target:'_blank',rel:'noopener noreferrer'},'Cómo llegar')),
      h('button',{type:'button',style:button,onClick:copy},'Copiar ubicación para el cuidador'),message&&h('p',{role:'status',style:text},message),
      editable&&h('button',{type:'button',style:button,onClick:()=>state.set({locationReturnTo:'payment',screen:'service-location'})},'Cambiar domicilio de esta reserva'));
  }
  function ProfileArea() {
    const state=useApp(),v=areaFields(state.user);
    return h('section',{style:{padding:16,border:'1px solid #d8e6ef',borderRadius:20,background:'#f3edff'}},h('h2',{style:{margin:0,fontSize:17,fontWeight:900}},'Mi zona de Trujillo'),h('p',{style:{...text,marginTop:6}},v.district?areaLabel(v):'Completa tu distrito y urbanización al editar tu perfil.'),h('p',{style:{...text,marginTop:6}},'Puedes elegir otro domicilio al reservar un servicio.'));
  }
  return {AreaFields,LocationScreen,LocationSummary,ProfileArea};
}
