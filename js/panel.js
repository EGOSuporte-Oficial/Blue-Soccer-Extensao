import OBR, { buildLabel } from "https://esm.sh/@owlbear-rodeo/sdk@3";
import {
  VISUAL,
  getStats,
  buildMarkerContent,
  buildDetailContent,
  markerIdFor,
  detailIdFor,
  extractRoomSettings,
} from "./shared.js";

// Os glifos de pips/barras (● ○ ▰ ▱) renderizam mais largos que uma letra
// comum, então uma linha que os contenha ganha um espaço extra de altura —
// evita que o texto fique maior do que o cálculo previu e corte embaixo.
function weightedLineCount(lines) {
  return lines.reduce((sum, line) => sum + (/[●○▰▱]/.test(line) ? 1.5 : 1), 0);
}

async function getRoomSettings() {
  const metadata = await OBR.room.getMetadata();
  return extractRoomSettings(metadata);
}

async function buildAndPlaceLabel({ tokenId, id, content, width, offsetGridUnits, pointerDirection }) {
  const [token] = await OBR.scene.items.getItems([tokenId]);
  if (!token) return null;

  const dpi = await OBR.scene.grid.getDpi();
  const { lines, color, textColor } = content;

  const position = {
    x: token.position.x,
    y: token.position.y + offsetGridUnits * dpi,
  };
  const height = VISUAL.PANEL_HEIGHT_PER_LINE * weightedLineCount(lines) + VISUAL.PANEL_PADDING * 2;
  const plainText = lines.join("\n");

  return { token, id, position, height, plainText, color, textColor, width, pointerDirection };
}

function makeLabel(built) {
  return buildLabel()
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
    .fillColor(built.textColor)
    .backgroundColor(built.color)
    .backgroundOpacity(0.95)
    .cornerRadius(VISUAL.CORNER_RADIUS)
    .pointerDirection(built.pointerDirection)
    .pointerWidth(14)
    .pointerHeight(8)
    .disableHit(true)
    .locked(true)
    .build();
}

// ---------------------------------------------------------------------------
// MARCADOR: item LOCAL (OBR.scene.local) — cada jogador vê (ou não) baseado
// na própria preferência dele (HIDDEN_MARKERS_KEY em OBR.player.metadata,
// gerenciado em background.js). Compacto de propósito.
//
// Posição e conteúdo respeitam as configurações da sala (offset, formação —
// embaixo/cima do token —, barras em vez de números, e name tag).
// ---------------------------------------------------------------------------
export async function renderMarker(tokenId) {
  const [token] = await OBR.scene.items.getItems([tokenId]);
  if (!token) return;
  const stats = getStats(token);
  const settings = await getRoomSettings();
  const tokenName = token.name || token.text?.plainText || "";

  const markerOffset =
    settings.justification === "TOP" ? -settings.offsetGrid : settings.offsetGrid;

  const built = await buildAndPlaceLabel({
    tokenId,
    id: markerIdFor(tokenId),
    content: buildMarkerContent(stats, settings, tokenName),
    width: VISUAL.MARKER_WIDTH,
    offsetGridUnits: markerOffset,
    pointerDirection: settings.justification === "TOP" ? "DOWN" : "UP",
  });
  if (!built) return;

  // Sempre apaga e recria do zero, em vez de tentar atualizar só alguns
  // campos — assim largura, fonte e espaçamento nunca ficam "desatualizados"
  // de uma versão anterior, mesmo que a gente mude essas medidas depois.
  try {
    await OBR.scene.local.deleteItems([built.id]);
  } catch {
    // não existia ainda — sem problema.
  }
  await OBR.scene.local.addItems([makeLabel(built)]);
}

export async function removeMarker(tokenId) {
  try {
    await OBR.scene.local.deleteItems([markerIdFor(tokenId)]);
  } catch {
    // já não existia — sem problema.
  }
}

// ---------------------------------------------------------------------------
// DETALHE: item LOCAL — só existe no cliente de quem selecionou o token.
// Some sozinho quando o token é desselecionado (removeDetail é chamado
// explicitamente nesse momento, em background.js). Sempre fica do lado
// OPOSTO do marcador, pra nunca sobrepor.
// ---------------------------------------------------------------------------
export async function renderDetail(tokenId) {
  const [token] = await OBR.scene.items.getItems([tokenId]);
  if (!token) return;
  const stats = getStats(token);
  const settings = await getRoomSettings();

  const detailMagnitude = settings.offsetGrid + 0.2;
  const detailOffset = settings.justification === "TOP" ? detailMagnitude : -detailMagnitude;

  const built = await buildAndPlaceLabel({
    tokenId,
    id: detailIdFor(tokenId),
    content: buildDetailContent(stats),
    width: VISUAL.DETAIL_WIDTH,
    offsetGridUnits: detailOffset,
    pointerDirection: settings.justification === "TOP" ? "UP" : "DOWN",
  });
  if (!built) return;

  try {
    await OBR.scene.local.deleteItems([built.id]);
  } catch {
    // não existia ainda — sem problema.
  }
  await OBR.scene.local.addItems([makeLabel(built)]);
}

export async function removeDetail(tokenId) {
  try {
    await OBR.scene.local.deleteItems([detailIdFor(tokenId)]);
  } catch {
    // já não existia — sem problema.
  }
}

// Atualiza o detalhe só se ele já estiver sendo exibido (token selecionado
// no momento). Usado pelo editor.js/table.js ao salvar, pra manter o painel
// local em dia sem criar um detalhe pra um token que ninguém selecionou.
export async function refreshDetailIfVisible(tokenId) {
  const [existing] = await OBR.scene.local.getItems([detailIdFor(tokenId)]);
  if (existing) {
    await renderDetail(tokenId);
  }
}
