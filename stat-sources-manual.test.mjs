import assert from 'node:assert/strict';
import { simulate } from './battle-engine.js';

const move = {id:'buff',name:'Impulso',definition:{type:'mente',category:'status',power:0,accuracy:100,criticalChance:0,priority:0,cooldown:0,rules:[{event:'manual',chance:100,target:'self',condition:{type:'always'},action:{type:'stat_change',stat:'speed',value:1}}]}};
const filler = id => ({id,name:id,definition:{type:'mente',category:'status',power:0,accuracy:100,criticalChance:0,priority:0,cooldown:0,rules:[]}});
const ability = id => ({id,name:id,definition:{rules:[]}});
const entity = (id,name) => ({id,name,definition:{types:['mente'],hp:100,attack:50,defense:50,specialAttack:50,specialDefense:50,speed:50,moveIds:['buff','m2','m3'],uniqueMoveId:'m4',globalAbilityId:'a1',uniqueAbilityId:'a2'}});
const catalog={entities:{e1:entity('e1','Hela'),e2:entity('e2','Hades')},moves:{buff:move,m2:filler('m2'),m3:filler('m3'),m4:filler('m4')},abilities:{a1:ability('a1'),a2:ability('a2')},effects:{},statuses:{},weathers:{},fields:{},scenarios:{}};
const chart={mente:{mente:'neutral'}};
// Preparar manualmente no debe ejecutar rondas.
const prepared=simulate({catalog,chart,leftTeam:['e1'],rightTeam:['e2'],turns:0,randomTape:[]});
assert.equal(prepared.rounds,0);
assert.deepEqual(prepared.left.statSources,[]);
// Continuación equivalente: reproducir una ronda con la decisión manual debe registrar la fuente sin undefined.push.
const played=simulate({catalog,chart,leftTeam:['e1'],rightTeam:['e2'],turns:1,leftOrders:[{move:'buff'}],rightOrders:[{move:'m2'}],randomTape:[0.1,0.1,0.1,0.1]});
assert.equal(played.rounds,1);
assert.equal(played.left.stages.speed,1);
assert.equal(played.left.statSources.length,1);
assert.equal(played.left.statSources[0].stat,'speed');
console.log('stat-sources manual regression OK');
