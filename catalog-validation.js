// Validación de configuración, no balance automático. No muta el contenido.
export const EVENTS = ['on_enter','turn_start','turn_end','round_end','on_attack','on_hit','on_damage_taken','manual'];
export const CONDITIONS = ['always','hp_below','hp_above','weather_is','field_is','has_status','has_type','was_hit_by_type','stat_below'];
export const TARGETS = ['self','target','all_active'];
export const ACTIONS = ['damage','heal','stat_change','apply_status','remove_status','apply_effect','remove_effect','set_weather','set_field','set_scenario','environment_immunity','prevent_environment','suppress_abilities','restrict_moves'];
const TYPES = ['fuego','planta','roca','hielo','rayo','metal','guerra','mente','encanto','espectro','divinidad','luz','oscuridad','viento','dragon','agua','veneno','tecnologia','agilidad','espiritu'];
const STATS = ['attack','defense','specialAttack','specialDefense','speed','accuracy','evasion','criticalChance'];
const ENV_CATS=['weathers','fields','scenarios'];
const ENV_ACTIONS=['damage_percent','heal_percent','stat_change','critical_change','remove_status','block_status'];
const slug = v => typeof v === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) && v.length <= 60;
const numeric = v => typeof v === 'number' && Number.isFinite(v);
const within = (v,a,b) => numeric(v) && v>=a && v<=b;
function fail(message){throw Error(message);}
function condition(c, prefix){
 if(!c || !CONDITIONS.includes(c.type)) fail(prefix+': condición desconocida o sin seleccionar.');
 if(c.type==='always') {if(c.value!==''&&c.value!==null&&c.value!==undefined) fail(prefix+': «Siempre» no lleva valor.');return;}
 if(['hp_below','hp_above'].includes(c.type) && !(c.value!=='' && within(Number(c.value),0,100))) fail(prefix+': el porcentaje de PS debe ser 0–100.');
 if(c.type==='stat_below' && !(c.value!=='' && within(Number(c.value),0,10000))) fail(prefix+': la Velocidad límite debe ser un número válido.');
 if(['weather_is','field_is','has_status','has_type','was_hit_by_type'].includes(c.type) && !slug(c.value)) fail(prefix+': se necesita un ID válido.');
 if(['has_type','was_hit_by_type'].includes(c.type) && !TYPES.includes(c.value)) fail(prefix+': tipo desconocido.');
}
export function validateRules(definition,category){
 if(!Array.isArray(definition.rules)) fail('La lista de reglas debe ser una lista (puede estar vacía).');
 if(definition.rules.length>100) fail('Máximo 100 reglas por elemento.');
 for(const [i,r] of definition.rules.entries()){
  const at=`Regla ${i+1}`;
  if(!EVENTS.includes(r.event)) fail(at+': elegí un evento admitido.');
  if(category==='moves' && r.event!=='manual') fail(at+': un ataque solo admite el evento «Al usar» en este laboratorio.');
  if(category==='effects' && r.event!=='manual') fail(at+': un efecto reutilizable solo admite el evento manual en este laboratorio.');
  if(['statuses','entities',...ENV_CATS].includes(category)) fail(at+': esta categoría todavía no ejecuta reglas propias; no se permite guardar una regla que sería ignorada.');
  condition(r.condition,at);
  if(!Array.isArray(r.conditions)) fail(at+': las condiciones adicionales deben ser una lista.');
  if(r.conditions.length>20) fail(at+': máximo 20 condiciones adicionales.');
  for(const [j,c] of r.conditions.entries()){
    condition(c,at+' / condición '+(j+2));
    if(!['AND','OR'].includes(c.operator)) fail(at+': operador debe ser Y u O.');
    if(typeof c.negate!=='boolean') fail(at+': «NO» debe ser sí o no.');
  }
  if(!TARGETS.includes(r.target)) fail(at+': objetivo no implementado.');
  if(!r.action || !ACTIONS.includes(r.action.type)) fail(at+': acción no implementada.');
  if(!within(r.chance,0,100)) fail(at+': probabilidad obligatoria de 0 a 100 %.');
  if(!Number.isInteger(r.duration)||r.duration<0||r.duration>9999) fail(at+': duración entera obligatoria de 0 a 9999.');
  if(!Number.isInteger(r.limit)||r.limit<0||r.limit>9999) fail(at+': límite entero obligatorio de 0 a 9999.');
  const a=r.action, v=a.value;
  if(['damage','heal'].includes(a.type) && !(v!==''&&Number.isInteger(Number(v))&&Number(v)>=0&&Number(v)<=100000)) fail(at+': daño o curación requieren PS enteros entre 0 y 100000.');
  if(a.type==='stat_change' && (!STATS.includes(a.stat)||!(v!==''&&Number.isInteger(Number(v))&&Number(v)>=-10&&Number(v)<=10))) fail(at+': elegí estadística y cambio entero entre −10 y +10 niveles.');
  if(['apply_status','apply_effect','remove_effect','set_weather','set_field','set_scenario'].includes(a.type)&&!slug(v)) fail(at+': la acción necesita un ID válido.');
  if(['environment_immunity','prevent_environment'].includes(a.type) && !['weathers','fields','scenarios','all'].includes(v))fail(at+': inmunidad debe indicar clima, campo, escenario o todos.');
  if(a.type==='apply_effect' && category==='effects' && r.duration!==0) fail(at+': la duración de un efecto reutilizable manual no está implementada; elegí 0.');
  if(['set_weather','set_field','set_scenario'].includes(a.type) && r.target==='all_active') fail(at+': el clima/campo es global, no admite «ambas entidades» como objetivo.');
  if(r.event==='manual' && category==='abilities') fail(at+': el evento manual no se ejecuta automáticamente en habilidades; usá un evento de habilidad.');
 }
}
export function validateDefinition(category,d){
 if(!d || typeof d!=='object'||Array.isArray(d)) fail('Definición inválida.');
 if(category==='moves'){
  if(!TYPES.includes(d.type)||!['physical','special','status'].includes(d.category)||!['global','unique'].includes(d.kind)) fail('Ataque: elegí clase, tipo y categoría.');
  if(!within(d.power,0,500)||!within(d.accuracy,0,100)||!within(d.criticalChance,0,50)||!Number.isInteger(d.priority)||d.priority< -5||d.priority>5) fail('Ataque: potencia 0–500, precisión 0–100, crítico 0–50, prioridad −5 a +5.');
 }
 if(category==='abilities'&&!['global','unique'].includes(d.kind)) fail('Habilidad: elegí global o exclusiva.');
 if(category==='entities'){
  if(!Array.isArray(d.types)||d.types.length<1||d.types.length>3||new Set(d.types).size!==d.types.length||d.types.some(t=>!TYPES.includes(t)))fail('Entidad: elegí 1–3 tipos distintos.');
  for(const k of ['hp','attack','defense','specialAttack','specialDefense','speed'])if(!Number.isInteger(d[k])||d[k]<(k==='hp'?1:0)||d[k]>200)fail('Entidad: estadística inválida '+k+'.');
  if(!Array.isArray(d.moveIds)||d.moveIds.length!==3||new Set([...d.moveIds,d.uniqueMoveId]).size!==4||![...d.moveIds,d.uniqueMoveId,d.globalAbilityId,d.uniqueAbilityId].every(slug))fail('Entidad: tres ataques globales, uno exclusivo y dos habilidades con IDs válidos.');
  if(d.spriteId&&!slug(d.spriteId))fail('Entidad: sprite ID inválido.');
 }
 if(category==='statuses'&&!Number.isInteger(d.duration))fail('Estado: duración entera obligatoria.');
 if(ENV_CATS.includes(category)){
  if(d.duration!==5)fail('Climas, campos y escenarios duran exactamente 5 rondas.');
  if(!Array.isArray(d.fieldEffects)||d.fieldEffects.length>100)fail('Efectos de entorno: se requiere una lista de hasta 100.');
  if(Array.isArray(d.rules)&&d.rules.length)fail('Los entornos no llevan reglas de activación: usá efectos de entorno.');
  for(const [i,e] of d.fieldEffects.entries()){
   const at='Efecto '+(i+1);
   if(!ENV_ACTIONS.includes(e.type))fail(at+': operación no admitida.');
   if(!within(e.chance,0,100))fail(at+': probabilidad entre 0 y 100 %.');
   if(!['all','include','exclude'].includes(e.filter))fail(at+': elegí filtro de tipos.');
   if(!Array.isArray(e.types)||new Set(e.types).size!==e.types.length||e.types.some(t=>!TYPES.includes(t)))fail(at+': tipos inválidos o repetidos.');
   if(e.filter!=='all'&&!e.types.length)fail(at+': seleccioná al menos un tipo.');
   if(e.filter==='all'&&e.types.length)fail(at+': «Todos» no lleva selección de tipos.');
   if(['damage_percent','heal_percent'].includes(e.type)&&!within(e.value,0,100))fail(at+': porcentaje de PS entre 0 y 100.');
   if(e.type==='stat_change'&&(!STATS.includes(e.stat)||!Number.isInteger(e.value)||e.value< -10||e.value>10))fail(at+': estadística y niveles enteros entre −10 y +10.');
   if(e.type==='critical_change'&&(!Number.isInteger(e.value)||e.value< -10||e.value>10))fail(at+': crítico entre −10 y +10 niveles.');
   if(['remove_status','block_status'].includes(e.type)&&e.value!==undefined)fail(at+': esta acción no lleva valor.');
   if(['remove_status','block_status'].includes(e.type)&&e.timing!=='round_end'&&e.timing!=='continuous')fail(at+': momento inválido.');
   if(['damage_percent','heal_percent'].includes(e.type)&&e.timing!=='round_end')fail(at+': daño y curación se aplican al final de ronda.');
   if(['stat_change','critical_change'].includes(e.type)&&e.timing!=='continuous')fail(at+': las estadísticas se modifican mientras esté activo.');
  }
 }
 if(category==='scenarios'&&d.imageId&&!slug(d.imageId))fail('Escenario: ID de imagen inválido.');
 validateRules(d,category);
}
