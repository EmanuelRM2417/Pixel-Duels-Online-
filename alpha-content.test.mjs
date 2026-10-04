import assert from 'node:assert/strict';
import { loadLiveContent } from './worker.js';

const store=new Map();
const put=(key,value)=>store.set(key,JSON.stringify(value));
put('catalog-v1:moves:m1',{id:'m1',category:'moves',name:'Golpe',definition:{},updatedAt:'2026-10-03T10:00:00.000Z'});
put('catalog-v1:entities:e1',{id:'e1',category:'entities',name:'Entidad',definition:{},updatedAt:'2026-10-03T10:01:00.000Z'});
put('type-chart-draft',{chart:{fuego:{fuego:'neutral'}},updatedAt:'2026-10-03T10:02:00.000Z'});
const kv={
  async list({prefix}){return {keys:[...store.keys()].filter(k=>k.startsWith(prefix)).map(name=>({name})),list_complete:true};},
  async get(key,type){const raw=store.get(key);return raw===undefined?null:(type==='json'?JSON.parse(raw):raw);},
  async put(key,value){store.set(key,value);}
};
const s=await loadLiveContent({PUBLIC_CONTENT:kv});
assert.equal(s.catalog.entities.e1.name,'Entidad');
assert.equal(s.catalog.moves.m1.name,'Golpe');
assert.equal(s.chart.fuego.fuego,'neutral');
assert.match(s.revision,/^draft-/);
console.log('live editor content test ok');
