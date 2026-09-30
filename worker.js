
import { createRemoteJWKSet, jwtVerify } from "jose";

// Respuestas JSON.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json"
    }
  });

// Verifica identidad mediante Cloudflare Access.
async function verifyEditorAccess(request, env) {
  try {
    const token = request.headers.get("Cf-Access-Jwt-Assertion");

    if (
      !token ||
      !env.ACCESS_TEAM_DOMAIN ||
      !env.ACCESS_AUD ||
      !env.EDITOR_EMAIL
    ) {
      return null;
    }

    const teamDomain = env.ACCESS_TEAM_DOMAIN
      .replace(/^https?:\/\//, "")
      .replace(/\/+$/, "");

    const issuer = `https://${teamDomain}`;

    const keys = createRemoteJWKSet(
      new URL(`${issuer}/cdn-cgi/access/certs`)
    );

    const { payload } = await jwtVerify(token, keys, {
      issuer,
      audience: env.ACCESS_AUD
    });

    const authorizedEmail = env.EDITOR_EMAIL
      .trim()
      .toLowerCase();

    const tokenEmail = String(payload.email || "")
      .trim()
      .toLowerCase();

    if (!tokenEmail || tokenEmail !== authorizedEmail) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// Respuestas privadas sin CORS público.
const privateJson = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // API privada del editor.
    if (url.pathname.startsWith("/editor-api/")) {
      if (request.method === "OPTIONS") {
        return privateJson({
          error: "Método no permitido."
        }, 405);
      }

      const identity = await verifyEditorAccess(request, env);

      if (!identity) {
        return privateJson({
          ok: false,
          error: "Acceso no autorizado."
        }, 401);
      }

      if (!env.EDITOR_DRAFTS) {
        return privateJson({
          ok: false,
          error: "Almacenamiento no conectado."
        }, 500);
      }

      // Comprobar conexión del editor.
      if (url.pathname === "/editor-api/status") {
        if (request.method !== "GET") {
          return privateJson({
            error: "Método no permitido."
          }, 405);
        }

        return privateJson({
          ok: true,
          editor: "Universal Duels",
          draftsConnected: true,
          publicationMode: "manual"
        });
      }


      // Subir imagen original de una entidad.
if (
  url.pathname === "/editor-api/sprites" &&
  request.method === "POST"
) {
  if (!env.EDITOR_SPRITES) {
    return privateJson({
      error: "El almacenamiento de sprites no está conectado."
    }, 500);
  }

  const origin = request.headers.get("Origin");

  if (origin !== url.origin) {
    return privateJson({
      error: "Origen no autorizado."
    }, 403);
  }

  const contentType = request.headers.get("Content-Type") || "";

  if (!contentType.toLowerCase().startsWith("image/png")) {
    return privateJson({
      error: "Solo se permiten archivos PNG."
    }, 415);
  }

  const maxSize = 2 * 1024 * 1024;
  const bytes = await request.arrayBuffer();

  if (bytes.byteLength === 0 || bytes.byteLength > maxSize) {
    return privateJson({
      error: "El PNG debe pesar entre 1 byte y 2 MB."
    }, 413);
  }

  const signature = new Uint8Array(bytes).slice(0, 8);
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];

  if (!pngSignature.every((value, i) => signature[i] === value)) {
    return privateJson({
      error: "El archivo no es un PNG válido."
    }, 415);
  }

    // Identificador elegido por el usuario.
  const spriteId = url.searchParams.get("id") || "";

  // Solo letras minúsculas, números y guiones.
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(spriteId) ||
      spriteId.length > 60) {
    return privateJson({
      error: "Usá entre 1 y 60 caracteres: letras minúsculas, números y guiones."
    }, 400);
  }

  const key = `drafts/${spriteId}.png`;

  // Evitar reemplazar un sprite existente.
  const existing = await env.EDITOR_SPRITES.head(key);

  if (existing) {
    return privateJson({
      error: "Ya existe un sprite con ese identificador."
    }, 409);
  }

  await env.EDITOR_SPRITES.put(key, bytes, {
    httpMetadata: {
      contentType: "image/png"
    }
  });

  return privateJson({
    ok: true,
    spriteId,
    message: "Sprite original guardado como borrador."
  });
}
// Consultar un sprite privado guardado en R2.
if (
  url.pathname.startsWith("/editor-api/sprites/") &&
  request.method === "GET"
) {
  if (!env.EDITOR_SPRITES) {
    return privateJson({
      error: "Almacenamiento de sprites no conectado."
    }, 500);
  }

  const spriteId = url.pathname.slice(
    "/editor-api/sprites/".length
  );

    if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(spriteId) ||
    spriteId.length > 60
  ) {
      
    return privateJson({
      error: "Identificador inválido."
    }, 400);
  }

  const object = await env.EDITOR_SPRITES.get(
    `drafts/${spriteId}.png`
  );

  if (!object) {
    return privateJson({
      error: "Sprite no encontrado."
    }, 404);
  }

  return new Response(object.body, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}      
      if (
        url.pathname === "/editor-api/draft" &&
        request.method === "GET"
      ) {
        const draft = await env.EDITOR_DRAFTS.get(
          "main-draft",
          "json"
        );

        return privateJson({
          ok: true,
          draft: draft || {
            notes: "",
            updatedAt: null
          }
        });
      }

      // Guardar borrador.
      if (
        url.pathname === "/editor-api/draft" &&
        request.method === "PUT"
      ) {
        const contentLength = Number(
          request.headers.get("Content-Length") || 0
        );

        if (contentLength > 100000) {
          return privateJson({
            error: "El borrador es demasiado grande."
          }, 413);
        }

        let body;

        try {
          const raw = await request.text();

          if (raw.length > 100000) {
            return privateJson({
              error: "El borrador es demasiado grande."
            }, 413);
          }

          body = JSON.parse(raw);
        } catch {
          return privateJson({
            error: "JSON inválido."
          }, 400);
        }

        if (
          !body ||
          typeof body !== "object" ||
          Array.isArray(body) ||
          typeof body.notes !== "string" ||
          body.notes.length > 50000
        ) {
          return privateJson({
            error: "Formato de borrador inválido."
          }, 400);
        }

        const draft = {
          notes: body.notes,
          updatedAt: new Date().toISOString()
        };

        await env.EDITOR_DRAFTS.put(
          "main-draft",
          JSON.stringify(draft)
        );

        return privateJson({
          ok: true,
          message: "Borrador guardado.",
          updatedAt: draft.updatedAt
        });
      }

      return privateJson({
        error: "Ruta privada no encontrada."
      }, 404);
    }

    // Rutas públicas existentes.
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    if (url.pathname === "/health") {
      return json({
        ok: true,
        service: "Duelo Pixel Rooms",
        version: 1
      });
    }

    // Crear una sala.
    if (
      url.pathname === "/api/rooms" &&
      request.method === "POST"
    ) {
      let body = {};

      try {
        body = await request.json();
      } catch {}

      const code = makeCode();
      const id = env.ROOMS.idFromName(code);
      const stub = env.ROOMS.get(id);

      const init = await stub.fetch(
        "https://room.internal/init",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            code,
            createdAt: Date.now(),
            hostName: cleanName(body.name)
          })
        }
      );

      if (!init.ok) {
        return json({
          error: "No se pudo crear la sala."
        }, 500);
      }

      return json({ code });
    }

    // Conectar jugadores a una sala.
    const match = url.pathname.match(
      /^\/api\/rooms\/([A-Z0-9]{6})$/i
    );

    if (match) {
      const code = match[1].toUpperCase();
      const id = env.ROOMS.idFromName(code);
      const stub = env.ROOMS.get(id);

      const target = new URL(request.url);

      target.pathname = "/connect";
      target.searchParams.set("code", code);
      target.searchParams.set(
        "name",
        cleanName(url.searchParams.get("name"))
      );

      return stub.fetch(
        new Request(target, request)
      );
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return json({
      error: "Ruta no encontrada."
    }, 404);
  }
};

// Generar código de sala.
function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);

  crypto.getRandomValues(bytes);

  return [...bytes]
    .map(x => chars[x % chars.length])
    .join("");
}

function cleanName(value) {
  const name = String(value || "Jugador")
    .trim()
    .replace(/[<>\u0000-\u001f]/g, "")
    .slice(0, 20);

  return name || "Jugador";
}

// Sistema de salas online.
export class Room {
  constructor(state) {
    this.state = state;
    this.storage = state.storage;
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (
      url.pathname === "/init" &&
      request.method === "POST"
    ) {
      const body = await request.json();
      const current = await this.storage.get("room");

      if (!current) {
        await this.storage.put("room", {
          code: body.code,
          createdAt: body.createdAt,
          players: []
        });

        await this.state.storage.setAlarm(
          Date.now() + 6 * 60 * 60 * 1000
        );
      }

      return new Response("ok");
    }

    if (url.pathname !== "/connect") {
      return new Response("Not found", {
        status: 404
      });
    }

    if (
      request.headers.get("Upgrade") !== "websocket"
    ) {
      return new Response(
        "Se requiere WebSocket",
        { status: 426 }
      );
    }

    const room = await this.storage.get("room");

    if (!room) {
      return new Response(
        JSON.stringify({
          error: "La sala no existe o expiró."
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    const sockets = this.state.getWebSockets();

    if (sockets.length >= 2) {
      return new Response(
        JSON.stringify({
          error: "La sala ya tiene dos jugadores."
        }),
        {
          status: 409,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    const used = sockets.map(s => {
      try {
        return s.deserializeAttachment()?.role;
      } catch {
        return null;
      }
    });

    const role = used.includes("host")
      ? "guest"
      : "host";

    const pair = new WebSocketPair();

    const client = pair[0];
    const server = pair[1];

    this.state.acceptWebSocket(server);

    server.serializeAttachment({
      role,
      name: cleanName(url.searchParams.get("name"))
    });

    const updated = await this.getRoom();

    updated.players = (
      updated.players || []
    ).filter(p => p.role !== role);

    updated.players.push({
      role,
      name: cleanName(url.searchParams.get("name")),
      ready: false,
      team: []
    });

    await this.storage.put("room", updated);

    this.send(server, {
      type: "welcome",
      role,
      code: updated.code
    });

    this.broadcast({
      type: "room",
      room: this.publicRoom(updated)
    });

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  async webSocketMessage(socket, message) {
    let data;

    try {
      data = JSON.parse(
        typeof message === "string"
          ? message
          : new TextDecoder().decode(message)
      );
    } catch {
      return;
    }

    const attachment =
      socket.deserializeAttachment() || {};

    const role = attachment.role;

    if (!role) return;

    const room = await this.getRoom();

    const player = (
      room.players || []
    ).find(p => p.role === role);

    if (!player) return;

    if (data.type === "ready") {
      player.ready = !!data.ready;

    } else if (data.type === "team") {
      if (
        !Array.isArray(data.team) ||
        data.team.length !== 8 ||
        data.team.some(
          x => typeof x !== "string" ||
          x.length > 100
        )
      ) {
        this.send(socket, {
          type: "error",
          message:
            "El equipo debe contener exactamente 8 identificadores de criatura."
        });
        return;
      }

      player.team = [...new Set(data.team)];

      if (player.team.length !== 8) {
        this.send(socket, {
          type: "error",
          message:
            "El equipo no puede tener criaturas duplicadas."
        });
        return;
      }

    } else if (data.type === "chat") {
      const text = String(data.text || "")
        .trim()
        .slice(0, 240);

      if (text) {
        this.broadcast({
          type: "chat",
          role,
          name: player.name,
          text,
          at: Date.now()
        });
      }

      return;

    } else if (data.type === "ping") {
      this.send(socket, {
        type: "pong",
        at: Date.now()
      });
      return;

    } else {
      this.send(socket, {
        type: "error",
        message:
          "Mensaje no reconocido por el servidor."
      });
      return;
    }

    await this.storage.put("room", room);

    this.broadcast({
      type: "room",
      room: this.publicRoom(room)
    });

    if (
      room.players.length === 2 &&
      room.players.every(
        p => p.ready && p.team.length === 8
      )
    ) {
      this.broadcast({
        type: "ready_to_battle",
        message:
          "Ambos jugadores están listos. La sala está preparada para iniciar el combate online."
      });
    }
  }

  async alarm() {
    for (
      const socket of this.state.getWebSockets()
    ) {
      try {
        socket.close(1000, "Sala expirada");
      } catch {}
    }

    await this.storage.delete("room");
  }

  async webSocketClose(socket) {
    await this.removeSocket(socket);
  }

  async webSocketError(socket) {
    await this.removeSocket(socket);
  }

  async removeSocket(socket) {
    let attachment = {};

    try {
      attachment =
        socket.deserializeAttachment() || {};
    } catch {}

    const room = await this.getRoom();

    room.players = (
      room.players || []
    ).filter(
      p => p.role !== attachment.role
    );

    await this.storage.put("room", room);

    this.broadcast({
      type: "room",
      room: this.publicRoom(room)
    });

    this.broadcast({
      type: "notice",
      message:
        "Un jugador se desconectó. La sala seguirá abierta para volver a entrar."
    });
  }

  async getRoom() {
    return (
      await this.storage.get("room")
    ) || {
      code: "",
      players: []
    };
  }

  publicRoom(room) {
    return {
      code: room.code,
      players: (
        room.players || []
      ).map(p => ({
        role: p.role,
        name: p.name,
        ready: !!p.ready,
        teamCount: (
          p.team || []
        ).length
      })),
      capacity: 2
    };
  }

  send(socket, data) {
    try {
      socket.send(JSON.stringify(data));
    } catch {}
  }

  broadcast(data) {
    for (
      const socket of this.state.getWebSockets()
    ) {
      this.send(socket, data);
    }
  }
}

