// Blue Soccer — Estatísticas
// Módulo compartilhado

// Identificação
export const ID = "com.egoblue.bluesoccer";
export const STATS_KEY = `${ID}/stats`;
export const PARENT_KEY = `${ID}/parentId`;
export const HIDDEN_MARKERS_KEY = `${ID}/hiddenMarkers`;
export const ROOM_SETTINGS_KEY = `${ID}/settings`;

// Configurações da sala
export function defaultRoomSettings() {
  return {
    offsetGrid: 0.85,
    justification: "BOTTOM",
    showBars: false,
    nameTags: false,
    visibilidade: "TODOS",
    edicaoLivre: false,
  };
}

export function extractRoomSettings(roomMetadata) {
  return { ...defaultRoomSettings(), ...(roomMetadata?.[ROOM_SETTINGS_KEY] || {}) };
}

// Permissões
export function podeVerEstatisticas(role, roomSettings) {
  if (roomSettings.visibilidade === "MESTRE") return role === "GM";
  return true;
}

export function podeEditarToken(role, item, roomSettings, playerId) {
  if (role === "GM") return true;
  if (roomSettings.visibilidade === "MESTRE") return false;
  if (roomSettings.edicaoLivre) return true;
  return Boolean(item && playerId && item.createdUserId === playerId);
}

// IDs
export function markerIdFor(tokenId) {
  return `${ID}/marker/${tokenId}`;
}
export function detailIdFor(tokenId) {
  return `${ID}/detail/${tokenId}`;
}

// Visual
export const VISUAL = {
  OFFSET_Y_GRID: 0.85,
  MARKER_WIDTH: 150,
  DETAIL_WIDTH: 220,
  PANEL_HEIGHT_PER_LINE: 19,
  PANEL_PADDING: 6,
  FONT_SIZE: 12,
  CORNER_RADIUS: 8,
  COLOR_NORMAL: "#0C1320",
  COLOR_ATIVO: "#00D4FF",
  COLOR_PENALIDADE: "#4a1f24",
  TEXT_COLOR: "#F5FAFF",
  TEXT_ON_ATIVO: "#090B12",
};

// Modelo de dados
export function defaultStats() {
  return {
    pa: { atual: 3, maximo: 3 },
    deslocamento: { atual: 6, maximo: 6 },
    despertar: {
      pontos: 0,
      ativo: false,
      rodadasRestantes: 0,
      penalidadeRodadas: 0,
      usado: false,
    },
    fluxo: {
      usado: false,
      ativo: false,
      rodadasRestantes: 0,
      exaustaoRodadas: 0,
    },
    posseDeBola: false,
    visivelParaJogadores: true,
  };
}

function deepMerge(base, extra) {
  if (!extra || typeof extra !== "object") return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const key of Object.keys(base)) {
    if (
      extra[key] !== undefined &&
      typeof base[key] === "object" &&
      base[key] !== null &&
      !Array.isArray(base[key])
    ) {
      out[key] = deepMerge(base[key], extra[key]);
    } else if (extra[key] !== undefined) {
      out[key] = extra[key];
    }
  }
  return out;
}

export function getStats(item) {
  const stored = item?.metadata?.[STATS_KEY];
  return deepMerge(defaultStats(), stored);
}

// Parser
export function parseInlineValue(inputStr, currentValue, { integer = true } = {}) {
  const trimmed = String(inputStr).trim().replace(",", ".");
  if (trimmed === "") return currentValue;
  const round = (n) => (integer ? Math.round(n) : Math.round(n * 100) / 100);
  if (/^[+-]\s*\d+(\.\d+)?$/.test(trimmed)) {
    return round(currentValue + parseFloat(trimmed.replace(/\s/g, "")));
  }
  const n = parseFloat(trimmed);
  return Number.isNaN(n) ? currentValue : round(n);
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function deslocamentoMaximoEfetivo(stats) {
  if (stats.posseDeBola) {
    return Math.max(1, Math.floor(stats.deslocamento.maximo / 2));
  }
  return stats.deslocamento.maximo;
}

// Quebra de linha
function wrapToWidth(text, width) {
  const maxChars = Math.max(6, Math.floor((width - VISUAL.PANEL_PADDING * 2) / 7.2));
  if (text.length <= maxChars) return [text];
  const words = text.split(" ");
  const out = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (test.length > maxChars && cur) {
      out.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function wrapLines(lines, width) {
  return lines.flatMap((line) => wrapToWidth(line, width));
}

function statusColors(stats) {
  if (stats.despertar.ativo || stats.fluxo.ativo) {
    return { bg: VISUAL.COLOR_ATIVO, text: VISUAL.TEXT_ON_ATIVO };
  }
  if (stats.despertar.penalidadeRodadas > 0 || stats.fluxo.exaustaoRodadas > 0) {
    return { bg: VISUAL.COLOR_PENALIDADE, text: VISUAL.TEXT_COLOR };
  }
  return { bg: VISUAL.COLOR_NORMAL, text: VISUAL.TEXT_COLOR };
}

function miniBar(atual, maximo, segments = 8) {
  const ratio = maximo > 0 ? clamp(atual / maximo, 0, 1) : 0;
  const filled = Math.round(ratio * segments);
  return "▰".repeat(filled) + "▱".repeat(Math.max(0, segments - filled));
}

// Marcador
export function buildMarkerContent(stats, roomSettings = defaultRoomSettings(), tokenName = "") {
  const lines = [];

  if (roomSettings.nameTags && tokenName) {
    lines.push(tokenName);
  }

  const deslocSufixo = stats.posseDeBola ? " (1/2)" : "";

  if (roomSettings.showBars) {
    lines.push(`PA ${miniBar(stats.pa.atual, stats.pa.maximo)} ${stats.pa.atual}/${stats.pa.maximo}`);
    lines.push(
      `DES ${miniBar(stats.deslocamento.atual, stats.deslocamento.maximo)} ${stats.deslocamento.atual}/${stats.deslocamento.maximo}m${deslocSufixo}`
    );
  } else {
    lines.push(
      `PA ${stats.pa.atual}/${stats.pa.maximo}  |  DES ${stats.deslocamento.atual}/${stats.deslocamento.maximo}m${deslocSufixo}`
    );
  }

  const tags = [];
  if (stats.despertar.ativo) tags.push("DESPERTAR");
  else if (stats.despertar.penalidadeRodadas > 0) tags.push("PENALIDADE");
  if (stats.fluxo.ativo) tags.push("FLUXO");
  else if (stats.fluxo.exaustaoRodadas > 0) tags.push("EXAUSTAO");
  if (stats.posseDeBola) tags.push("BOLA");
  if (tags.length) lines.push(tags.join(" · "));

  const { bg, text } = statusColors(stats);
  return { lines: wrapLines(lines, VISUAL.MARKER_WIDTH), color: bg, textColor: text };
}

// Detalhe
export function buildDetailContent(stats) {
  const lines = [];
  const deslocSufixo = stats.posseDeBola ? " (reduzido a metade — posse de bola)" : "";

  lines.push(`PA ${stats.pa.atual}/${stats.pa.maximo}`);
  lines.push(`Deslocamento ${stats.deslocamento.atual}/${stats.deslocamento.maximo}m${deslocSufixo}`);

  const pontos = clamp(stats.despertar.pontos, 0, 10);
  const pips = "●".repeat(pontos) + "○".repeat(10 - pontos);
  if (stats.despertar.ativo) {
    lines.push(`Despertar ATIVO — ${stats.despertar.rodadasRestantes} rodada(s) restante(s)`);
  } else if (stats.despertar.penalidadeRodadas > 0) {
    lines.push(`Despertar: -1 atributos — ${stats.despertar.penalidadeRodadas} rodada(s)`);
  } else if (stats.despertar.usado) {
    lines.push(`Despertar usado nesta partida`);
  } else {
    lines.push(`Despertar ${pontos}/10`);
    lines.push(pips);
  }

  if (stats.fluxo.ativo) {
    lines.push(`Fluxo ATIVO — ${stats.fluxo.rodadasRestantes} rodada(s) restante(s)`);
  } else if (stats.fluxo.exaustaoRodadas > 0) {
    lines.push(`Exaustao do Fluxo — ${stats.fluxo.exaustaoRodadas} rodada(s)`);
  } else if (stats.fluxo.usado) {
    lines.push(`Fluxo usado nesta partida`);
  }

  if (stats.posseDeBola) lines.push(`Posse de Bola`);

  const { bg, text } = statusColors(stats);
  return { lines: wrapLines(lines, VISUAL.DETAIL_WIDTH), color: bg, textColor: text };
}

// Nova Rodada
export function advanceRound(stats) {
  const next = deepMerge(defaultStats(), stats);

  next.pa.atual = next.pa.maximo;
  next.deslocamento.atual = deslocamentoMaximoEfetivo(next);

  if (next.despertar.ativo) {
    next.despertar.rodadasRestantes = Math.max(0, next.despertar.rodadasRestantes - 1);
    if (next.despertar.rodadasRestantes === 0) {
      next.despertar.ativo = false;
      next.despertar.penalidadeRodadas = 3;
      next.despertar.pontos = 0;
      next.despertar.usado = true;
    }
  } else if (next.despertar.penalidadeRodadas > 0) {
    next.despertar.penalidadeRodadas -= 1;
  }

  if (next.fluxo.ativo) {
    next.fluxo.rodadasRestantes = Math.max(0, next.fluxo.rodadasRestantes - 1);
    if (next.fluxo.rodadasRestantes === 0) {
      next.fluxo.ativo = false;
      next.fluxo.exaustaoRodadas = 2;
    }
  } else if (next.fluxo.exaustaoRodadas > 0) {
    next.fluxo.exaustaoRodadas -= 1;
  }

  return next;
}
