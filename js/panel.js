import OBR, { buildLabel } from "https://esm.sh/@owlbear-rodeo/sdk@3";
import {
  PARENT_KEY,
  VISUAL,
  getStats,
  buildMarkerContent,
  buildDetailContent,
  markerIdFor,
  detailIdFor,
} from "./shared.js";

async function buildAndPlaceLabel({ tokenId, id, content, width, offsetSign, pointerDirection }) {
  const [token] = await OBR.scene.items.getItems([tokenId]);
  if (!token) return null;

  const dpi = await OBR.scene.grid.getDpi();
  const { lines, color } = content;

  const position = {
    x: token.position.x,
    y: token.position.y + offsetSign * dpi * VISUAL.OFFSET_Y_GRID,
  };
  const height = VISUAL.PANEL_HEIGHT_PER_LINE * lines.length + VISUAL.PANEL_PADDING * 2;
  const plainText = lines.join("\n");

  return { token, id, position, height, plainText, color, width, pointerDirection };
}

// ---------------------------------------------------------------------------
// MARCADOR: item sincronizado (OBR.scene.items) — visível pra mesa inteira,
// sempre. Compacto de propósito.
// ---------------------------------------------------------------------------
export async function renderMarker(tokenId) {
  const stats = getStats((await OBR.scene.items.getItems([tokenId]))[0]);
  if (!stats) return;

  const built = await buildAndPlaceLabel({
    tokenId,
    id: markerIdFor(tokenId),
    content: buildMarkerContent(stats),
    width: VISUAL.MARKER_WIDTH,
    offsetSign: 1, // abaixo do token
    pointerDirection: "UP",
  });
  if (!built) return;

  const [existing] = await OBR.scene.items.getItems([built.id]);

  if (existing) {
    await OBR.scene.items.updateItems([built.id], (items) => {
      for (const item of items) {
        item.position = built.position;
        item.text.plainText = built.plainText;
        item.text.height = built.height;
        item.style.backgroundColor = built.color;
      }
    });
    return;
  }

  const label = buildLabel()
    .id(built.id)
    .plainText(built.plainText)
    .position(built.position)
    .attachedTo(built.token.id)
    .layer(built.token.layer)
    .width(built.width)
    .height(built.height)
    .fontSize(VISUAL.FONT_SIZE)
    .fontWeight(600)
    .textAlign("CENTER")
    .textAlignVertical("MIDDLE")
    .padding(VISUAL.PANEL_PADDING)
    .fillColor(VISUAL.TEXT_COLOR)
    .backgroundColor(built.color)
    .backgroundOpacity(0.95)
    .cornerRadius(VISUAL.CORNER_RADIUS)
    .pointerDirection(built.pointerDirection)
    .pointerWidth(14)
    .pointerHeight(8)
    .disableHit(true)
    .locked(true)
    .build();
  label.metadata[PARENT_KEY] = built.token.id;

  await OBR.scene.items.addItems([label]);
}

export async function removeMarker(tokenId) {
  try {
    await OBR.scene.items.deleteItems([markerIdFor(tokenId)]);
  } catch {
    // já não existia — sem problema.
  }
}

// ---------------------------------------------------------------------------
// DETALHE: item LOCAL (OBR.scene.local) — só existe no cliente de quem
// selecionou o token. Some sozinho quando o token é desselecionado
// (chamamos removeDetail explicitamente nesse momento, em background.js).
// ---------------------------------------------------------------------------
export async function renderDetail(tokenId) {
  const stats = getStats((await OBR.scene.items.getItems([tokenId]))[0]);
  if (!stats) return;

  const built = await buildAndPlaceLabel({
    tokenId,
    id: detailIdFor(tokenId),
    content: buildDetailContent(stats),
    width: VISUAL.DETAIL_WIDTH,
    offsetSign: -1.6, // acima do token, pra não sobrepor o marcador de baixo
    pointerDirection: "DOWN",
  });
  if (!built) return;

  const [existing] = await OBR.scene.local.getItems([built.id]);

  if (existing) {
    await OBR.scene.local.updateItems([built.id], (items) => {
      for (const item of items) {
        item.position = built.position;
        item.text.plainText = built.plainText;
        item.text.height = built.height;
        item.style.backgroundColor = built.color;
      }
    });
    return;
  }

  const label = buildLabel()
    .id(built.id)
    .plainText(built.plainText)
    .position(built.position)
    .attachedTo(built.token.id)
    .layer(built.token.layer)
    .width(built.width)
    .height(built.height)
    .fontSize(VISUAL.FONT_SIZE)
    .fontWeight(600)
    .textAlign("CENTER")
    .textAlignVertical("MIDDLE")
    .padding(VISUAL.PANEL_PADDING)
    .fillColor(VISUAL.TEXT_COLOR)
    .backgroundColor(built.color)
    .backgroundOpacity(0.97)
    .cornerRadius(VISUAL.CORNER_RADIUS)
    .pointerDirection(built.pointerDirection)
    .pointerWidth(14)
    .pointerHeight(8)
    .disableHit(true)
    .locked(true)
    .build();

  await OBR.scene.local.addItems([label]);
}

export async function removeDetail(tokenId) {
  try {
    await OBR.scene.local.deleteItems([detailIdFor(tokenId)]);
  } catch {
    // já não existia — sem problema.
  }
}

// Atualiza o detalhe só se ele já estiver sendo exibido (token selecionado
// no momento). Usado pelo editor.js ao salvar, pra manter o painel local em
// dia sem criar um detalhe pra um token que ninguém selecionou.
export async function refreshDetailIfVisible(tokenId) {
  const [existing] = await OBR.scene.local.getItems([detailIdFor(tokenId)]);
  if (existing) {
    await renderDetail(tokenId);
  }
}
