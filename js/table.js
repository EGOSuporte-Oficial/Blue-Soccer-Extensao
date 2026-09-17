import OBR, { buildShape } from "https://esm.sh/@owlbear-rodeo/sdk@3";
import {
  ID,
  getStats,
  STATS_KEY,
  parseInlineValue,
  clamp,
  deslocamentoMaximoEfetivo,
} from "./shared.js";
import { renderMarker, refreshDetailIfVisible } from "./panel.js";

const app = document.getElementById("app");

let role = "PLAYER";
let items = [];
let highlightedId = null;

function highlightIdFor(tokenId) {
  return `${ID}/highlight/${tokenId}`;
}

OBR.onReady(async () => {
  role = await OBR.player.getRole();
  items = await OBR.scene.items.getItems();
  render();

  OBR.scene.items.onChange((newItems) => {
    items = newItems;
    render();
  });
});

function trackedItems() {
  return items.filter((it) => {
    const stats = it.metadata?.[STATS_KEY];
    if (!stats) return false;
    if (role !== "GM" && stats.visivelParaJogadores === false) return false;
    return true;
  });
}

function render() {
  const tracked = trackedItems();

  if (tracked.length === 0) {
    app.innerHTML = `<p class="loading">Nenhum token com estatísticas na cena ainda.<br />Clique com o botão direito num token e escolha "Editar Estatísticas" pra começar.</p>`;
    return;
  }

  app.innerHTML = `
    <h1>Tabela de Estatísticas</h1>
    <p class="subtitle">Blue Soccer RPG — clique num token pra focar nele</p>
    <div class="token-table">
      ${tracked.map((item) => rowTemplate(item)).join("")}
    </div>
  `;
  wire();
}

function rowTemplate(item) {
  const stats = getStats(item);
  const deslocMax = deslocamentoMaximoEfetivo(stats);
  const name = item.text?.plainText || item.name || "Token";

  return `
    <div class="token-row" data-id="${item.id}">
      <div class="token-row-name">${name}</div>
      <div class="token-row-fields">
        <label>
          PA
          <input type="text" inputmode="numeric" data-field="pa" data-id="${item.id}" value="${stats.pa.atual}" />
          <span class="slash">/${stats.pa.maximo}</span>
        </label>
        <label>
          DES
          <input type="text" inputmode="numeric" data-field="desloc" data-id="${item.id}" value="${stats.deslocamento.atual}" />
          <span class="slash">/${deslocMax}m</span>
        </label>
        <label>
          DSP
          <input type="text" inputmode="numeric" data-field="despertar" data-id="${item.id}" value="${stats.despertar.pontos}" />
          <span class="slash">/10</span>
        </label>
      </div>
    </div>
  `;
}

function wire() {
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
// Clique na linha: move a câmera até o token e desenha um contorno de
// destaque local (só você vê) por alguns segundos.
//
// Aviso: "mover a câmera" e "desenhar uma forma" usam APIs da Owlbear que eu
// não consegui reconferir na documentação nesta rodada — se alguma delas não
// funcionar exatamente assim, a tabela continua funcionando pra ver/editar
// os valores mesmo assim (cada parte está isolada em try/catch).
// ---------------------------------------------------------------------------
async function focusToken(tokenId) {
  const item = items.find((it) => it.id === tokenId);
  if (!item) return;

  try {
    const dpi = await OBR.scene.grid.getDpi();
    const half = dpi * 0.75; // aproxima o "raio" de um token padrão
    const bounds = {
      min: { x: item.position.x - half, y: item.position.y - half },
      max: { x: item.position.x + half, y: item.position.y + half },
    };
    await OBR.viewport.animateToBounds(bounds);
  } catch {
    // segue o jogo sem o movimento de câmera.
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
