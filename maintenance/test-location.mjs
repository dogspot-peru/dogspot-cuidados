import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import coverage from '../dogspot-coverage-data.mjs';
import {DISTRICTS,areaError,areaFields,profileAddress,districtAt,containsPoint,pointError,locationError,locationSnapshot,mapsLink,locationNotes,createLocationFeature} from '../dogspot-location.mjs';
const valid=()=>({district:'Trujillo',neighborhood:'Centro',address:'Dirección de prueba 123',reference:'Timbre 2',lat:-8.1116,lng:-79.0287,confirmedAt:'2026-11-17T20:00:00.000Z'});

test('coverage includes all twelve districts and excludes El Porvenir at registration',()=>{
  assert.equal(DISTRICTS.length,12);assert.equal(new Set(DISTRICTS).size,12);
  assert.ok(DISTRICTS.includes('Alto Trujillo'));
  assert.match(areaError({district:'El Porvenir',neighborhood:'Centro'}),/no tenemos cobertura/);
  assert.match(areaError({district:'Lima',neighborhood:'Centro'}),/Trujillo/);
  assert.match(areaError({district:'Trujillo',neighborhood:''}),/urbanización/);
  assert.equal(areaError(valid()),'');
});
test('the pin is independently checked even if an allowed district is submitted',()=>{
  assert.equal(districtAt(-8.08,-79.005),'El Porvenir');
  assert.match(locationError({...valid(),lat:-8.08,lng:-79.005}),/El Porvenir/);
  assert.equal(locationSnapshot({...valid(),lat:-8.08,lng:-79.005}),null);
  assert.equal(districtAt(-12.0464,-77.0428),null);
  assert.match(locationError({...valid(),lat:-12.0464,lng:-77.0428}),/fuera/);
});
test('valid points in Trujillo, Huanchaco, Moche, Victor Larco and Alto Trujillo are supported',()=>{
  for(const [name,lat,lng] of [['Trujillo',-8.1116778,-79.0287742],['Huanchaco',-8.0800318,-79.1204769],['Moche',-8.1714148,-79.008936],['Víctor Larco Herrera',-8.1320017,-79.0448398],['Alto Trujillo',-8.062749,-79.0100315]]){
    assert.equal(districtAt(lat,lng),name,name);assert.equal(locationError({...valid(),district:name,lat,lng}),'',name);
  }
});
test('changing only the district cannot mislabel an otherwise covered pin',()=>{
  assert.match(locationError({...valid(),district:'Huanchaco'}),/coincidir/);
});
test('confirmation requires an address, explicit pin, and confirmation date',()=>{
  assert.match(locationError({...valid(),address:''}),/calle/);
  assert.match(locationError({...valid(),lat:undefined}),/Marca/);
  assert.match(locationError({...valid(),confirmedAt:null}),/Confirma/);
  for(const lat of [NaN,Infinity,'-8.1116'])assert.ok(pointError({lat,lng:-79.0287}));
});
test('polygon holes and MultiPolygons are respected and boundary points are recognized',()=>{
  const square=[[0,0],[5,0],[5,5],[0,5],[0,0]],hole=[[1,1],[2,1],[2,2],[1,2],[1,1]];
  assert.equal(containsPoint({type:'Polygon',coordinates:[square,hole]},1.5,1.5),false);
  assert.equal(containsPoint({type:'MultiPolygon',coordinates:[[square,hole]]},3,3),true);
  assert.equal(containsPoint({type:'Polygon',coordinates:[square]},0,2),true);
  const vertex=coverage.features.find(f=>f.properties.name==='El Porvenir').geometry.coordinates[0][0];
  assert.equal(districtAt(vertex[1],vertex[0]),'El Porvenir');
});
test('each booking gets an immutable, bounded snapshot with no unrelated user fields',()=>{
  const source={...valid(),password:'secret',photo:'private-photo',arbitrary:{value:1}};
  const copy=locationSnapshot(source);source.address='Changed profile';source.lat=0;
  assert.equal(copy.address,'Dirección de prueba 123');assert.equal(copy.lat,-8.1116);
  assert.equal(copy.password,undefined);assert.equal(copy.photo,undefined);assert.equal(copy.arbitrary,undefined);
  assert.equal(locationSnapshot({...valid(),reference:'x'.repeat(600)}).reference.length,500);
});
test('maps and directions always use the saved coordinates, not the mutable profile address',()=>{
  const loc=valid(),url=new URL(mapsLink(loc)),directions=new URL(mapsLink(loc,true));
  assert.equal(url.hostname,'www.google.com');assert.equal(url.searchParams.get('query'),'-8.111600,-79.028700');
  assert.equal(directions.searchParams.get('destination'),'-8.111600,-79.028700');
  assert.equal(mapsLink({...loc,lat:NaN}), '');
  assert.match(locationNotes(loc),/Dirección de prueba 123/);assert.match(locationNotes(loc),/Timbre 2/);assert.match(locationNotes(loc),/google.com\/maps/);
});
test('native registration controls require a zone and disable El Porvenir',()=>{
  const React={createElement:(type,props,...children)=>({type,props:props??{},children})};
  const tree=createLocationFeature(React,()=>({})).AreaFields({value:{},onChange(){}});
  const all=[];function walk(n){if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(walk);return;}all.push(n);walk(n.children);}walk(tree);
  assert.equal(all.find(n=>n.type==='select').props.required,true);
  assert.equal(all.find(n=>n.type==='input').props.required,true);
  assert.equal(all.find(n=>n.type==='option'&&n.props.value==='El Porvenir').props.disabled,true);
});

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const bundle=html.match(/src="\.\/(index-location-[a-f0-9]+\.js)"/)[1];
const source=readFileSync(new URL('../'+bundle,import.meta.url),'utf8');
const helpers={DogSpotAreaError:areaError,DogSpotAreaFields:areaFields,DogSpotProfileAddress:profileAddress,DogSpotLocationError:locationError,DogSpotLocationSnapshot:locationSnapshot,DogSpotLocationNotes:locationNotes};
test('private Sheets booking payload keeps the selected location and readable directions in notes',()=>{
  const start=source.indexOf('var A=',200000),end=source.indexOf('var st=',start);
  assert.ok(start>0&&end>start);
  const context=vm.createContext({...helpers,URL,Date,Intl,we:e=>e.sessions??[]});
  vm.runInContext(source.slice(start,end),context);
  context.booking={id:'b1',status:'confirmado',mode:'horas',payment:'Yape',sessions:[],notes:'Instrucción conservada',serviceLocation:valid()};
  context.user={id:'u1',email:'cliente@example.org',name:'Cliente',district:'Trujillo',neighborhood:'Centro'};
  const payload=vm.runInContext('at(booking,null,user,"Ana")',context);
  assert.equal(payload.serviceLocation.address,valid().address);
  assert.equal(payload.user.district,'Trujillo');assert.equal(payload.user.neighborhood,'Centro');
  assert.match(payload.notes,/Instrucción conservada/);assert.match(payload.notes,/maps/);
  assert.equal(payload.user.password,undefined);
  context.payload=payload;
  const restored=vm.runInContext('ot(payload)',context);
  assert.equal(restored.serviceLocation.lat,valid().lat);
  assert.equal(restored.user.district,'Trujillo');
  assert.equal(restored.user.neighborhood,'Centro');
  assert.equal(restored.user.address,payload.user.address);
});
