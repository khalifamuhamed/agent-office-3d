// agent-office-3d — original isometric canvas renderer.
// No code from any other project is used here; this is a from-scratch implementation
// of the general idea "show agent status as desks in an office".

const TILE_W = 140;
const TILE_H = 70;
const COL_STEP = TILE_W / 2;
const ROW_STEP = 120; // wider than TILE_H/2 so desks and name tags don't overlap between rows
const ORIGIN_X = 460;
const ORIGIN_Y = 80;
const COLS = 3;

const STATUS_COLORS = {
  busy: "#3ddc84",
  idle: "#f5c451",
  offline: "#5a5f6b",
};

const STATUS_LABEL = {
  busy: "busy",
  idle: "idle",
  offline: "offline",
};

let agents = [];
let deskHitboxes = []; // { agent, cx, cy, r }

const canvas = document.getElementById("scene");
const ctx = canvas.getContext("2d");
const panel = document.getElementById("panel");
const panelBody = document.getElementById("panel-body");
const panelClose = document.getElementById("panel-close");
const statBar = document.getElementById("stat-bar");

function isoPos(col, row) {
  const x = ORIGIN_X + (col - row) * COL_STEP;
  const y = ORIGIN_Y + (col + row) * (ROW_STEP / 2);
  return { x, y };
}

function drawFloorTile(x, y) {
  ctx.beginPath();
  ctx.moveTo(x, y - TILE_H / 2);
  ctx.lineTo(x + TILE_W / 2, y);
  ctx.lineTo(x, y + TILE_H / 2);
  ctx.lineTo(x - TILE_W / 2, y);
  ctx.closePath();
  ctx.fillStyle = "#1b1f2a";
  ctx.fill();
  ctx.strokeStyle = "#2a2f3d";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawDesk(x, y, agent) {
  const color = STATUS_COLORS[agent.status];
  const deskTop = y + 6;

  // desk body
  ctx.fillStyle = "#3a3f4e";
  ctx.fillRect(x - 26, deskTop, 52, 14);
  ctx.fillStyle = "#2c303c";
  ctx.fillRect(x - 26, deskTop + 14, 10, 18);
  ctx.fillRect(x + 16, deskTop + 14, 10, 18);

  // monitor
  const monitorLit = agent.status !== "offline";
  ctx.fillStyle = monitorLit ? "#0d1a12" : "#14151a";
  ctx.fillRect(x - 10, deskTop - 20, 20, 14);
  if (monitorLit) {
    ctx.fillStyle = color;
    ctx.globalAlpha = agent.status === "busy" ? 0.9 : 0.5;
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(x - 7, deskTop - 17 + i * 4, 6 + (i % 2) * 6, 2);
    }
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = "#1a1b20";
  ctx.fillRect(x - 3, deskTop - 6, 6, 4);

  // person
  const bodyY = agent.status === "idle" ? deskTop + 2 : deskTop - 4;
  ctx.beginPath();
  ctx.fillStyle = "#e8c39e";
  ctx.arc(x, bodyY - 16, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = agent.status === "offline" ? "#3a3d46" : color;
  ctx.globalAlpha = agent.status === "offline" ? 0.5 : 1;
  ctx.beginPath();
  ctx.moveTo(x - 8, bodyY - 10);
  ctx.quadraticCurveTo(x, bodyY - 20, x + 8, bodyY - 10);
  ctx.lineTo(x + 6, bodyY + 2);
  ctx.lineTo(x - 6, bodyY + 2);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  if (agent.status === "idle") {
    ctx.fillStyle = "#caa27a";
    ctx.fillRect(x + 10, bodyY - 8, 4, 6);
  }

  // name tag
  ctx.font = "11px sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = agent.status === "offline" ? "#6b6f7a" : "#e9edf4";
  ctx.fillText(agent.name, x, deskTop + 40);

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x - 24, deskTop + 36, 3, 0, Math.PI * 2);
  ctx.fill();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  deskHitboxes = [];

  agents.forEach((agent, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const { x, y } = isoPos(col, row);
    drawFloorTile(x, y);
    drawDesk(x, y, agent);
    deskHitboxes.push({ agent, cx: x, cy: y, r: 46 });
  });

  renderStatBar();
}

function renderStatBar() {
  const busy = agents.filter((a) => a.status === "busy").length;
  const online = agents.filter((a) => a.status !== "offline").length;
  const tokens = agents.reduce((s, a) => s + a.tokens, 0);
  const cost = agents.reduce((s, a) => s + a.cost, 0);

  statBar.innerHTML = `
    <span>🏢 ${online} online</span>
    <span>⚡ ${busy} busy</span>
    <span>🔢 ${tokens.toLocaleString()} tokens</span>
    <span>💵 $${cost.toFixed(2)}</span>
  `;
}

function openPanel(agent) {
  const idleMinutes = Math.round(agent.lastActive / 60) || 0;
  panelBody.innerHTML = `
    <h3>${agent.name}</h3>
    <p class="status-pill status-${agent.status}">${STATUS_LABEL[agent.status]}</p>
    <dl>
      <dt>Tokens</dt><dd>${agent.tokens.toLocaleString()}</dd>
      <dt>Cost</dt><dd>$${agent.cost.toFixed(2)}</dd>
      <dt>Last active</dt><dd>${agent.lastActive}s ago (~${idleMinutes}m)</dd>
    </dl>
  `;
  panel.classList.add("open");
}

canvas.addEventListener("click", (ev) => {
  const rect = canvas.getBoundingClientRect();
  const mx = ev.clientX - rect.left;
  const my = ev.clientY - rect.top;
  const hit = deskHitboxes.find(
    (h) => Math.hypot(mx - h.cx, my - (h.cy + 10)) < h.r
  );
  if (hit) openPanel(hit.agent);
});

panelClose.addEventListener("click", () => panel.classList.remove("open"));

async function loadAgents() {
  const res = await fetch("sample-data/agents.json");
  agents = await res.json();
  render();
}

function tick() {
  // simulate the passage of time on lastActive so the demo feels alive
  agents.forEach((a) => {
    a.lastActive += 1;
  });
  render();
}

loadAgents().then(() => {
  setInterval(tick, 5000);
});
