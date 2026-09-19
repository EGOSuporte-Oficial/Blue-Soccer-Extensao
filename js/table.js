import OBR, { buildShape } from "https://esm.sh/@owlbear-rodeo/sdk@3";
import {
  ID,
  getStats,
  STATS_KEY,
  ROOM_SETTINGS_KEY,
  parseInlineValue,
  clamp,
  deslocamentoMaximoEfetivo,
  extractRoomSettings,
  podeVerEstatisticas,
  podeEditarToken,
} from "./shared.js";
import { renderMarker, refreshDetailIfVisible } from "./panel.js";

const app = document.getElementById("app");

let role = "PLAYER";
let items = [];
let roomSettings = extractRoomSettings(null);
let highlightedId = null;
let view = "list"; // "list" | "settings"

function highlightIdFor(tokenId) {
  return `${ID}/highlight/${tokenId}`;
}

OBR.onReady(async () => {
  role = await OBR.player.getRole();
  items = await OBR.scene.items.getItems();
  roomSettings = extractRoomSettings(await OBR.room.getMetadata());
  render();

  OBR.scene.items.onChange((newItems) => {
    items = newItems;
    render();
  });

  OBR.room.onMetadataChange(async (metadata) => {
    roomSettings = extractRoomSettings(metadata);
    render();
  });
});

function trackedItems() {
  return items.filter((it) => Boolean(it.metadata?.[STATS_KEY]));
}

function render() {
  if (!podeVerEstatisticas(role, roomSettings)) {
    app.innerHTML = `
      <div class="locked">
        <strong>Estatísticas ocultas</strong><br />
        Somente o Mestre pode ver as estatísticas agora.
        <p><button class="link-btn" id="abrir-config">Configurações e suporte</button></p>
      </div>
    `;
    byId("abrir-config")?.addEventListener("click", () => {
      view = "settings";
      render();
    });
    return;
  }

  if (view === "settings") {
    renderSettings();
    return;
  }

  renderList();
}

function renderList() {
  const tracked = trackedItems();

  app.innerHTML = `
    <div class="row split">
      <div>
        <h1>Tabela de Estatísticas</h1>
        <p class="subtitle">Blue Soccer RPG — clique num token pra focar nele</p>
      </div>
      <button class="link-btn" id="abrir-config">Configurações</button>
    </div>
    ${
      tracked.length === 0
        ? `<p class="loading">Nenhum token com estatísticas na cena ainda.<br />Clique com o botão direito num token e escolha "Editar Estatísticas" pra começar.</p>`
        : `<div class="token-table">${tracked.map((item) => rowTemplate(item)).join("")}</div>`
    }
  `;
  wireList(tracked);
}

function rowTemplate(item) {
  const stats = getStats(item);
  const deslocMax = deslocamentoMaximoEfetivo(stats);
  const name = item.text?.plainText || item.name || "Token";
  const editable = podeEditarToken(role, item, roomSettings, OBR.player.id);
  const ro = editable ? "" : "disabled";

  return `
    <div class="token-row" data-id="${item.id}">
      <div class="token-row-name">${name}</div>
      <div class="token-row-fields">
        <label>
          PA
          <input type="text" inputmode="numeric" data-field="pa" data-id="${item.id}" value="${stats.pa.atual}" ${ro} />
          <span class="slash">/${stats.pa.maximo}</span>
        </label>
        <label>
          DES
          <input type="text" inputmode="numeric" data-field="desloc" data-id="${item.id}" value="${stats.deslocamento.atual}" ${ro} />
          <span class="slash">/${deslocMax}m</span>
        </label>
        <label>
          DSP
          <input type="text" inputmode="numeric" data-field="despertar" data-id="${item.id}" value="${stats.despertar.pontos}" ${ro} />
          <span class="slash">/10</span>
        </label>
      </div>
    </div>
  `;
}

function wireList(tracked) {
  byId("abrir-config").addEventListener("click", () => {
    view = "settings";
    render();
  });

  document.querySelectorAll(".token-row").forEach((row) => {
    row.addEventListener("click", (e) => {
      if (e.target.tagName === "INPUT") return;
      focusToken(row.dataset.id);
    });
  });

  document.querySelectorAll("input[data-field]").forEach((input) => {
    input.addEventListener("click", (e) => e.stopPropagation());
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") e.target.blur();
    });
    input.addEventListener("change", (e) => {
      updateField(e.target.dataset.id, e.target.dataset.field, e.target.value);
    });
  });
}

async function updateField(tokenId, field, rawValue) {
  const item = items.find((it) => it.id === tokenId);
  if (!item) return;
  if (!podeEditarToken(role, item, roomSettings, OBR.player.id)) return;
  const stats = getStats(item);

  if (field === "pa") {
    stats.pa.atual = clamp(parseInlineValue(rawValue, stats.pa.atual), 0, stats.pa.maximo);
  } else if (field === "desloc") {
    const max = deslocamentoMaximoEfetivo(stats);
    stats.deslocamento.atual = clamp(parseInlineValue(rawValue, stats.deslocamento.atual), 0, max);
  } else if (field === "despertar") {
    stats.despertar.pontos = clamp(parseInlineValue(rawValue, stats.despertar.pontos), 0, 10);
  }

  await OBR.scene.items.updateItems([tokenId], (draftItems) => {
    for (const draft of draftItems) {
      draft.metadata[STATS_KEY] = JSON.parse(JSON.stringify(stats));
    }
  });
  await renderMarker(tokenId);
  await refreshDetailIfVisible(tokenId);
}

// ---------------------------------------------------------------------------
// Tela de Configurações: permissões e aparência (só o Mestre edita) + links
// de suporte (visíveis pra todo mundo).
// ---------------------------------------------------------------------------
function renderSettings() {
  const s = roomSettings;

  const gmBlock =
    role === "GM"
      ? `
    <div class="card">
      <div class="card-title">Permissões</div>
      <div class="settings-row">
        <span class="field-col-label">Quem vê as estatísticas</span>
        <div class="row split">
          <button data-setting="visibilidade" data-value="TODOS" class="${s.visibilidade === "TODOS" ? "toggle-active" : ""}">Todos veem</button>
          <button data-setting="visibilidade" data-value="MESTRE" class="${s.visibilidade === "MESTRE" ? "toggle-active" : ""}">Só o Mestre</button>
        </div>
      </div>
      <div class="settings-row">
        <span class="field-col-label">Quem pode editar</span>
        <div class="row split">
          <button data-setting="edicaoLivre" data-value="false" class="${!s.edicaoLivre ? "toggle-active" : ""}">Só o próprio token</button>
          <button data-setting="edicaoLivre" data-value="true" class="${s.edicaoLivre ? "toggle-active" : ""}">Qualquer token</button>
        </div>
      </div>
      <p class="hint">"Próprio token" considera quem colocou o token no mapa.</p>
    </div>

    <div class="card">
      <div class="card-title">Aparência da bolha</div>
      <div class="settings-row">
        <span class="field-col-label">Formação</span>
        <div class="row split">
          <button data-setting="justification" data-value="BOTTOM" class="${s.justification === "BOTTOM" ? "toggle-active" : ""}">Embaixo do token</button>
          <button data-setting="justification" data-value="TOP" class="${s.justification === "TOP" ? "toggle-active" : ""}">Cima do token</button>
        </div>
      </div>
      <div class="settings-row">
        <span class="field-col-label">Deslocamento (distância do token)</span>
        <input type="text" inputmode="decimal" id="setting-offset" value="${s.offsetGrid}" />
      </div>
      <label class="checkbox">
        <input type="checkbox" id="setting-bars" ${s.showBars ? "checked" : ""} />
        Mostrar barras em vez de números
      </label>
      <label class="checkbox">
        <input type="checkbox" id="setting-nametags" ${s.nameTags ? "checked" : ""} />
        Mostrar nome do token (Name Tag)
      </label>
    </div>
  `
      : "";

  app.innerHTML = `
    <div class="row split">
      <h1>Configurações</h1>
      <button class="link-btn" id="voltar-lista">Voltar</button>
    </div>

    ${gmBlock}

    <div class="card">
      <div class="card-title">Suporte</div>
      <div class="settings-links">
        <a href="https://egosuporte-oficial.github.io/Blue-Soccer-Extensao/#readme" target="_blank" rel="noopener">Instruções (README no GitHub)</a>
        <p class="hint">Reportar um bug — copie e envie um e-mail pra: <strong>egorpg.suporte@gmail.com</strong></p>
        <a href="https://discord.gg/qFS6P5WMXA" target="_blank" rel="noopener">Servidor do Discord</a>
      </div>
    </div>
  `;
  wireSettings();
}

function wireSettings() {
  byId("voltar-lista").addEventListener("click", () => {
    view = "list";
    render();
  });

  if (role !== "GM") return;

  document.querySelectorAll("button[data-setting]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.setting;
      let value = btn.dataset.value;
      if (value === "true") value = true;
      else if (value === "false") value = false;
      updateRoomSetting({ [key]: value });
    });
  });

  const offsetInput = byId("setting-offset");
  offsetInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") e.target.blur();
  });
  offsetInput.addEventListener("change", (e) => {
    const value = clamp(
      parseInlineValue(e.target.value, roomSettings.offsetGrid, { integer: false }),
      0.2,
      3
    );
    updateRoomSetting({ offsetGrid: value });
  });

  byId("setting-bars").addEventListener("change", (e) => {
    updateRoomSetting({ showBars: e.target.checked });
  });

  byId("setting-nametags").addEventListener("change", (e) => {
    updateRoomSetting({ nameTags: e.target.checked });
  });
}

async function updateRoomSetting(partial) {
  const current = extractRoomSettings(await OBR.room.getMetadata());
  const next = { ...current, ...partial };
  await OBR.room.setMetadata({ [ROOM_SETTINGS_KEY]: next });
  roomSettings = next;
  render();
}

function byId(id) {
  return document.getElementById(id);
}

// ---------------------------------------------------------------------------
// Clique na linha: move a câmera até o token e desenha um contorno de
// destaque local (só você vê) por alguns segundos.
// ---------------------------------------------------------------------------
async function focusToken(tokenId) {
  const item = items.find((it) => it.id === tokenId);
  if (!item) return;

  try {
    const [scale, viewWidth, viewHeight] = await Promise.all([
      OBR.viewport.getScale(),
      OBR.viewport.getWidth(),
      OBR.viewport.getHeight(),
    ]);
    const halfW = viewWidth / (2 * scale);
    const halfH = viewHeight / (2 * scale);
    const bounds = {
      min: { x: item.position.x - halfW, y: item.position.y - halfH },
      max: { x: item.position.x + halfW, y: item.position.y + halfH },
      width: halfW * 2,
      height: halfH * 2,
      center: { x: item.position.x, y: item.position.y },
    };
    await OBR.viewport.animateToBounds(bounds);
  } catch (err) {
    console.error("[Blue Soccer] Falha ao mover a câmera:", err);
  }

  try {
    await setHighlight(item);
  } catch {
    // segue o jogo sem o contorno de destaque.
  }
}

async function setHighlight(item) {
  if (highlightedId && highlightedId !== item.id) {
    await clearHighlight(highlightedId);
  }
  highlightedId = item.id;

  const dpi = await OBR.scene.grid.getDpi();
  const size = dpi * 1.15;

  const ring = buildShape()
    .id(highlightIdFor(item.id))
    .shapeType("CIRCLE")
    .position(item.position)
    .width(size)
    .height(size)
    .strokeColor("#00D4FF")
    .strokeWidth(3)
    .strokeOpacity(0.9)
    .fillOpacity(0)
    .attachedTo(item.id)
    .layer(item.layer)
    .disableHit(true)
    .locked(true)
    .build();

  try {
    await OBR.scene.local.deleteItems([ring.id]);
  } catch {
    // não existia ainda — sem problema.
  }
  await OBR.scene.local.addItems([ring]);

  setTimeout(() => clearHighlight(item.id), 4000);
}

async function clearHighlight(tokenId) {
  try {
    await OBR.scene.local.deleteItems([highlightIdFor(tokenId)]);
  } catch {
    // já não existia — sem problema.
  }
  if (highlightedId === tokenId) highlightedId = null;
}
