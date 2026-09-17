import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import {
  getStats,
  STATS_KEY,
  HIDDEN_MARKERS_KEY,
  parseInlineValue,
  clamp,
  advanceRound,
  deslocamentoMaximoEfetivo,
} from "./shared.js";
import { renderMarker, removeMarker, refreshDetailIfVisible } from "./panel.js";

const app = document.getElementById("app");
const itemId = new URLSearchParams(location.search).get("id");

let stats = null;
let role = "PLAYER";
let activeTab = "stats"; // "stats" | "acoes"
let markerHidden = false; // preferência PESSOAL deste jogador pra este token

OBR.onReady(init);

async function init() {
  if (!itemId) {
    app.innerHTML = `<p class="error">Nenhum token selecionado.</p>`;
    return;
  }

  role = await OBR.player.getRole();
  const [item] = await OBR.scene.items.getItems([itemId]);
  if (!item) {
    app.innerHTML = `<p class="error">Este token não existe mais.</p>`;
    return;
  }

  stats = getStats(item);

  const metadata = await OBR.player.getMetadata();
  const hiddenArr = metadata?.[HIDDEN_MARKERS_KEY];
  markerHidden = Array.isArray(hiddenArr) && hiddenArr.includes(itemId);

  if (role !== "GM" && !stats.visivelParaJogadores) {
    app.innerHTML = `
      <div class="locked">
        <strong>Estatísticas ocultas</strong><br />
        Somente o Mestre pode ver as estatísticas deste token.
      </div>`;
    return;
  }

  render();
}

function pips(n) {
  const p = clamp(n, 0, 10);
  return "●".repeat(p) + "○".repeat(10 - p);
}

function render() {
  app.innerHTML = template(stats);
  wire();
}

function template(s) {
  const deslocMax = deslocamentoMaximoEfetivo(s);

  const despertarUsado = s.despertar.usado;
  const despertarBtnLabel = despertarUsado
    ? "Despertar já usado"
    : s.despertar.ativo
    ? "Desativar Despertar"
    : s.despertar.pontos >= 10
    ? "Ativar Despertar"
    : `Ativar Despertar (${s.despertar.pontos}/10)`;
  const despertarBtnDisabled =
    despertarUsado || (!s.despertar.ativo && s.despertar.pontos < 10) ? "disabled" : "";
  const despertarPontosDisabled = despertarUsado ? "disabled" : "";
  const despertarStatus = s.despertar.ativo
    ? `Ativo — ${s.despertar.rodadasRestantes} rodada(s) restante(s)`
    : s.despertar.penalidadeRodadas > 0
    ? `Penalidade -1 em atributos — ${s.despertar.penalidadeRodadas} rodada(s)`
    : despertarUsado
    ? "Já usado nesta partida"
    : "";

  const fluxoBtnLabel = s.fluxo.ativo
    ? "Desativar Fluxo"
    : s.fluxo.usado
    ? "Fluxo já usado"
    : "Ativar Fluxo (-3 PA)";
  const fluxoBtnDisabled = !s.fluxo.ativo && s.fluxo.usado ? "disabled" : "";
  const fluxoStatus = s.fluxo.ativo
    ? `Ativo — ${s.fluxo.rodadasRestantes} rodada(s) restante(s)`
    : s.fluxo.exaustaoRodadas > 0
    ? `Exaustão (Desvantagem, -2 fixo) — ${s.fluxo.exaustaoRodadas} rodada(s)`
    : s.fluxo.usado
    ? "Já usado nesta partida"
    : "";

  const statsTab = `
    <div class="card">
      <div class="card-title"><span class="dot pa"></span>Pontos de Ação</div>
      <div class="row">
        <div class="field-col">
          <input type="text" id="pa-atual" value="${s.pa.atual}" inputmode="numeric" />
          <span class="field-col-label">Atual</span>
        </div>
        <span class="slash">/</span>
        <div class="field-col">
          <input type="text" id="pa-maximo" value="${s.pa.maximo}" inputmode="numeric" />
          <span class="field-col-label">Máximo</span>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title"><span class="dot desloc"></span>Deslocamento (metros)</div>
      <div class="row">
        <div class="field-col">
          <input type="text" id="desloc-atual" value="${s.deslocamento.atual}" inputmode="numeric" />
          <span class="field-col-label">Atual</span>
        </div>
        <span class="slash">/</span>
        <div class="field-col">
          <input type="text" id="desloc-maximo" value="${s.deslocamento.maximo}" inputmode="numeric" />
          <span class="field-col-label">Máximo</span>
        </div>
      </div>
      ${
        s.posseDeBola
          ? `<p class="hint">Atenção — com a bola: o máximo continua ${s.deslocamento.maximo}m, mas o efetivo agora é <strong>${deslocMax}m</strong> (metade), a menos que uma habilidade diga o contrário.</p>`
          : ""
      }
    </div>

    <div class="card">
      <div class="card-title"><span class="dot despertar"></span>Pontos de Despertar</div>
      <div class="row split">
        <div class="field">
          <input type="text" id="despertar-pontos" value="${s.despertar.pontos}" inputmode="numeric" ${despertarPontosDisabled} />
          <span class="slash">/ 10</span>
        </div>
        <button id="despertar-toggle" ${despertarBtnDisabled}>${despertarBtnLabel}</button>
      </div>
      <div class="pips">${pips(s.despertar.pontos)}</div>
      <div class="row split">
        <label class="checkbox">
          <input type="checkbox" id="despertar-usado" ${s.despertar.usado ? "checked" : ""} />
          Já usado nesta partida
        </label>
      </div>
      <div class="status-line ${s.despertar.ativo ? "active" : ""}">${despertarStatus}</div>
    </div>

    <div class="card">
      <div class="card-title"><span class="dot fluxo"></span>Fluxo</div>
      <div class="row split">
        <label class="checkbox">
          <input type="checkbox" id="fluxo-usado" ${s.fluxo.usado ? "checked" : ""} />
          Já usado nesta partida
        </label>
        <button id="fluxo-toggle" ${fluxoBtnDisabled}>${fluxoBtnLabel}</button>
      </div>
      <div class="status-line ${s.fluxo.ativo ? "active" : ""}">${fluxoStatus}</div>
    </div>

    <div class="card">
      <label class="checkbox">
        <input type="checkbox" id="posse-bola" ${s.posseDeBola ? "checked" : ""} />
        Posse de Bola
      </label>
      <p class="hint">Enquanto estiver com a bola, o Deslocamento efetivo fica pela metade do máximo (a menos que uma habilidade diga o contrário).</p>
    </div>

    <p class="hint">
      Dica: em qualquer campo de número (PA, Deslocamento ou Despertar —
      atual ou máximo), digite <strong>+2</strong> ou <strong>-1</strong> e
      aperte Enter (ou saia do campo) para somar/subtrair rápido.
    </p>
  `;

  const acoesTab = `
    <div class="card">
      <div class="card-title">Marcador no mapa</div>
      <div class="row split">
        <button id="marcador-mostrar" class="${!markerHidden ? "toggle-active" : ""}" ${!markerHidden ? "disabled" : ""}>Mostrar Sempre</button>
        <button id="marcador-ocultar" class="${markerHidden ? "toggle-active" : ""}" ${markerHidden ? "disabled" : ""}>Não Aparecer</button>
      </div>
      <p class="hint">Essa preferência é só sua — os outros jogadores continuam vendo (ou não) o marcador deste token de acordo com a preferência de cada um.</p>
    </div>

    <button class="round" id="nova-rodada">Nova Rodada — recupera PA e Deslocamento</button>
    <button class="link-btn" id="remover">Remover estatísticas deste token</button>
  `;

  return `
    <h1>Editar Estatísticas</h1>
    <p class="subtitle">Blue Soccer RPG</p>

    <div class="tabs">
      <button class="tab-btn ${activeTab === "stats" ? "active" : ""}" data-tab="stats">Estatísticas</button>
      <button class="tab-btn ${activeTab === "acoes" ? "active" : ""}" data-tab="acoes">Ações</button>
    </div>

    <div class="tab-panel" style="${activeTab === "stats" ? "" : "display:none;"}">
      ${statsTab}
    </div>
    <div class="tab-panel" style="${activeTab === "acoes" ? "" : "display:none;"}">
      ${acoesTab}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// IMPORTANTE: sempre grava uma cópia "limpa" (JSON) do objeto de estatísticas,
// nunca o objeto em si. A Owlbear Rodeo processa o valor gravado internamente
// (usando Immer por baixo dos panos) e pode deixá-lo somente-leitura depois —
// se a gente entregasse o mesmo objeto que continua em uso aqui no editor,
// qualquer edição seguinte falhava silenciosamente.
// ---------------------------------------------------------------------------
async function save() {
  await OBR.scene.items.updateItems([itemId], (items) => {
    for (const item of items) {
      item.metadata[STATS_KEY] = JSON.parse(JSON.stringify(stats));
    }
  });
  if (markerHidden) {
    await removeMarker(itemId);
  } else {
    await renderMarker(itemId);
  }
  await refreshDetailIfVisible(itemId);
  render();
}

async function setMarkerHidden(hide) {
  const metadata = await OBR.player.getMetadata();
  const current = Array.isArray(metadata?.[HIDDEN_MARKERS_KEY]) ? metadata[HIDDEN_MARKERS_KEY] : [];
  const next = hide
    ? Array.from(new Set([...current, itemId]))
    : current.filter((id) => id !== itemId);
  await OBR.player.setMetadata({ [HIDDEN_MARKERS_KEY]: next });
  markerHidden = hide;
  if (hide) {
    await removeMarker(itemId);
  } else {
    await renderMarker(itemId);
  }
  render();
}

function byId(id) {
  return document.getElementById(id);
}

function wireEnterToBlur(id) {
  byId(id).addEventListener("keydown", (e) => {
    if (e.key === "Enter") e.target.blur();
  });
}

function wire() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset.tab;
      render();
    });
  });

  byId("pa-atual").addEventListener("change", (e) => {
    stats.pa.atual = clamp(parseInlineValue(e.target.value, stats.pa.atual), 0, stats.pa.maximo);
    save();
  });
  wireEnterToBlur("pa-atual");

  byId("pa-maximo").addEventListener("change", (e) => {
    stats.pa.maximo = Math.max(0, Math.round(parseInlineValue(e.target.value, stats.pa.maximo)));
    stats.pa.atual = Math.min(stats.pa.atual, stats.pa.maximo);
    save();
  });
  wireEnterToBlur("pa-maximo");

  byId("desloc-atual").addEventListener("change", (e) => {
    const max = deslocamentoMaximoEfetivo(stats);
    stats.deslocamento.atual = clamp(parseInlineValue(e.target.value, stats.deslocamento.atual), 0, max);
    save();
  });
  wireEnterToBlur("desloc-atual");

  byId("desloc-maximo").addEventListener("change", (e) => {
    stats.deslocamento.maximo = Math.max(
      0,
      Math.round(parseInlineValue(e.target.value, stats.deslocamento.maximo))
    );
    stats.deslocamento.atual = Math.min(stats.deslocamento.atual, deslocamentoMaximoEfetivo(stats));
    save();
  });
  wireEnterToBlur("desloc-maximo");

  const despertarPontosInput = byId("despertar-pontos");
  if (!despertarPontosInput.disabled) {
    despertarPontosInput.addEventListener("change", (e) => {
      stats.despertar.pontos = clamp(parseInlineValue(e.target.value, stats.despertar.pontos), 0, 10);
      save();
    });
    wireEnterToBlur("despertar-pontos");
  }

  byId("despertar-toggle").addEventListener("click", () => {
    if (stats.despertar.usado) return;
    if (stats.despertar.ativo) {
      stats.despertar.ativo = false;
      stats.despertar.rodadasRestantes = 0;
      stats.despertar.penalidadeRodadas = 3;
      stats.despertar.usado = true;
    } else if (stats.despertar.pontos >= 10) {
      stats.despertar.ativo = true;
      stats.despertar.rodadasRestantes = 5;
      stats.despertar.pontos = 0;
    }
    save();
  });

  byId("despertar-usado").addEventListener("change", (e) => {
    stats.despertar.usado = e.target.checked;
    save();
  });

  byId("fluxo-usado").addEventListener("change", (e) => {
    stats.fluxo.usado = e.target.checked;
    save();
  });

  byId("fluxo-toggle").addEventListener("click", () => {
    if (stats.fluxo.ativo) {
      stats.fluxo.ativo = false;
      stats.fluxo.rodadasRestantes = 0;
    } else if (!stats.fluxo.usado) {
      stats.fluxo.ativo = true;
      stats.fluxo.rodadasRestantes = 5;
      stats.fluxo.usado = true;
      stats.pa.atual = Math.max(0, stats.pa.atual - 3);
    }
    save();
  });

  byId("posse-bola").addEventListener("change", (e) => {
    stats.posseDeBola = e.target.checked;
    stats.deslocamento.atual = Math.min(stats.deslocamento.atual, deslocamentoMaximoEfetivo(stats));
    save();
  });

  byId("nova-rodada").addEventListener("click", () => {
    stats = advanceRound(stats);
    save();
  });

  byId("marcador-mostrar").addEventListener("click", () => setMarkerHidden(false));
  byId("marcador-ocultar").addEventListener("click", () => setMarkerHidden(true));

  byId("remover").addEventListener("click", async () => {
    if (!confirm("Remover as estatísticas de Blue Soccer deste token?")) return;
    await OBR.scene.items.updateItems([itemId], (items) => {
      for (const item of items) delete item.metadata[STATS_KEY];
    });
    await removeMarker(itemId);
    app.innerHTML = `<p class="loading">Estatísticas removidas. Feche e reabra o menu para recomeçar.</p>`;
  });
}
