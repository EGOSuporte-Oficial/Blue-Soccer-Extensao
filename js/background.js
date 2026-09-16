import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import { ID, STATS_KEY, HIDDEN_MARKERS_KEY } from "./shared.js";
import { renderMarker, removeMarker, renderDetail, removeDetail } from "./panel.js";

const BASE_URL = "https://egosuporte-oficial.github.io/Blue-Soccer-Extensao";

// Cópia mais recente de todos os itens da cena (atualizada pelo onChange
// abaixo), pra não precisar buscar de novo toda hora.
let cachedItems = [];

// Tokens que ESTE cliente está mostrando marcador/detalhe agora — usado só
// pra saber o que remover quando algo muda (deixa de ser rastreado, foi
// escondido pela preferência do jogador, ou o token sumiu).
let renderedMarkerIds = new Set();
let detailedTokenIds = new Set();

OBR.onReady(async () => {
  cachedItems = await OBR.scene.items.getItems();
  setupContextMenu();
  setupSceneSync();
  setupPlayerSync();
  await syncMarkers();
});

// ---------------------------------------------------------------------------
// Menu de contexto: aparece ao clicar com o botão direito em um token nas
// camadas de Personagem, Montaria ou Item. Abre o popover do editor,
// ancorado no próprio ícone clicado.
//
// Observação: a Owlbear Rodeo não resolve caminho relativo nem absoluto
// (tipo "/icons/stats.svg") do jeito que um navegador resolveria — ela só
// concatena o domínio puro com o texto do caminho. Por isso o ícone e a
// URL do popover aqui usam o link completo (BASE_URL).
// ---------------------------------------------------------------------------
function setupContextMenu() {
  OBR.contextMenu.create({
    id: `${ID}/context-menu`,
    icons: [
      {
        icon: `${BASE_URL}/icons/stats.svg`,
        label: "Editar Estatísticas",
        filter: {
          every: [
            { key: "layer", value: "CHARACTER", coordinator: "||" },
            { key: "layer", value: "MOUNT", coordinator: "||" },
            { key: "layer", value: "PROP" },
          ],
        },
      },
    ],
    onClick(context, elementId) {
      const item = context.items[0];
      if (!item) return;
      OBR.popover.open({
        id: `${ID}/editor`,
        url: `${BASE_URL}/editor.html?id=${encodeURIComponent(item.id)}`,
        height: 480,
        width: 300,
        anchorElementId: elementId,
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Marcador: cada cliente decide, pra cada token com estatísticas, se mostra
// o marcador compacto — com base na preferência PESSOAL desse jogador
// (HIDDEN_MARKERS_KEY em OBR.player.metadata, um array de IDs de token que
// ELE escolheu não ver). Isso roda de novo sempre que os itens da cena
// mudam (token novo, estatística editada) ou a preferência do jogador muda.
// ---------------------------------------------------------------------------
async function getHiddenSet() {
  const metadata = await OBR.player.getMetadata();
  const arr = metadata?.[HIDDEN_MARKERS_KEY];
  return new Set(Array.isArray(arr) ? arr : []);
}

async function syncMarkers() {
  const hidden = await getHiddenSet();
  const trackedIds = new Set(
    cachedItems.filter((it) => it.metadata?.[STATS_KEY]).map((it) => it.id)
  );

  for (const id of Array.from(renderedMarkerIds)) {
    if (!trackedIds.has(id) || hidden.has(id)) {
      await removeMarker(id);
      renderedMarkerIds.delete(id);
    }
  }

  for (const id of trackedIds) {
    if (hidden.has(id)) continue;
    await renderMarker(id);
    renderedMarkerIds.add(id);
  }
}

// ---------------------------------------------------------------------------
// Reage a mudanças na cena: dados de estatística mudaram, token novo
// apareceu, ou um token foi apagado (nesse caso, limpa marcador e detalhe
// órfãos deste cliente).
// ---------------------------------------------------------------------------
function setupSceneSync() {
  OBR.scene.items.onChange(async (items) => {
    cachedItems = items;
    await syncMarkers();

    const ids = new Set(items.map((it) => it.id));
    for (const tokenId of Array.from(detailedTokenIds)) {
      if (!ids.has(tokenId)) {
        await removeDetail(tokenId);
        detailedTokenIds.delete(tokenId);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Reage a mudanças no jogador: seleção (mostra/some o detalhe completo) e
// preferência de marcador (mostra/some o marcador compacto pra este token).
// ---------------------------------------------------------------------------
function setupPlayerSync() {
  OBR.player.onChange(async (player) => {
    const selection = player.selection ?? [];
    const selectedSet = new Set(selection);

    for (const id of Array.from(detailedTokenIds)) {
      if (!selectedSet.has(id)) {
        await removeDetail(id);
        detailedTokenIds.delete(id);
      }
    }

    for (const id of selection) {
      if (detailedTokenIds.has(id)) continue;
      const item = cachedItems.find((it) => it.id === id);
      if (item?.metadata?.[STATS_KEY]) {
        await renderDetail(id);
        detailedTokenIds.add(id);
      }
    }

    await syncMarkers();
  });
}
