// ---------------------------------------------------------------------------
// Blue Soccer — Estatísticas para Owlbear Rodeo
// Módulo compartilhado entre background.js e editor.js
// ---------------------------------------------------------------------------

// Namespace da extensão (notação de domínio reverso, como recomenda a OBR).
export const ID = "com.egoblue.bluesoccer";

// Chave de metadata onde guardamos os dados de jogo no próprio token.
export const STATS_KEY = `${ID}/stats`;

// Chave de metadata gravada no marcador, apontando de volta pro token-dono.
// Serve só pra limpeza de "órfãos" (marcador cujo token foi apagado).
export const PARENT_KEY = `${ID}/parentId`;

// Chave usada em OBR.player.metadata pra guardar a preferência PESSOAL de
// cada jogador sobre quais tokens ele não quer ver o marcador compacto.
// Guarda um array de IDs de token. É por jogador, não sincronizado — cada
// pessoa na mesa decide por si só, sem afetar o que os outros veem.
export const HIDDEN_MARKERS_KEY = `${ID}/hiddenMarkers`;

// Chave usada em OBR.room.metadata pra guardar as configurações da SALA —
// compartilhadas com todo mundo (diferente da preferência pessoal acima).
export const ROOM_SETTINGS_KEY = `${ID}/settings`;

// ---------------------------------------------------------------------------
// Configurações da sala: aparência da bolha e permissões dos jogadores.
// Ficam em OBR.room.metadata, então valem pra mesa inteira. Só o Mestre edita
// (a interface restringe isso; quem chamar getRoomMetadata/setRoomMetadata
// precisa importar o SDK e fazer a chamada — este arquivo não usa a OBR
// diretamente, só a lógica de mesclar/interpretar os valores).
// ---------------------------------------------------------------------------
export function defaultRoomSettings() {
  return {
    offsetGrid: 0.85, // deslocamento vertical do marcador (múltiplos do DPI do grid)
    justification: "BOTTOM", // "BOTTOM" | "TOP" — onde o marcador fica em relação ao token
    showBars: false, // barrinhas (▰▱) em vez de números crus no marcador
    nameTags: false, // mostra o nome do token junto no marcador
    visibilidade: "TODOS", // "TODOS" (jogadores veem) | "MESTRE" (só o Mestre vê/edita)
    edicaoLivre: false, // se true, jogadores podem editar token de qualquer um
  };
}

export function extractRoomSettings(roomMetadata) {
  return { ...defaultRoomSettings(), ...(roomMetadata?.[ROOM_SETTINGS_KEY] || {}) };
}

// ---------------------------------------------------------------------------
// Permissões: quem pode ver e quem pode editar as estatísticas de um token,
// combinando o papel do jogador (GM/PLAYER), as configurações da sala, e —
// pra edição — se o token foi colocado por quem está tentando editar.
// ---------------------------------------------------------------------------
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

// IDs determinísticos — permitem achar/atualizar sempre o mesmo item, sem
// precisar guardar referências cruzadas em metadata.
export function markerIdFor(tokenId) {
  return `${ID}/marker/${tokenId}`;
}
export function detailIdFor(tokenId) {
  return `${ID}/detail/${tokenId}`;
}

// ---------------------------------------------------------------------------
// Ajustes visuais.
//
// MARCADOR: item sincronizado (OBR.scene.items), visível pra mesa inteira o
// tempo todo — por isso fica pequeno e só com o essencial.
//
// DETALHE: item LOCAL (OBR.scene.local) — só existe no cliente de quem
// selecionou aquele token, some quando desseleciona. Pode ser mais completo
// porque não fica poluindo a tela de ninguém além de quem pediu.
// ---------------------------------------------------------------------------
export const VISUAL = {
  OFFSET_Y_GRID: 0.85, // unidade-base de deslocamento vertical (múltiplos do DPI do grid);
  // o marcador usa essa unidade abaixo do token, o detalhe usa um múltiplo
  // maior dela acima do token (ver offsetSign em panel.js) — assim os dois
  // nunca se sobrepõem.
  MARKER_WIDTH: 150, // px de tela
  DETAIL_WIDTH: 220, // px de tela (reduzido, mas com folga pra não cortar texto)
  PANEL_HEIGHT_PER_LINE: 19, // px de tela por linha de texto
  PANEL_PADDING: 6, // px de tela
  FONT_SIZE: 12, // px de tela
  CORNER_RADIUS: 8,
  // Paleta do E.G.O.
  COLOR_NORMAL: "#0C1320", // panel-dark — discreto, tema escuro do E.G.O.
  COLOR_ATIVO: "#00D4FF", // cyan — Despertar/Fluxo ativos, "acende" a bolha
  COLOR_PENALIDADE: "#4a1f24", // vermelho escuro — penalidade pós-Despertar/Fluxo
  TEXT_COLOR: "#F5FAFF", // white
  TEXT_ON_ATIVO: "#090B12", // background — texto escuro sobre o ciano brilhante
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
      usado: false, // Despertar só pode ser usado 1x por partida (Livro do Jogador)
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
// Parser de expressões rápidas: digitar "+2" soma ao valor atual, "-1"
// subtrai, e um número "puro" substitui o valor. Sempre arredonda pro
// inteiro mais próximo.
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
// Regra do Livro do Jogador: um jogador Com a Bola (CaB), se não tiver
// nenhuma habilidade que diga o contrário, tem o Deslocamento cortado pela
// metade enquanto estiver com a posse.
// ---------------------------------------------------------------------------
export function deslocamentoMaximoEfetivo(stats) {
  if (stats.posseDeBola) {
    return Math.max(1, Math.floor(stats.deslocamento.maximo / 2));
  }
  return stats.deslocamento.maximo;
}

// ---------------------------------------------------------------------------
// Quebra de linha manual, baseada numa largura de caractere aproximada.
// Isso existe pra que a altura do painel (calculada como linhas × altura-
// por-linha) sempre bata com o que realmente aparece na tela — antes, uma
// linha comprida podia quebrar visualmente sem o painel crescer junto,
// cortando o texto.
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// MARCADOR (compacto, local por jogador — cada cliente decide se mostra ou
// não, via a preferência guardada em OBR.player metadata): só PA,
// Deslocamento, e códigos curtos pros estados que merecem atenção.
//
// roomSettings controla dois extras opcionais (configuráveis pelo Mestre):
// mostrar barrinhas em vez de números, e mostrar o nome do token.
// ---------------------------------------------------------------------------
export function buildMarkerContent(stats, roomSettings = defaultRoomSettings(), tokenName = "") {
  const lines = [];

  if (roomSettings.nameTags && tokenName) {
    lines.push(tokenName);
  }

  // Mostra o máximo BASE (o configurado, sem a redução), não o efetivo —
  // senão o número de máximo "some" e parece que o atual caiu sozinho.
  // O "(1/2)" avisa que a posse de bola está reduzindo o efetivo agora.
  const deslocSufixo = stats.posseDeBola ? " (1/2)" : "";

  if (roomSettings.showBars) {
    lines.push(`PA ${miniBar(stats.pa.atual, stats.pa.maximo)}`);
    lines.push(`DES ${miniBar(stats.deslocamento.atual, stats.deslocamento.maximo)}${deslocSufixo}`);
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

// ---------------------------------------------------------------------------
// DETALHE (completo, local — só pra quem selecionou o token): a leitura
// cheia, com pips de Despertar e status de rodadas.
// ---------------------------------------------------------------------------
export function buildDetailContent(stats) {
  const lines = [];
  // Mesma lógica do marcador: mostra o máximo BASE, com um aviso à parte
  // sobre a redução — o atual continua sendo o valor real, já limitado.
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
    // Os círculos de pips ficam numa linha só pra eles — combinados com o
    // texto "Despertar X/10" na mesma linha, a largura real deles (os
    // glifos são mais largos que uma letra comum) podia estourar a caixa e
    // cortar o texto.
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

// ---------------------------------------------------------------------------
// Regra de "Nova Rodada" (Livro do Jogador, seção Iniciativa):
// - PA volta ao máximo; Deslocamento volta ao máximo efetivo (considerando
//   Posse de Bola).
// - Contadores de duração (Despertar ativo, penalidade, Fluxo ativo,
//   exaustão do Fluxo) descem 1 e, ao chegarem a 0, desligam o estado.
// - Quando o Despertar termina naturalmente (rodadas acabam), ele também
//   fica marcado como "usado" — só pode acontecer 1x por partida.
// ---------------------------------------------------------------------------
export function advanceRound(stats) {
  const next = deepMerge(defaultStats(), stats);

  next.pa.atual = next.pa.maximo;
  next.deslocamento.atual = deslocamentoMaximoEfetivo(next);

  if (next.despertar.ativo) {
    next.despertar.rodadasRestantes = Math.max(0, next.despertar.rodadasRestantes - 1);
    if (next.despertar.rodadasRestantes === 0) {
      next.despertar.ativo = false;
      next.despertar.penalidadeRodadas = 3; // -1 em todos atributos por 3 rodadas
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
      next.fluxo.exaustaoRodadas = 2; // Desvantagem + -2 fixo por 2 rodadas
    }
  } else if (next.fluxo.exaustaoRodadas > 0) {
    next.fluxo.exaustaoRodadas -= 1;
  }

  return next;
}
