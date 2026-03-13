const logs = [];
let socket = null;
let activeId = null;

const wsInput = document.getElementById("ws-url");
const connectBtn = document.getElementById("connect-btn");
const statusPill = document.getElementById("status-pill");
const filterInput = document.getElementById("filter-input");
const clearBtn = document.getElementById("clear-btn");
const counter = document.getElementById("counter");
const rowsEl = document.getElementById("log-rows");
const detailsView = document.getElementById("details-view");

function setStatus(isConnected) {
  statusPill.textContent = isConnected ? "connected" : "disconnected";
  statusPill.classList.toggle("connected", isConnected);
  statusPill.classList.toggle("disconnected", !isConnected);
  connectBtn.textContent = isConnected ? "Disconnect" : "Connect";
}

function formatTime(epochMs) {
  return new Date(epochMs).toLocaleTimeString();
}

function addLog(payload) {
  logs.unshift(payload);
  if (logs.length > 1000) {
    logs.pop();
  }
  renderRows();
}

function getFilteredLogs() {
  const filterText = filterInput.value.trim().toLowerCase();
  if (!filterText) {
    return logs;
  }

  return logs.filter((log) => {
    return (
      String(log.method || "")
        .toLowerCase()
        .includes(filterText) ||
      String(log.url || "")
        .toLowerCase()
        .includes(filterText)
    );
  });
}

function renderRows() {
  const filtered = getFilteredLogs();
  counter.textContent = `${filtered.length} logs`;

  rowsEl.innerHTML = "";
  for (const log of filtered) {
    const tr = document.createElement("tr");
    if (log.id === activeId) {
      tr.classList.add("active");
    }

    const tTime = document.createElement("td");
    tTime.textContent = formatTime(log.timestamp);

    const tMethod = document.createElement("td");
    tMethod.textContent = String(log.method || "").toUpperCase();

    const tUrl = document.createElement("td");
    tUrl.textContent = log.url;

    tr.appendChild(tTime);
    tr.appendChild(tMethod);
    tr.appendChild(tUrl);

    tr.addEventListener("click", () => {
      activeId = log.id;
      detailsView.textContent = JSON.stringify(log, null, 2);
      renderRows();
    });

    rowsEl.appendChild(tr);
  }
}

function connect() {
  const url = wsInput.value.trim();
  if (!url) {
    return;
  }

  socket = new WebSocket(url);

  socket.addEventListener("open", () => {
    setStatus(true);
  });

  socket.addEventListener("close", () => {
    setStatus(false);
  });

  socket.addEventListener("error", () => {
    setStatus(false);
  });

  socket.addEventListener("message", (event) => {
    let parsed;
    try {
      parsed = JSON.parse(event.data);
    } catch {
      return;
    }

    if (parsed && parsed.type === "network.request.config" && parsed.payload) {
      addLog(parsed.payload);
    }
  });
}

function disconnect() {
  if (!socket) {
    return;
  }

  socket.close();
  socket = null;
  setStatus(false);
}

connectBtn.addEventListener("click", () => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    disconnect();
    return;
  }

  connect();
});

filterInput.addEventListener("input", () => {
  renderRows();
});

clearBtn.addEventListener("click", () => {
  logs.length = 0;
  activeId = null;
  detailsView.textContent = "Select a log row to inspect payload.";
  renderRows();
});

setStatus(false);
renderRows();
