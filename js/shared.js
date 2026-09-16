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
  DETAIL_WIDTH: 210, // px de tela
  PANEL_HEIGHT_PER_LINE: 22, // px de tela por linha de texto
  PANEL_PADDING: 8, // px de tela
  FONT_SIZE: 13, // px de tela
  CORNER_RADIUS: 10,
  COLOR_NORMAL: "#17365c", // azul-marinho (Blue Soccer)
  COLOR_DESPERTAR: "#caa53d", // dourado — Despertar/Fluxo ativo
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

function statusColor(stats) {
  if (stats.despertar.ativo || stats.fluxo.ativo) return VISUAL.COLOR_DESPERTAR;
  if (stats.despertar.penalidadeRodadas > 0 || stats.fluxo.exaustaoRodadas > 0)
    return VISUAL.COLOR_PENALIDADE;
  return VISUAL.COLOR_NORMAL;
}

// ---------------------------------------------------------------------------
// MARCADOR (compacto, local por jogador — cada cliente decide se mostra ou
// não, via a preferência guardada em OBR.player metadata): só PA,
// Deslocamento, e códigos curtos pros estados que merecem atenção.
// ---------------------------------------------------------------------------
export function buildMarkerContent(stats) {
  // Mostra o máximo BASE (o configurado, sem a redução), não o efetivo —
  // senão o número de máximo "some" e parece que o atual caiu sozinho.
  // O "(1/2)" avisa que a posse de bola está reduzindo o efetivo agora.
  const deslocSufixo = stats.posseDeBola ? " (1/2)" : "";

  const lines = [
    `PA ${stats.pa.atual}/${stats.pa.maximo}  |  DES ${stats.deslocamento.atual}/${stats.deslocamento.maximo}m${deslocSufixo}`,
  ];

  const tags = [];
  if (stats.despertar.ativo) tags.push("DESPERTAR");
  else if (stats.despertar.penalidadeRodadas > 0) tags.push("PENALIDADE");
  if (stats.fluxo.ativo) tags.push("FLUXO");
  else if (stats.fluxo.exaustaoRodadas > 0) tags.push("EXAUSTAO");
  if (stats.posseDeBola) tags.push("BOLA");
  if (tags.length) lines.push(tags.join(" · "));

  return { lines: wrapLines(lines, VISUAL.MARKER_WIDTH), color: statusColor(stats) };
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
    lines.push(`Despertar ${pips} ${pontos}/10`);
  }

  if (stats.fluxo.ativo) {
    lines.push(`Fluxo ATIVO — ${stats.fluxo.rodadasRestantes} rodada(s) restante(s)`);
  } else if (stats.fluxo.exaustaoRodadas > 0) {
    lines.push(`Exaustao do Fluxo — ${stats.fluxo.exaustaoRodadas} rodada(s)`);
  } else if (stats.fluxo.usado) {
    lines.push(`Fluxo usado nesta partida`);
  }

  if (stats.posseDeBola) lines.push(`Posse de Bola`);

  return { lines: wrapLines(lines, VISUAL.DETAIL_WIDTH), color: statusColor(stats) };
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
