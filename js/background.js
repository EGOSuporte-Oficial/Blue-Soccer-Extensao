import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import { ID, STATS_KEY, HIDDEN_MARKERS_KEY, extractRoomSettings, podeVerEstatisticas } from "./shared.js";
import { renderMarker, removeMarker, renderDetail, removeDetail } from "./panel.js";

const BASE_URL = "https://egosuporte-oficial.github.io/Blue-Soccer-Extensao";

let cachedItems = [];
let role = "PLAYER";
let renderedMarkerIds = new Set();
let detailedTokenIds = new Set();

OBR.onReady(async () => {
  role = await OBR.player.getRole();
  cachedItems = await OBR.scene.items.getItems();
  setupContextMenu();
  setupSceneSync();
  setupPlayerSync();
  setupRoomSync();
  await syncMarkers();
});

// Menu de contexto
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

// Marcador
async function getHiddenSet() {
  const metadata = await OBR.player.getMetadata();
  const arr = metadata?.[HIDDEN_MARKERS_KEY];
  return new Set(Array.isArray(arr) ? arr : []);
}

async function getRoomSettings() {
  const metadata = await OBR.room.getMetadata();
  return extractRoomSettings(metadata);
}

async function syncMarkers() {
  const roomSettings = await getRoomSettings();

  if (!podeVerEstatisticas(role, roomSettings)) {
    for (const id of Array.from(renderedMarkerIds)) {
      await removeMarker(id);
      renderedMarkerIds.delete(id);
    }
    return;
  }

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

async function syncDetails() {
  const roomSettings = await getRoomSettings();
  if (!podeVerEstatisticas(role, roomSettings)) {
    for (const id of Array.from(detailedTokenIds)) {
      await removeDetail(id);
      detailedTokenIds.delete(id);
    }
  }
}

// Cena
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

// Jogador
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

    const roomSettings = await getRoomSettings();
    if (podeVerEstatisticas(role, roomSettings)) {
      for (const id of selection) {
        if (detailedTokenIds.has(id)) continue;
        const item = cachedItems.find((it) => it.id === id);
        if (item?.metadata?.[STATS_KEY]) {
          await renderDetail(id);
          detailedTokenIds.add(id);
        }
      }
    }

    await syncMarkers();
  });
}

// Sala
function setupRoomSync() {
  OBR.room.onMetadataChange(async () => {
    await syncMarkers();
    await syncDetails();
  });
}
