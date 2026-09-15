import OBR, { buildLabel } from "https://esm.sh/@owlbear-rodeo/sdk@3";
import { PARENT_KEY, VISUAL, getStats, buildPanelContent, panelIdFor } from "./shared.js";

// Recalcula e escreve a bolha de estatísticas de um token no cenário
// (visível para todos os conectados, pois usa a API síncrona OBR.scene.items,
// e não OBR.scene.local). Cria o item na primeira vez, atualiza nas seguintes.
export async function renderPanel(tokenId) {
  const [token] = await OBR.scene.items.getItems([tokenId]);
  if (!token) return;

  const stats = getStats(token);
  const { lines, color } = buildPanelContent(stats);
  const panelId = panelIdFor(tokenId);
  const dpi = await OBR.scene.grid.getDpi();

  const position = {
    x: token.position.x,
    y: token.position.y + dpi * VISUAL.OFFSET_Y_GRID,
  };
  const height = VISUAL.PANEL_HEIGHT_PER_LINE * lines.length + VISUAL.PANEL_PADDING * 2;
  const plainText = lines.join("\n");

  const [existing] = await OBR.scene.items.getItems([panelId]);

  if (existing) {
    await OBR.scene.items.updateItems([panelId], (items) => {
      for (const item of items) {
        item.position = position;
        item.text.plainText = plainText;
        item.text.height = height;
        item.style.backgroundColor = color;
      }
    });
    return;
  }

  const label = buildLabel()
    .id(panelId)
    .plainText(plainText)
    .position(position)
    .attachedTo(token.id)
    .layer(token.layer)
    .width(VISUAL.PANEL_WIDTH)
    .height(height)
    .fontSize(VISUAL.FONT_SIZE)
    .fontWeight(600)
    .textAlign("CENTER")
    .textAlignVertical("MIDDLE")
    .padding(VISUAL.PANEL_PADDING)
    .fillColor(VISUAL.TEXT_COLOR)
    .backgroundColor(color)
    .backgroundOpacity(0.95)
    .cornerRadius(VISUAL.CORNER_RADIUS)
    .pointerDirection("UP")
    .pointerWidth(14)
    .pointerHeight(8)
    .disableHit(true)
    .locked(true)
    .build();
  label.metadata[PARENT_KEY] = token.id;

  await OBR.scene.items.addItems([label]);
}

// Remove a bolha de estatísticas de um token (usado ao apagar as estatísticas
// pelo editor, ou quando o próprio token deixa de existir).
export async function removePanel(tokenId) {
  const panelId = panelIdFor(tokenId);
  try {
    await OBR.scene.items.deleteItems([panelId]);
  } catch {
    // já não existia — sem problema.
  }
}
