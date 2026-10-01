import { validateDefinition } from "./catalog-validation.js";
import { simulate } from "./battle-engine.js";

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


      // Sprites de tipos: recursos privados independientes de los sprites de entidades.
      // Se permite reemplazarlos expresamente; no se alteran los valores de la tabla.
      const typeIds = new Set(["fuego","planta","roca","hielo","rayo","metal","guerra","mente","encanto","espectro","divinidad","luz","oscuridad","viento","dragon","agua","veneno","tecnologia","agilidad","espiritu"]);
      if (url.pathname === "/editor-api/type-icons" && request.method === "GET") {
        if (!env.EDITOR_SPRITES) return privateJson({error:"Almacenamiento R2 no conectado."},500);
        const objects = await env.EDITOR_SPRITES.list({prefix:"type-icons/",limit:100});
        return privateJson({ok:true,types:objects.objects.map(o=>o.key.slice(11).replace(/\.png$/,"" )).filter(id=>typeIds.has(id))});
      }
      const iconMatch=url.pathname.match(/^\/editor-api\/type-icons\/([a-z]+)$/);
      if(iconMatch){
        const id=iconMatch[1];if(!typeIds.has(id))return privateJson({error:"Tipo desconocido."},400);
        if(!env.EDITOR_SPRITES)return privateJson({error:"Almacenamiento R2 no conectado."},500);
        const key=`type-icons/${id}.png`;
        if(request.method==="GET"){
          const obj=await env.EDITOR_SPRITES.get(key);if(!obj)return privateJson({error:"Sprite no encontrado."},404);
          return new Response(obj.body,{headers:{"Content-Type":"image/png","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
        }
        if(request.method==="PUT"){
          if(request.headers.get("Origin")!==url.origin)return privateJson({error:"Origen no autorizado."},403);
          if(!(request.headers.get("Content-Type")||"").toLowerCase().startsWith("image/png"))return privateJson({error:"Solo PNG."},415);
          const length=Number(request.headers.get("Content-Length")||0);if(length>2*1024*1024)return privateJson({error:"PNG demasiado grande."},413);
          const bytes=await request.arrayBuffer();if(!bytes.byteLength||bytes.byteLength>2*1024*1024)return privateJson({error:"El PNG debe pesar entre 1 byte y 2 MB."},413);
          const sig=new Uint8Array(bytes).slice(0,8);if(![137,80,78,71,13,10,26,10].every((x,i)=>sig[i]===x))return privateJson({error:"Firma PNG inválida."},415);
          await env.EDITOR_SPRITES.put(key,bytes,{httpMetadata:{contentType:"image/png"}});
          return privateJson({ok:true,type:id,message:"Sprite guardado."});
        }
        return privateJson({error:"Método no permitido."},405);
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

      // ========================================
      // TABLA DE TIPOS
      // ========================================

      const TYPES = [
        "fuego",
        "planta",
        "roca",
        "hielo",
        "rayo",
        "metal",
        "guerra",
        "mente",
        "encanto",
        "espectro",
        "divinidad",
        "luz",
        "oscuridad",
        "viento",
        "dragon",
        "agua",
        "veneno",
        "tecnologia",
        "agilidad",
        "espiritu"
      ];

      const TYPE_VALUES = [
        "neutral",
        "ineficaz",
        "eficaz",
        "inmune"
      ];

      // Crear tabla inicialmente neutral.
      function createDefaultTypeChart() {
        const chart = {};

        for (const attackType of TYPES) {
          chart[attackType] = {};

          for (const defenseType of TYPES) {
            chart[attackType][defenseType] = "neutral";
          }
        }

        return chart;
      }

      // Simulación de combate exclusivamente privada y sin escrituras.
      if (url.pathname === "/editor-api/simulate" && request.method === "POST") {
        if (request.headers.get("Origin") !== url.origin) return privateJson({error:"Origen no autorizado."},403);
        let input;
        try { const raw=await request.text(); if(raw.length>20000) return privateJson({error:"Solicitud demasiado grande."},413); input=JSON.parse(raw); }
        catch { return privateJson({error:"Solicitud inválida."},400); }
        const idPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
        if (!idPattern.test(input?.left||"") || !idPattern.test(input?.right||"")) return privateJson({error:"Elegí dos entidades válidas."},400);
        const allIds=[...(Array.isArray(input.leftTeam)?input.leftTeam:[input.left]),...(Array.isArray(input.rightTeam)?input.rightTeam:[input.right])];
        if(allIds.length>16||allIds.some(id=>!idPattern.test(id||"")))return privateJson({error:"Equipo inválido."},400);
        const ids={entities:[...new Set(allIds)],moves:[],abilities:[],effects:[]};
        const catalog={entities:{},moves:{},abilities:{},effects:{},weathers:{},fields:{},scenarios:{}};
        async function get(category,id) {
          if (!idPattern.test(id||"")) throw Error("Referencia inválida: "+id);
          if (catalog[category][id]) return catalog[category][id];
          const entry=await env.EDITOR_DRAFTS.get(`catalog-v1:${category}:${id}`,"json");
          if(!entry) throw Error("No existe "+category+" / "+id);
          catalog[category][id]=entry; return entry;
        }
        try {
          for (const id of ids.entities) {
            const e=await get("entities",id),d=e.definition;
            for(const mid of [...(d.moveIds||[]),d.uniqueMoveId]) await get("moves",mid);
            for(const aid of [d.globalAbilityId,d.uniqueAbilityId]) await get("abilities",aid);
          }
          // Efectos reutilizados: profundidad de referencia acotada.
          let pending=[...Object.values(catalog.moves),...Object.values(catalog.abilities)];
          for(let depth=0;depth<5;depth++) {
            const next=[];
            for(const entry of pending) for(const rule of entry.definition.rules||[]) if(rule.action?.type==="apply_effect") {
              const eid=rule.action.value;
              if(!catalog.effects[eid]) next.push(await get("effects",eid));
            }
            pending=next;if(!next.length)break;
          }
          // Cargar los entornos referenciados por habilidades/ataques/efectos.
          const seen=new Set();
          for(const [category,id] of [['weathers',input.weather],['fields',input.field]])if(id)await get(category,id);
          for(const category of ['moves','abilities','effects'])for(const entry of Object.values(catalog[category]))for(const rule of entry.definition.rules||[]){
            const envCategory={set_weather:'weathers',set_field:'fields',set_scenario:'scenarios'}[rule.action?.type];
            if(envCategory&&rule.action.value){const key=envCategory+':'+rule.action.value;if(!seen.has(key)){seen.add(key);await get(envCategory,rule.action.value);}}
          }
          const chart=await env.EDITOR_DRAFTS.get("type-chart-draft","json");
          return privateJson(simulate({left:input.left,right:input.right,catalog,chart:chart?.chart||chart,turns:Math.min(50,Math.max(1,Number(input.turns)||10)),seed:Number(input.seed)||12345,weather:input.weather||"",field:input.field||"",leftMove:input.leftMove||"",rightMove:input.rightMove||"",leftTeam:input.leftTeam,rightTeam:input.rightTeam,leftOrders:input.leftOrders,rightOrders:input.rightOrders}));
        } catch(e) { return privateJson({error:String(e.message||e)},400); }
      }

      // Catálogo privado de contenido. No ejecuta mecánicas en combate.
      const CATALOG_CATEGORIES = ["effects", "moves", "abilities", "entities", "weathers", "fields", "scenarios", "statuses"];
      const catalogMatch = url.pathname.match(/^\/editor-api\/catalog\/([a-z]+)(?:\/([a-z0-9]+(?:-[a-z0-9]+)*))?$/);
      if (catalogMatch) {
        const category = catalogMatch[1];
        const id = catalogMatch[2];
        if (!CATALOG_CATEGORIES.includes(category)) return privateJson({ error: "Categoría inválida." }, 404);
        const prefix = `catalog-v1:${category}:`;
        if (request.method === "GET" && !id) {
          const listed = await env.EDITOR_DRAFTS.list({ prefix, limit: 1000 });
          const entries = await Promise.all(listed.keys.map(async key => env.EDITOR_DRAFTS.get(key.name, "json")));
          return privateJson({ ok: true, entries: entries.filter(Boolean), cursor: listed.list_complete ? null : listed.cursor });
        }
        if (request.method === "GET" && id) {
          const entry = await env.EDITOR_DRAFTS.get(prefix + id, "json");
          return entry ? privateJson({ ok: true, entry }) : privateJson({ error: "No encontrado." }, 404);
        }
        if (request.method === "PUT" && id) {
          if (request.headers.get("Origin") !== url.origin) return privateJson({ error: "Origen no autorizado." }, 403);
          const raw = await request.text();
          if (raw.length > 60000) return privateJson({ error: "Contenido demasiado grande." }, 413);
          let body;
          try { body = JSON.parse(raw); } catch { return privateJson({ error: "JSON inválido." }, 400); }
          if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.name !== "string" || !body.name.trim() || body.name.length > 100 || typeof body.description !== "string" || body.description.length > 2000 || !body.definition || typeof body.definition !== "object" || Array.isArray(body.definition)) {
            return privateJson({ error: "Se requiere nombre, descripción y definición como objeto." }, 400);
          }
          // Validaciones de referencias y rangos del editor, sin modificar balance.
          const d=body.definition;
          try { validateDefinition(category,d); } catch (error) { return privateJson({error:error.message},400); }
          const slug=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
          const allTypes=["fuego","planta","roca","hielo","rayo","metal","guerra","mente","encanto","espectro","divinidad","luz","oscuridad","viento","dragon","agua","veneno","tecnologia","agilidad","espiritu"];
          if (category === "moves") {
            if (!allTypes.includes(d.type)||!["physical","special","status"].includes(d.category)||!Number.isFinite(d.power)||d.power<0||d.power>500||!Number.isFinite(d.accuracy)||d.accuracy<0||d.accuracy>100||!Number.isFinite(d.criticalChance)||d.criticalChance<0||d.criticalChance>50||!Number.isInteger(d.priority)||d.priority< -5||d.priority>5) return privateJson({error:"Tipo, categoría, potencia, precisión, crítico o prioridad inválidos."},400);
          }
          if (category === "entities") {
            if(!Array.isArray(d.types)||d.types.length<1||d.types.length>3||new Set(d.types).size!==d.types.length||d.types.some(t=>!allTypes.includes(t)))return privateJson({error:"Se requieren 1–3 tipos distintos y válidos."},400);
            for(const stat of ["hp","attack","defense","specialAttack","specialDefense","speed"])if(!Number.isInteger(d[stat])||d[stat]<(stat==="hp"?1:0)||d[stat]>200)return privateJson({error:"Estadística inválida: "+stat+" (PS 1–200; demás 0–200)."},400);
            if(!Array.isArray(d.moveIds)||d.moveIds.length!==3||new Set([...d.moveIds,d.uniqueMoveId]).size!==4)return privateJson({error:"Se requieren tres ataques globales y uno exclusivo, todos distintos."},400);
            for(const [kind,ids] of [["moves",[...d.moveIds,d.uniqueMoveId]],["abilities",[d.globalAbilityId,d.uniqueAbilityId]]])for(const ref of ids) {
              if(!slug.test(ref||""))return privateJson({error:"Referencia inválida: "+ref},400);
              const found=await env.EDITOR_DRAFTS.get(`catalog-v1:${kind}:${ref}`,"json");
              if(!found)return privateJson({error:`Falta ${kind} / ${ref}. Guardalo antes de crear la entidad.`},400);
              const expected = kind==='moves' ? (ref===d.uniqueMoveId?'unique':'global') : (ref===d.uniqueAbilityId?'unique':'global');
              if(found.definition.kind!==expected) return privateJson({error:`${kind} / ${ref}: la clase debe ser ${expected}.`},400);
            }
            if(d.spriteId && !slug.test(d.spriteId))return privateJson({error:"ID de sprite inválido."},400);
          }
          if(Array.isArray(d.rules))for(const rule of d.rules) {
            if(!Number.isFinite(rule.chance??100)||(rule.chance??100)<0||(rule.chance??100)>100||!Number.isFinite(rule.duration??0)||(rule.duration??0)<0||!Number.isFinite(rule.limit??0)||(rule.limit??0)<0)return privateJson({error:"Probabilidad, duración o límite inválidos."},400);
            if(rule.action?.type==="apply_effect" && rule.action.value && !await env.EDITOR_DRAFTS.get(`catalog-v1:effects:${rule.action.value}`,"json"))return privateJson({error:"Guardá primero el efecto "+rule.action.value},400);
          }
          const entry = { id, category, name: body.name.trim(), description: body.description, definition: body.definition, updatedAt: new Date().toISOString() };
          await env.EDITOR_DRAFTS.put(prefix + id, JSON.stringify(entry));
          return privateJson({ ok: true, entry });
        }
        if (request.method === "DELETE" && id) {
          if (request.headers.get("Origin") !== url.origin) return privateJson({ error: "Origen no autorizado." }, 403);
          await env.EDITOR_DRAFTS.delete(prefix + id);
          return privateJson({ ok: true });
        }
        return privateJson({ error: "Método no permitido." }, 405);
      }

      // Recuperar tabla privada.
      if (
        url.pathname === "/editor-api/type-chart" &&
        request.method === "GET"
      ) {
        const saved = await env.EDITOR_DRAFTS.get(
          "type-chart-draft",
          "json"
        );

        // Compatibilidad: conservar las relaciones guardadas cuando el tipo
        // antes llamado "aire" pasa a llamarse "viento".
        const chart = createDefaultTypeChart();
        if (saved?.chart) {
          for (const attack of TYPES) {
            for (const defense of TYPES) {
              const oldAttack = attack === "viento" ? "aire" : attack;
              const oldDefense = defense === "viento" ? "aire" : defense;
              const value = saved.chart[attack]?.[defense]
                ?? saved.chart[oldAttack]?.[oldDefense];
              if (TYPE_VALUES.includes(value)) chart[attack][defense] = value;
            }
          }
        }
        // No reescribir KV en GET: se migra al guardar el siguiente cambio.
        return privateJson({
          ok: true,
          types: TYPES,
          chart,
          updatedAt: saved?.updatedAt || null
        });
      }

      // Guardar tabla privada.
      if (
        url.pathname === "/editor-api/type-chart" &&
        request.method === "PUT"
      ) {
        if (request.headers.get("Origin") !== url.origin) {
          return privateJson({
            error: "Origen no autorizado."
          }, 403);
        }

        let body;

        try {
          body = await request.json();
        } catch {
          return privateJson({
            error: "JSON inválido."
          }, 400);
        }

        const chart = body?.chart;

        if (
          !chart ||
          typeof chart !== "object" ||
          Array.isArray(chart)
        ) {
          return privateJson({
            error: "Tabla inválida."
          }, 400);
        }

        // Validar las 400 relaciones.
        for (const attackType of TYPES) {
          const row = chart[attackType];

          if (
            !row ||
            typeof row !== "object" ||
            Array.isArray(row)
          ) {
            return privateJson({
              error: "Falta una fila de la tabla."
            }, 400);
          }

          for (const defenseType of TYPES) {
            if (
              !TYPE_VALUES.includes(row[defenseType])
            ) {
              return privateJson({
                error: "Hay una relación de tipos inválida."
              }, 400);
            }
          }
        }

        const draft = {
          chart,
          updatedAt: new Date().toISOString()
        };

        await env.EDITOR_DRAFTS.put(
          "type-chart-draft",
          JSON.stringify(draft)
        );

        return privateJson({
          ok: true,
          message: "Tabla de tipos guardada.",
          updatedAt: draft.updatedAt
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

