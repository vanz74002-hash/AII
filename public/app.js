/* ============================================================
   QWEN NEXUS — APP CONTROLLER v4.2
   Upgraded by Kairo | Cybercrime Game Specialist
   ============================================================ */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// State Global
const state = {
    messages: [],
    busy: false,
    files: [],
    config: {
        access: "guest",
        chatHistory: false,
        googleLogin: false
    }
};

// --- UTILITIES ---

function toast(message, type = "info") {
    const el = $("#toast");
    if (!el) return;
    
    el.textContent = message;
    el.className = `toast show ${type}`;
    
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => {
        el.classList.remove("show");
    }, 3000);
}

async function api(path, options = {}) {
    try {
        const response = await fetch(path, {
            ...options,
            headers: {
                "content-type": "application/json",
                ...(options.headers || {})
            }
        });
        
        const data = await response.json().catch(() => ({}));
        
        if (!response.ok) {
            throw new Error(data.error || `Request failed (${response.status})`);
        }
        return data;
    } catch (err) {
        console.error("API Error:", err);
        throw err;
    }
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatMessage(text) {
    let safe = escapeHtml(text);
    
    // Code Blocks
    safe = safe.replace(/```([\w-]*)\n([\s\S]*?)```/g, (_, lang, code) => 
        `<pre><code class="language-${lang || 'text'}">${code}</code></pre>`
    );
    
    // Inline Code
    safe = safe.replace(/`([^`\n]+)`/g, "<code>$1</code>");
    
    // Bold
    safe = safe.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    
    // Line Breaks
    safe = safe.replace(/\n/g, "<br>");
    
    return safe;
}

// --- CORE FUNCTIONS ---

function enterApp() {
    const loginScreen = $("#loginScreen");
    const appShell = $("#app");
    
    if (loginScreen) loginScreen.classList.add("hidden");
    if (appShell) appShell.classList.remove("hidden");
    
    const input = $("#messageInput");
    if (input) input.focus();
    
    initSystemMonitor();
    toast("Welcome to QWEN NEXUS. Session Ephemeral.");
}

function clearMessages() {
    state.messages = [];
    const list = $("#messageList");
    const welcome = $("#welcome");
    
    if (list) {
        list.innerHTML = "";
        list.classList.remove("visible");
    }
    if (welcome) welcome.classList.remove("hidden");
}

function appendMessage(message) {
    const list = $("#messageList");
    const welcome = $("#welcome");
    
    if (!list) return;

    const item = document.createElement("article");
    item.className = `message ${message.role}`;
    
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const avatarChar = message.role === "assistant" ? "N" : "U";
    const name = message.role === "assistant" ? "QWEN NEXUS" : "YOU";
    
    item.innerHTML = `
        <div class="message-avatar">${avatarChar}</div>
        <div class="message-body">
            <div class="message-head">
                ${name}
                <time>${time}</time>
            </div>
            <div class="message-content">${formatMessage(message.content)}</div>
            ${message.role === "assistant" ? `
                <div class="message-actions">
                    <button data-copy aria-label="Copy text">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    </button>
                </div>
            ` : ""}
        </div>
    `;

    const copyBtn = item.querySelector("[data-copy]");
    if (copyBtn) {
        copyBtn.addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(message.content);
                toast("Response copied to clipboard.", "success");
            } catch {
                toast("Failed to copy.", "error");
            }
        });
    }

    list.appendChild(item);
    list.classList.add("visible");
    if (welcome) welcome.classList.add("hidden");
    
    list.scrollTop = list.scrollHeight;
}

async function sendMessage(content) {
    if (state.busy || !content.trim()) return;
    
    state.busy = true;
    const sendBtn = $("#sendBtn");
    if (sendBtn) sendBtn.disabled = true;

    state.messages.push({ role: "user", content });
    appendMessage({ role: "user", content });

    const list = $("#messageList");
    const loading = document.createElement("article");
    loading.className = "message assistant thinking";
    loading.id = "thinking-msg";
    loading.innerHTML = `
        <div class="message-avatar">N</div>
        <div class="message-body">
            <div class="message-head">QWEN NEXUS</div>
            <div class="message-content muted">
                Processing<span class="dots">...</span>
            </div>
        </div>
    `;
    if (list) list.appendChild(loading);

    try {
        const result = await api("/api/chat", {
            method: "POST",
            body: JSON.stringify({ 
                messages: state.messages.slice(-16)
            })
        });

        const loadingMsg = $("#thinking-msg");
        if (loadingMsg) loadingMsg.remove();

        const answer = result.response || "Model returned empty response.";
        
        state.messages.push({ role: "assistant", content: answer });
        appendMessage({ role: "assistant", content: answer });

    } catch (err) {
        const loadingMsg = $("#thinking-msg");
        if (loadingMsg) loadingMsg.remove();
        
        toast(err.message, "error");
        appendMessage({ 
            role: "assistant", 
            content: `⚠️ System Error: ${err.message}` 
        });
    } finally {
        state.busy = false;
        if (sendBtn) sendBtn.disabled = false;
        const input = $("#messageInput");
        if (input) input.focus();
    }
}

// --- VIEW SWITCHING ---

function switchView(viewName) {
    $$(".module-view").forEach(el => el.classList.remove("active"));
    
    const target = $(`#${viewName}View`);
    if (target) target.classList.add("active");

    $$(".nav-item").forEach(btn => {
        if (btn.dataset.view === viewName) {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });

    const titleMap = {
        "chat": "NEXUS CORE",
        "files": "LOCAL FILE LAB",
        "system": "SYSTEM MONITOR"
    };
    const titleEl = $("#viewTitle");
    if (titleEl) titleEl.textContent = titleMap[viewName] || "QWEN NEXUS";

    closeSidebar();
}

function closeSidebar() {
    const sidebar = $("#sidebar");
    const overlay = $(".sidebar-overlay");
    if (sidebar) sidebar.classList.remove("open");
    if (overlay) overlay.classList.remove("visible");
}

// --- SYSTEM MONITOR TELEMETRY ---

function initSystemMonitor() {
    // Update Clock
    setInterval(() => {
        const clock = $("#clock");
        if (clock) clock.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }, 1000);

    // Connection Status
    const connEl = $("#connectionStatus");
    if (connEl) {
        connEl.textContent = navigator.onLine ? "ONLINE" : "OFFLINE";
    }

    // Language
    const langEl = $("#deviceLanguage");
    if (langEl) {
        langEl.textContent = navigator.language || "ID";
    }

    // Screen Resolution
    const screenEl = $("#deviceScreen");
    if (screenEl) {
        screenEl.textContent = `${window.innerWidth}×${window.innerHeight}`;
    }

    // Hardware Info
    const memEl = $("#deviceMemory");
    const coreEl = $("#deviceCores");
    const platformEl = $("#devicePlatform");
    const uaEl = $("#deviceUA");

    if (memEl) memEl.textContent = navigator.deviceMemory ? `${navigator.deviceMemory} GB` : "N/A";
    if (coreEl) coreEl.textContent = navigator.hardwareConcurrency || "Unknown";
    if (platformEl) platformEl.textContent = navigator.platform || "Unknown";
    if (uaEl) uaEl.textContent = navigator.userAgent.split(" ").pop() || "Unknown";
}

// --- FILE VAULT LOGIC ---

function readableFile(file) {
    const ext = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "";
    const textTypes = ["txt", "lua", "js", "mjs", "ts", "json", "md", "py", "html", "css", "xml", "csv", "log", "yaml", "yml", "toml", "ini", "sh", "sql", "conf", "cfg"];
    
    return file.type.startsWith("text/") || textTypes.includes(ext) || (!ext && file.size < 150000);
}

async function handleFiles(fileList, isVault = false) {
    const files = [...fileList];
    if (!files.length) return;

    const tray = isVault ? $("#vaultList") : $("#attachmentTray");
    
    if (isVault && tray) {
        tray.innerHTML = "";
    }

    let totalSize = 0;
    const snippets = [];

    for (const file of files) {
        if (file.size > 10 * 1024 * 1024) {
            toast(`${file.name}: Exceeds 10MB limit.`, "error");
            continue;
        }

        if (isVault && tray) {
            const card = document.createElement("div");
            card.className = "file-card";
            card.innerHTML = `
                <div class="file-icon">${file.name.split(".").pop().toUpperCase()}</div>
                <div class="file-details">
                    <strong>${escapeHtml(file.name)}</strong>
                    <small>${(file.size / 1024).toFixed(1)} KB • Local Only</small>
                </div>
                <div class="file-actions">
                    <button onclick="this.closest('.file-card').remove()" aria-label="Remove">✕</button>
                </div>
            `;
            tray.appendChild(card);
        }

        if (readableFile(file) && file.size <= 250000) {
            try {
                const content = await file.text();
                const remain = Math.max(0, 18000 - totalSize);
                if (remain > 0) {
                    const part = content.slice(0, remain);
                    snippets.push(`FILE: ${file.name}\n\`\`\`\n${part}\n\`\`\``);
                    totalSize += part.length;
                }
            } catch (e) {
                console.warn("Failed to read file", file.name);
            }
        } else {
            snippets.push(`FILE: ${file.name} (Binary/Large - Metadata Only)`);
        }
    }

    if (!isVault && snippets.length) {
        const input = $("#messageInput");
        if (input) {
            input.value = `Analyze the following files:\n\n${snippets.join("\n\n")}\n\n`;
            input.dispatchEvent(new Event("input"));
            toast("Files loaded into context.", "success");
        }
    } else if (isVault) {
        toast(`${files.length} file(s) added to Vault.`, "success");
    }
}

// --- EVENT LISTENERS ---

document.addEventListener("DOMContentLoaded", () => {
    const enterBtn = $("#enterAppBtn");
    if (enterBtn) enterBtn.addEventListener("click", enterApp);

    const newChatBtn = $("#newChatBtn");
    if (newChatBtn) newChatBtn.addEventListener("click", () => {
        clearMessages();
        const input = $("#messageInput");
        if (input) input.focus();
        toast("New session started. History cleared.");
        closeSidebar();
    });

    const menuBtn = $("#menuBtn");
    const closeSidebarBtn = $("#closeSidebar");
    const overlay = $(".sidebar-overlay");

    if (menuBtn) menuBtn.addEventListener("click", () => {
        const sidebar = $("#sidebar");
        if (sidebar) sidebar.classList.add("open");
        if (overlay) overlay.classList.add("visible");
    });

    if (closeSidebarBtn) closeSidebarBtn.addEventListener("click", closeSidebar);
    if (overlay) overlay.addEventListener("click", closeSidebar);

    $$(".nav-item").forEach(btn => {
        btn.addEventListener("click", () => switchView(btn.dataset.view));
    });

    $$(".quick-module-card").forEach(card => {
        card.addEventListener("click", () => {
            const view = card.dataset.view;
            const prompt = card.dataset.prompt;
            
            if (view) {
                switchView(view);
            } else if (prompt) {
                switchView("chat");
                const input = $("#messageInput");
                if (input) {
                    input.value = prompt;
                    input.focus();
                }
            }
        });
    });

    const composer = $("#composer");
    if (composer) {
        composer.addEventListener("submit", async (event) => {
            event.preventDefault();
            const input = $("#messageInput");
            const content = input?.value.trim();
            if (!content) return;
            
            if (input) input.value = "";
            if (input) input.style.height = "auto";
            
            await sendMessage(content);
        });
    }

    const messageInput = $("#messageInput");
    if (messageInput) {
        messageInput.addEventListener("input", (event) => {
            event.target.style.height = "auto";
            event.target.style.height = `${Math.min(event.target.scrollHeight, 180)}px`;
        });
        
        messageInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                composer?.requestSubmit();
            }
        });
    }

    const fileInput = $("#fileInput");
    const vaultInput = $("#vaultInput");

    if (fileInput) {
        fileInput.addEventListener("change", async (event) => {
            await handleFiles(event.target.files, false);
            event.target.value = "";
        });
    }

    if (vaultInput) {
        vaultInput.addEventListener("change", async (event) => {
            await handleFiles(event.target.files, true);
            event.target.value = "";
        });
    }
});
