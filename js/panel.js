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

// Marcador
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

  try {
    await OBR.scene.local.deleteItems([built.id]);
  } catch {
    // ok
  }
  await OBR.scene.local.addItems([makeLabel(built)]);
}

export async function removeMarker(tokenId) {
  try {
    await OBR.scene.local.deleteItems([markerIdFor(tokenId)]);
  } catch {
    // ok
  }
}

// Detalhe
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
    // ok
  }
  await OBR.scene.local.addItems([makeLabel(built)]);
}

export async function removeDetail(tokenId) {
  try {
    await OBR.scene.local.deleteItems([detailIdFor(tokenId)]);
  } catch {
    // ok
  }
}

export async function refreshDetailIfVisible(tokenId) {
  const [existing] = await OBR.scene.local.getItems([detailIdFor(tokenId)]);
  if (existing) {
    await renderDetail(tokenId);
  }
}
