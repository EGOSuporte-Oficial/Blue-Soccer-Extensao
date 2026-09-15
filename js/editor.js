import OBR from "https://esm.sh/@owlbear-rodeo/sdk@3";
import { getStats, STATS_KEY, parseInlineValue, clamp, advanceRound } from "./shared.js";
import { renderPanel, removePanel } from "./panel.js";

const app = document.getElementById("app");
const itemId = new URLSearchParams(location.search).get("id");

let stats = null;
let role = "PLAYER";

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
  app.innerHTML = template(stats, role);
  wire();
}

function template(s, role) {
  const despertarBtnLabel = s.despertar.ativo
    ? "Desativar Despertar"
    : s.despertar.pontos >= 10
    ? "Ativar Despertar"
    : `Ativar Despertar (${s.despertar.pontos}/10)`;
  const despertarBtnDisabled = !s.despertar.ativo && s.despertar.pontos < 10 ? "disabled" : "";
  const despertarStatus = s.despertar.ativo
    ? `⚡ Ativo — ${s.despertar.rodadasRestantes} rodada(s) restante(s)`
    : s.despertar.penalidadeRodadas > 0
    ? `⚠ Penalidade -1 em atributos — ${s.despertar.penalidadeRodadas} rodada(s)`
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
    : "";

  const gmSection =
    role === "GM"
      ? `
    <hr />
    <div class="card gm-only">
      <div class="card-title">Mestre</div>
      <label class="checkbox">
        <input type="checkbox" id="visivel-jogadores" ${s.visivelParaJogadores ? "checked" : ""} />
        Visível/editável pelos jogadores
      </label>
      <p class="hint">
        Se desmarcado, só o Mestre vê e edita — jogadores não veem nem a bolha
        no token nem este painel para este token.
      </p>
    </div>`
      : "";

  return `
    <h1>Editar Estatísticas</h1>
    <p class="subtitle">Blue Soccer RPG</p>

    <div class="card">
      <div class="card-title"><span class="dot pa"></span>Pontos de Ação</div>
      <div class="row split">
        <div class="field">
          <input type="text" id="pa-atual" value="${s.pa.atual}" inputmode="numeric" />
          <span class="slash">/</span>
          <input type="number" id="pa-maximo" min="0" value="${s.pa.maximo}" />
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title"><span class="dot desloc"></span>Deslocamento (metros)</div>
      <div class="row split">
        <div class="field">
          <input type="text" id="desloc-atual" value="${s.deslocamento.atual}" inputmode="numeric" />
          <span class="slash">/</span>
          <input type="number" id="desloc-maximo" min="0" value="${s.deslocamento.maximo}" />
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title"><span class="dot despertar"></span>Pontos de Despertar</div>
      <div class="row split">
        <div class="field">
          <input type="text" id="despertar-pontos" value="${s.despertar.pontos}" inputmode="numeric" />
          <span class="slash">/ 10</span>
        </div>
        <button id="despertar-toggle" ${despertarBtnDisabled}>${despertarBtnLabel}</button>
      </div>
      <div class="pips">${pips(s.despertar.pontos)}</div>
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
        ⚽ Posse de Bola
      </label>
    </div>

    <button class="round" id="nova-rodada">Nova Rodada — recupera PA e Deslocamento</button>

    ${gmSection}

    <p class="hint">
      Dica: nos campos de PA, Deslocamento e Despertar, digite
      <strong>+2</strong> ou <strong>-1</strong> e aperte Enter (ou saia do
      campo) para somar/subtrair rápido — como na Stat Bubbles for D&amp;D.
    </p>

    <button class="link-btn" id="remover">Remover estatísticas deste token</button>
  `;
}

async function save() {
  await OBR.scene.items.updateItems([itemId], (items) => {
    for (const item of items) {
      item.metadata[STATS_KEY] = stats;
    }
  });
  await renderPanel(itemId);
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
  byId("pa-atual").addEventListener("change", (e) => {
    stats.pa.atual = Math.max(0, parseInlineValue(e.target.value, stats.pa.atual));
    save();
  });
  wireEnterToBlur("pa-atual");

  byId("pa-maximo").addEventListener("change", (e) => {
    stats.pa.maximo = Math.max(0, Math.round(Number(e.target.value) || 0));
    save();
  });

  byId("desloc-atual").addEventListener("change", (e) => {
    stats.deslocamento.atual = Math.max(0, parseInlineValue(e.target.value, stats.deslocamento.atual));
    save();
  });
  wireEnterToBlur("desloc-atual");

  byId("desloc-maximo").addEventListener("change", (e) => {
    stats.deslocamento.maximo = Math.max(0, Math.round(Number(e.target.value) || 0));
    save();
  });

  byId("despertar-pontos").addEventListener("change", (e) => {
    stats.despertar.pontos = clamp(parseInlineValue(e.target.value, stats.despertar.pontos), 0, 10);
    save();
  });
  wireEnterToBlur("despertar-pontos");

  byId("despertar-toggle").addEventListener("click", () => {
    if (stats.despertar.ativo) {
      stats.despertar.ativo = false;
      stats.despertar.rodadasRestantes = 0;
    } else if (stats.despertar.pontos >= 10) {
      stats.despertar.ativo = true;
      stats.despertar.rodadasRestantes = 5;
      stats.despertar.pontos = 0;
    }
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
    save();
  });

  byId("nova-rodada").addEventListener("click", () => {
    stats = advanceRound(stats);
    save();
  });

  const visivel = byId("visivel-jogadores");
  if (visivel) {
    visivel.addEventListener("change", (e) => {
      stats.visivelParaJogadores = e.target.checked;
      save();
    });
  }

  byId("remover").addEventListener("click", async () => {
    if (!confirm("Remover as estatísticas de Blue Soccer deste token?")) return;
    await OBR.scene.items.updateItems([itemId], (items) => {
      for (const item of items) delete item.metadata[STATS_KEY];
    });
    await removePanel(itemId);
    app.innerHTML = `<p class="loading">Estatísticas removidas. Feche e reabra o menu para recomeçar.</p>`;
  });
}
