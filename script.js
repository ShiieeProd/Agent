// =============================================================
// CONFIG
// =============================================================
const SHEET_ID = "19e0-6wUPcgmLEp-nkc22j_Dljok8UdSMzeT_jaoF-pI";
const SHEET_NAME = "Input";
const DEFAULT_IMG = "images/agents/default.png";

// =============================================================
// HELPERS: parse Google Sheets "gviz" JSON safely
// =============================================================
function safeParseGviz(text) {
  try {
    return JSON.parse(text.substring(47, text.length - 2));
  } catch (err) {
    console.warn("GViz parse failed:", err);
    return null;
  }
}

// given json.table.rows and expected number of rows, produce normalized rows
function normalizeRows(gvizRows, expectedCount, expectedCols = 2) {
  const out = [];
  for (let r = 0; r < expectedCount; r++) {
    const row = gvizRows && gvizRows[r] ? gvizRows[r].c || [] : [];
    const cells = [];
    for (let c = 0; c < expectedCols; c++) {
      cells.push(row[c] && row[c].v != null ? String(row[c].v).trim() : "");
    }
    out.push(cells);
  }
  return out;
}

// =============================================================
// FETCH: single-column ranges (returns array of values)
// used for single cells like C8, C9, D9, E8 etc.
// =============================================================
async function fetchRange(range) {
  const url =
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?` +
    `tqx=out:json&sheet=${SHEET_NAME}&range=${range}`;

  try {
    const res = await fetch(url);
    const text = await res.text();
    const json = safeParseGviz(text);
    if (!json || !json.table) return [];

    const rows = json.table.rows || [];
    // return first column of each row (works for single-column ranges)
    return rows.map(r => (r.c && r.c[0] && r.c[0].v != null ? String(r.c[0].v).trim() : ""));
  } catch (err) {
    console.error("fetchRange error:", err);
    return [];
  }
}

// =============================================================
// FETCH ROW-PAIRS: returns array of { player, agent } for each row
// e.g. fetchRows(11, 15, "C", "D") => [{player,agent}, ...]
// =============================================================
async function fetchRows(startRow, endRow, col1, col2) {
  const range = `${col1}${startRow}:${col2}${endRow}`;
  const expectedCount = endRow - startRow + 1;
  const url =
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?` +
    `tqx=out:json&sheet=${SHEET_NAME}&range=${range}`;

  try {
    const res = await fetch(url);
    const text = await res.text();
    const json = safeParseGviz(text);
    const rows = (json && json.table && json.table.rows) ? json.table.rows : [];
    const normalized = normalizeRows(rows, expectedCount, 2);

    return normalized.map(([p, a]) => ({ player: p || "", agent: a || "" }));
  } catch (err) {
    console.error("fetchRows error:", err);
    // return empty but correctly sized array to avoid index issues
    return Array.from({ length: expectedCount }).map(() => ({ player: "", agent: "" }));
  }
}

// =============================================================
// FETCH LEFT TEAM (DEF) & RIGHT TEAM (ATK) - using row pairs
// =============================================================
async function fetchLeftTeam() {
  const status = (await fetchRange("C8:C8"))[0] || "";
  const teamName = (await fetchRange("C9:C9"))[0] || "";
  const role = (await fetchRange("D9:D9"))[0] || "";
  const rows = await fetchRows(11, 15, "C", "D"); // C11:D15 pairs

  return { status, teamName, role, rows };
}

async function fetchRightTeam() {
  const status = (await fetchRange("G8:G8"))[0] || "";
  const teamName = (await fetchRange("G9:G9"))[0] || "";
  const role = (await fetchRange("F9:F9"))[0] || "";
  const rows = await fetchRows(11, 15, "F", "G"); // F11:G15 pairs

  return { status, teamName, role, rows };
}

async function fetchMap() {
  return (await fetchRange("E8:E8"))[0] || "";
}

// =============================================================
// RENDER DIAMONDS (Win Counter)
// =============================================================
function renderDiamonds(containerId, status) {
  const box = document.getElementById(containerId);
  if (!box) return;

  box.innerHTML = "";
  const stat = Number(status) || 0;

  for (let i = 0; i < 3; i++) {
    const d = document.createElement("div");
    d.classList.add("diamond");
    if (i < stat) d.classList.add("filled");
    box.appendChild(d);
  }
}

// =============================================================
// CREATE PLAYER CARD (keeps your original signature)
// =============================================================
function createPlayerCard(player, agent, side, index) {
  const card = document.createElement("div");
  card.className = `player-card ${side.toLowerCase()}`;

  const folder = side === "DEF" ? "Left" : "Right";

  // AGENT IMAGE
  const img = document.createElement("img");
  img.className = "agent-img";
  img.dataset.side = side;
  img.dataset.index = index;
  const imageName = agent ? agent.trim() : "";
  img.src = imageName
    ? `images/agents/${folder}/${imageName}.png`
    : DEFAULT_IMG;

  img.onerror = () => (img.src = DEFAULT_IMG);
  img.dataset.lastSrc = img.src;

  // AGENT NAME
  const agName = document.createElement("div");
  agName.className = `agent-name ${side.toLowerCase()}`;
  agName.textContent = agent || "AGENT";

  // PLAYER NAME
  const plName = document.createElement("div");
  plName.className = `player-name ${side.toLowerCase()}`;
  plName.textContent = player || "PLAYER";

  card.appendChild(img);
  card.appendChild(agName);
  card.appendChild(plName);

  return card;
}

// =============================================================
// INITIAL BUILD OF OVERLAY
// =============================================================
async function initOverlay() {
  try {
    const left = await fetchLeftTeam();
    const right = await fetchRightTeam();
    const map = await fetchMap();

    // TEAM NAMES
    const teamLeftEl = document.getElementById("teamLeft");
    const teamRightEl = document.getElementById("teamRight");
    if (teamLeftEl) teamLeftEl.textContent = left.teamName;
    if (teamRightEl) teamRightEl.textContent = right.teamName;

    // ROLES
    const roleLeftEl = document.getElementById("roleLeft");
    const roleRightEl = document.getElementById("roleRight");
    if (roleLeftEl) roleLeftEl.textContent = left.role;
    if (roleRightEl) roleRightEl.textContent = right.role;

    // TEAM LOGOS
    const logoLeft = document.getElementById("teamLogoLeft");
    const logoRight = document.getElementById("teamLogoRight");
    if (logoLeft) logoLeft.src = `images/teams/${left.teamName.toLowerCase()}.png`;
    if (logoRight) logoRight.src = `images/teams/${right.teamName.toLowerCase()}.png`;

    // MAP INFO
    const mapNameEl = document.getElementById("mapName");
    const mapImageEl = document.getElementById("mapImage");
    if (mapNameEl) mapNameEl.textContent = map.toUpperCase();
    if (mapImageEl) mapImageEl.src = `images/maps/${map.toLowerCase()}.png`;

    // DIAMONDS
    renderDiamonds("diamondLeft", left.status);
    renderDiamonds("diamondRight", right.status);

    // PLAYER CARDS
    const leftBox = document.getElementById("leftLineup");
    const rightBox = document.getElementById("rightLineup");

    if (leftBox) leftBox.innerHTML = "";
    if (rightBox) rightBox.innerHTML = "";

    left.rows.forEach((r, i) => {
      if (leftBox) leftBox.appendChild(createPlayerCard(r.player, r.agent, "DEF", i));
    });

    right.rows.forEach((r, i) => {
      if (rightBox) rightBox.appendChild(createPlayerCard(r.player, r.agent, "ATK", i));
    });
  } catch (err) {
    console.error("initOverlay error:", err);
  }
}

// =============================================================
// AUTO REFRESH LOOP (1 second)
// Updates team data, player names, agent images + names (with slide-up animation)
// =============================================================
setInterval(async () => {
  try {
    const left = await fetchLeftTeam();
    const right = await fetchRightTeam();
    const map = await fetchMap();

    // TEAM NAMES
    const teamLeftEl = document.getElementById("teamLeft");
    const teamRightEl = document.getElementById("teamRight");
    if (teamLeftEl) teamLeftEl.textContent = left.teamName;
    if (teamRightEl) teamRightEl.textContent = right.teamName;

    // ROLES
    const roleLeftEl = document.getElementById("roleLeft");
    const roleRightEl = document.getElementById("roleRight");
    if (roleLeftEl) roleLeftEl.textContent = left.role;
    if (roleRightEl) roleRightEl.textContent = right.role;

    // TEAM LOGOS
    const logoLeft = document.getElementById("teamLogoLeft");
    const logoRight = document.getElementById("teamLogoRight");
    if (logoLeft) logoLeft.src = `images/teams/${left.teamName.toLowerCase()}.png`;
    if (logoRight) logoRight.src = `images/teams/${right.teamName.toLowerCase()}.png`;

    // MAP
    const mapNameEl = document.getElementById("mapName");
    const mapImageEl = document.getElementById("mapImage");
    if (mapNameEl) mapNameEl.textContent = map.toUpperCase();
    if (mapImageEl) mapImageEl.src = `images/maps/${map.toLowerCase()}.png`;

    // DIAMONDS
    renderDiamonds("diamondLeft", left.status);
    renderDiamonds("diamondRight", right.status);

    // PLAYER NAMES (update text only)
    document.querySelectorAll(".player-name.def").forEach((el, i) => {
      el.textContent = left.rows[i] ? left.rows[i].player || "PLAYER" : "PLAYER";
    });
    document.querySelectorAll(".player-name.atk").forEach((el, i) => {
      el.textContent = right.rows[i] ? right.rows[i].player || "PLAYER" : "PLAYER";
    });

    // AGENTS (image + slide-up animation + agent name update)
    document.querySelectorAll(".agent-img").forEach(img => {
      const side = img.dataset.side;
      const index = Number(img.dataset.index);
      const data = side === "DEF" ? left.rows[index] : right.rows[index];

      const folder = side === "DEF" ? "Left" : "Right";
      const currentAgent = data ? data.agent : "";
      const newSrc = currentAgent
        ? `images/agents/${folder}/${currentAgent.toLowerCase()}.png`
        : DEFAULT_IMG;

      if (img.dataset.lastSrc !== newSrc) {
        img.src = newSrc;
        img.dataset.lastSrc = newSrc;

        // trigger slide-up animation (requires CSS .slide-up)
        img.classList.remove("slide-up");
        void img.offsetWidth; // reflow
        img.classList.add("slide-up");

        // update agent name
        const agName = img.parentElement.querySelector(".agent-name");
        if (agName) agName.textContent = currentAgent || "AGENT";
      }
    });

  } catch (err) {
    console.error("Auto-refresh error:", err);
  }
}, 1000); // 1000 ms = 1 second

// =============================================================
// START
// =============================================================
initOverlay();
