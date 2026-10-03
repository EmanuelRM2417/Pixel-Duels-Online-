import { simulate } from "./battle-engine.js";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type"};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
const TYPES=new Set(["fuego","planta","roca","hielo","rayo","metal","guerra","mente","encanto","espectro","divinidad","luz","oscuridad","viento","dragon","agua","veneno","tecnologia","agilidad","valor"]);
const ID=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function pointer(env){return env.PUBLIC_CONTENT?.get("public-v1:current","json");}
async function snapshot(env,revision){
  if(!env.PUBLIC_CONTENT)throw Error("Contenido público no conectado.");
  let rev=revision;
  if(!rev){const p=await pointer(env);rev=p?.revision;}
  if(!rev||!/^[a-z0-9-]{1,80}$/.test(rev))throw Error("Todavía no hay una Alpha publicada.");
  const value=await env.PUBLIC_CONTENT.get(`public-v1:snapshot:${rev}`,"json");
  if(!value)throw Error("La revisión publicada ya no está disponible.");
  return value;
}
function publicCatalog(s){return {ok:true,version:s.version,revision:s.revision,publishedAt:s.publishedAt,types:s.types,chart:s.chart,catalog:s.catalog};}
function cleanName(value){const name=String(value||"Jugador").trim().replace(/[<>\u0000-\u001f]/g,"").slice(0,20);return name||"Jugador";}
function makeCode(){const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789",bytes=new Uint8Array(6);crypto.getRandomValues(bytes);return [...bytes].map(x=>chars[x%chars.length]).join("");}
function compactResult(r){return {rounds:r.rounds,winner:r.winner,left:r.left,right:r.right,leftTeam:r.leftTeam,rightTeam:r.rightTeam,weather:r.weather,field:r.field,scenario:r.scenario,weatherTurns:r.weatherTurns,fieldTurns:r.fieldTurns,scenarioTurns:r.scenarioTurns};}

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(request.method==="OPTIONS")return new Response(null,{headers:cors});
    if(url.pathname==="/health"){
      const p=await pointer(env);
      return json({ok:true,service:"Universal Duels",version:"0.1.0-alpha",publishedRevision:p?.revision||null});
    }
    if(url.pathname==="/api/catalog"&&request.method==="GET"){
      try{return json(publicCatalog(await snapshot(env)));}catch(e){return json({error:e.message},503);}
    }
    const catMatch=url.pathname.match(/^\/api\/catalog\/(alpha01-[a-z0-9-]+)$/i);
    if(catMatch&&request.method==="GET"){
      try{return json(publicCatalog(await snapshot(env,catMatch[1])));}catch(e){return json({error:e.message},404);}
    }
    const spriteMatch=url.pathname.match(/^\/api\/sprites\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
    if(spriteMatch&&request.method==="GET"){
      if(!env.PUBLIC_SPRITES)return json({error:"Sprites públicos no conectados."},503);
      try{
        const requestedRevision=url.searchParams.get("revision")||"";
        const s=await snapshot(env,requestedRevision||undefined),id=spriteMatch[1];
        const published=Object.values(s.catalog?.entities||{}).some(e=>e?.definition?.spriteId===id);
        if(!published)return json({error:"Sprite no publicado."},404);
        const obj=await env.PUBLIC_SPRITES.get(`drafts/${id}.png`);if(!obj)return json({error:"Sprite no encontrado."},404);
        return new Response(obj.body,{headers:{"Content-Type":"image/png","Cache-Control":"public, max-age=3600","X-Content-Type-Options":"nosniff"}});
      }catch(e){return json({error:e.message},404);}
    }
    const typeMatch=url.pathname.match(/^\/api\/type-icons\/([a-z]+)$/);
    if(typeMatch&&request.method==="GET"){
      if(!TYPES.has(typeMatch[1]))return json({error:"Tipo desconocido."},404);
      if(!env.PUBLIC_SPRITES)return json({error:"Sprites públicos no conectados."},503);
      const obj=await env.PUBLIC_SPRITES.get(`type-icons/${typeMatch[1]}.png`);if(!obj)return json({error:"Icono no encontrado."},404);
      return new Response(obj.body,{headers:{"Content-Type":"image/png","Cache-Control":"public, max-age=3600","X-Content-Type-Options":"nosniff"}});
    }
    if(url.pathname==="/api/rooms"&&request.method==="POST"){
      let body={};try{body=await request.json();}catch{}
      const code=makeCode(),id=env.ROOMS.idFromName(code),stub=env.ROOMS.get(id);
      const init=await stub.fetch("https://room.internal/init",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code,createdAt:Date.now(),hostName:cleanName(body.name)})});
      if(!init.ok)return json({error:"No se pudo crear la sala."},500);
      return json({code});
    }
    const roomMatch=url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{6})$/i);
    if(roomMatch){
      const code=roomMatch[1].toUpperCase(),id=env.ROOMS.idFromName(code),stub=env.ROOMS.get(id),target=new URL(request.url);
      target.pathname="/connect";target.searchParams.set("code",code);target.searchParams.set("name",cleanName(url.searchParams.get("name")));
      return stub.fetch(new Request(target,request));
    }
    if(env.ASSETS)return env.ASSETS.fetch(request);
    return json({error:"Ruta no encontrada."},404);
  }
};

export class Room {
  constructor(state,env){this.state=state;this.storage=state.storage;this.env=env;}
  async fetch(request){
    const url=new URL(request.url);
    if(url.pathname==="/init"&&request.method==="POST"){
      const body=await request.json(),current=await this.storage.get("room");
      if(!current){await this.storage.put("room",{code:body.code,createdAt:body.createdAt,players:[],battle:null});await this.storage.setAlarm(Date.now()+6*60*60*1000);}
      return new Response("ok");
    }
    if(url.pathname!=="/connect")return new Response("Not found",{status:404});
    if(request.headers.get("Upgrade")!=="websocket")return new Response("Se requiere WebSocket",{status:426});
    const room=await this.getRoom();if(!room.code)return new Response(JSON.stringify({error:"La sala no existe o expiró."}),{status:404,headers:{"Content-Type":"application/json"}});
    const sockets=this.state.getWebSockets();if(sockets.length>=2)return new Response(JSON.stringify({error:"La sala ya tiene dos jugadores conectados."}),{status:409,headers:{"Content-Type":"application/json"}});
    const used=sockets.map(s=>{try{return s.deserializeAttachment()?.role}catch{return null}});
    const role=used.includes("host")?"guest":"host",name=cleanName(url.searchParams.get("name"));
    const pair=new WebSocketPair(),client=pair[0],server=pair[1];this.state.acceptWebSocket(server);server.serializeAttachment({role,name});
    let player=(room.players||[]).find(p=>p.role===role);
    if(player){player.name=name;player.connected=true;}else{player={role,name,ready:false,team:[],connected:true};room.players.push(player);}
    await this.storage.put("room",room);
    this.send(server,{type:"welcome",role,code:room.code});
    this.send(server,{type:"room",room:this.publicRoom(room)});
    if(room.battle)this.send(server,{type:"battle_sync",battle:this.publicBattle(room,role)});
    this.broadcastRoom(room);
    return new Response(null,{status:101,webSocket:client});
  }
  async webSocketMessage(socket,message){
    let data;try{data=JSON.parse(typeof message==="string"?message:new TextDecoder().decode(message));}catch{return;}
    const att=socket.deserializeAttachment()||{},role=att.role;if(!role)return;
    const room=await this.getRoom(),player=(room.players||[]).find(p=>p.role===role);if(!player)return;
    if(data.type==="ping"){this.send(socket,{type:"pong",at:Date.now()});return;}
    if(data.type==="chat"){const text=String(data.text||"").trim().slice(0,240);if(text)this.broadcast({type:"chat",role,name:player.name,text,at:Date.now()});return;}
    if(data.type==="team"){
      if(room.battle?.status==="playing"){this.send(socket,{type:"error",message:"No podés cambiar el equipo durante una batalla."});return;}
      let s;try{s=await snapshot(this.env);}catch(e){this.send(socket,{type:"error",message:e.message});return;}
      if(!Array.isArray(data.team)||data.team.length!==8||new Set(data.team).size!==8||data.team.some(id=>!ID.test(id||"")||!s.catalog?.entities?.[id])){this.send(socket,{type:"error",message:"El equipo debe contener 8 personajes publicados distintos."});return;}
      player.team=[...data.team];player.ready=false;
    } else if(data.type==="ready"){
      if(player.team.length!==8){this.send(socket,{type:"error",message:"Guardá un equipo de 8 antes de marcarte listo."});return;}
      player.ready=!!data.ready;
    } else if(data.type==="order"){
      await this.handleOrder(socket,room,role,data.order);return;
    } else if(data.type==="surrender"){
      if(room.battle?.status!=="playing")return;
      room.battle.status="finished";room.battle.winner=role==="host"?"guest":"host";room.battle.finishReason="surrender";
      await this.storage.put("room",room);this.broadcastBattle(room,"battle_result",{reason:"surrender"});return;
    } else {this.send(socket,{type:"error",message:"Mensaje no reconocido por el servidor."});return;}
    await this.storage.put("room",room);this.broadcastRoom(room);await this.maybeStartBattle(room);
  }
  async maybeStartBattle(room){
    if(room.battle?.status==="playing"||room.battle?.status==="finished")return;
    const host=room.players.find(p=>p.role==="host"),guest=room.players.find(p=>p.role==="guest");
    if(!host||!guest||!host.ready||!guest.ready||host.team.length!==8||guest.team.length!==8)return;
    let s;try{s=await snapshot(this.env);}catch(e){this.broadcast({type:"error",message:e.message});return;}
    if([...host.team,...guest.team].some(id=>!s.catalog.entities[id])){this.broadcast({type:"error",message:"Uno de los equipos contiene contenido que ya no está publicado."});return;}
    try{
      const result=simulate({left:host.team[0],right:guest.team[0],leftTeam:host.team,rightTeam:guest.team,catalog:s.catalog,chart:s.chart,turns:0,leftOrders:[],rightOrders:[],randomTape:[]});
      room.battle={status:result.winner?"finished":"playing",revision:s.revision,round:1,leftOrders:[],rightOrders:[],pending:{host:null,guest:null},randomTape:result.randomTape,logLength:result.log.length,lastState:compactResult(result),recentLog:result.log.slice(-100),winner:result.winner==="left"?"host":result.winner==="right"?"guest":null,finishReason:result.winner?"ko":null};
      await this.storage.put("room",room);this.broadcastBattle(room,"battle_start",{logs:result.log,visualEvents:result.visualEvents});
    }catch(e){this.broadcast({type:"error",message:"No se pudo iniciar: "+String(e.message||e)});}
  }
  async handleOrder(socket,room,role,order){
    const b=room.battle;if(!b||b.status!=="playing"){this.send(socket,{type:"error",message:"La batalla todavía no está activa."});return;}
    if(b.pending?.[role]){this.send(socket,{type:"error",message:"Ya elegiste una acción para esta ronda."});return;}
    if(!order||typeof order!=="object"||Array.isArray(order)){this.send(socket,{type:"error",message:"Acción inválida."});return;}
    const state=b.lastState,unit=role==="host"?state.left:state.right,team=role==="host"?state.leftTeam:state.rightTeam;
    if(order.move!==undefined){
      if(typeof order.move!=="string"||!ID.test(order.move)){this.send(socket,{type:"error",message:"Movimiento inválido."});return;}
      let s;try{s=await snapshot(this.env,b.revision);}catch(e){this.send(socket,{type:"error",message:e.message});return;}
      const ent=s.catalog.entities[unit.id],allowed=[...(ent?.definition?.moveIds||[]),ent?.definition?.uniqueMoveId].filter(Boolean);
      if(!allowed.includes(order.move)){this.send(socket,{type:"error",message:"Ese movimiento no pertenece al personaje activo."});return;}
      order={move:order.move};
    } else if(order.switch!==undefined){
      const i=Number(order.switch),activeIndex=team.findIndex(x=>x.id===unit.id);
      if(!Number.isInteger(i)||i<0||i>=team.length||i===activeIndex||team[i].hp<=0){this.send(socket,{type:"error",message:"Cambio inválido."});return;}
      order={switch:i};
    } else {this.send(socket,{type:"error",message:"Elegí un movimiento o un cambio."});return;}
    b.pending[role]=order;await this.storage.put("room",room);this.send(socket,{type:"order_accepted",round:b.round});
    this.broadcast({type:"battle_waiting",round:b.round,host:!!b.pending.host,guest:!!b.pending.guest});
    if(b.pending.host&&b.pending.guest)await this.resolveRound(room);
  }
  async resolveRound(room){
    const b=room.battle,host=room.players.find(p=>p.role==="host"),guest=room.players.find(p=>p.role==="guest");if(!b||!host||!guest)return;
    try{
      const s=await snapshot(this.env,b.revision),leftOrders=[...b.leftOrders,b.pending.host],rightOrders=[...b.rightOrders,b.pending.guest];
      const result=simulate({left:host.team[0],right:guest.team[0],leftTeam:host.team,rightTeam:guest.team,catalog:s.catalog,chart:s.chart,turns:b.round,leftOrders,rightOrders,randomTape:b.randomTape});
      const start=b.logLength||0,newLogs=result.log.slice(start),newVisual=result.visualEvents.filter(e=>e.logIndex>=start);
      b.leftOrders=leftOrders;b.rightOrders=rightOrders;b.randomTape=result.randomTape;b.logLength=result.log.length;b.lastState=compactResult(result);b.recentLog=[...(b.recentLog||[]),...newLogs].slice(-120);b.pending={host:null,guest:null};
      if(result.winner){b.status="finished";b.winner=result.winner==="left"?"host":"guest";b.finishReason="ko";}else b.round++;
      await this.storage.put("room",room);this.broadcastBattle(room,result.winner?"battle_result":"battle_round",{logs:newLogs,visualEvents:newVisual,logStart:start});
    }catch(e){b.pending={host:null,guest:null};await this.storage.put("room",room);this.broadcast({type:"error",message:"No se pudo resolver la ronda: "+String(e.message||e)});}
  }
  publicBattle(room,role){const b=room.battle;if(!b)return null;return {status:b.status,revision:b.revision,round:b.round,state:b.lastState,recentLog:b.recentLog||[],winner:b.winner||null,finishReason:b.finishReason||null,submitted:!!b.pending?.[role],opponentSubmitted:!!b.pending?.[role==="host"?"guest":"host"]};}
  broadcastBattle(room,type,extra={}){for(const s of this.state.getWebSockets()){let role;try{role=s.deserializeAttachment()?.role}catch{}if(role)this.send(s,{type,battle:this.publicBattle(room,role),...extra});}}
  broadcastRoom(room){this.broadcast({type:"room",room:this.publicRoom(room)});}
  publicRoom(room){return {code:room.code,players:(room.players||[]).map(p=>({role:p.role,name:p.name,ready:!!p.ready,teamCount:(p.team||[]).length,connected:!!p.connected})),capacity:2,battleStatus:room.battle?.status||null};}
  async webSocketClose(socket){await this.removeSocket(socket);} async webSocketError(socket){await this.removeSocket(socket);}
  async removeSocket(socket){let a={};try{a=socket.deserializeAttachment()||{}}catch{}const room=await this.getRoom(),p=(room.players||[]).find(x=>x.role===a.role);if(p)p.connected=false;await this.storage.put("room",room);this.broadcastRoom(room);this.broadcast({type:"notice",message:"Un jugador se desconectó. Puede volver a entrar con el mismo código."});}
  async alarm(){for(const socket of this.state.getWebSockets()){try{socket.close(1000,"Sala expirada")}catch{}}await this.storage.delete("room");}
  async getRoom(){return (await this.storage.get("room"))||{code:"",players:[],battle:null};}
  send(socket,data){try{socket.send(JSON.stringify(data))}catch{}}
  broadcast(data){for(const socket of this.state.getWebSockets())this.send(socket,data);}
}
