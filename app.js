const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const tabs = document.getElementById("tabs");
const content = document.getElementById("content");

const searchBox = document.getElementById("searchBox");
const searchBtn = document.getElementById("searchBtn");
const errorOnly = document.getElementById("errorOnly");
const exportBtn = document.getElementById("exportBtn");

const massSearchBox = document.getElementById("massSearchBox");
const massSearchBtn = document.getElementById("massSearchBtn");
const replaceBtn = document.getElementById("replaceBtn");

let logs = {};
let activeLog = null;
const colors = ["#4caf50", "#2196f3", "#ff9800", "#e91e63", "#9c27b0", "#00bcd4", "#ffc107", "#8bc34a"];

// Virtual Scroll Ayarları
const LINE_HEIGHT = 20; // CSS'deki line-height ile uyumlu olmalı
let visibleLines = []; // O an filtrelenmiş/gösterilmeye hazır satırlar

/* =========================
   DRAG & DROP
========================= */
dropZone.addEventListener("dragover", e => {
    if (e.dataTransfer.types.includes("Files")) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add("dragover");
    }
});

dropZone.addEventListener("dragleave", e => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", e => {
    if (e.dataTransfer.types.includes("Files")) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove("dragover");
        if (e.dataTransfer.files.length) {
            [...e.dataTransfer.files].forEach(file => readFile(file));
        }
    }
});

fileInput.addEventListener("change", e => [...e.target.files].forEach(file => readFile(file)));

/* =========================
   LOG PROCESSES
========================= */
function readFile(file) {
    if (!file.name.match(/\.(log|txt)$/i)) {
        alert("Only .log and .txt files are supported!");
        return;
    }
    const reader = new FileReader();
    reader.onload = () => createLog(file.name, reader.result, colors[Object.keys(logs).length % colors.length]);
    reader.readAsText(file);
}

function createLog(name, text, color, isQueryTab = false) {
    if (logs[name] && !isQueryTab) {
        alert(`${name} file is already imported!`);
        return;
    }
    
    // Satırları bellek dostu şekilde sakla
    const lines = text ? text.split(/\r?\n/) : [];
    logs[name] = { name, color, lines, isQuery: isQueryTab };

    const tab = document.createElement("div");
    tab.className = "tab";
    tab.dataset.log = name;
    tab.style.borderBottom = `3px solid ${color}`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    if (isQueryTab) checkbox.style.display = "none";
    checkbox.onclick = e => e.stopPropagation();

    const label = document.createElement("span");
    label.textContent = name;
    label.style.flex = "1";

    const closeBtn = document.createElement("span");
    closeBtn.innerHTML = "&times;";
    closeBtn.style.cursor = "pointer";
    closeBtn.onclick = e => { e.stopPropagation(); closeLog(name); };

    tab.appendChild(checkbox); tab.appendChild(label); tab.appendChild(closeBtn);
    tab.addEventListener("click", () => openLog(name));
    tabs.appendChild(tab);

    if (!activeLog || isQueryTab) openLog(name);
}

function closeLog(name) {
    delete logs[name];
    [...tabs.children].find(t => t.dataset.log === name)?.remove();
    if (activeLog === name) {
        content.innerHTML = "";
        const remaining = Object.keys(logs).filter(k => k !== "Query");
        if (remaining.length > 0) openLog(remaining[0]);
        else activeLog = null;
    }
}

function openLog(name) {
    if (!logs[name]) return;
    activeLog = name;
    [...tabs.children].forEach(t => t.classList.toggle("active", t.dataset.log === name));
    
    // Filtreleme uygula ve sanal listeyi hazırla
    prepareVisibleLines();
}

function prepareVisibleLines(filteredLines = null) {
    if (!activeLog || !logs[activeLog]) return;
    
    const sourceLines = filteredLines || logs[activeLog].lines;
    const isErrorOnly = errorOnly.checked;
    
    // Ham veriyi işle (Hafıza için map/filter zincirini optimize ediyoruz)
    visibleLines = [];
    for (let i = 0; i < sourceLines.length; i++) {
        const lineText = sourceLines[i];
        if (isErrorOnly && !lineText.toLowerCase().includes("error")) continue;
        
        visibleLines.push({
            text: lineText,
            originalIndex: i,
            color: logs[activeLog].color,
            logName: logs[activeLog].name
        });
    }
    
    content.scrollTop = 0;
    renderVirtualScroll();
}

// Sanal Kaydırma Render Motoru
function renderVirtualScroll() {
    const scrollTop = content.scrollTop;
    const viewportHeight = content.clientHeight;
    
    const startIndex = Math.floor(scrollTop / LINE_HEIGHT);
    const endIndex = Math.min(visibleLines.length - 1, Math.ceil((scrollTop + viewportHeight) / LINE_HEIGHT));
    
    // Toplam yüksekliği simüle eden boş bir div oluştur
    const totalHeight = visibleLines.length * LINE_HEIGHT;
    
    content.innerHTML = `<div style="height: ${totalHeight}px; position: relative; width: 100%;"></div>`;
    const container = content.firstChild;

    const useColor = logs[activeLog].isQuery;

    for (let i = startIndex; i <= endIndex; i++) {
        const lineData = visibleLines[i];
        if (!lineData) continue;

        const row = document.createElement("div");
        row.className = "line";
        row.style.position = "absolute";
        row.style.top = `${i * LINE_HEIGHT}px`;
        row.style.height = `${LINE_HEIGHT}px`;
        row.style.width = "100%";
        
        const lineNumber = document.createElement("span");
        lineNumber.className = "line-number";
        lineNumber.textContent = (lineData.originalIndex + 1).toString();
        
        const logLine = document.createElement("span");
        logLine.className = "log-line";
        logLine.style.color = useColor ? lineData.color : '#ddd';
        logLine.textContent = useColor ? `[${lineData.logName}] ${lineData.text}` : lineData.text;
        
        row.appendChild(lineNumber);
        row.appendChild(logLine);
        container.appendChild(row);
    }
}

// Scroll olunca render'ı güncelle
content.addEventListener("scroll", renderVirtualScroll);

/* =========================
   SEARCH & REPLACE
========================= */
searchBtn.onclick = search;
searchBox.onkeydown = e => {
    if (e.key === "Enter") {
        e.preventDefault();
        search();
    }
};

function search() {
    if (!activeLog || logs[activeLog].isQuery) {
        alert("Please first select a log file!");
        return;
    }
    const term = searchBox.value.toLowerCase();
    
    if (term) {
        const filtered = logs[activeLog].lines.filter(l => l.toLowerCase().includes(term));
        prepareVisibleLines(filtered);
    } else {
        prepareVisibleLines();
    }
}

// Replace Fonksiyonu (Mantık korundu, data güncellendi)
replaceBtn.onclick = () => activeLog && showReplaceModal();

function showReplaceModal() {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);display:flex;justify-content:center;align-items:center;z-index:1000;";
    
    const initialFind = activeLog === "Query" ? massSearchBox.value : searchBox.value;
    const modal = document.createElement("div");
    modal.style.cssText = "background:#252526;padding:20px;border:1px solid #555;border-radius:5px;width:350px;display:flex;flex-direction:column;gap:15px;";
    modal.innerHTML = `
        <h3 style="margin:0;color:#fff;">Find & Replace</h3>
        <input type="text" id="modalFind" placeholder="Find..." value="${initialFind.replace(/"/g, '&quot;')}" style="padding:8px;background:#1e1e1e;color:#ddd;border:1px solid #555;">
        <input type="text" id="modalReplace" placeholder="Replace with..." style="padding:8px;background:#1e1e1e;color:#ddd;border:1px solid #555;">
        <div style="display:flex;justify-content:flex-end;gap:10px;">
            <button id="modalCancelBtn" style="padding:6px 12px;background:#444;color:#fff;border:none;cursor:pointer;">Cancel</button>
            <button id="modalDoReplaceBtn" style="padding:6px 12px;background:#444;color:#fff;border:1px solid #555;cursor:pointer;">Replace All</button>
        </div>`;

    document.body.appendChild(overlay); 
    overlay.appendChild(modal);

    const fInput = document.getElementById("modalFind");
    const rInput = document.getElementById("modalReplace");
    fInput.focus();
    
    const doReplace = () => {
        const findText = fInput.value;
        const replaceText = rInput.value;
        if (!findText) {
            alert("Please enter the word will be searched!");
            return;
        }

        const targetLogNames = activeLog === "Query" 
            ? [...tabs.children].filter(t => t.querySelector("input")?.checked).map(t => t.dataset.log)
            : [activeLog];

        if (targetLogNames.length === 0) {
            alert("The log file which will be replaced is not selected!");
            return;
        }

        targetLogNames.forEach(name => {
            if (logs[name] && !logs[name].isQuery) {
                logs[name].lines = logs[name].lines.map(line => line.split(findText).join(replaceText));
            }
        });

        if (activeLog === "Query") massSearch();
        else prepareVisibleLines();
        
        overlay.remove();
        alert("Replacing is completed!");
    };

    fInput.addEventListener("keydown", e => { if (e.key === "Enter") doReplace(); });
    rInput.addEventListener("keydown", e => { if (e.key === "Enter") doReplace(); });
    document.getElementById("modalDoReplaceBtn").addEventListener("click", doReplace);
    document.getElementById("modalCancelBtn").addEventListener("click", () => overlay.remove());
}

massSearchBtn.onclick = massSearch;
massSearchBox.onkeydown = e => {
    if (e.key === "Enter") {
        e.preventDefault();
        massSearch();
    }
};

function massSearch() {
    const term = massSearchBox.value.toLowerCase();
    if (!term) {
        alert("Please enter a word!");
        return;
    }
    
    const checkedLogs = [...tabs.children]
        .filter(tab => {
            const checkbox = tab.querySelector("input");
            return checkbox?.checked && tab.dataset.log !== "Query";
        })
        .map(tab => tab.dataset.log);
    
    if (checkedLogs.length === 0) {
        alert("Please check at least one log file!");
        return;
    }
    
    if (!logs["Query"]) createLog("Query", "", "#ffffff", true);
    
    activeLog = "Query";
    [...tabs.children].forEach(t => t.classList.toggle("active", t.dataset.log === "Query"));
    
    visibleLines = [];
    const isErrorOnly = errorOnly.checked;

    checkedLogs.forEach(logName => {
        const log = logs[logName];
        if (!log) return;
        
        log.lines.forEach((line, i) => {
            if (line.toLowerCase().includes(term)) {
                if (isErrorOnly && !line.toLowerCase().includes("error")) return;
                visibleLines.push({
                    text: line,
                    originalIndex: i,
                    color: log.color,
                    logName: log.name
                });
            }
        });
    });
    
    content.scrollTop = 0;
    renderVirtualScroll();

    if (visibleLines.length === 0) {
        content.innerHTML = "<div style='padding:20px;text-align:center;color:#777;'>No result found.</div>";
    }
}

errorOnly.addEventListener("change", () => {
    if (!activeLog) return;
    if (activeLog === "Query") massSearch();
    else search();
});

exportBtn.onclick = () => {
    // Görünür olan (filtrelenmiş) satırları dışa aktar
    if (visibleLines.length === 0) {
        alert("Export edilecek içerik bulunamadı!");
        return;
    }
    const textToExport = visibleLines.map(l => l.text).join('\n');
    const blob = new Blob([textToExport], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = activeLog ? `${activeLog}_export.log` : "export.log";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};