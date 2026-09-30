const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (url.pathname === "/health") return json({ ok: true, service: "Duelo Pixel Rooms", version: 1 });
      async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (url.pathname === "/health") return json({ ok: true, service: "Duelo Pixel Rooms", version: 1 });
        
    if (url.pathname === "/editor-api/status") {
      if (request.method !== "GET") {
        return json({ error: "Método no permitido." }, 405);
      }

      if (!env.EDITOR_DRAFTS) {
        return json({
          ok: false,
          error: "El almacenamiento de borradores no está conectado."
        }, 500);
      }

      return json({
        ok: true,
        editor: "Universal Duels",
        draftsConnected: true,
        publicationMode: "manual"
      });
    }

    if (url.pathname === "/api/rooms" && request.method === "POST") {
    

    if (url.pathname === "/api/rooms" && request.method === "POST") {
      let body = {};
      try { body = await request.json(); } catch {}
      const code = makeCode();
      const id = env.ROOMS.idFromName(code);
      const stub = env.ROOMS.get(id);
      const init = await stub.fetch("https://room.internal/init", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, createdAt: Date.now(), hostName: cleanName(body.name) }) });
      if (!init.ok) return json({ error: "No se pudo crear la sala." }, 500);
      return json({ code });
    }

    const match = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{6})$/i);
    if (match) {
      const code = match[1].toUpperCase();
      const id = env.ROOMS.idFromName(code);
      const stub = env.ROOMS.get(id);
      const target = new URL(request.url);
      target.pathname = "/connect";
      target.searchParams.set("code", code);
      target.searchParams.set("name", cleanName(url.searchParams.get("name")));
      return stub.fetch(new Request(target, request));
    }
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return json({ error: "Ruta no encontrada." }, 404);
  }
};

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return [...bytes].map(x => chars[x % chars.length]).join("");
}
function cleanName(value) {
  const name = String(value || "Jugador").trim().replace(/[<>\u0000-\u001f]/g, "").slice(0, 20);
  return name || "Jugador";
}

export class Room {
  constructor(state) { this.state = state; this.storage = state.storage; }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/init" && request.method === "POST") {
      const body = await request.json();
      const current = await this.storage.get("room");
      if (!current) { await this.storage.put("room", { code: body.code, createdAt: body.createdAt, players: [] }); await this.state.storage.setAlarm(Date.now() + 6 * 60 * 60 * 1000); }
      return new Response("ok");
    }
    if (url.pathname !== "/connect") return new Response("Not found", { status: 404 });
    if (request.headers.get("Upgrade") !== "websocket") return new Response("Se requiere WebSocket", { status: 426 });

    const room = await this.storage.get("room");
    if (!room) return new Response(JSON.stringify({ error: "La sala no existe o expiró." }), { status: 404, headers: { "Content-Type": "application/json" } });
    const sockets = this.state.getWebSockets();
    if (sockets.length >= 2) return new Response(JSON.stringify({ error: "La sala ya tiene dos jugadores." }), { status: 409, headers: { "Content-Type": "application/json" } });

    const used = sockets.map(s => { try { return s.deserializeAttachment()?.role; } catch { return null; } });
    const role = used.includes("host") ? "guest" : "host";
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.state.acceptWebSocket(server);
    server.serializeAttachment({ role, name: cleanName(url.searchParams.get("name")) });
    const updated = await this.getRoom();
    updated.players = (updated.players || []).filter(p => p.role !== role);
    updated.players.push({ role, name: cleanName(url.searchParams.get("name")), ready: false, team: [] });
    await this.storage.put("room", updated);
    this.send(server, { type: "welcome", role, code: updated.code });
    this.broadcast({ type: "room", room: this.publicRoom(updated) });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket, message) {
    let data;
    try { data = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message)); } catch { return; }
    const attachment = socket.deserializeAttachment() || {};
    const role = attachment.role;
    if (!role) return;
    const room = await this.getRoom();
    const player = (room.players || []).find(p => p.role === role);
    if (!player) return;

    if (data.type === "ready") {
      player.ready = !!data.ready;
    } else if (data.type === "team") {
      if (!Array.isArray(data.team) || data.team.length !== 8 || data.team.some(x => typeof x !== "string" || x.length > 100)) {
        this.send(socket, { type: "error", message: "El equipo debe contener exactamente 8 identificadores de criatura." }); return;
      }
      player.team = [...new Set(data.team)];
      if (player.team.length !== 8) { this.send(socket, { type: "error", message: "El equipo no puede tener criaturas duplicadas." }); return; }
    } else if (data.type === "chat") {
      const text = String(data.text || "").trim().slice(0, 240);
      if (text) this.broadcast({ type: "chat", role, name: player.name, text, at: Date.now() });
      return;
    } else if (data.type === "ping") {
      this.send(socket, { type: "pong", at: Date.now() }); return;
    } else {
      this.send(socket, { type: "error", message: "Mensaje no reconocido por el servidor." }); return;
    }
    await this.storage.put("room", room);
    this.broadcast({ type: "room", room: this.publicRoom(room) });
    if (room.players.length === 2 && room.players.every(p => p.ready && p.team.length === 8)) {
      this.broadcast({ type: "ready_to_battle", message: "Ambos jugadores están listos. La sala está preparada para iniciar el combate online." });
    }
  }

  async alarm() { for (const socket of this.state.getWebSockets()) { try { socket.close(1000, "Sala expirada"); } catch {} } await this.storage.delete("room"); }

  async webSocketClose(socket) { await this.removeSocket(socket); }
  async webSocketError(socket) { await this.removeSocket(socket); }
  async removeSocket(socket) {
    let attachment = {}; try { attachment = socket.deserializeAttachment() || {}; } catch {}
    const room = await this.getRoom();
    room.players = (room.players || []).filter(p => p.role !== attachment.role);
    await this.storage.put("room", room);
    this.broadcast({ type: "room", room: this.publicRoom(room) });
    this.broadcast({ type: "notice", message: "Un jugador se desconectó. La sala seguirá abierta para volver a entrar." });
  }
  async getRoom() { return (await this.storage.get("room")) || { code: "", players: [] }; }
  publicRoom(room) { return { code: room.code, players: (room.players || []).map(p => ({ role: p.role, name: p.name, ready: !!p.ready, teamCount: (p.team || []).length })), capacity: 2 }; }
  send(socket, data) { try { socket.send(JSON.stringify(data)); } catch {} }
  broadcast(data) { for (const socket of this.state.getWebSockets()) this.send(socket, data); }
}
