import assert from 'node:assert/strict';
import fs from 'node:fs';
import { simulate } from './battle-engine.js';

const move=id=>({id,name:id,definition:{kind:'global',type:'fuego',category:'physical',power:40,accuracy:100,criticalChance:0,priority:0,cooldown:0,rules:[]}});
const ability=id=>({id,name:id,definition:{kind:'global',rules:[]}});
const uniqueAbility=id=>({id,name:id,definition:{kind:'unique',rules:[]}});
const uniqueMove={id:'unique',name:'Único',definition:{kind:'unique',type:'fuego',category:'status',power:0,accuracy:0,criticalChance:0,priority:0,cooldown:0,rules:[]}};
const catalog={entities:{},moves:{m1:move('m1'),m2:move('m2'),m3:move('m3'),unique:uniqueMove},abilities:{a:ability('a'),u:uniqueAbility('u')},effects:{},statuses:{},weathers:{},fields:{},scenarios:{}};
for(let i=0;i<8;i++)catalog.entities['e'+i]={id:'e'+i,name:'Entidad '+i,definition:{types:['fuego'],hp:100,attack:100,defense:100,specialAttack:100,specialDefense:100,speed:100,moveIds:['m1','m2','m3'],uniqueMoveId:'unique',globalAbilityId:'a',uniqueAbilityId:'u'}};
for(let i=8;i<16;i++)catalog.entities['e'+i]={...catalog.entities.e0,id:'e'+i,name:'Entidad '+i};
const chart={fuego:{fuego:'neutral'}};
const result=simulate({left:'e0',right:'e8',leftTeam:Array.from({length:8},(_,i)=>'e'+i),rightTeam:Array.from({length:8},(_,i)=>'e'+(i+8)),catalog,chart,turns:1,leftOrders:[{move:'m1'}],rightOrders:[{move:'m1'}],randomTape:[],randomSource:()=>0.2});
assert.equal(result.rounds,1);
assert.ok(result.log.some(x=>x.includes('usó m1')));
assert.ok(result.left.hp<100||result.right.hp<100);

const worker=fs.readFileSync(new URL('./worker.js',import.meta.url),'utf8');
assert.match(worker,/public-v1:current/);
assert.match(worker,/PUBLIC_CONTENT/);
assert.match(worker,/PUBLIC_SPRITES/);
assert.match(worker,/data\.type===\"order\"/);
assert.doesNotMatch(worker,/editor-api\//);
const html=fs.readFileSync(new URL('./public/index.html',import.meta.url),'utf8');
assert.match(html,/Alpha 0\.1/);
assert.match(html,/Buscar personaje/);
assert.match(html,/data-move/);
assert.match(html,/Cambiar personaje/);
console.log('alpha public tests ok');
