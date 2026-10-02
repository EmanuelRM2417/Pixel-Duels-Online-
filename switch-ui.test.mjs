import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('./public/editor/index.html',import.meta.url),'utf8');
assert.ok(html.includes('function openSwitchPicker(side)'), 'debe existir selector visual de cambio');
assert.ok(html.includes("battlePendingOrder[side]={switch:Number(b.dataset.switchIndex)}"), 'el selector debe crear una orden switch');
assert.ok(html.includes("orders.push({switch:pending.switch})"), 'simAdvance debe enviar el cambio al motor');
assert.ok(!html.includes('El selector de cambio voluntario todavía no está conectado.'), 'no debe quedar el placeholder antiguo');
console.log('PASS: voluntary switch UI is connected to manual battle orders');
