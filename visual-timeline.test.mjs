import assert from 'node:assert/strict';
import { simulate } from './battle-engine.js';

const entity=(id,name,moves)=>({id,name,definition:{types:['fuego'],hp:100,attack:100,defense:100,specialAttack:100,specialDefense:100,speed:100,moveIds:moves.slice(0,3),uniqueMoveId:moves[3],globalAbilityId:'ga',uniqueAbilityId:'ua'}});
const move=(id,name,rules=[])=>({id,name,definition:{type:'fuego',category:'status',power:0,accuracy:0,criticalChance:0,priority:0,cooldown:0,rules}});
const catalog={
 moves:{
  buff:move('buff','Impulso',[{event:'manual',condition:{type:'always'},target:'self',chance:100,duration:0,limit:0,action:{type:'stat_change',stat:'speed',value:1}}]),
  m2:move('m2','M2'),m3:move('m3','M3'),m4:move('m4','M4')
 },
 abilities:{ga:{id:'ga',name:'GA',definition:{rules:[]}},ua:{id:'ua',name:'UA',definition:{rules:[]}}},
 statuses:{},effects:{},weathers:{},fields:{},scenarios:{},
 entities:{a:entity('a','A',['buff','m2','m3','m4']),b:entity('b','B',['m2','m3','m4','buff']),c:entity('c','C',['m2','m3','m4','buff'])}
};
const chart={fuego:{fuego:'neutral'}};
const r=simulate({left:'a',right:'b',leftTeam:['a','c'],rightTeam:['b'],leftOrders:[{move:'buff'}],rightOrders:[{move:'m2'}],turns:1,catalog,chart,randomTape:[0.1,0.1,0.1,0.1]});
const statEvent=r.visualEvents.find(e=>e.type==='unit_state'&&e.side==='left'&&e.unit?.stages?.speed===1);
assert.ok(statEvent,'Debe emitir estado visual inmediatamente al cambiar una stat');
assert.equal(r.log[statEvent.logIndex].includes('speed'),true);

const s=simulate({left:'a',right:'b',leftTeam:['a','c'],rightTeam:['b'],leftOrders:[{switch:1}],rightOrders:[{move:'m2'}],turns:1,catalog,chart,randomTape:[0.1,0.1,0.1]});
const sw=s.visualEvents.find(e=>e.type==='switch'&&e.side==='left');
assert.ok(sw,'Debe emitir evento visual de cambio');
assert.equal(sw.unit.id,'c');
assert.equal(s.log[sw.logIndex].includes('entra al campo'),true);
console.log('visual-timeline ok');
