import assert from 'node:assert/strict';
import {simulate} from './battle-engine.js';

const noop=(id, cooldown=0)=>({id,name:id,definition:{type:'valor',category:'status',power:0,accuracy:100,criticalChance:0,priority:0,cooldown,rules:[]}});
const boost={id:'boost',name:'Impulso',definition:{type:'valor',category:'status',power:0,accuracy:100,criticalChance:0,priority:0,cooldown:3,rules:[{event:'manual',condition:{type:'always'},target:'self',action:{type:'stat_change',stat:'speed',value:2},chance:100,duration:0,limit:0}]}};
const enterField={id:'entry',name:'Entrada de arena',definition:{rules:[{event:'on_enter',condition:{type:'always'},target:'self',action:{type:'set_field',value:'arena'},chance:100,duration:0,limit:1}]}};
const blank={id:'blank',name:'Sin habilidad',definition:{rules:[]}};
const entity=(id, ability='blank')=>({id,name:id.toUpperCase(),definition:{types:['valor'],hp:500,attack:20,defense:200,specialAttack:20,specialDefense:200,speed:100,moveIds:['noop1','noop2','noop3'],uniqueMoveId:id==='a'?'boost':'noop4',globalAbilityId:ability,uniqueAbilityId:'blank'}});
const catalog={
  entities:{a:entity('a','entry'),b:entity('b'),c:entity('c')},
  moves:{noop1:noop('noop1'),noop2:noop('noop2'),noop3:noop('noop3'),noop4:noop('noop4'),boost},
  abilities:{entry:enterField,blank},effects:{},statuses:{},weathers:{},scenarios:{},
  fields:{arena:{id:'arena',name:'Arena',definition:{duration:5,fieldEffects:[]}}}
};
const rightOrders=Array.from({length:6},()=>({move:'noop1'}));

// A activa el campo al entrar, se potencia, sale, espera a que el campo termine y vuelve.
const r=simulate({left:'a',right:'c',leftTeam:['a','b'],rightTeam:['c'],catalog,turns:6,
  leftOrders:[{move:'boost'},{switch:1},{move:'noop1'},{move:'noop1'},{move:'noop1'},{switch:0}],rightOrders});
const a=r.leftTeam.find(x=>x.id==='a');
assert.deepEqual(a.stages,{},'los niveles temporales se reinician al salir');
assert.deepEqual(a.statSources,[],'las fuentes de niveles temporales se limpian al salir');
assert.equal(r.field,'arena','la habilidad de entrada puede volver a activar el campo tras expirar');
assert.equal(r.fieldTurns,4,'el campo reactivado empieza en 5 y consume la ronda de reentrada');
assert.equal(r.log.filter(x=>x.includes('Se activa field: Arena')).length,2,'la habilidad on_enter limitada se rearma por entrada');
assert.equal(a.cooldowns.boost,0,'los cooldowns siguen contando mientras el personaje está en reserva');

// Si vuelve antes de que termine, no debe refrescar la duración del campo.
const r2=simulate({left:'a',right:'c',leftTeam:['a','b'],rightTeam:['c'],catalog,turns:2,
  leftOrders:[{switch:1},{switch:0}],rightOrders:rightOrders.slice(0,2)});
assert.equal(r2.field,'arena');
assert.equal(r2.fieldTurns,3,'reentrar mientras el mismo campo sigue activo no reinicia sus 5 rondas');
assert.equal(r2.log.filter(x=>x.includes('Se activa field: Arena')).length,1,'no se reactiva el mismo campo mientras sigue activo');

console.log('PASS: switch resets stages, re-arms on-enter abilities, preserves environment duration and reserve cooldown turns');
