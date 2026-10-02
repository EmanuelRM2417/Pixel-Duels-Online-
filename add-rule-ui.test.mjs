import fs from 'node:fs';
const html=fs.readFileSync(new URL('./public/editor/index.html', import.meta.url),'utf8');
if(/\bisEffect\b/.test(html)) throw new Error('Quedó una referencia huérfana a isEffect en el editor');
if(!html.includes('id="builderAddRule"')) throw new Error('Falta el botón Agregar regla');
if(!html.includes('function addRule(rule = {})')) throw new Error('Falta addRule()');
if(!html.includes('document.getElementById("builderAddRule").addEventListener("click",()=>addRule())')) throw new Error('El botón Agregar regla no está conectado a addRule()');
console.log('add rule UI regression ok');
