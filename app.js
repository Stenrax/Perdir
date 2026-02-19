const IMMERSION_STATES = [
  "Immersion demandée par l'élève",
  "Document donné à l'élève",
  "Document complété rendu par l'élève",
  "Immersion demandée à l'établissement",
  "Réponse positive de l'établissement",
  "Réponse négative de l'établissement",
  "Immersion terminée - En attente du bilan d'immersion",
  "Immersion terminée - Bilan d'immersion reçu",
];

const REAFFECTATION_STATES = [
  "Pas de demande de réaffectation",
  "Réaffectation demandée par l'élève - Dossier à donner à l'élève",
  "Dossier de demande de réaffectation donné à l'élève",
  "Dossier de demande de réaffectation rendu par l'élève",
  "Dossier de demande de réaffectation envoyé au FoQualE",
  "Réaffectation acceptée par la DSDEN",
  "Réaffectation refusée par la DSDEN",
];

const STORAGE_KEY = "perdir_immersions_v1";

const state = {
  immersions: [],
};

const byId = (id) => document.getElementById(id);
const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

function initTabs() {
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("active"));
      tab.classList.add("active");
      byId(tab.dataset.tab).classList.add("active");
      if (tab.dataset.tab === "dashboard") {
        renderDashboard();
      }
    });
  });
}

function parseDate(value) {
  return new Date(`${value}T00:00:00`);
}

function getPeriod(immersion) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = parseDate(immersion.dateDebut);
  const end = parseDate(immersion.dateFin);

  if (today < start) return "Future";
  if (today > end) return "Passée";
  return "En cours";
}

function saveLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.immersions));
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      state.immersions = parsed;
    }
  } catch {
    state.immersions = [];
  }
}

function createImmersion() {
  const payload = {
    id: crypto.randomUUID(),
    origineEtablissement: byId("origineEtablissement").value.trim(),
    nom: byId("nom").value.trim(),
    prenom: byId("prenom").value.trim(),
    classe: byId("classe").value.trim(),
    accueilEtablissement: byId("accueilEtablissement").value.trim(),
    cursusDemande: byId("cursusDemande").value.trim(),
    dateDebut: byId("dateDebut").value,
    dateFin: byId("dateFin").value,
    immersionState: IMMERSION_STATES[0],
    reaffectationState: REAFFECTATION_STATES[0],
    createdAt: new Date().toISOString(),
  };

  if (Object.values(payload).some((v) => typeof v === "string" && !v)) {
    alert("Veuillez compléter tous les champs.");
    return;
  }

  if (parseDate(payload.dateFin) < parseDate(payload.dateDebut)) {
    alert("La date de fin doit être supérieure ou égale à la date de début.");
    return;
  }

  state.immersions.unshift(payload);
  saveLocal();
  renderAll();

  document.querySelectorAll("#studentForm input, #immersionForm input").forEach((input) => {
    input.value = "";
  });
}

function deleteImmersion(id) {
  if (!confirm("Supprimer cette immersion ?")) return;
  state.immersions = state.immersions.filter((i) => i.id !== id);
  saveLocal();
  renderAll();
}

function updateImmersionState(id, value) {
  const item = state.immersions.find((i) => i.id === id);
  if (!item) return;
  item.immersionState = value;
  saveLocal();
  renderAll();
}

function updateReaffectationState(id, value) {
  const item = state.immersions.find((i) => i.id === id);
  if (!item) return;
  item.reaffectationState = value;
  saveLocal();
  renderAll();
}

function renderImmersionsTab() {
  const filters = {
    origine: byId("filterOrigine").value.trim().toLowerCase(),
    classe: byId("filterClasse").value.trim().toLowerCase(),
    accueil: byId("filterAccueil").value.trim().toLowerCase(),
    cursus: byId("filterCursus").value.trim().toLowerCase(),
  };

  const list = state.immersions.filter((item) => {
    return (
      item.origineEtablissement.toLowerCase().includes(filters.origine) &&
      item.classe.toLowerCase().includes(filters.classe) &&
      item.accueilEtablissement.toLowerCase().includes(filters.accueil) &&
      item.cursusDemande.toLowerCase().includes(filters.cursus)
    );
  });

  byId("immersionsList").innerHTML = list.length
    ? list
        .map((item) => {
          const period = getPeriod(item);
          return `
            <article class="item">
              <div class="item-header">
                <h3 class="item-title">${escapeHtml(item.prenom)} ${escapeHtml(item.nom)}</h3>
                <button class="icon-btn" data-delete="${item.id}" title="Supprimer" aria-label="Supprimer">🗑️</button>
              </div>
              <p class="item-meta">Origine : ${escapeHtml(item.origineEtablissement)} (${escapeHtml(item.classe)})</p>
              <p class="item-meta">Accueil : ${escapeHtml(item.accueilEtablissement)} | Cursus : ${escapeHtml(item.cursusDemande)}</p>
              <p class="item-meta">Du ${item.dateDebut} au ${item.dateFin} <span class="tag">${period}</span></p>
              <div class="row">
                <label>
                  Avancement immersion
                  <select data-immersion-state="${item.id}">
                    ${IMMERSION_STATES.map((status) => `<option ${status === item.immersionState ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}
                  </select>
                </label>
              </div>
            </article>`;
        })
        .join("")
    : '<p class="empty">Aucune immersion ne correspond aux filtres.</p>';
}

function renderReaffectationTab() {
  const hideProcessed = byId("hideProcessedReaffectation").checked;
  const list = state.immersions.filter((item) => {
    const isPast = getPeriod(item) === "Passée";
    if (!isPast) return false;
    if (!hideProcessed) return true;
    return ![
      "Réaffectation acceptée par la DSDEN",
      "Réaffectation refusée par la DSDEN",
    ].includes(item.reaffectationState);
  });

  byId("reaffectationList").innerHTML = list.length
    ? list
        .map(
          (item) => `
      <article class="item">
        <div class="item-header">
          <h3 class="item-title">${escapeHtml(item.prenom)} ${escapeHtml(item.nom)}</h3>
          <button class="icon-btn" data-delete="${item.id}" title="Supprimer" aria-label="Supprimer">🗑️</button>
        </div>
        <p class="item-meta">${escapeHtml(item.origineEtablissement)} → ${escapeHtml(item.accueilEtablissement)} (${escapeHtml(item.cursusDemande)})</p>
        <p class="item-meta">État immersion : <span class="tag">${escapeHtml(item.immersionState)}</span></p>
        <div class="row">
          <label>
            État de réaffectation
            <select data-reaffectation-state="${item.id}">
              ${REAFFECTATION_STATES.map((status) => `<option ${status === item.reaffectationState ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}
            </select>
          </label>
        </div>
      </article>`
        )
        .join("")
    : '<p class="empty">Aucune immersion passée à afficher.</p>';
}

function renderStatsTable() {
  const total = state.immersions.length;
  const futures = state.immersions.filter((i) => getPeriod(i) === "Future").length;
  const enCours = state.immersions.filter((i) => getPeriod(i) === "En cours").length;
  const passees = state.immersions.filter((i) => getPeriod(i) === "Passée").length;
  const reaffectationDemandee = state.immersions.filter(
    (i) => i.reaffectationState !== REAFFECTATION_STATES[0]
  ).length;
  const reaffectationsTraitees = state.immersions.filter((i) =>
    ["Réaffectation acceptée par la DSDEN", "Réaffectation refusée par la DSDEN"].includes(
      i.reaffectationState
    )
  ).length;

  byId("statsTableContainer").innerHTML = `
    <table>
      <thead>
        <tr><th>Indicateur</th><th>Valeur</th></tr>
      </thead>
      <tbody>
        <tr><td>Total immersions</td><td>${total}</td></tr>
        <tr><td>Immersions futures</td><td>${futures}</td></tr>
        <tr><td>Immersions en cours</td><td>${enCours}</td></tr>
        <tr><td>Immersions passées</td><td>${passees}</td></tr>
        <tr><td>Réaffectations demandées</td><td>${reaffectationDemandee}</td></tr>
        <tr><td>Réaffectations traitées</td><td>${reaffectationsTraitees}</td></tr>
      </tbody>
    </table>
  `;
}

function renderFlowCanvas() {
  const canvas = byId("flowCanvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const nodes = new Map();
  const links = new Map();

  state.immersions.forEach((i) => {
    nodes.set(i.origineEtablissement, { type: "origin" });
    nodes.set(i.accueilEtablissement, { type: "target" });
    const key = `${i.origineEtablissement}→${i.accueilEtablissement}`;
    links.set(key, (links.get(key) || 0) + 1);
  });

  const origins = [...new Set(state.immersions.map((i) => i.origineEtablissement))];
  const targets = [...new Set(state.immersions.map((i) => i.accueilEtablissement))];

  const leftX = 120;
  const rightX = canvas.width - 120;

  const originPos = new Map();
  const targetPos = new Map();

  origins.forEach((name, idx) => {
    originPos.set(name, {
      x: leftX,
      y: ((idx + 1) * canvas.height) / (origins.length + 1),
    });
  });

  targets.forEach((name, idx) => {
    targetPos.set(name, {
      x: rightX,
      y: ((idx + 1) * canvas.height) / (targets.length + 1),
    });
  });

  links.forEach((count, key) => {
    const [from, to] = key.split("→");
    const p1 = originPos.get(from);
    const p2 = targetPos.get(to);
    if (!p1 || !p2) return;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.bezierCurveTo((p1.x + p2.x) / 2, p1.y, (p1.x + p2.x) / 2, p2.y, p2.x, p2.y);
    ctx.strokeStyle = "rgba(230, 31, 82, 0.75)";
    ctx.lineWidth = 1 + count;
    ctx.stroke();
  });

  const drawNode = (name, pos, color) => {
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText(name, pos.x + 15, pos.y + 4);
  };

  originPos.forEach((pos, name) => drawNode(name, pos, "#420e1b"));
  targetPos.forEach((pos, name) => drawNode(name, pos, "#e61f52"));

  if (!state.immersions.length) {
    ctx.font = "14px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillText("Aucune donnée pour le diagramme.", 20, 30);
  }
}

function renderDashboard() {
  renderFlowCanvas();
  renderStatsTable();
}

function bindDynamicActions() {
  document.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => deleteImmersion(btn.dataset.delete));
  });

  document.querySelectorAll("[data-immersion-state]").forEach((select) => {
    select.addEventListener("change", () => updateImmersionState(select.dataset.immersionState, select.value));
  });

  document.querySelectorAll("[data-reaffectation-state]").forEach((select) => {
    select.addEventListener("change", () =>
      updateReaffectationState(select.dataset.reaffectationState, select.value)
    );
  });
}

function renderAll() {
  renderImmersionsTab();
  renderReaffectationTab();
  renderDashboard();
  bindDynamicActions();
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state.immersions, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "immersions.json";
  a.click();
  URL.revokeObjectURL(url);
}

function importJson(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!Array.isArray(parsed)) throw new Error("Format invalide");
      state.immersions = parsed;
      saveLocal();
      renderAll();
      alert("Import JSON réalisé.");
    } catch {
      alert("Fichier JSON invalide.");
    }
  };
  reader.readAsText(file);
}

function initEvents() {
  byId("createImmersionBtn").addEventListener("click", createImmersion);
  ["filterOrigine", "filterClasse", "filterAccueil", "filterCursus"].forEach((id) => {
    byId(id).addEventListener("input", renderAll);
  });
  byId("hideProcessedReaffectation").addEventListener("change", renderAll);

  byId("exportJsonBtn").addEventListener("click", exportJson);
  byId("importJsonInput").addEventListener("change", (event) => {
    const [file] = event.target.files;
    importJson(file);
    event.target.value = "";
  });
}

function main() {
  loadLocal();
  initTabs();
  initEvents();
  renderAll();
}

main();
