// Motor privado con RNG criptográfico y reproducción interna de rondas para controles manuales.
export const STATS = ['hp','attack','defense','specialAttack','specialDefense','speed'];
const clamp = (n, min, max) => Math.max(min, Math.min(max, Number(n) || 0));
const integer = n => Math.round(Number(n) || 0);
const safe = s => String(s || '').slice(0, 100);
const percent = x => clamp(x, 0, 100);
const base = d => Object.fromEntries(STATS.map(k => [k, clamp(d[k] ?? 0, 0, k === 'hp' ? 500 : 200)]));
export function validateEntity(entry) {
  const d = entry?.definition;
  if (!d || !Array.isArray(d.types) || d.types.length < 1 || d.types.length > 3 || new Set(d.types).size !== d.types.length) throw Error('Entidad sin 1–3 tipos distintos.');
  for (const s of STATS) { const max=s==='hp'?500:200; if (!Number.isInteger(Number(d[s])) || Number(d[s]) < 0 || Number(d[s]) > max) throw Error('Estadística inválida: ' + s); } if(['attack','defense','specialAttack','specialDefense','speed'].reduce((n,k)=>n+Number(d[k]||0),0)>1000)throw Error('Las cinco estadísticas base superan 1000.');
  if (!Array.isArray(d.moveIds) || d.moveIds.length !== 3 || !d.uniqueMoveId || !d.globalAbilityId || !d.uniqueAbilityId) throw Error('La entidad requiere tres ataques globales, uno exclusivo y dos habilidades.');
}
function actor(entry, moves, abilities) {
  validateEntity(entry);
  const d = entry.definition, stats = base(d);
  return { id:entry.id, name:entry.name, types:d.types.map(t=>t==='espiritu'?'valor':t), stats, hp:stats.hp, maxHp:stats.hp, stages:{}, environmentStages:{}, environmentCrit:0, environmentImmune:[], environmentDamageImmunity:[], statusBlocked:false, status:null, effects:[], statSources:[], moves, abilities, used:{}, cooldowns:{}, cooldownSetRound:{}, environmentCooldownOnUse:[], lastHitType:null };
}
function ensureActorRuntime(a) {
  if (!a || typeof a !== 'object') throw Error('Combatiente inválido durante la resolución.');
  if (!Array.isArray(a.effects)) a.effects=[];
  if (!Array.isArray(a.statSources)) a.statSources=[];
  if (!Array.isArray(a.environmentCooldownOnUse)) a.environmentCooldownOnUse=[];
  if (!Array.isArray(a.environmentDamageImmunity)) a.environmentDamageImmunity=[];
  if (!a.cooldowns || typeof a.cooldowns !== 'object' || Array.isArray(a.cooldowns)) a.cooldowns={};
  if (!a.cooldownSetRound || typeof a.cooldownSetRound !== 'object' || Array.isArray(a.cooldownSetRound)) a.cooldownSetRound={};
  if (!a.stages || typeof a.stages !== 'object' || Array.isArray(a.stages)) a.stages={};
  if (!a.environmentStages || typeof a.environmentStages !== 'object' || Array.isArray(a.environmentStages)) a.environmentStages={};
  if (!a.statusStages || typeof a.statusStages !== 'object' || Array.isArray(a.statusStages)) a.statusStages={};
  if (!a.used || typeof a.used !== 'object' || Array.isArray(a.used)) a.used={};
  return a;
}
function battleLogName(a){return (a?._mirror?(a?.side==='left'?'@@L@@':a?.side==='right'?'@@R@@':''):'')+(a?.name||'');}
function stageFactor(...values){let up=0,down=0;for(const raw of values){const v=Number(raw)||0;if(v>0)up+=v;else down+=v;}up=clamp(up,0,10);down=clamp(down,-10,0);return Math.max(0,1+up*.10+down*.05);}
function effective(a, stat) { ensureActorRuntime(a); return Math.max(1, Math.round((a.stats[stat]??100) * stageFactor(a.stages[stat],a.environmentStages[stat],a.statusStages?.[stat]))); }
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
function sourceMeta(state){return {sourceKind:state.currentSourceKind||'efecto',sourceId:state.currentSourceId||'',sourceName:state.currentSourceName||'Efecto',sourceActor:state.currentSourceActor||''};}
function clearStatusLinkedEffects(actor,statusId){ensureActorRuntime(actor);actor.effects=actor.effects.filter(e=>!(e.sourceKind==='estado'&&e.sourceId===statusId));}
function action(rule, user, opponent, state, depth) {
  ensureActorRuntime(user); ensureActorRuntime(opponent);
  const targets = rule.target === 'self' || rule.target === 'ally' || rule.target === 'all_allies' ? [user] : rule.target === 'all_active' ? [user,opponent] : [opponent];
  const act = rule.action || {}, v = act.value;
  if (['set_weather','set_field','set_scenario'].includes(act.type)) {
    const kind={set_weather:'weathers',set_field:'fields',set_scenario:'scenarios'}[act.type];
    const key={weathers:'weather',fields:'field',scenarios:'scenario'}[kind];
    const entry=state.catalog[kind]?.[v];
    if (!entry) {state.log.push('Entorno no encontrado: '+safe(v));return;}
    if(state[key]===v){state.log.push('El entorno '+safe(v)+' ya está activo.');return;}
    if([state.current?.(0),state.current?.(1)].some(a=>a?.effects.some(e=>e.id==='prevent_environment'&&(e.kind==='all'||e.kind===kind)))){state.log.push('Activación de entorno bloqueada.');return;}
    state[key]=safe(v);state[key+'Turns']=5;state.log.push('Se activa '+key+': '+entry.name+' (5 rondas).');state.refreshEnvironment?.();return;
  }
  if (['environment_immunity','prevent_environment'].includes(act.type)) {
    for(const t of (rule.target==='all_active'?[user,opponent]:rule.target==='target'?[opponent]:[user])){
      t.effects.push({id:act.type,kind:v,turns:integer(rule.duration),permanent:integer(rule.duration)===0,source:'ability',...sourceMeta(state)});
      state.log.push(battleLogName(t)+' obtiene inmunidad a '+v+'.');
    }return;
  }
  if (act.type === 'apply_effect') {
    const effect = state.catalog.effects?.[v];
    if (effect && depth < 6) for (const sub of effect.definition.rules || []) if (sub.event === 'manual' && conditionsPass(sub,user,opponent,state) && chance(sub,state)) action(sub,user,opponent,state,depth+1);
    return;
  }
  for (const t of targets) {
    if (!t || t.hp <= 0) continue; ensureActorRuntime(t);
    if (act.type === 'heal') { const before=t.hp, amount=Math.max(0,integer(t.maxHp*percent(v)/100)); t.hp=Math.min(t.maxHp,t.hp+amount); const actual=t.hp-before; if(actual>0)state.log.push(`${battleLogName(t)} recupera ${actual} PS (${percent(v)} %).`); }
    else if (act.type === 'damage') { const amount=percent(v)===0?0:Math.max(1,integer(t.maxHp*percent(v)/100));if(amount>0){t.hp=Math.max(0,t.hp-amount);state.log.push(`${battleLogName(t)} recibe ${amount} de daño adicional (${percent(v)} %).`);} }
    else if (act.type === 'heal_from_damage') { const dealt=state.lastDamage?.attackerId===user.id?state.lastDamage.amount:0,before=t.hp; const amount=Math.max(0,integer(dealt*percent(v)/100)); t.hp=Math.min(t.maxHp,t.hp+amount); const actual=t.hp-before;if(actual>0)state.log.push(`${battleLogName(t)} recupera ${actual} PS (${percent(v)} % del daño infligido).`); }
    else if (act.type === 'stat_change' && ['attack','defense','specialAttack','specialDefense','speed','accuracy','evasion','criticalChance'].includes(act.stat)) { const before=t.stages[act.stat]||0,next=clamp(before+integer(v),-10,10),delta=next-before;t.stages[act.stat]=next;if(delta){t.statSources.push({stat:act.stat,value:delta,sourceName:state.currentSourceName||'Efecto',sourceKind:state.currentSourceKind||'efecto',sourceActor:state.currentSourceActor||user.name});state.log.push(`${battleLogName(t)}: ${act.stat} ${next}.`);state.pushVisualUnit?.(t);} }
    else if (act.type === 'apply_status' && !t.status && !t.statusBlocked) { const st=state.catalog.statuses?.[safe(v)],f=st?.definition?.typeFilter||{mode:'all',types:[]},matched=(f.types||[]).some(x=>t.types.includes(x)),immune=f.mode==='exclude'&&matched||f.mode==='include'&&!matched;if(immune){state.log.push(`${battleLogName(t)} es inmune a ${st?.name||safe(v)}.`);}else{t.status={id:safe(v),turns:Math.max(0,integer(rule.duration))};state.refreshStatus?.();state.log.push(`${battleLogName(t)} recibe ${st?.name||t.status.id}.`);} }
    else if (act.type === 'remove_status') { if(t.status){const oldId=t.status.id,old=state.catalog.statuses?.[oldId]?.name||oldId;t.status=null;clearStatusLinkedEffects(t,oldId);state.refreshStatus?.();state.log.push(`${battleLogName(t)} pierde ${old}.`);} }
    else if (act.type === 'suppress_abilities') { t.effects.push({id:'suppressed',turns:Math.max(1,integer(rule.duration)),...sourceMeta(state)}); state.log.push(`${battleLogName(t)}: habilidades anuladas.`); }
    else if (act.type === 'remove_effect') t.effects = t.effects.filter(e=>e.id!==v);
    else if (act.type === 'restrict_moves') { if(!t.effects.some(e=>e.id==='restrict_moves'&&e.sourceKind===state.currentSourceKind&&e.sourceId===state.currentSourceId)) t.effects.push({id:'restrict_moves',turns:Math.max(1,integer(rule.duration)),...sourceMeta(state)}); }
    else if (act.type === 'modify_active_cooldowns') { for(const [mid,n] of Object.entries(t.cooldowns)){if(n<=0)continue;const next=Math.max(0,n+integer(v));t.cooldowns[mid]=next;const m=t.moves.find(x=>x.id===mid);state.log.push(`${battleLogName(t)}: cooldown activo de ${m?.name||mid} ${integer(v)>=0?'+':''}${integer(v)} → ${next}.`);} }
    else if (act.type === 'cooldown_on_use') { t.effects.push({id:'cooldown_on_use',value:integer(v),turns:Math.max(1,integer(rule.duration)||1),...sourceMeta(state)}); state.log.push(`${battleLogName(t)}: sus movimientos usados reciben ${integer(v)>=0?'+':''}${integer(v)} turno(s) de cooldown adicional.`); }
    else if (act.type === 'immunity') { const f=act.typeFilter||{mode:'all',types:[]}; t.effects.push({id:'immunity',damageClass:act.damageClass||'all',filter:f,turns:Math.max(1,integer(rule.duration)||1),...sourceMeta(state)}); state.log.push(`${battleLogName(t)} obtiene inmunidad ${act.damageClass&&act.damageClass!=='all'?'a daño '+act.damageClass:'al daño indicado'}.`); }
  }
}
function rulesFor(entry, event, user, opponent, state) {
  if (user.hp <= 0) return;
  if(event==='on_status' && user.status){const statusId=user.status.id,st=state.catalog.statuses?.[statusId];for(const rule of st?.definition?.rules||[]){if(!user.status||user.status.id!==statusId)break;if(rule.event==='on_status'&&rule.action?.type!=='stat_change'&&conditionsPass(rule,user,opponent,state)&&chance(rule,state)){state.currentSourceName=st.name;state.currentSourceKind='estado';state.currentSourceId=st.id||statusId;state.currentSourceActor=user.name;action(rule,user,opponent,state,0);state.currentSourceName='';state.currentSourceId='';}}}
  for (const ability of user.abilities) {
    if (!ability || user.effects.some(e=>e.id==='suppressed')) continue;
    for (const [i,rule] of (ability.definition.rules || []).entries()) {
      const key = ability.id + ':' + i;
      if (rule.event !== event || (rule.limit > 0 && (user.used[key] || 0) >= rule.limit)) continue;
      if (!conditionsPass(rule,user,opponent,state) || !chance(rule,state)) continue;
      user.used[key] = (user.used[key] || 0)+1;
      state.currentSourceName=ability.name||entry?.name||'Habilidad';state.currentSourceKind='habilidad';state.currentSourceId=ability.id;state.currentSourceActor=user.name;action(rule,user,opponent,state,0);state.currentSourceName='';state.currentSourceId='';
    }
  }
}
function runMoveRules(move,event,user,opponent,state) {
  for (const rule of move?.definition?.rules || []) {
    if (rule.event !== event || !conditionsPass(rule,user,opponent,state) || !chance(rule,state)) continue;
    state.currentSourceName=move.name;state.currentSourceKind='movimiento';state.currentSourceId=move.id;state.currentSourceActor=user.name;
    action(rule,user,opponent,state,0);
    state.currentSourceName='';state.currentSourceId='';
  }
}
function applyMoveCooldown(attacker,move,state){
  const d=move.definition;
  let appliedCd=Math.max(0,integer(d.cooldown||0));
  for(const e of attacker.effects.filter(e=>e.id==='cooldown_on_use'))appliedCd=Math.max(0,appliedCd+integer(e.value));
  for(const e of attacker.environmentCooldownOnUse||[])if(chance(e,state))appliedCd=Math.max(0,appliedCd+integer(e.value));
  if(appliedCd>0){attacker.cooldowns[move.id]=appliedCd;attacker.cooldownSetRound[move.id]=state.round;state.log.push(`${battleLogName(attacker)} tiene ${appliedCd} ${appliedCd===1?'turno restante':'turnos restantes'} para poder volver a usar ${move.name}.`);}
}
function hit(attacker, defender, move, state) {
  ensureActorRuntime(attacker); ensureActorRuntime(defender);
  const d = move.definition;
  if (attacker.hp <= 0 || defender.hp <= 0) return;
  if ((attacker.cooldowns[move.id]||0)>0) { state.log.push(`${battleLogName(attacker)} no puede usar ${move.name}: quedan ${attacker.cooldowns[move.id]} turnos de cooldown.`); return; }
  if (attacker.effects.some(e=>e.id==='restrict_moves')) { state.log.push(`${battleLogName(attacker)} tiene ataques restringidos.`); return; }

  // «Al atacar» pertenece al inicio de la acción. «Al usar» ocurre siempre que
  // el movimiento se ejecuta, incluso si luego falla la precisión.
  rulesFor(null,'on_attack',attacker,defender,state);
  runMoveRules(move,'on_attack',attacker,defender,state);
  state.log.push(`${battleLogName(attacker)} usó ${move.name}.`);
  runMoveRules(move,'manual',attacker,defender,state);

  if (d.accuracy !== null && d.accuracy !== undefined && Number(d.accuracy)!==0 && state.random()*100 >= percent(Number(d.accuracy) * (effective(attacker,'accuracy')/100) / (effective(defender,'evasion')/100))) {
    state.log.push(`${battleLogName(attacker)} falló.`);
    applyMoveCooldown(attacker,move,state);
    return;
  }

  let damage = 0;
  if (d.category !== 'status' && Number(d.power) > 0) {
    const effectImmune=[...(defender.effects||[]),...(defender.environmentDamageImmunity||[])].some(e=>e.id==='immunity'&&(e.damageClass==='all'||e.damageClass===d.category)&&(()=>{const f=e.filter||{mode:'all',types:[]},matched=(f.types||[]).includes(d.type);return f.mode==='all'||f.mode==='include'&&matched||f.mode==='exclude'&&!matched})());
    if(effectImmune){state.log.push(`${battleLogName(defender)} es inmune al ataque.`);applyMoveCooldown(attacker,move,state);return;}
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
    if (state.random()*100 < percent((d.criticalChance ?? 0) + attacker.environmentCrit + (attacker.stages.criticalChance||0)*5)) { bonus += .5; state.log.push(`${battleLogName(attacker)} hizo un golpe crítico.`); }
    damage = immune ? 0 : Math.max(1,integer(raw*(1+bonus)));
    if(immune){state.log.push(`${battleLogName(defender)} es inmune al ataque.`);applyMoveCooldown(attacker,move,state);return;}
    defender.hp = Math.max(0,defender.hp-damage);
    state.lastDamage={attackerId:attacker.id,defenderId:defender.id,amount:damage};
    defender.lastHitType = d.type;
    state.log.push(`${battleLogName(defender)} recibe ${damage} de daño.`);
  }

  // Llegar aquí significa que el movimiento superó la comprobación de impacto.
  runMoveRules(move,'on_hit',attacker,defender,state);
  rulesFor(null,'on_hit',attacker,defender,state);
  if (damage > 0) rulesFor(null,'on_damage_taken',defender,attacker,state);
  applyMoveCooldown(attacker,move,state);
}

function tick(actor,state) { ensureActorRuntime(actor);for (const e of actor.effects) if (e.turns > 0) e.turns--; actor.effects = actor.effects.filter(e=>e.permanent || e.turns !== 0); if (actor.status?.turns > 0 && --actor.status.turns === 0){const oldId=actor.status.id;actor.status=null;clearStatusLinkedEffects(actor,oldId);state?.refreshStatus?.();} }
// Laboratorio de equipos: hasta ocho entidades por lado, una activa (Singles).
// Las órdenes son datos declarativos, nunca código del usuario.
export function simulate({left,right,leftTeam,rightTeam,chart,catalog,turns=10,randomTape=[],randomSource,weather='',field='',scenario='',leftMove='',rightMove='',leftOrders=[],rightOrders=[]}) {
  if (!Number.isInteger(turns) || turns < 0 || turns > 50) throw Error('Rondas entre 0 y 50.');
  if (!Array.isArray(randomTape) || randomTape.length > 30000 || randomTape.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0||v>=1)) throw Error('Historial RNG inválido.');
  const tape=randomTape.slice();
  let cursor=0;
  const fresh=typeof randomSource==='function'?randomSource:()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;
  const random=()=>{if(cursor<tape.length)return tape[cursor++];const v=fresh();if(!Number.isFinite(v)||v<0||v>=1)throw Error('RNG inválido.');tape.push(v);cursor++;return v;};
  const state={chart,catalog,weather:'',field:'',scenario:'',weatherTurns:0,fieldTurns:0,scenarioTurns:0,round:0,lastDamage:null,random,log:[],timeline:[],visualEvents:[]};
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
  teams[0].forEach(a=>a.side='left');teams[1].forEach(a=>a.side='right');
  const active=[0,0];
  const current=i=>teams[i][active[i]];
  const syncMirrorTags=()=>{for(const t of teams)for(const a of t)a._mirror=false;const mirror=current(0)?.id&&current(0).id===current(1)?.id;if(mirror){current(0)._mirror=true;current(1)._mirror=true;}};
  state.current=current;syncMirrorTags();
  const remaining=i=>teams[i].some(a=>a.hp>0);
  const summary=p=>{ensureActorRuntime(p);const core=['attack','defense','specialAttack','specialDefense','speed'];return ({id:p.id,name:p.name,side:p.side,hp:p.hp,maxHp:p.maxHp,baseStats:Object.fromEntries(core.map(k=>[k,p.stats[k]])),currentStats:Object.fromEntries(core.map(k=>[k,effective(p,k)])),stages:{...p.stages},environmentStages:{...p.environmentStages},statusStages:{...(p.statusStages||{})},statSources:[...(p.statSources||[])],environmentCrit:p.environmentCrit,status:p.status,effects:p.effects.map(e=>({...e})),types:p.types,cooldowns:{...p.cooldowns}})};
  const snapshot=(round)=>state.timeline.push({round,left:summary(current(0)),right:summary(current(1)),weather:state.weather,field:state.field,scenario:state.scenario,teams:teams.map(t=>t.map(summary))});
  state.captureUnit=a=>summary(a);
  state.pushVisualUnit=(a,type='unit_state')=>state.visualEvents.push({logIndex:state.log.length-1,type,side:a.side,unit:summary(a)});
  const resetEntryAbilityUsage=a=>{
    ensureActorRuntime(a);
    for(const ability of a.abilities||[])for(const [idx,rule] of (ability?.definition?.rules||[]).entries())if(rule.event==='on_enter')delete a.used[ability.id+':'+idx];
  };
  const enter=i=>{const a=current(i);resetEntryAbilityUsage(a);rulesFor(null,'on_enter',a,current(1-i),state);};
  const resetSwitchStages=a=>{
    ensureActorRuntime(a);
    a.stages={};
    a.statSources=[];
  };
  const switchTo=(i,index,forced=false)=>{
    if(!Number.isInteger(index)||index<0||index>=teams[i].length||index===active[i]||teams[i][index].hp<=0)throw Error('Cambio inválido en equipo '+(i===0?'izquierdo':'derecho')+'.');
    const leaving=current(i);
    resetSwitchStages(leaving);
    active[i]=index;syncMirrorTags();state.log.push((forced?'Relevo automático: ':'Cambio: ')+battleLogName(current(i))+' entra al campo.');state.pushVisualUnit?.(current(i),'switch');enter(i);state.refreshEnvironment?.();
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
  const chooseMove=(a,opponent,requested)=>{
    if(requested){const m=a.moves.find(m=>m.id===requested);if(!m)throw Error('El ataque '+requested+' no pertenece a '+a.name+'.');return m;}
    // Selección aleatoria entre ataques utilizables. Nunca priorizar un ataque
    // ofensivo completamente inmune cuando existe una alternativa útil.
    const available=a.moves.filter(m=>(a.cooldowns[m.id]||0)<=0); if(!available.length)throw Error(a.name+' no tiene movimientos disponibles por cooldown.');
    const useful=available.filter(m=>m.definition.category==='status'||Number(m.definition.power)<=0||!opponent.types.some(t=>state.chart?.[m.definition.type]?.[t]==='inmune'));
    const pool=useful.length?useful:available;
    return pool[Math.floor(random()*pool.length)];
  };
  enter(0);enter(1);
  // Los entornos de prueba solo se activan si existe su definición en el catálogo.
  for(const [key,id,kind] of [['weather',weather,'weathers'],['field',field,'fields'],['scenario',scenario,'scenarios']])if(id){
    if(!catalog[kind]?.[id])throw Error('Entorno no encontrado: '+kind+'/'+id);
    state[key]=id;state[key+'Turns']=5;state.log.push('Entorno inicial: '+catalog[kind][id].name+' (5 rondas).');
  }
  snapshot(0);
  const envKinds=[['weather','weathers'],['field','fields'],['scenario','scenarios']];
  const matches=(a,e)=>e.filter==='all'||(e.filter==='include'?e.types.some(t=>a.types.includes(t)):!e.types.some(t=>a.types.includes(t)));
  const immune=(a,kind)=>a.effects.some(e=>e.id==='environment_immunity'&&(e.kind==='all'||e.kind===kind)&&!(e.source==='ability'&&a.effects.some(x=>x.id==='suppressed')));
  const refreshEnvironment=()=>{
    for(const i of [0,1]){const a=ensureActorRuntime(current(i));a.environmentStages={};a.environmentCrit=0;a.environmentCooldownOnUse=[];a.environmentDamageImmunity=[];a.statusBlocked=false;}
    for(const [key,kind] of envKinds){const id=state[key],entry=state.catalog[kind]?.[id];if(!id||!entry)continue;
      for(const e of entry.definition.fieldEffects||[]){
        if(e.timing!=='continuous')continue;
        for(const i of [0,1]){const a=ensureActorRuntime(current(i));if(a.hp<=0||immune(a,kind)||!matches(a,e)||!chance(e,state))continue;
          if(e.type==='stat_change'){
            if(e.stat==='criticalChance')a.environmentCrit+=e.value*5;
            else a.environmentStages[e.stat]=(a.environmentStages[e.stat]||0)+e.value;
          }else if(e.type==='critical_change')a.environmentCrit+=e.value*5;
          else if(e.type==='remove_status'&&a.status){const oldId=a.status.id;a.status=null;clearStatusLinkedEffects(a,oldId);state.refreshStatus?.();}
          else if(e.type==='block_status'){if(a.status){const oldId=a.status.id;a.status=null;clearStatusLinkedEffects(a,oldId);}a.statusBlocked=true;state.refreshStatus?.();}
          else if(e.type==='cooldown_on_use')a.environmentCooldownOnUse.push(e);
          else if(e.type==='immunity')a.environmentDamageImmunity.push({id:'immunity',damageClass:e.damageClass||'all',filter:e.immunityTypeFilter||{mode:'all',types:[]},sourceKind:kind,sourceName:entry.name});
        }
      }
    }
  };
  const applyEnvironmentTimedEffect=(a,e,entry,kind)=>{
    if(a.hp<=0||immune(a,kind)||!matches(a,e)||!chance(e,state))return;
    if(e.type==='damage_percent'){
      const amount=e.value===0?0:Math.max(1,integer(a.maxHp*e.value/100));
      if(amount>0){a.hp=Math.max(0,a.hp-amount);state.log.push(entry.name+': '+battleLogName(a)+' pierde '+amount+' PS ('+e.value+' %).');}
    }else if(e.type==='heal_percent'){
      const before=a.hp,amount=integer(a.maxHp*e.value/100);a.hp=Math.min(a.maxHp,a.hp+amount);const actual=a.hp-before;
      if(actual>0)state.log.push(entry.name+': '+battleLogName(a)+' recupera '+actual+' PS ('+e.value+' %).');
    }else if(e.type==='cooldown_change'){
      for(const [mid,n] of Object.entries(a.cooldowns)){if(n<=0)continue;const next=Math.max(0,n+integer(e.value));a.cooldowns[mid]=next;const m=a.moves.find(x=>x.id===mid);state.log.push(entry.name+': cooldown activo de '+(m?.name||mid)+' en '+battleLogName(a)+' '+(e.value>=0?'+':'')+e.value+' → '+next+'.');}
    }else if(e.type==='remove_status'&&a.status){
      const oldId=a.status.id,old=state.catalog.statuses?.[oldId]?.name||oldId;a.status=null;clearStatusLinkedEffects(a,oldId);state.refreshStatus?.();state.log.push(entry.name+': '+battleLogName(a)+' pierde '+old+'.');
    }else if(e.type==='block_status'){
      if(a.status){const oldId=a.status.id,old=state.catalog.statuses?.[oldId]?.name||oldId;a.status=null;clearStatusLinkedEffects(a,oldId);state.refreshStatus?.();state.log.push(entry.name+': '+battleLogName(a)+' pierde '+old+'.');}
      a.statusBlocked=true;
    }else if(e.type==='stat_change'){
      const stat=e.stat,before=a.stages[stat]||0,next=clamp(before+integer(e.value),-10,10),delta=next-before;a.stages[stat]=next;
      if(delta){a.statSources.push({stat,value:delta,sourceName:entry.name,sourceKind:kind,sourceActor:'entorno'});state.log.push(entry.name+': '+battleLogName(a)+' '+stat+' '+(delta>0?'+':'')+delta+'.');state.pushVisualUnit?.(a);}
    }else if(e.type==='critical_change'){
      const stat='criticalChance',before=a.stages[stat]||0,next=clamp(before+integer(e.value),-10,10),delta=next-before;a.stages[stat]=next;
      if(delta){a.statSources.push({stat,value:delta,sourceName:entry.name,sourceKind:kind,sourceActor:'entorno'});state.log.push(entry.name+': '+battleLogName(a)+' crítico '+(delta>0?'+':'')+delta+'.');state.pushVisualUnit?.(a);}
    }
  };
  const environmentTimed=(timing)=>{
    for(const [key,kind] of envKinds){const id=state[key],entry=state.catalog[kind]?.[id];if(!id||!entry)continue;
      for(const e of entry.definition.fieldEffects||[]){if(e.timing!==timing)continue;for(const i of [0,1])applyEnvironmentTimedEffect(ensureActorRuntime(current(i)),e,entry,kind);}
    }
  };

  const refreshStatus=()=>{for(const t of teams)for(const a of t){a.statusStages={};if(!a.status)continue;const st=state.catalog.statuses?.[a.status.id];for(const r of st?.definition?.rules||[]){if(r.event!=='on_status'||r.action?.type!=='stat_change')continue;const stat=r.action.stat,val=integer(r.action.value);a.statusStages[stat]=(a.statusStages[stat]||0)+val;}}};
  state.refreshStatus=refreshStatus;refreshStatus();
  state.refreshEnvironment=refreshEnvironment;
  let played=0;
  for(let round=1;round<=turns&&remaining(0)&&remaining(1);round++){
    played=round;state.round=round;syncMirrorTags();state.log.push('— Ronda '+round+' —');
    autoReplace(0);autoReplace(1);
    const orders=[parseOrder(leftOrders,round,'izquierda',leftMove),parseOrder(rightOrders,round,'derecha',rightMove)];
    // Cambios declarados se resuelven antes de los ataques, por orden de Velocidad.
    const switches=[0,1].filter(i=>orders[i].switch!==undefined).sort((i,j)=>effective(current(j),'speed')-effective(current(i),'speed')||(random()<.5?-1:1));
    for(const i of switches){const dest=orders[i].switch;if(!Number.isInteger(dest))throw Error('El índice de cambio debe ser entero (0 a 7).');switchTo(i,dest);}
    refreshEnvironment();
    environmentTimed('turn_start');
    for(const i of [0,1])if(current(i).hp>0)rulesFor(null,'turn_start',current(i),current(1-i),state);
    const attacks=[0,1].filter(i=>orders[i].switch===undefined&&current(i).hp>0).map(i=>({side:i,actor:current(i),move:chooseMove(current(i),current(1-i),orders[i].move)}));
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
    for(const i of [0,1])if(current(i).hp>0){rulesFor(null,'on_status',current(i),current(1-i),state);rulesFor(null,'turn_end',current(i),current(1-i),state);}
    environmentTimed('turn_end');
    for(const i of [0,1])if(current(i).hp>0)rulesFor(null,'round_end',current(i),current(1-i),state);
    environmentTimed('round_end');
    // El turno de uso NO cuenta para reducir su propio cooldown. Solo se reducen al final de turnos posteriores.
    for(const t of teams)for(const a of t)for(const [mid,n] of Object.entries(a.cooldowns)){if(n<=0||a.cooldownSetRound[mid]===round)continue;const next=n-1;a.cooldowns[mid]=next;const m=a.moves.find(x=>x.id===mid);state.log.push(next>0?`${battleLogName(a)} tiene ${next} ${next===1?'turno restante':'turnos restantes'} para poder volver a usar ${m?.name||mid}.`:`${battleLogName(a)} puede volver a usar ${m?.name||mid}.`);}
    for(const t of teams)for(const a of t)if(a.hp>0)tick(a,state);state.refreshStatus?.();
    if(state.weatherTurns>0&&--state.weatherTurns===0){state.weather='';state.log.push('El clima termina.');}
    if(state.fieldTurns>0&&--state.fieldTurns===0){state.field='';state.log.push('El campo termina.');}
    if(state.scenarioTurns>0&&--state.scenarioTurns===0){state.scenario='';state.log.push('El escenario termina.');}
    for(const i of [0,1])autoReplace(i);
    snapshot(round);
  }
  const leftAlive=remaining(0),rightAlive=remaining(1);
  const winner=leftAlive&&!rightAlive?'left':rightAlive&&!leftAlive?'right':null;
  return {ok:true,mode:'private-singles-team-simulation',rounds:played,winner,winnerId:winner==='left'?current(0).id:winner==='right'?current(1).id:null,left:summary(current(0)),right:summary(current(1)),leftTeam:teams[0].map(summary),rightTeam:teams[1].map(summary),weather:state.weather,field:state.field,scenario:state.scenario,weatherTurns:state.weatherTurns,fieldTurns:state.fieldTurns,scenarioTurns:state.scenarioTurns,log:state.log.slice(0,1500),timeline:state.timeline,visualEvents:state.visualEvents.filter(e=>e.logIndex<1500),randomTape:tape.slice(0,cursor)};
}
