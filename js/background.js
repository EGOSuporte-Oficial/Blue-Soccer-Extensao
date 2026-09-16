import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import { ID, PARENT_KEY } from "./shared.js";

const BASE_URL = "https://egosuporte-oficial.github.io/Blue-Soccer-Extensao";

OBR.onReady(async () => {
  setupContextMenu();
  setupOrphanCleanup();
});

// ---------------------------------------------------------------------------
// Menu de contexto: aparece ao clicar com o botão direito em um token nas
// camadas de Personagem, Montaria ou Item (as mesmas que a Stat Bubbles for
// D&D usa). Abre o popover do editor, ancorado no próprio ícone clicado.
//
// Observação: a Owlbear Rodeo não resolve caminho relativo nem absoluto
// (tipo "/icons/stats.svg") do jeito que um navegador resolveria — ela só
// concatena o domínio puro com o texto do caminho. Por isso o ícone e a
// URL do popover aqui usam o link completo (BASE_URL), em vez de caminho
// relativo como os outros arquivos .html usam entre si.
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
// Limpeza de segurança: se alguém apagar o token diretamente (sem passar
// pelo editor), as bolhas anexadas ficam "órfãs" no cenário. Aqui a gente
// detecta e remove. Como só apaga o que já não tem dono, essa checagem é
// idempotente — não corre risco de loop mesmo rodando em todos os clientes
// conectados ao mesmo tempo.
// ---------------------------------------------------------------------------
function setupOrphanCleanup() {
  OBR.scene.items.onChange(async (items) => {
    const ids = new Set(items.map((it) => it.id));
    const orphans = items
      .filter((it) => it.metadata?.[PARENT_KEY] && !ids.has(it.metadata[PARENT_KEY]))
      .map((it) => it.id);
    if (orphans.length) {
      try {
        await OBR.scene.items.deleteItems(orphans);
      } catch {
        // outro cliente já deve ter removido — sem problema.
      }
    }
  });
}
