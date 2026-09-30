// Motor determinista de PRUEBAS privadas. No utiliza código ejecutable de contenido.
export const STATS = ['hp','attack','defense','specialAttack','specialDefense','speed'];
const clamp = (n, min, max) => Math.max(min, Math.min(max, Number(n) || 0));
const integer = n => Math.round(Number(n) || 0);
const safe = s => String(s || '').slice(0, 100);
const percent = x => clamp(x, 0, 100);
const base = d => Object.fromEntries(STATS.map(k => [k, clamp(d[k] ?? 1, k === "hp" ? 1 : 0, 200)]));
export function validateEntity(entry) {
  const d = entry?.definition;
  if (!d || !Array.isArray(d.types) || d.types.length < 1 || d.types.length > 3 || new Set(d.types).size !== d.types.length) throw Error('Entidad sin 1–3 tipos distintos.');
  for (const s of STATS) if (!Number.isInteger(Number(d[s])) || Number(d[s]) < (s === "hp" ? 1 : 0) || Number(d[s]) > 200) throw Error('Estadística inválida: ' + s);
  if (!Array.isArray(d.moveIds) || d.moveIds.length !== 3 || !d.uniqueMoveId || !d.globalAbilityId || !d.uniqueAbilityId) throw Error('La entidad requiere tres ataques globales, uno exclusivo y dos habilidades.');
}
function actor(entry, moves, abilities) {
  validateEntity(entry);
  const d = entry.definition, stats = base(d);
  return { id:entry.id, name:entry.name, types:d.types, stats, hp:stats.hp, maxHp:stats.hp, stages:{}, status:null, effects:[], moves, abilities, used:{}, lastHitType:null };
}
function effective(a, stat) { return Math.max(1, Math.round(a.stats[stat] * (1 + clamp(a.stages[stat] || 0, -10, 10) * .05))); }
function meets(cond, user, target, state) {
  if (!cond || cond.type === 'always') return true;
  const v = cond.value;
  switch (cond.type) {
    case 'hp_below': return user.hp / user.maxHp * 100 < Number(v);
    case 'hp_above': return user.hp / user.maxHp * 100 > Number(v);
    case 'weather_is': return state.weather === v;
    case 'field_is': return state.field === v;
    case 'has_status': return user.status?.id === v;
    case 'has_type': return user.types.includes(v);
    case 'was_hit_by_type': return user.lastHitType === v;
    case 'stat_below': return effective(user, 'speed') < Number(v);
    default: return false; // Las condiciones desconocidas nunca se ejecutan.
  }
}
function conditionsPass(rule,user,target,state) {
  const parts=Array.isArray(rule.conditions)&&rule.conditions.length?rule.conditions:[rule.condition||{type:'always'}];
  let result=null;
  for (const part of parts) {
    const yes=part.negate?!meets(part,user,target,state):meets(part,user,target,state);
    result=result===null?yes:part.operator==='OR'?(result||yes):(result&&yes);
  }
  return rule.negate?!result:result;
}
function chance(rule, state) { return percent(rule.chance ?? 100) >= 100 || state.random() * 100 < percent(rule.chance ?? 100); }
function action(rule, user, opponent, state, depth) {
  const targets = rule.target === 'self' || rule.target === 'ally' || rule.target === 'all_allies' ? [user] : rule.target === 'all_active' ? [user,opponent] : [opponent];
  const act = rule.action || {}, v = act.value;
  if (act.type === 'set_weather') { state.weather = safe(v); state.weatherTurns = Math.max(0,integer(rule.duration)); state.log.push('Clima: ' + state.weather); return; }
  if (act.type === 'set_field') { state.field = safe(v); state.fieldTurns = Math.max(0,integer(rule.duration)); state.log.push('Campo: ' + state.field); return; }
  if (act.type === 'apply_effect') {
    const effect = state.catalog.effects?.[v];
    if (effect && depth < 6) for (const sub of effect.definition.rules || []) if (sub.event === 'manual' && conditionsPass(sub,user,opponent,state) && chance(sub,state)) action(sub,user,opponent,state,depth+1);
    return;
  }
  for (const t of targets) {
    if (!t || t.hp <= 0) continue;
    if (act.type === 'heal') { const amount = Math.max(0,integer(v)); t.hp = Math.min(t.maxHp,t.hp+amount); state.log.push(`${t.name} recupera ${amount} PS.`); }
    else if (act.type === 'damage') { const amount = Math.max(1,integer(v)); t.hp = Math.max(0,t.hp-amount); state.log.push(`${t.name} recibe ${amount} de daño adicional.`); }
    else if (act.type === 'stat_change' && STATS.includes(act.stat) && act.stat !== 'hp') { t.stages[act.stat] = clamp((t.stages[act.stat] || 0) + integer(v),-10,10); state.log.push(`${t.name}: ${act.stat} ${t.stages[act.stat]}.`); }
    else if (act.type === 'apply_status' && !t.status) { t.status = {id:safe(v),turns:Math.max(0,integer(rule.duration))}; state.log.push(`${t.name} recibe estado ${t.status.id}.`); }
    else if (act.type === 'remove_status') { t.status = null; state.log.push(`${t.name} pierde su estado.`); }
    else if (act.type === 'suppress_abilities') { t.effects.push({id:'suppressed',turns:Math.max(1,integer(rule.duration))}); state.log.push(`${t.name}: habilidades anuladas.`); }
    else if (act.type === 'remove_effect') t.effects = t.effects.filter(e=>e.id!==v);
    else if (act.type === 'restrict_moves') t.effects.push({id:'restrict_moves',turns:Math.max(1,integer(rule.duration))});
  }
}
function rulesFor(entry, event, user, opponent, state) {
  if (user.hp <= 0) return;
  for (const ability of user.abilities) {
    if (!ability || user.effects.some(e=>e.id==='suppressed')) continue;
    for (const [i,rule] of (ability.definition.rules || []).entries()) {
      const key = ability.id + ':' + i;
      if (rule.event !== event || (rule.limit > 0 && (user.used[key] || 0) >= rule.limit)) continue;
      if (!conditionsPass(rule,user,opponent,state) || !chance(rule,state)) continue;
      user.used[key] = (user.used[key] || 0)+1;
      action(rule,user,opponent,state,0);
    }
  }
}
function hit(attacker, defender, move, state) {
  const d = move.definition;
  if (attacker.hp <= 0 || defender.hp <= 0) return;
  if (attacker.effects.some(e=>e.id==='restrict_moves')) { state.log.push(`${attacker.name} tiene ataques restringidos.`); return; }
  rulesFor(null,'on_attack',attacker,defender,state);
  if (d.accuracy !== null && d.accuracy !== undefined && state.random()*100 >= percent(d.accuracy)) { state.log.push(`${attacker.name} falla ${move.name}.`); return; }
  let damage = 0;
  if (d.category !== 'status' && Number(d.power) > 0) {
    const attack = effective(attacker,d.category === 'special'?'specialAttack':'attack');
    const defense = effective(defender,d.category === 'special'?'specialDefense':'defense');
    const raw = Math.max(1,Math.floor((2*50/5+2)*Number(d.power)*attack/defense/50+2));
    let bonus = attacker.types.includes(d.type) ? .2 : 0;
    let immune = false;
    for (const t of defender.types) {
      const relation = state.chart?.[d.type]?.[t] || 'neutral';
      if (relation === 'inmune') immune = true;
      else if (relation === 'eficaz') bonus += .2;
      else if (relation === 'ineficaz') bonus -= .2;
    }
    if (state.random()*100 < percent(d.criticalChance ?? 0)) { bonus += .5; state.log.push('¡Golpe crítico!'); }
    damage = immune ? 0 : Math.max(1,integer(raw*(1+bonus)));
    defender.hp = Math.max(0,defender.hp-damage);
    defender.lastHitType = d.type;
    state.log.push(`${attacker.name} usa ${move.name}: ${damage} daño a ${defender.name}.`);
  } else state.log.push(`${attacker.name} usa ${move.name}.`);
  for (const rule of d.rules || []) if (rule.event === 'manual' && conditionsPass(rule,attacker,defender,state) && chance(rule,state)) action(rule,attacker,defender,state,0);
  rulesFor(null,'on_hit',attacker,defender,state);
  if (damage > 0) rulesFor(null,'on_damage_taken',defender,attacker,state);
}
function tick(actor) { for (const e of actor.effects) if (e.turns > 0) e.turns--; actor.effects = actor.effects.filter(e=>e.turns !== 0); if (actor.status?.turns > 0 && --actor.status.turns === 0) actor.status = null; }
export function simulate({left,right,chart,catalog,turns=10,seed=12345,weather='',field='',leftMove='',rightMove=''}) {
  if (!Number.isInteger(turns) || turns<1 || turns>50) throw Error('Rondas entre 1 y 50.');
  let n = Number(seed) >>> 0;
  const random = () => { n = (Math.imul(1664525,n)+1013904223)>>>0; return n/4294967296; };
  const state = {chart,catalog,weather,field,weatherTurns:0,fieldTurns:0,random,log:[]};
  const load = id => { const e=catalog.entities[id]; if (!e) throw Error('Entidad no encontrada: '+id); const d=e.definition; const moveIds=[...(d.moveIds||[]),d.uniqueMoveId]; const moves=moveIds.map(mid=>{const m=catalog.moves[mid];if(!m)throw Error('Ataque inexistente: '+mid);return m;}); const abilities=[d.globalAbilityId,d.uniqueAbilityId].map(aid=>{const a=catalog.abilities[aid];if(!a)throw Error('Habilidad inexistente: '+aid);return a;}); return actor(e,moves,abilities); };
  const a=load(left),b=load(right);
  rulesFor(null,'on_enter',a,b,state);rulesFor(null,'on_enter',b,a,state);
  let round=0;
  for (round=1;round<=turns && a.hp>0 && b.hp>0;round++) {
    state.log.push(`— Ronda ${round} —`);
    rulesFor(null,'turn_start',a,b,state);rulesFor(null,'turn_start',b,a,state);
    const pick = p => p.moves.find(m=>m.definition.category !== 'status') || p.moves[0];
    const ma=a.moves.find(m=>m.id===leftMove)||pick(a),mb=b.moves.find(m=>m.id===rightMove)||pick(b);
    const pa=clamp(ma.definition.priority,-5,5),pb=clamp(mb.definition.priority,-5,5);
    const first = pa!==pb ? (pa>pb?a:b) : effective(a,'speed')!==effective(b,'speed') ? (effective(a,'speed')>effective(b,'speed')?a:b) : (random()<.5?a:b);
    const second=first===a?b:a;
    hit(first,second,first===a?ma:mb,state);
    if (second.hp>0) hit(second,first,second===a?ma:mb,state);
    rulesFor(null,'turn_end',a,b,state);rulesFor(null,'turn_end',b,a,state);
    rulesFor(null,'round_end',a,b,state);rulesFor(null,'round_end',b,a,state);
    tick(a);tick(b);
    if (state.weatherTurns>0 && --state.weatherTurns===0) state.weather='';
    if (state.fieldTurns>0 && --state.fieldTurns===0) state.field='';
  }
  const summary=p=>({id:p.id,name:p.name,hp:p.hp,maxHp:p.maxHp,stages:p.stages,status:p.status});
  return {ok:true,mode:'private-singles-simulation',rounds:Math.min(round,turns),winner:a.hp===b.hp?null:(a.hp>b.hp?a.id:b.id),left:summary(a),right:summary(b),weather:state.weather,field:state.field,log:state.log.slice(0,1000)};
}
