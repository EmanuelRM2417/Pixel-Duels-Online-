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
  const parts=[rule.condition||{type:'always'},...(Array.isArray(rule.conditions)?rule.conditions:[])];
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
// Laboratorio de equipos: hasta ocho entidades por lado, una activa (Singles).
// Las órdenes son datos declarativos, nunca código del usuario.
export function simulate({left,right,leftTeam,rightTeam,chart,catalog,turns=10,seed=12345,weather='',field='',leftMove='',rightMove='',leftOrders=[],rightOrders=[]}) {
  if (!Number.isInteger(turns) || turns < 1 || turns > 50) throw Error('Rondas entre 1 y 50.');
  let n=Number(seed)>>>0;
  const random=()=>{n=(Math.imul(1664525,n)+1013904223)>>>0;return n/4294967296;};
  const state={chart,catalog,weather,field,weatherTurns:0,fieldTurns:0,random,log:[],timeline:[]};
  const load=id=>{
    const e=catalog.entities[id];if(!e)throw Error('Entidad no encontrada: '+id);
    const d=e.definition;
    const moves=[...(d.moveIds||[]),d.uniqueMoveId].map(mid=>{const m=catalog.moves[mid];if(!m)throw Error('Ataque inexistente: '+mid);return m;});
    const abilities=[d.globalAbilityId,d.uniqueAbilityId].map(aid=>{const a=catalog.abilities[aid];if(!a)throw Error('Habilidad inexistente: '+aid);return a;});
    return actor(e,moves,abilities);
  };
  const parseTeam=(value,single,side)=>{
    const ids=value===undefined?[single]:value;
    if(!Array.isArray(ids)||ids.length<1||ids.length>8||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length)throw Error('El equipo '+side+' debe tener entre 1 y 8 entidades diferentes.');
    return ids.map(load);
  };
  const teams=[parseTeam(leftTeam,left,'izquierdo'),parseTeam(rightTeam,right,'derecho')];
  const active=[0,0];
  const current=i=>teams[i][active[i]];
  const remaining=i=>teams[i].some(a=>a.hp>0);
  const summary=p=>({id:p.id,name:p.name,hp:p.hp,maxHp:p.maxHp,stages:{...p.stages},status:p.status,types:p.types});
  const snapshot=(round)=>state.timeline.push({round,left:summary(current(0)),right:summary(current(1)),weather:state.weather,field:state.field,teams:teams.map(t=>t.map(summary))});
  const enter=i=>rulesFor(null,'on_enter',current(i),current(1-i),state);
  const switchTo=(i,index,forced=false)=>{
    if(!Number.isInteger(index)||index<0||index>=teams[i].length||index===active[i]||teams[i][index].hp<=0)throw Error('Cambio inválido en equipo '+(i===0?'izquierdo':'derecho')+'.');
    active[i]=index;state.log.push((forced?'Relevo automático: ':'Cambio: ')+current(i).name+' entra al campo.');enter(i);
  };
  const autoReplace=i=>{
    if(current(i).hp>0)return;
    const next=teams[i].findIndex((a,j)=>j!==active[i]&&a.hp>0);
    if(next>=0)switchTo(i,next,true);
  };
  const parseOrder=(orders,round,side,defaultMove)=>{
    const order=orders[round-1];
    if(order===undefined||order===null||order==='')return {move:defaultMove};
    if(typeof order==='string')return {move:order};
    if(!order||typeof order!=='object'||Array.isArray(order))throw Error('Orden inválida en ronda '+round+' ('+side+').');
    if(order.switch!==undefined)return {switch:order.switch};
    if(order.move!==undefined&&typeof order.move!=='string')throw Error('ID de ataque inválido en ronda '+round+'.');
    return {move:order.move||defaultMove};
  };
  const chooseMove=(a,requested)=>{
    if(requested){const m=a.moves.find(m=>m.id===requested);if(!m)throw Error('El ataque '+requested+' no pertenece a '+a.name+'.');return m;}
    return a.moves.find(m=>m.definition.category!=='status')||a.moves[0];
  };
  enter(0);enter(1);snapshot(0);
  let played=0;
  for(let round=1;round<=turns&&remaining(0)&&remaining(1);round++){
    played=round;state.log.push('— Ronda '+round+' —');
    autoReplace(0);autoReplace(1);
    const orders=[parseOrder(leftOrders,round,'izquierda',leftMove),parseOrder(rightOrders,round,'derecha',rightMove)];
    // Cambios declarados se resuelven antes de los ataques, por orden de Velocidad.
    const switches=[0,1].filter(i=>orders[i].switch!==undefined).sort((i,j)=>effective(current(j),'speed')-effective(current(i),'speed')||(random()<.5?-1:1));
    for(const i of switches){const dest=orders[i].switch;if(!Number.isInteger(dest))throw Error('El índice de cambio debe ser entero (0 a 7).');switchTo(i,dest);}
    for(const i of [0,1])if(current(i).hp>0)rulesFor(null,'turn_start',current(i),current(1-i),state);
    const attacks=[0,1].filter(i=>orders[i].switch===undefined&&current(i).hp>0).map(i=>({side:i,actor:current(i),move:chooseMove(current(i),orders[i].move)}));
    attacks.sort((x,y)=>{
      const px=Number(x.move.definition.priority)||0,py=Number(y.move.definition.priority)||0;
      if(px!==py)return py-px;
      const sx=effective(x.actor,'speed'),sy=effective(y.actor,'speed');
      return sx!==sy?sy-sx:(random()<.5?-1:1);
    });
    for(const turn of attacks){
      if(!remaining(0)||!remaining(1))break;
      if(current(turn.side)!==turn.actor||turn.actor.hp<=0)continue;
      const opponent=current(1-turn.side);
      if(opponent.hp<=0)continue;
      hit(turn.actor,opponent,turn.move,state);
      // Los reemplazos automáticos entran después de resolver el grupo de acciones.
    }
    for(const i of [0,1])if(current(i).hp>0)rulesFor(null,'turn_end',current(i),current(1-i),state);
    for(const i of [0,1])if(current(i).hp>0)rulesFor(null,'round_end',current(i),current(1-i),state);
    for(const t of teams)for(const a of t)if(a.hp>0)tick(a);
    if(state.weatherTurns>0&&--state.weatherTurns===0){state.weather='';state.log.push('El clima termina.');}
    if(state.fieldTurns>0&&--state.fieldTurns===0){state.field='';state.log.push('El campo termina.');}
    for(const i of [0,1])autoReplace(i);
    snapshot(round);
  }
  const leftAlive=remaining(0),rightAlive=remaining(1);
  const winner=leftAlive&&!rightAlive?'left':rightAlive&&!leftAlive?'right':null;
  return {ok:true,mode:'private-singles-team-simulation',rounds:played,winner,winnerId:winner==='left'?current(0).id:winner==='right'?current(1).id:null,left:summary(current(0)),right:summary(current(1)),leftTeam:teams[0].map(summary),rightTeam:teams[1].map(summary),weather:state.weather,field:state.field,log:state.log.slice(0,1500),timeline:state.timeline};
}
