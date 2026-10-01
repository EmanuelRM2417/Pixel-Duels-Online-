import assert from 'node:assert/strict';
import {validateDefinition} from './catalog-validation.js';
const d={duration:3,rules:[{event:'on_status',condition:{type:'always',value:''},conditions:[],target:'self',action:{type:'damage',value:'5',stat:''},chance:100,duration:0,limit:0,operator:'AND',negate:false}]};
assert.doesNotThrow(()=>validateDefinition('statuses',d));
console.log('status implicit rule validation ok');
