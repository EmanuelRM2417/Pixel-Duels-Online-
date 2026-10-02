import fs from 'node:fs';
const html=fs.readFileSync(new URL('./public/editor/index.html',import.meta.url),'utf8');
for(const expected of [
  "const moveIds=Array.isArray(definition.moveIds)?definition.moveIds:[];",
  "move2Id:moveIds[0]||''",
  "move3Id:moveIds[1]||''",
  "move4Id:moveIds[2]||''",
  "result.moveIds=[result.move2Id,result.move3Id,result.move4Id].filter(Boolean)"
]) if(!html.includes(expected)) throw Error('Missing entity move slot mapping: '+expected);
console.log('PASS: entity moveIds are restored into the three global move editor slots');
