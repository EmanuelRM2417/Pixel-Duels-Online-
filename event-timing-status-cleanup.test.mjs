import assert from 'node:assert/strict';
import {simulate} from './battle-engine.js';
import {validateDefinition} from './catalog-validation.js';

const ability=(id)=>({id,name:id,definition:{kind:'global',rules:[]}});
const ent=(id,moves)=>({id,name:id,definition:{types:['agua'],hp:100,attack:60,defense:60,specialAttack:60,specialDefense:60,speed:id==='a'?80:50,moveIds:moves.slice(0,3),uniqueMoveId:moves[3],globalAbilityId:'g',uniqueAbilityId:'u'}});
const baseRule=(event,action,target='self',chance=100,duration=0)=>({event,condition:{type:'always',value:''},conditions:[],target,action,chance,duration,limit:0,operator:'AND',negate:false});
const noop={id:'noop',name:'Quieto',definition:{kind:'global',type:'agua',category:'status',power:0,accuracy:100,criticalChance:0,priority:0,cooldown:0,rules:[]}};
const eventMove={id:'eventos',name:'Eventos',definition:{kind:'unique',type:'agua',category:'status',power:0,accuracy:1,criticalChance:0,priority:0,cooldown:1,rules:[
  baseRule('manual',{type:'stat_change',value:1,stat:'attack'}),
  baseRule('on_attack',{type:'stat_change',value:1,stat:'defense'}),
  baseRule('on_hit',{type:'stat_change',value:1,stat:'speed'})
]}};
validateDefinition('moves',eventMove.definition);
let catalog={entities:{a:ent('a',['noop','noop','noop','eventos']),b:ent('b',['noop','noop','noop','noop'])},moves:{noop,eventos:eventMove},abilities:{g:ability('g'),u:ability('u')},statuses:{},effects:{},weathers:{},fields:{},scenarios:{}};
let r=simulate({left:'a',right:'b',catalog,chart:{},turns:1,leftMove:'eventos',rightMove:'noop',randomSource:()=>.5});
assert.equal(r.left.stages.attack,1,'Al usar ocurre aunque el movimiento falle');
assert.equal(r.left.stages.defense,1,'Al atacar ocurre al iniciar la acción');
assert.equal(r.left.stages.speed||0,0,'Al acertar no ocurre si falla precisión');
assert.equal(r.left.cooldowns.eventos,1,'un movimiento fallado también recibe cooldown');

const hitMove=structuredClone(eventMove);hitMove.id='eventos-hit';hitMove.name='Eventos Hit';hitMove.definition.accuracy=100;hitMove.definition.cooldown=0;
catalog=structuredClone(catalog);catalog.moves['eventos-hit']=hitMove;catalog.entities.a.definition.uniqueMoveId='eventos-hit';
r=simulate({left:'a',right:'b',catalog,chart:{},turns:1,leftMove:'eventos-hit',rightMove:'noop',randomSource:()=>.5});
assert.equal(r.left.stages.speed,1,'Al acertar ocurre tras superar precisión');

const freeze={id:'congelacion',name:'Congelación',definition:{duration:0,typeFilter:{mode:'all',types:[]},rules:[
  baseRule('on_status',{type:'modify_active_cooldowns',value:1,stat:''},'self'),
  baseRule('on_status',{type:'restrict_moves',value:'',stat:''},'self',100,5),
  baseRule('on_status',{type:'remove_status',value:'',stat:''},'self',100,0)
]}};
const freezeMove={id:'congelar',name:'Congelar',definition:{kind:'unique',type:'hielo',category:'status',power:0,accuracy:100,criticalChance:0,priority:0,cooldown:0,rules:[baseRule('on_hit',{type:'apply_status',value:'congelacion',stat:''},'target',100,0)]}};
const poke={id:'golpe',name:'Golpe',definition:{kind:'global',type:'agua',category:'physical',power:20,accuracy:100,criticalChance:0,priority:0,cooldown:0,rules:[]}};
catalog={entities:{a:ent('a',['noop','noop','noop','congelar']),b:ent('b',['golpe','noop','noop','noop'])},moves:{noop,congelar:freezeMove,golpe:poke},abilities:{g:ability('g'),u:ability('u')},statuses:{congelacion:freeze},effects:{},weathers:{},fields:{},scenarios:{}};
r=simulate({left:'a',right:'b',catalog,chart:{},turns:2,leftOrders:['congelar','noop'],rightOrders:['golpe','golpe'],randomSource:()=>.5});
assert.equal(r.right.status,null,'Congelación puede quitarse a sí misma');
assert.ok(!r.right.effects.some(e=>e.id==='restrict_moves'),'la restricción creada por Congelación desaparece con el estado');
assert.ok(r.log.filter(x=>x.includes('b usó Golpe')).length>=2,'el personaje puede volver a usar movimientos tras descongelarse');

const env={id:'frio',name:'Frío',definition:{duration:5,rules:[],fieldEffects:[{type:'damage_percent',chance:100,filter:'all',types:[],value:10,timing:'turn_start'}]}};
validateDefinition('fields',env.definition);
const setField={id:'campo',name:'Campo',definition:{kind:'unique',type:'agua',category:'status',power:0,accuracy:100,criticalChance:0,priority:0,cooldown:0,rules:[baseRule('on_hit',{type:'set_field',value:'frio',stat:''},'self')]}};
catalog=structuredClone(catalog);catalog.fields.frio=env;catalog.moves.campo=setField;catalog.entities.a.definition.uniqueMoveId='campo';
r=simulate({left:'a',right:'b',catalog,chart:{},turns:2,leftOrders:['campo','noop'],rightOrders:['noop','noop'],randomSource:()=>.5});
assert.equal(r.left.hp,90,'efecto de campo configurado en inicio de turno se ejecuta al inicio de la ronda siguiente');
assert.equal(r.right.hp,90,'el timing del entorno se aplica a todos los objetivos filtrados');
console.log('PASS: eventos de movimiento, timing de entorno y limpieza de restricciones por estado');
