// ---------------------------------------------------------------------------
// Blue Soccer — Estatísticas para Owlbear Rodeo
// Módulo compartilhado entre background.js e editor.js
// ---------------------------------------------------------------------------

// Namespace da extensão (notação de domínio reverso, como recomenda a OBR).
export const ID = "com.egoblue.bluesoccer";

// Chave de metadata onde guardamos os dados de jogo no próprio token.
export const STATS_KEY = `${ID}/stats`;

// Chave de metadata gravada na bolha, apontando de volta pro token-dono.
// Serve só pra limpeza de "órfãs" (bolha cujo token foi apagado).
export const PARENT_KEY = `${ID}/parentId`;

// ID determinístico da bolha de um token — permite achar/atualizar o mesmo
// item sempre, sem precisar guardar referências cruzadas em metadata.
export function panelIdFor(tokenId) {
  return `${ID}/panel/${tokenId}`;
}

// ---------------------------------------------------------------------------
// Ajustes visuais — mexa aqui se o painel ficar grande/pequeno/deslocado
// demais em relação aos tokens da sua mesa.
//
// O painel é um item do tipo "Label" (bolha de texto com fundo), que a OBR
// desenha em "screen-space": o TAMANHO (largura/altura/fonte) fica sempre
// igual na tela, não importa o zoom — por isso PANEL_WIDTH/FONT_SIZE etc.
// são pixels de tela fixos. Já a POSIÇÃO é em coordenadas do mundo (a mesma
// usada pelos tokens), por isso o deslocamento vertical é multiplicado pelo
// DPI do grid da cena, pra continuar logo abaixo do token em qualquer grid.
// OFFSET_Y_GRID assume um token de 1x1 quadrado — aumente para tokens maiores.
// ---------------------------------------------------------------------------
export const VISUAL = {
  OFFSET_Y_GRID: 0.85, // deslocamento vertical (múltiplos do DPI do grid)
  PANEL_WIDTH: 200, // px de tela
  PANEL_HEIGHT_PER_LINE: 22, // px de tela por linha de texto
  PANEL_PADDING: 8, // px de tela
  FONT_SIZE: 13, // px de tela
  CORNER_RADIUS: 10,
  COLOR_NORMAL: "#17365c", // azul-marinho (Blue Soccer)
  COLOR_DESPERTAR: "#caa53d", // dourado — Despertar ativo
  COLOR_PENALIDADE: "#5c2323", // vermelho escuro — penalidade pós-Despertar/Fluxo
  TEXT_COLOR: "#f4f6fb",
};

// ---------------------------------------------------------------------------
// Modelo de dados padrão de um jogador de Blue Soccer.
// Baseado no Livro do Jogador 0.9.3.2 (PA, Deslocamento e Despertar).
// ---------------------------------------------------------------------------
export function defaultStats() {
  return {
    pa: { atual: 3, maximo: 3 },
    deslocamento: { atual: 6, maximo: 6 },
    despertar: {
      pontos: 0, // 0–10, acumulado durante a partida
      ativo: false, // true durante as 5 rodadas do Despertar
      rodadasRestantes: 0,
      penalidadeRodadas: 0, // -1 em todos atributos por 3 rodadas, pós-Despertar
    },
    fluxo: {
      usado: false, // Fluxo só pode ser ativado 1x por partida
      ativo: false, // true durante as 5 rodadas do Fluxo
      rodadasRestantes: 0,
      exaustaoRodadas: 0, // Desvantagem + -2 fixo por 2 rodadas, pós-Fluxo
    },
    posseDeBola: false,
    visivelParaJogadores: true, // trava de GM, equivalente ao "Player Editable"
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

// Lê as estatísticas de um item, preenchendo com o padrão qualquer campo
// que ainda não exista (tokens novos, ou extensão atualizada com novos campos).
export function getStats(item) {
  const stored = item?.metadata?.[STATS_KEY];
  return deepMerge(defaultStats(), stored);
}

// ---------------------------------------------------------------------------
// Parser de expressões rápidas, no estilo da Stat Bubbles for D&D:
// digitar "+2" soma ao valor atual, "-1" subtrai, e um número "puro"
// substitui o valor. Sempre arredonda pro inteiro mais próximo.
// ---------------------------------------------------------------------------
export function parseInlineValue(inputStr, currentValue) {
  const trimmed = String(inputStr).trim().replace(",", ".");
  if (trimmed === "") return currentValue;
  if (/^[+-]\s*\d+(\.\d+)?$/.test(trimmed)) {
    return Math.round(currentValue + parseFloat(trimmed.replace(/\s/g, "")));
  }
  const n = parseFloat(trimmed);
  return Number.isNaN(n) ? currentValue : Math.round(n);
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// ---------------------------------------------------------------------------
// Monta o texto (linhas) e a cor do painel a partir das estatísticas atuais.
// Mantido separado da geometria/SDK para poder ser testado isoladamente.
// ---------------------------------------------------------------------------
export function buildPanelContent(stats) {
  const lines = [];

  lines.push(
    `PA ${stats.pa.atual}/${stats.pa.maximo}   Desloc. ${stats.deslocamento.atual}/${stats.deslocamento.maximo}m`
  );

  const pontos = clamp(stats.despertar.pontos, 0, 10);
  const pips = "●".repeat(pontos) + "○".repeat(10 - pontos);
  let despertarLine = `Despertar ${pips} ${pontos}/10`;
  if (stats.despertar.ativo) {
    despertarLine += `  ⚡ ATIVO (${stats.despertar.rodadasRestantes}r)`;
  } else if (stats.despertar.penalidadeRodadas > 0) {
    despertarLine += `  ⚠ -1 atributos (${stats.despertar.penalidadeRodadas}r)`;
  }
  lines.push(despertarLine);

  const extras = [];
  if (stats.posseDeBola) extras.push("⚽ Posse de Bola");
  if (stats.fluxo.ativo) extras.push(`Fluxo ATIVO (${stats.fluxo.rodadasRestantes}r)`);
  else if (stats.fluxo.exaustaoRodadas > 0)
    extras.push(`Exaustão do Fluxo (${stats.fluxo.exaustaoRodadas}r)`);
  if (extras.length) lines.push(extras.join("   "));

  let color = VISUAL.COLOR_NORMAL;
  if (stats.despertar.ativo || stats.fluxo.ativo) color = VISUAL.COLOR_DESPERTAR;
  else if (stats.despertar.penalidadeRodadas > 0 || stats.fluxo.exaustaoRodadas > 0)
    color = VISUAL.COLOR_PENALIDADE;

  return { lines, color };
}

// ---------------------------------------------------------------------------
// Regra de "Nova Rodada" (Livro do Jogador, seção Iniciativa):
// - PA e Deslocamento voltam ao máximo.
// - Contadores de duração (Despertar ativo, penalidade, Fluxo ativo,
//   exaustão do Fluxo) descem 1 e, ao chegarem a 0, desligam o estado.
// ---------------------------------------------------------------------------
export function advanceRound(stats) {
  const next = deepMerge(defaultStats(), stats);

  next.pa.atual = next.pa.maximo;
  next.deslocamento.atual = next.deslocamento.maximo;

  if (next.despertar.ativo) {
    next.despertar.rodadasRestantes = Math.max(0, next.despertar.rodadasRestantes - 1);
    if (next.despertar.rodadasRestantes === 0) {
      next.despertar.ativo = false;
      next.despertar.penalidadeRodadas = 3; // -1 em todos atributos por 3 rodadas
      next.despertar.pontos = 0;
    }
  } else if (next.despertar.penalidadeRodadas > 0) {
    next.despertar.penalidadeRodadas -= 1;
  }

  if (next.fluxo.ativo) {
    next.fluxo.rodadasRestantes = Math.max(0, next.fluxo.rodadasRestantes - 1);
    if (next.fluxo.rodadasRestantes === 0) {
      next.fluxo.ativo = false;
      next.fluxo.exaustaoRodadas = 2; // Desvantagem + -2 fixo por 2 rodadas
    }
  } else if (next.fluxo.exaustaoRodadas > 0) {
    next.fluxo.exaustaoRodadas -= 1;
  }

  return next;
}
