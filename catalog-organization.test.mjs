import { validateDefinition } from './catalog-validation.js';
const baseEntity={types:['valor'],hp:500,attack:200,defense:200,specialAttack:200,specialDefense:200,speed:200,tags:['Dioses','Antigua Grecia'],moveIds:['a','b','c'],uniqueMoveId:'d',globalAbilityId:'e',uniqueAbilityId:'f',spriteId:'hades',rules:[]};
validateDefinition('entities',baseEntity);
let failed=false;try{validateDefinition('entities',{...baseEntity,hp:501});}catch{failed=true}if(!failed)throw Error('PS 501 should fail');
validateDefinition('moves',{tags:['Maldición'],kind:'global',type:'valor',category:'status',power:0,accuracy:100,criticalChance:0,priority:0,cooldown:2,rules:[{event:'manual',condition:{type:'always',value:''},conditions:[],target:'target',action:{type:'immunity',value:'',stat:'',damageClass:'special',typeFilter:{mode:'exclude',types:['fuego']}},chance:100,duration:2,limit:0,operator:'AND',negate:false}]});
validateDefinition('fields',{duration:5,rules:[],fieldEffects:[{type:'immunity',chance:100,filter:'all',types:[],timing:'continuous',damageClass:'physical',immunityTypeFilter:{mode:'include',types:['oscuridad']}}]});
console.log('PASS: valor, PS 500, tags and immunity definitions');
