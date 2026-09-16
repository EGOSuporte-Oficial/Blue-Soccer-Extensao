import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import { ID, PARENT_KEY, STATS_KEY } from "./shared.js";
import { renderDetail, removeDetail } from "./panel.js";

const BASE_URL = "https://egosuporte-oficial.github.io/Blue-Soccer-Extensao";

// IDs de token que atualmente têm um "detalhe" local exibido nesta sessão
// (ou seja, que este jogador tem selecionados agora). Usado pra saber o que
// remover quando a seleção muda ou quando o token some do cenário.
let detailedTokenIds = new Set();

OBR.onReady(async () => {
  setupContextMenu();
  setupOrphanCleanup();
  setupSelectionDetail();
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
// Detalhe sob seleção: quando este jogador seleciona um token que tem
// estatísticas de Blue Soccer, mostra o painel completo (local, só pra ele).
// Ao desselecionar, o painel some. `OBR.player.onChange` dispara sempre que
// a seleção (ou qualquer outra propriedade do jogador) muda.
// ---------------------------------------------------------------------------
function setupSelectionDetail() {
  OBR.player.onChange(async (player) => {
    const selection = player.selection ?? [];
    const selectedSet = new Set(selection);

    // Remove o detalhe de tokens que não estão mais selecionados.
    for (const id of Array.from(detailedTokenIds)) {
      if (!selectedSet.has(id)) {
        await removeDetail(id);
        detailedTokenIds.delete(id);
      }
    }

    // Mostra o detalhe pra tokens recém-selecionados que tenham estatísticas.
    for (const id of selection) {
      if (detailedTokenIds.has(id)) continue;
      const [item] = await OBR.scene.items.getItems([id]);
      if (item?.metadata?.[STATS_KEY]) {
        await renderDetail(id);
        detailedTokenIds.add(id);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Limpeza de segurança: se alguém apagar o token diretamente (sem passar
// pelo editor), o marcador anexado fica "órfão" no cenário. Aqui a gente
// detecta e remove — tanto o marcador sincronizado quanto um eventual
// detalhe local que ainda estivesse aberto pra esse token.
// ---------------------------------------------------------------------------
function setupOrphanCleanup() {
  OBR.scene.items.onChange(async (items) => {
    const ids = new Set(items.map((it) => it.id));

    const orphanMarkers = items
      .filter((it) => it.metadata?.[PARENT_KEY] && !ids.has(it.metadata[PARENT_KEY]))
      .map((it) => it.id);
    if (orphanMarkers.length) {
      try {
        await OBR.scene.items.deleteItems(orphanMarkers);
      } catch {
        // outro cliente já deve ter removido — sem problema.
      }
    }

    for (const tokenId of Array.from(detailedTokenIds)) {
      if (!ids.has(tokenId)) {
        await removeDetail(tokenId);
        detailedTokenIds.delete(tokenId);
      }
    }
  });
}
