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

const STORAGE_KEY = "perdir_immersions_v2";

const state = {
  immersions: [],
  journal: [],
};

const byId = (id) => document.getElementById(id);
const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

function showToast(message) {
  const container = byId("toastContainer");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("visible");
  }, 10);
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.remove(), 300);
  }, 2600);
}

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

function trackEvent(type, payload) {
  state.journal.unshift({
    id: crypto.randomUUID(),
    type,
    payload,
    timestamp: new Date().toISOString(),
  });
}

function saveLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.immersions)) {
        state.immersions = parsed.immersions;
        state.journal = Array.isArray(parsed.journal) ? parsed.journal : [];
        return;
      }
    }

    // Compatibilité avec l'ancien format (tableau simple)
    const legacyRaw = localStorage.getItem("perdir_immersions_v1");
    if (!legacyRaw) return;
    const legacy = JSON.parse(legacyRaw);
    if (Array.isArray(legacy)) {
      state.immersions = legacy;
      state.journal = [];
      saveLocal();
    }
  } catch {
    state.immersions = [];
    state.journal = [];
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
  trackEvent("immersion_created", { id: payload.id });
  saveLocal();
  renderAll();
  showToast(`Immersion créée pour ${payload.prenom} ${payload.nom}.`);

  document.querySelectorAll("#studentForm input, #immersionForm input").forEach((input) => {
    input.value = "";
  });
}

function deleteImmersion(id) {
  const target = state.immersions.find((i) => i.id === id);
  if (!target || !confirm("Supprimer cette immersion ?")) return;
  state.immersions = state.immersions.filter((i) => i.id !== id);
  trackEvent("immersion_deleted", { id });
  saveLocal();
  renderAll();
  showToast(`Immersion supprimée pour ${target.prenom} ${target.nom}.`);
}

function updateImmersionState(id, value) {
  const item = state.immersions.find((i) => i.id === id);
  if (!item || item.immersionState === value) return;
  item.immersionState = value;
  trackEvent("immersion_state_updated", { id, value });
  saveLocal();
  renderAll();
  showToast(`Statut immersion mis à jour : ${value}`);
}

function updateReaffectationState(id, value) {
  const item = state.immersions.find((i) => i.id === id);
  if (!item || item.reaffectationState === value) return;
  item.reaffectationState = value;
  trackEvent("reaffectation_state_updated", { id, value });
  saveLocal();
  renderAll();
  showToast(`Statut réaffectation mis à jour : ${value}`);
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

function renderKpis() {
  const cards = [
    {
      label: "Immersions totales",
      value: state.immersions.length,
    },
    {
      label: "Immersions demandées",
      value: state.immersions.filter((i) => i.immersionState === IMMERSION_STATES[0]).length,
    },
    {
      label: "Avis positifs immersion",
      value: state.immersions.filter((i) => i.immersionState === IMMERSION_STATES[4]).length,
    },
    {
      label: "Avis négatifs immersion",
      value: state.immersions.filter((i) => i.immersionState === IMMERSION_STATES[5]).length,
    },
    {
      label: "Réaffectations demandées",
      value: state.immersions.filter((i) => i.reaffectationState !== REAFFECTATION_STATES[0]).length,
    },
    {
      label: "Réaffectations acceptées",
      value: state.immersions.filter((i) => i.reaffectationState === REAFFECTATION_STATES[5]).length,
    },
  ];

  byId("kpiCards").innerHTML = cards
    .map(
      (card) => `
      <article class="kpi-card">
        <p>${escapeHtml(card.label)}</p>
        <strong>${card.value}</strong>
      </article>
    `
    )
    .join("");
}

function renderStatsTable() {
  const origins = [...new Set(state.immersions.map((i) => i.origineEtablissement))].sort((a, b) =>
    a.localeCompare(b)
  );
  const targets = [...new Set(state.immersions.map((i) => i.accueilEtablissement))].sort((a, b) =>
    a.localeCompare(b)
  );

  if (!origins.length || !targets.length) {
    byId("statsTableContainer").innerHTML = '<p class="empty">Aucune donnée à afficher.</p>';
    return;
  }

  const matrix = new Map();
  state.immersions.forEach((item) => {
    const key = `${item.origineEtablissement}::${item.accueilEtablissement}`;
    matrix.set(key, (matrix.get(key) || 0) + 1);
  });

  const header = targets.map((target) => `<th>${escapeHtml(target)}</th>`).join("");
  const rows = origins
    .map((origin) => {
      const cols = targets
        .map((target) => `<td>${matrix.get(`${origin}::${target}`) || 0}</td>`)
        .join("");
      return `<tr><th>${escapeHtml(origin)}</th>${cols}</tr>`;
    })
    .join("");

  byId("statsTableContainer").innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Origine \ Accueil</th>
          ${header}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderDashboard() {
  renderKpis();
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
  const payload = {
    generatedAt: new Date().toISOString(),
    immersions: state.immersions,
    journal: state.journal,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
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
      if (Array.isArray(parsed)) {
        state.immersions = parsed;
        state.journal = [];
      } else if (Array.isArray(parsed?.immersions)) {
        state.immersions = parsed.immersions;
        state.journal = Array.isArray(parsed.journal) ? parsed.journal : [];
      } else {
        throw new Error("Format invalide");
      }
      saveLocal();
      renderAll();
      showToast("Import JSON réalisé.");
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
