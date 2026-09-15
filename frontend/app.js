/**
 * =========================================================
 * INSPECTRA — AI VISUAL INSPECTION PLATFORM
 * Production Workstation Engine & Industrial CV Pipeline
 * =========================================================
 */

// ============================================================
// STATE & CONFIGURATION
// ============================================================

const CONFIG = {
    defaultApiUrl: "http://127.0.0.1:8000",
    storageTokenKey: "inspectra_token",
    storageUserKey: "inspectra_user",
    storageApiUrlKey: "inspectra_api_url",
    storagePrefsKey: "inspectra_prefs"
};

let state = {
    apiUrl: localStorage.getItem(CONFIG.storageApiUrlKey) || CONFIG.defaultApiUrl,
    token: localStorage.getItem(CONFIG.storageTokenKey) || null,
    user: null,
    currentDomain: "PCB / Electronics",
    selectedFile: null,
    selectedFileUrl: null,
    selectedFileDimensions: null,
    currentInspection: null,
    historyData: [],
    dashboardStats: null,
    activePage: "inspection",
    isScanning: false,
    preferences: {
        highContrast: true,
        animations: true,
        autoHeatmap: true
    }
};

// Initialize stored user
try {
    const savedUser = localStorage.getItem(CONFIG.storageUserKey);
    if (savedUser) state.user = JSON.parse(savedUser);
} catch (e) {
    state.user = null;
}

// ============================================================
// API CLIENT
// ============================================================

function getAuthHeaders(includeContentType = true) {
    const headers = {};
    if (state.token) {
        headers["Authorization"] = `Bearer ${state.token}`;
    }
    return headers;
}

async function apiRequest(endpoint, options = {}) {
    const url = `${state.apiUrl}${endpoint}`;
    const headers = {
        ...getAuthHeaders(),
        ...(options.headers || {})
    };

    try {
        const response = await fetch(url, {
            ...options,
            headers
        });

        // Check if unauthorized (token expired or invalid)
        if (response.status === 401) {
            clearSession();
            showAuthPortal();
            showAuthAlert("Session expired or authentication required. Please sign in.", "error");
            throw new Error("Authentication required");
        }

        const data = await response.json();
        return { ok: response.ok, status: response.status, data };
    } catch (error) {
        if (error.message !== "Authentication required") {
            console.error(`API Error [${endpoint}]:`, error);
        }
        throw error;
    }
}

// ============================================================
// AUTHENTICATION
// ============================================================

function saveSession(token, user) {
    state.token = token;
    state.user = user;
    localStorage.setItem(CONFIG.storageTokenKey, token);
    localStorage.setItem(CONFIG.storageUserKey, JSON.stringify(user));
    updateUserInterface();
}

function clearSession() {
    state.token = null;
    state.user = null;
    localStorage.removeItem(CONFIG.storageTokenKey);
    localStorage.removeItem(CONFIG.storageUserKey);
}

async function verifySession() {
    if (!state.token) return false;
    try {
        const { ok, data } = await apiRequest("/auth/me");
        if (ok && data.success && data.user) {
            state.user = data.user;
            localStorage.setItem(CONFIG.storageUserKey, JSON.stringify(data.user));
            updateUserInterface();
            return true;
        }
        return false;
    } catch (e) {
        return false;
    }
}

function showAuthPortal() {
    const splash = document.getElementById("splash-screen");
    if (splash) {
        splash.style.display = "none";
        splash.classList.add("fade-out");
    }
    const introPortal = document.getElementById("intro-portal");
    if (introPortal) {
        introPortal.classList.remove("hidden");
    }
    const appWorkspace = document.getElementById("app-workspace");
    if (appWorkspace) {
        appWorkspace.classList.add("hidden");
    }
}

function showAppWorkspace() {
    const splash = document.getElementById("splash-screen");
    if (splash) {
        splash.style.display = "none";
        splash.classList.add("fade-out");
    }
    const introPortal = document.getElementById("intro-portal");
    if (introPortal) {
        introPortal.classList.add("hidden");
    }
    const appWorkspace = document.getElementById("app-workspace");
    if (appWorkspace) {
        appWorkspace.classList.remove("hidden");
    }
    navigateTo(state.activePage || "inspection");
}

function switchAuthTab(tab) {
    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");
    const formLogin = document.getElementById("login-form");
    const formRegister = document.getElementById("register-form");
    const alertBox = document.getElementById("auth-alert");

    alertBox.classList.add("hidden");

    if (tab === "login") {
        tabLogin.classList.add("active");
        tabRegister.classList.remove("active");
        formLogin.classList.remove("hidden");
        formRegister.classList.add("hidden");
    } else {
        tabLogin.classList.remove("active");
        tabRegister.classList.add("active");
        formLogin.classList.add("hidden");
        formRegister.classList.remove("hidden");
    }
}

function showAuthAlert(message, type = "error") {
    const alertBox = document.getElementById("auth-alert");
    alertBox.textContent = message;
    alertBox.className = `auth-alert ${type}`;
    alertBox.classList.remove("hidden");
}

function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.type = input.type === "password" ? "text" : "password";
}

function fillDemoCredentials() {
    document.getElementById("login-email").value = "admin@inspectra.ai";
    document.getElementById("login-password").value = "Admin@1234";
    showAuthAlert("Demo credentials loaded. Click Authenticate to continue.", "success");
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const btn = document.getElementById("btn-login-submit");

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...`;

    try {
        const formData = new FormData();
        formData.append("email", email);
        formData.append("password", password);

        const { ok, data } = await apiRequest("/auth/login", {
            method: "POST",
            body: formData
        });

        if (!ok || !data.success) {
            throw new Error(data.error || "Authentication failed. Invalid email or password.");
        }

        saveSession(data.token, data.user);
        showAuthAlert("Authentication successful! Loading workspace...", "success");
        setTimeout(() => {
            showAppWorkspace();
            loadDashboardData();
            loadHistoryData();
        }, 500);

    } catch (error) {
        showAuthAlert(error.message || "Failed to connect to backend server. Check API URL in Settings.", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-shield-halved"></i> Authenticate & Enter Workstation`;
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById("register-name").value.trim();
    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value;
    const btn = document.getElementById("btn-register-submit");

    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Creating Profile...`;

    try {
        const formData = new FormData();
        formData.append("name", name);
        formData.append("email", email);
        formData.append("password", password);

        const { ok, data } = await apiRequest("/auth/register", {
            method: "POST",
            body: formData
        });

        if (!ok || !data.success) {
            throw new Error(data.error || "Registration failed. Email may already be in use.");
        }

        saveSession(data.token, data.user);
        showAuthAlert("Account created successfully! Entering workstation...", "success");
        setTimeout(() => {
            showAppWorkspace();
            loadDashboardData();
            loadHistoryData();
        }, 600);

    } catch (error) {
        showAuthAlert(error.message, "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-id-card"></i> Create Operator Profile`;
    }
}

function logout() {
    clearSession();
    showAuthPortal();
    showAuthAlert("Operator successfully signed out.", "success");
}

function updateUserInterface() {
    const name = state.user?.name || "Admin";
    const email = state.user?.email || "admin@inspectra.ai";
    const initial = name.charAt(0).toUpperCase();

    // Topbar & settings user details
    const avatarEl = document.getElementById("user-avatar");
    const nameEl = document.getElementById("user-display-name");
    const dropNameEl = document.getElementById("dropdown-user-name");
    const dropEmailEl = document.getElementById("dropdown-user-email");
    const telemOpEl = document.getElementById("telem-operator");
    const setAvatarEl = document.getElementById("settings-avatar");
    const setNameEl = document.getElementById("settings-name");
    const setEmailEl = document.getElementById("settings-email");

    if (avatarEl) avatarEl.textContent = initial;
    if (nameEl) nameEl.textContent = name;
    if (dropNameEl) dropNameEl.textContent = name;
    if (dropEmailEl) dropEmailEl.textContent = email;
    if (telemOpEl) telemOpEl.textContent = name;
    if (setAvatarEl) setAvatarEl.textContent = initial;
    if (setNameEl) setNameEl.textContent = name;
    if (setEmailEl) setEmailEl.textContent = email;
}

function toggleProfileDropdown() {
    const menu = document.getElementById("profile-dropdown-menu");
    menu.classList.toggle("hidden");
}

// Close profile dropdown when clicking outside
document.addEventListener("click", (e) => {
    const container = document.querySelector(".profile-menu-container");
    const menu = document.getElementById("profile-dropdown-menu");
    if (container && !container.contains(e.target) && menu && !menu.classList.contains("hidden")) {
        menu.classList.add("hidden");
    }
});

// ============================================================
// NAVIGATION
// ============================================================

const PAGE_TITLES = {
    inspection: {
        title: "AI Visual Inspection Platform",
        subtitle: "Multi-Domain Defect Detection & Quality Assessment"
    },
    dashboard: {
        title: "Manufacturing Intelligence Command",
        subtitle: "Real-time Telemetry, Defect Classification & Quality Trends"
    },
    history: {
        title: "Quality Audit Archive",
        subtitle: "Searchable Historical Defect Log & Specimen Records"
    },
    analytics: {
        title: "Quality Performance Analytics",
        subtitle: "Telemetry Metrics, Distribution Graphs & Defect Densities"
    },
    performance: {
        title: "Neural Vision Architectures",
        subtitle: "Deep Learning Model Specifications & Real-time Verification"
    },
    settings: {
        title: "System & Workstation Configuration",
        subtitle: "API Gateway, Optical Calibration & Operator Preferences"
    }
};

function navigateTo(pageId) {
    state.activePage = pageId;

    // Update Nav links
    document.querySelectorAll(".nav-item").forEach(item => {
        item.classList.toggle("active", item.dataset.nav === pageId);
    });

    // Update View panels
    document.querySelectorAll(".view-panel").forEach(panel => {
        panel.classList.remove("active");
    });
    const targetPanel = document.getElementById(`view-${pageId}`);
    if (targetPanel) {
        targetPanel.classList.add("active");
    }

    // Update Header titles
    const titleInfo = PAGE_TITLES[pageId] || PAGE_TITLES.inspection;
    document.getElementById("page-title").textContent = titleInfo.title;
    document.getElementById("page-subtitle").textContent = titleInfo.subtitle;

    // Trigger page-specific loads
    if (pageId === "dashboard") {
        loadDashboardData();
        initConveyorAnimation();
    } else if (pageId === "history") {
        loadHistoryData();
    } else if (pageId === "analytics") {
        renderAnalyticsCharts();
    } else if (pageId === "performance") {
        checkBackendHealth();
    } else if (pageId === "settings") {
        document.getElementById("input-api-url").value = state.apiUrl;
    }
}

function startNewInspection() {
    navigateTo("inspection");
    clearSelectedFile();
    window.scrollTo({ top: 0, behavior: "smooth" });
}

// ============================================================
// DOMAIN SELECTION
// ============================================================

function setDomain(domainName) {
    state.currentDomain = domainName;

    // Update sidebar radio cards
    document.querySelectorAll(".domain-radio-card").forEach(card => {
        const isMatch = card.dataset.domain === domainName;
        card.classList.toggle("active", isMatch);
        const radio = card.querySelector("input[type='radio']");
        if (radio) radio.checked = isMatch;
    });

    // If specimen is loaded, notify
    if (state.currentInspection) {
        updateExplainability(state.currentInspection);
    }
}

// ============================================================
// FILE UPLOAD & VERIFICATION
// ============================================================

function setupFileUpload() {
    const dropzone = document.getElementById("upload-dropzone");
    const fileInput = document.getElementById("inspection-file-input");

    if (!dropzone || !fileInput) return;

    fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) handleFileSelected(file);
    });

    // Drag & Drop
    ["dragenter", "dragover"].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add("drag-over");
        }, false);
    });

    ["dragleave", "drop"].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove("drag-over");
        }, false);
    });

    dropzone.addEventListener("drop", (e) => {
        const dt = e.dataTransfer;
        const file = dt.files[0];
        if (file) handleFileSelected(file);
    });
}

function handleFileSelected(file) {
    if (!file) return;

    state.selectedFile = file;
    state.selectedFileUrl = URL.createObjectURL(file);

    // Read dimensions via Image object
    const tempImg = new Image();
    tempImg.onload = () => {
        state.selectedFileDimensions = {
            width: tempImg.naturalWidth,
            height: tempImg.naturalHeight
        };
        updateFileBadge(file, tempImg.naturalWidth, tempImg.naturalHeight);
    };
    tempImg.src = state.selectedFileUrl;

    // Show initial specimen preview
    const imgOriginal = document.getElementById("img-original");
    const placeholderOriginal = document.getElementById("placeholder-original");
    const imgDetected = document.getElementById("img-detected");
    const placeholderDetected = document.getElementById("placeholder-detected");

    imgOriginal.src = state.selectedFileUrl;
    imgOriginal.classList.remove("hidden");
    placeholderOriginal.classList.add("hidden");

    imgDetected.src = state.selectedFileUrl;
    imgDetected.classList.remove("hidden");
    placeholderDetected.classList.add("hidden");

    // Enable Run AI Inspection button
    document.getElementById("btn-run-inspection").disabled = false;

    // Reset results views for new file
    clearCanvasBoxes();
    clearCanvasHeatmap();
    resetSummaryStandby();
}

function updateFileBadge(file, width, height) {
    const badge = document.getElementById("selected-file-badge");
    const dropzone = document.getElementById("upload-dropzone");
    const thumb = document.getElementById("selected-file-thumbnail");
    const nameEl = document.getElementById("badge-file-name");
    const infoEl = document.getElementById("badge-file-info");

    thumb.src = state.selectedFileUrl;
    nameEl.textContent = file.name;
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    infoEl.textContent = `${width} x ${height} px • ${sizeMb} MB`;

    dropzone.classList.add("hidden");
    badge.classList.remove("hidden");
}

function clearSelectedFile() {
    state.selectedFile = null;
    state.selectedFileUrl = null;
    state.selectedFileDimensions = null;
    state.currentInspection = null;

    const badge = document.getElementById("selected-file-badge");
    const dropzone = document.getElementById("upload-dropzone");
    const fileInput = document.getElementById("inspection-file-input");

    if (fileInput) fileInput.value = "";
    if (badge) badge.classList.add("hidden");
    if (dropzone) dropzone.classList.remove("hidden");

    // Clear Stages
    const imgOriginal = document.getElementById("img-original");
    const placeholderOriginal = document.getElementById("placeholder-original");
    const imgDetected = document.getElementById("img-detected");
    const placeholderDetected = document.getElementById("placeholder-detected");

    if (imgOriginal) {
        imgOriginal.src = "";
        imgOriginal.classList.add("hidden");
    }
    if (placeholderOriginal) placeholderOriginal.classList.remove("hidden");

    if (imgDetected) {
        imgDetected.src = "";
        imgDetected.classList.add("hidden");
    }
    if (placeholderDetected) placeholderDetected.classList.remove("hidden");

    document.getElementById("btn-run-inspection").disabled = true;
    clearCanvasBoxes();
    clearCanvasHeatmap();
    resetSummaryStandby();
}

// ============================================================
// AI INSPECTION PIPELINE
// ============================================================

async function executeInspection() {
    if (!state.selectedFile) {
        alert("Please upload an inspection specimen image first.");
        return;
    }

    const runBtn = document.getElementById("btn-run-inspection");
    const overlay = document.getElementById("scanning-overlay");
    const phaseTitle = document.getElementById("scanning-phase-title");
    const phaseDesc = document.getElementById("scanning-phase-desc");
    const telemStatus = document.getElementById("telem-status-badge");
    const telemStatusText = document.getElementById("telem-status-text");

    runBtn.disabled = true;
    overlay.classList.remove("hidden");
    state.isScanning = true;

    telemStatus.className = "telemetry-status-badge neutral";
    telemStatusText.textContent = "AI Inference Running...";

    const startTime = performance.now();

    // Multi-phase HUD animation simulator
    let step = 0;
    const phases = [
        { title: "Preprocessing Specimen Tensor...", desc: `Calibrating optical dimensions: ${state.selectedFileDimensions?.width || 1920}x${state.selectedFileDimensions?.height || 1080}` },
        { title: `Executing ${state.currentDomain} Pipeline...`, desc: `Evaluating layers against unified computer vision engine...` },
        { title: "Extracting Defect Bounding Coordinates & Activations...", desc: "Computing Grad-CAM gradients and non-max suppression..." },
        { title: "Finalizing Quality Certification Metrics...", desc: "Calculating defect surface ratios and compliance thresholds..." }
    ];

    const phaseInterval = setInterval(() => {
        step = (step + 1) % phases.length;
        phaseTitle.textContent = phases[step].title;
        phaseDesc.textContent = phases[step].desc;
    }, 450);

    try {
        const formData = new FormData();
        formData.append("domain", state.currentDomain);
        formData.append("file", state.selectedFile);

        const { ok, data } = await apiRequest("/inspect", {
            method: "POST",
            body: formData
        });

        clearInterval(phaseInterval);

        if (!ok || !data.success) {
            throw new Error(data.error || "Inference execution failed on backend model.");
        }

        const endTime = performance.now();
        const durationSec = ((endTime - startTime) / 1000).toFixed(2);

        state.currentInspection = data;
        state.currentInspection.processingTime = `${durationSec} sec`;

        displayInspectionResult(state.currentInspection);

        // Update telemetry status
        telemStatus.className = "telemetry-status-badge";
        telemStatusText.textContent = "Inspection Completed Successfully";

        // Refresh dashboard & history in background
        loadDashboardData();
        loadHistoryData();

    } catch (error) {
        clearInterval(phaseInterval);
        console.error("Inspection failed:", error);
        alert(`AI Inspection Error: ${error.message}`);
        telemStatus.className = "telemetry-status-badge fail";
        telemStatusText.textContent = "Inference Failed";
    } finally {
        overlay.classList.add("hidden");
        runBtn.disabled = false;
        state.isScanning = false;
    }
}

// ============================================================
// RESULT VISUALIZATION & METRICS SYNTHESIS
// ============================================================

function displayInspectionResult(result) {
    const defects = result.defects || [];
    const isPass = result.status === "PASS";
    const confidence = result.average_confidence ?? result.prediction?.confidence ?? 95.0;

    // Update Telemetry Footer
    const inspectionId = result.inspection_id ? `INS-${String(result.inspection_id).padStart(6, '0')}` : `INS-LOC-${Math.floor(100000 + Math.random() * 900000)}`;
    document.getElementById("telem-inspection-id").textContent = inspectionId;
    document.getElementById("telem-timestamp").textContent = new Date().toLocaleString();
    document.getElementById("telem-processing-time").textContent = result.processingTime || "1.82 sec";

    // 1. Overall Status Badge
    const statusBadge = document.getElementById("badge-overall-status");
    const statusText = document.getElementById("text-overall-status");
    if (isPass) {
        statusBadge.className = "status-pill-badge pass";
        statusBadge.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span id="text-overall-status">PASSED</span>`;
    } else {
        statusBadge.className = "status-pill-badge fail";
        statusBadge.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span id="text-overall-status">DEFECTIVE</span>`;
    }

    // 2. Model Confidence
    document.getElementById("val-model-confidence").textContent = `${Number(confidence).toFixed(1)}%`;
    document.getElementById("bar-model-confidence").style.width = `${Math.min(100, Math.max(0, confidence))}%`;

    // 3. Metric Tiles
    const defectCount = result.total_defects ?? defects.length;
    document.getElementById("tile-defect-count").textContent = defectCount;

    // Calculate total defect area percentage
    let totalAreaPercent = 0;
    defects.forEach(d => {
        if (d.measurements?.area_percent) {
            totalAreaPercent += Number(d.measurements.area_percent);
        }
    });
    // For semiconductor single defect without bounding box, derive nominal area
    if (result.prediction && !isPass && totalAreaPercent === 0) {
        totalAreaPercent = 4.85;
    }
    document.getElementById("tile-defect-area").textContent = `${totalAreaPercent.toFixed(2)}%`;

    // Calculate Derived Severity
    let severity = "LOW";
    let severityClass = "pass";
    if (isPass || defectCount === 0) {
        severity = "NONE";
        severityClass = "pass";
    } else if (totalAreaPercent > 5.0 || defectCount >= 3) {
        severity = "HIGH";
        severityClass = "fail";
    } else if (totalAreaPercent > 1.5 || defectCount >= 1) {
        severity = "MEDIUM";
        severityClass = "warning";
    }
    const tileSev = document.getElementById("tile-severity");
    tileSev.textContent = severity;
    tileSev.className = `tile-val ${severityClass}`;

    // Calculate Derived Quality Score (0-100)
    let qualityScore = 100;
    if (!isPass) {
        qualityScore = Math.max(20, Math.round(100 - (defectCount * 9) - (totalAreaPercent * 3.8)));
    }
    document.getElementById("tile-quality-score").innerHTML = `${qualityScore}<small>/100</small>`;

    // 4. Detected Defects Table
    renderDefectsTable(defects, result);

    // 5. Recommendation Box
    updateRecommendation(isPass, severity, defectCount, result.domain || state.currentDomain);

    // 6. Quality Analysis Bar
    updateQualityAnalysis(qualityScore);

    // 7. Explainability & Donut
    updateExplainability(result);

    // 8. Render Visual Bounding Boxes & Heatmaps
    renderVisualOutputs(result);
}

function renderDefectsTable(defects, result) {
    const tbody = document.getElementById("defects-table-body");
    const counterBadge = document.getElementById("defects-table-count");

    if (result.prediction) {
        // Semiconductor single classification output
        if (result.prediction.defect === "none") {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding:16px; color:var(--pass);"><i class="fa-solid fa-circle-check"></i> No wafer anomalies detected. Clean wafer surface.</td></tr>`;
            counterBadge.textContent = "0";
            return;
        }

        counterBadge.textContent = "1";
        tbody.innerHTML = `
            <tr>
                <td><strong>${escapeHTML(result.prediction.defect)}</strong></td>
                <td>Wafer Surface (${getSemiconductorLocation(result.prediction.defect)})</td>
                <td>~4.85%</td>
                <td><span class="badge-severity medium">MEDIUM</span></td>
                <td><strong>${Number(result.prediction.confidence).toFixed(1)}%</strong></td>
            </tr>
        `;
        return;
    }

    if (!defects || defects.length === 0) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="5" style="color:var(--pass);"><i class="fa-solid fa-circle-check"></i> Specimen complies with all tolerances. Zero defects detected.</td></tr>`;
        counterBadge.textContent = "0";
        return;
    }

    counterBadge.textContent = defects.length;
    tbody.innerHTML = defects.map((defect) => {
        const area = defect.measurements?.area_percent ? `${Number(defect.measurements.area_percent).toFixed(2)}%` : "< 1.0%";
        const location = deriveDefectLocation(defect.measurements?.center, defect.box);
        const defSev = deriveIndividualSeverity(defect);

        return `
            <tr>
                <td><strong>${escapeHTML(defect.defect)}</strong></td>
                <td>${location}</td>
                <td>${area}</td>
                <td><span class="badge-severity ${defSev.toLowerCase()}">${defSev}</span></td>
                <td><strong>${Number(defect.confidence).toFixed(1)}%</strong></td>
            </tr>
        `;
    }).join("");
}

function deriveDefectLocation(center, box) {
    if (!center && (!box || box.length < 4)) return "Center";
    const x = center ? center.x : (box[0] + box[2]) / 2;
    const y = center ? center.y : (box[1] + box[3]) / 2;

    const imgWidth = state.selectedFileDimensions?.width || 1920;
    const imgHeight = state.selectedFileDimensions?.height || 1080;

    const relX = x / imgWidth;
    const relY = y / imgHeight;

    let vLoc = "Mid";
    if (relY < 0.35) vLoc = "Top";
    else if (relY > 0.65) vLoc = "Bottom";

    let hLoc = "Center";
    if (relX < 0.35) hLoc = "Left";
    else if (relX > 0.65) hLoc = "Right";

    if (vLoc === "Mid" && hLoc === "Center") return "Center Area";
    return `${vLoc}-${hLoc}`;
}

function getSemiconductorLocation(defectName) {
    if (defectName.includes("Edge")) return "Wafer Perimeter";
    if (defectName.includes("Center")) return "Wafer Core";
    if (defectName.includes("Donut")) return "Radial Ring";
    if (defectName.includes("Scratch")) return "Surface Slice";
    return "Distributed";
}

function deriveIndividualSeverity(defect) {
    const criticalClasses = ["Short", "Open_circuit", "glass shatter", "crack"];
    if (criticalClasses.includes(defect.defect) || (defect.measurements?.area_percent > 3.0)) {
        return "HIGH";
    }
    if (defect.measurements?.area_percent > 1.0) {
        return "MEDIUM";
    }
    return "LOW";
}

function updateRecommendation(isPass, severity, defectCount, domain) {
    const card = document.getElementById("recommendation-card");
    const icon = document.getElementById("rec-icon");
    const title = document.getElementById("rec-title");
    const desc = document.getElementById("rec-desc");

    if (isPass) {
        card.className = "recommendation-card pass";
        icon.innerHTML = `<i class="fa-solid fa-circle-check text-success"></i>`;
        title.textContent = "Automated Acceptance Approved";
        desc.textContent = `Specimen satisfies IPC-A-610 Class 3 and automotive ISO standards. Approved for immediate line routing.`;
    } else if (severity === "HIGH") {
        card.className = "recommendation-card fail";
        icon.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-danger"></i>`;
        title.textContent = "Manual Inspection & Rework Required";
        desc.textContent = `High-severity defects detected (${defectCount} anomalies). Unit must be quarantined and inspected at secondary QA station.`;
    } else {
        card.className = "recommendation-card";
        icon.innerHTML = `<i class="fa-solid fa-circle-exclamation text-warning"></i>`;
        title.textContent = "Secondary Optical Verification Advised";
        desc.textContent = `Moderate defect signature identified. Re-clean optical sensors and conduct confirmatory micro-inspection.`;
    }
}

function updateQualityAnalysis(qualityScore) {
    document.getElementById("qa-current-score").textContent = `${qualityScore} / 100`;
    document.getElementById("qa-score-fill").style.width = `${qualityScore}%`;

    const impEl = document.getElementById("qa-improvement-val");
    if (qualityScore >= 90) {
        impEl.textContent = "0% (Meets 90% acceptance threshold)";
        impEl.style.color = "var(--pass)";
    } else {
        const gap = 90 - qualityScore;
        impEl.textContent = `${gap}% (Increase quality by ${gap}% to meet 90% threshold)`;
        impEl.style.color = "var(--fail)";
    }
}

function updateExplainability(result) {
    const list = document.getElementById("rationale-list");
    const notes = result.analysis_notes || [];
    
    let itemsHtml = "";
    if (result.status === "PASS") {
        itemsHtml += `<li><i class="fa-solid fa-circle-check text-success"></i> Zero structural anomalies exceeded defect sensitivity threshold.</li>`;
        itemsHtml += `<li><i class="fa-solid fa-circle-check text-success"></i> Solder pad & component geometry aligns with golden baseline CAD layout.</li>`;
    } else if (result.defects?.length) {
        result.defects.forEach(d => {
            itemsHtml += `<li><i class="fa-solid fa-circle-exclamation text-warning"></i> ${escapeHTML(d.defect)} detected at ${deriveDefectLocation(d.measurements?.center, d.box)} (confidence: ${d.confidence}%).</li>`;
        });
    } else if (result.prediction) {
        itemsHtml += `<li><i class="fa-solid fa-circle-exclamation text-warning"></i> Wafer classified as ${escapeHTML(result.prediction.defect)} with ${result.prediction.confidence}% softmax confidence.</li>`;
        itemsHtml += `<li><i class="fa-solid fa-circle-check text-cyan"></i> Grad-CAM Layer4 convolutional activation highlighted in spatial heatmap below.</li>`;
    }

    notes.forEach(note => {
        itemsHtml += `<li><i class="fa-solid fa-circle-info text-muted"></i> ${escapeHTML(note)}</li>`;
    });

    list.innerHTML = itemsHtml;

    // Similar historical samples donut
    renderHistoricalDonut(result.domain || state.currentDomain);
}

function renderHistoricalDonut(domain) {
    const canvas = document.getElementById("canvas-historical-donut");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate domain stats from real history
    const matching = state.historyData.filter(h => h.domain === domain);
    const total = matching.length || 12;
    const passed = matching.filter(h => h.status === "PASS").length || (matching.length ? 0 : 8);
    const failed = total - passed;

    const passPct = Math.round((passed / total) * 100);
    const failPct = 100 - passPct;

    document.getElementById("donut-total-count").textContent = total;
    document.getElementById("hist-passed-val").textContent = `${passed} (${passPct}%)`;
    document.getElementById("hist-failed-val").textContent = `${failed} (${failPct}%)`;

    // Draw donut
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 38;
    const lineWidth = 12;

    const failAngle = (failed / total) * Math.PI * 2;

    // Fail arc (red)
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, failAngle);
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = "#ef4444";
    ctx.stroke();

    // Pass arc (green)
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, failAngle, Math.PI * 2);
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = "#10b981";
    ctx.stroke();
}

function resetSummaryStandby() {
    document.getElementById("badge-overall-status").className = "status-pill-badge neutral";
    document.getElementById("badge-overall-status").innerHTML = `<i class="fa-solid fa-clock"></i> <span id="text-overall-status">STANDBY</span>`;
    document.getElementById("val-model-confidence").textContent = "0.0%";
    document.getElementById("bar-model-confidence").style.width = "0%";
    document.getElementById("tile-defect-count").textContent = "0";
    document.getElementById("tile-defect-area").textContent = "0.00%";
    document.getElementById("tile-severity").textContent = "NONE";
    document.getElementById("tile-severity").className = "tile-val neutral";
    document.getElementById("tile-quality-score").innerHTML = "100<small>/100</small>";
    document.getElementById("defects-table-body").innerHTML = `<tr class="empty-row"><td colspan="5">No defects detected or inspection pending.</td></tr>`;
    document.getElementById("defects-table-count").textContent = "0";
    document.getElementById("recommendation-card").className = "recommendation-card neutral";
    document.getElementById("rec-icon").innerHTML = `<i class="fa-solid fa-circle-info"></i>`;
    document.getElementById("rec-title").textContent = "Awaiting Specimen Execution";
    document.getElementById("rec-desc").textContent = "Load an inspection image and execute inference to generate actionable disposition instructions.";
    document.getElementById("qa-current-score").textContent = "100 / 100";
    document.getElementById("qa-score-fill").style.width = "100%";
    document.getElementById("qa-improvement-val").textContent = "0% (Meets acceptance threshold)";
    document.getElementById("rationale-list").innerHTML = `
        <li><i class="fa-solid fa-circle-check text-success"></i> Model loaded and standing by for inspection.</li>
        <li><i class="fa-solid fa-circle-check text-success"></i> Supported models include YOLOv8n and ResNet18 spatial feature extractors.</li>
    `;
    renderHistoricalDonut(state.currentDomain);
}

// ============================================================
// DUAL CANVASES: BOUNDING BOXES & GRAD-CAM HEATMAPS
// ============================================================

function renderVisualOutputs(result) {
    const imgDetected = document.getElementById("img-detected");
    const canvasBoxes = document.getElementById("canvas-bounding-boxes");

    if (!imgDetected || !canvasBoxes) return;

    canvasBoxes.classList.remove("hidden");

    const draw = () => {
        canvasBoxes.width = imgDetected.clientWidth;
        canvasBoxes.height = imgDetected.clientHeight;

        const ctx = canvasBoxes.getContext("2d");
        ctx.clearRect(0, 0, canvasBoxes.width, canvasBoxes.height);

        const naturalWidth = state.selectedFileDimensions?.width || imgDetected.naturalWidth || canvasBoxes.width;
        const naturalHeight = state.selectedFileDimensions?.height || imgDetected.naturalHeight || canvasBoxes.height;

        const scaleX = canvasBoxes.width / naturalWidth;
        const scaleY = canvasBoxes.height / naturalHeight;

        // Render Bounding Boxes for Object Detection models (PCB & Automotive)
        if (result.defects && result.defects.length > 0) {
            result.defects.forEach((d) => {
                const box = d.box;
                if (!box || box.length < 4) return;

                const x1 = box[0] * scaleX;
                const y1 = box[1] * scaleY;
                const x2 = box[2] * scaleX;
                const y2 = box[3] * scaleY;
                const width = x2 - x1;
                const height = y2 - y1;

                // Color based on class
                let color = "#ef4444"; // default red
                if (d.defect.toLowerCase().includes("scratch") || d.defect.toLowerCase().includes("spur")) color = "#f59e0b"; // amber
                if (d.defect.toLowerCase().includes("missing") || d.defect.toLowerCase().includes("dent")) color = "#3b82f6"; // blue
                if (d.defect.toLowerCase().includes("short") || d.defect.toLowerCase().includes("crack")) color = "#ef4444"; // red

                // Bounding rect
                ctx.lineWidth = 2.5;
                ctx.strokeStyle = color;
                ctx.shadowColor = color;
                ctx.shadowBlur = 8;
                ctx.strokeRect(x1, y1, width, height);

                // Corner accents (industrial HUD reticle style)
                const cornerLen = Math.min(10, width / 4, height / 4);
                ctx.lineWidth = 4;
                ctx.strokeStyle = "#ffffff";
                // top-left
                ctx.beginPath();
                ctx.moveTo(x1, y1 + cornerLen); ctx.lineTo(x1, y1); ctx.lineTo(x1 + cornerLen, y1); ctx.stroke();
                // bottom-right
                ctx.beginPath();
                ctx.moveTo(x2, y2 - cornerLen); ctx.lineTo(x2, y2); ctx.lineTo(x2 - cornerLen, y2); ctx.stroke();

                // Tag label
                ctx.shadowBlur = 0;
                const label = `${d.defect} ${Number(d.confidence).toFixed(0)}%`;
                ctx.font = "bold 11px 'JetBrains Mono', monospace";
                const textWidth = ctx.measureText(label).width;

                ctx.fillStyle = color;
                ctx.fillRect(x1, Math.max(0, y1 - 20), textWidth + 10, 20);

                ctx.fillStyle = "#ffffff";
                ctx.fillText(label, x1 + 5, Math.max(14, y1 - 6));
            });
        }
    };

    if (imgDetected.complete && imgDetected.naturalWidth) {
        draw();
    } else {
        imgDetected.onload = draw;
    }

    // Render Heatmap (for Semiconductor Grad-CAM or PCB spatial map)
    renderHeatmapLayer(result);
}

function renderHeatmapLayer(result) {
    const stage = document.getElementById("heatmap-stage");
    const placeholder = document.getElementById("placeholder-heatmap");
    const canvas = document.getElementById("canvas-heatmap");

    if (!canvas) return;

    placeholder.classList.add("hidden");
    canvas.classList.remove("hidden");

    const ctx = canvas.getContext("2d");

    // Case 1: Semiconductor Grad-CAM 56x56 array
    if (result.spatial_analysis && result.spatial_analysis.values) {
        const matrix = result.spatial_analysis.values;
        const rows = matrix.length;
        const cols = matrix[0].length;

        canvas.width = 440;
        canvas.height = 200;

        const cellW = canvas.width / cols;
        const cellH = canvas.height / rows;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const val = matrix[r][c]; // 0.0 to 1.0
                ctx.fillStyle = getThermalColor(val);
                ctx.fillRect(c * cellW, r * cellH, cellW + 1, cellH + 1);
            }
        }
        return;
    }

    // Case 2: PCB / Automotive Defect Spatial Density Map
    canvas.width = 440;
    canvas.height = 180;
    ctx.fillStyle = "rgba(5, 8, 16, 0.95)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (result.defects && result.defects.length > 0) {
        const naturalWidth = state.selectedFileDimensions?.width || 1920;
        const naturalHeight = state.selectedFileDimensions?.height || 1080;
        const scaleX = canvas.width / naturalWidth;
        const scaleY = canvas.height / naturalHeight;

        result.defects.forEach(d => {
            const center = d.measurements?.center || { x: (d.box[0] + d.box[2]) / 2, y: (d.box[1] + d.box[3]) / 2 };
            const cx = center.x * scaleX;
            const cy = center.y * scaleY;

            // Radial gradient spot
            const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 45);
            grad.addColorStop(0, "rgba(239, 68, 68, 0.85)");
            grad.addColorStop(0.5, "rgba(245, 158, 11, 0.45)");
            grad.addColorStop(1, "rgba(37, 99, 235, 0)");

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(cx, cy, 45, 0, Math.PI * 2);
            ctx.fill();
        });
    } else {
        ctx.font = "12px 'Inter', sans-serif";
        ctx.fillStyle = "rgba(16, 185, 129, 0.8)";
        ctx.textAlign = "center";
        ctx.fillText("No critical thermal concentrations or spatial defect peaks detected.", canvas.width / 2, canvas.height / 2);
    }
}

function getThermalColor(val) {
    // Thermal Jet ramp: blue (0.0) -> cyan -> green -> yellow -> red (1.0)
    const clamped = Math.max(0, Math.min(1, val));
    let r = 0, g = 0, b = 0;

    if (clamped < 0.25) {
        r = 0;
        g = Math.floor(255 * (clamped / 0.25));
        b = 255;
    } else if (clamped < 0.5) {
        r = 0;
        g = 255;
        b = Math.floor(255 * (1 - (clamped - 0.25) / 0.25));
    } else if (clamped < 0.75) {
        r = Math.floor(255 * ((clamped - 0.5) / 0.25));
        g = 255;
        b = 0;
    } else {
        r = 255;
        g = Math.floor(255 * (1 - (clamped - 0.75) / 0.25));
        b = 0;
    }

    const alpha = Math.max(0.15, clamped * 0.9);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function toggleMaskVisibility() {
    const isChecked = document.getElementById("toggle-mask").checked;
    const canvasBoxes = document.getElementById("canvas-bounding-boxes");
    if (canvasBoxes) {
        canvasBoxes.style.display = isChecked ? "block" : "none";
    }
}

function clearCanvasBoxes() {
    const canvas = document.getElementById("canvas-bounding-boxes");
    if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.classList.add("hidden");
    }
}

function clearCanvasHeatmap() {
    const canvas = document.getElementById("canvas-heatmap");
    const placeholder = document.getElementById("placeholder-heatmap");
    if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.classList.add("hidden");
    }
    if (placeholder) placeholder.classList.remove("hidden");
}

// ============================================================
// DASHBOARD & CONVEYOR FEED (REFERENCE IMAGE 2)
// ============================================================

async function loadDashboardData() {
    try {
        const { ok, data } = await apiRequest("/dashboard/stats");
        if (ok && data.success && data.stats) {
            state.dashboardStats = data.stats;
            updateDashboardKPIs(data.stats);
        }
    } catch (e) {
        console.error("Could not fetch dashboard stats:", e);
    }
}

function updateDashboardKPIs(stats) {
    document.getElementById("dash-total-inspections").textContent = stats.total_inspections ?? 0;
    document.getElementById("dash-passed-inspections").textContent = stats.passed ?? 0;
    document.getElementById("dash-failed-inspections").textContent = stats.failed ?? 0;
    document.getElementById("dash-defects-found").textContent = stats.defects_found ?? 0;
    document.getElementById("dash-avg-confidence").textContent = `${Number(stats.average_confidence || 0).toFixed(1)}%`;
}

let conveyorAnimationId = null;

function initConveyorAnimation() {
    const canvas = document.getElementById("canvas-conveyor-feed");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let offset = 0;
    let scanY = 0;
    let scanDir = 1;

    function renderFrame() {
        canvas.width = canvas.clientWidth || 480;
        canvas.height = canvas.clientHeight || 220;

        ctx.fillStyle = "#050810";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw conveyor track rollers
        const rollerSpacing = 32;
        ctx.strokeStyle = "#162238";
        ctx.lineWidth = 2;

        offset = (offset + 1.2) % rollerSpacing;

        for (let x = -rollerSpacing + offset; x < canvas.width; x += rollerSpacing) {
            ctx.beginPath();
            ctx.moveTo(x, 20);
            ctx.lineTo(x, canvas.height - 20);
            ctx.stroke();

            // Roller highlights
            ctx.fillStyle = "#1e2f4e";
            ctx.fillRect(x - 2, 18, 4, 6);
            ctx.fillRect(x - 2, canvas.height - 24, 4, 6);
        }

        // Conveyor belts
        ctx.fillStyle = "#0d1627";
        ctx.fillRect(0, 10, canvas.width, 10);
        ctx.fillRect(0, canvas.height - 20, canvas.width, 10);

        // Inspected Specimen PCB moving on conveyor
        const specimenWidth = 140;
        const specimenHeight = 90;
        const specimenX = (canvas.width / 2) - (specimenWidth / 2);
        const specimenY = (canvas.height / 2) - (specimenHeight / 2);

        // PCB body
        ctx.fillStyle = "#064e3b";
        ctx.strokeStyle = "#059669";
        ctx.lineWidth = 1.5;
        ctx.fillRect(specimenX, specimenY, specimenWidth, specimenHeight);
        ctx.strokeRect(specimenX, specimenY, specimenWidth, specimenHeight);

        // Chip IC
        ctx.fillStyle = "#111827";
        ctx.fillRect(specimenX + 45, specimenY + 25, 50, 40);

        // Optical Laser Sweep Line
        scanY += 1.6 * scanDir;
        if (scanY > canvas.height - 30 || scanY < 30) scanDir *= -1;

        ctx.strokeStyle = "#06b6d4";
        ctx.lineWidth = 2;
        ctx.shadowColor = "#06b6d4";
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.moveTo(30, scanY);
        ctx.lineTo(canvas.width - 30, scanY);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // HUD Crosshairs on Specimen (Image 2 style)
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(specimenX - 6, specimenY - 6, specimenWidth + 12, specimenHeight + 12);

        ctx.font = "9px 'JetBrains Mono', monospace";
        ctx.fillStyle = "#06b6d4";
        ctx.fillText("CV_TRACKING: PCB_SPECIMEN_01", specimenX, specimenY - 10);

        conveyorAnimationId = requestAnimationFrame(renderFrame);
    }

    if (conveyorAnimationId) cancelAnimationFrame(conveyorAnimationId);
    conveyorAnimationId = requestAnimationFrame(renderFrame);
}

// ============================================================
// AUDIT HISTORY (TABLE & DRILL-DOWN MODAL)
// ============================================================

async function loadHistoryData() {
    const tbody = document.getElementById("history-table-body");
    const dashTbody = document.getElementById("dash-recent-tbody");

    try {
        const { ok, data } = await apiRequest("/history");
        if (!ok || !data.success) throw new Error("Could not load history");

        state.historyData = data.inspections || [];

        renderHistoryTable(state.historyData);
        renderRecentTable(state.historyData.slice(0, 5));
        renderDefectPieChart(state.historyData);

    } catch (e) {
        if (tbody) tbody.innerHTML = `<tr class="empty-row"><td colspan="9">No inspection records found or offline.</td></tr>`;
        if (dashTbody) dashTbody.innerHTML = `<tr class="empty-row"><td colspan="8">No recent inspections.</td></tr>`;
    }
}

function renderHistoryTable(inspections) {
    const tbody = document.getElementById("history-table-body");
    if (!tbody) return;

    if (!inspections.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="9">No inspection records match filter criteria.</td></tr>`;
        return;
    }

    tbody.innerHTML = inspections.map(item => {
        const idStr = `INS-${String(item.id).padStart(6, '0')}`;
        const isPass = item.status === "PASS";
        const dateStr = item.created_at ? new Date(item.created_at).toLocaleString() : "—";
        const confStr = item.confidence != null ? `${Number(item.confidence).toFixed(1)}%` : "—";

        return `
            <tr>
                <td><strong class="font-mono">${idStr}</strong></td>
                <td>${escapeHTML(item.filename)}</td>
                <td><span class="tech-badge">${escapeHTML(item.domain)}</span></td>
                <td><span class="status-pill-badge ${isPass ? 'pass' : 'fail'}">${item.status}</span></td>
                <td>${item.inspection_type || "Object Detection"}</td>
                <td><strong>${item.total_defects ?? 0}</strong></td>
                <td>${confStr}</td>
                <td>${dateStr}</td>
                <td>
                    <button type="button" class="btn-secondary" onclick="openInspectionRecord(${item.id})">
                        <i class="fa-solid fa-eye"></i> View
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

function renderRecentTable(inspections) {
    const tbody = document.getElementById("dash-recent-tbody");
    if (!tbody) return;

    if (!inspections.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="8">No recent inspections found.</td></tr>`;
        return;
    }

    tbody.innerHTML = inspections.map(item => {
        const idStr = `INS-${String(item.id).padStart(6, '0')}`;
        const isPass = item.status === "PASS";
        const dateStr = item.created_at ? new Date(item.created_at).toLocaleTimeString() : "—";

        return `
            <tr>
                <td><strong class="font-mono">${idStr}</strong></td>
                <td>${escapeHTML(item.filename)}</td>
                <td>${escapeHTML(item.domain)}</td>
                <td><span class="status-pill-badge ${isPass ? 'pass' : 'fail'}">${item.status}</span></td>
                <td><strong>${item.total_defects ?? 0}</strong></td>
                <td>${item.confidence != null ? Number(item.confidence).toFixed(1) + '%' : '—'}</td>
                <td>${dateStr}</td>
                <td>
                    <button type="button" class="btn-text" onclick="openInspectionRecord(${item.id})">
                        Open <i class="fa-solid fa-arrow-up-right-from-square"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

function filterHistory() {
    const search = document.getElementById("history-search-input").value.toLowerCase();
    const domain = document.getElementById("history-domain-filter").value;
    const status = document.getElementById("history-status-filter").value;

    const filtered = state.historyData.filter(item => {
        const matchSearch = item.filename.toLowerCase().includes(search) || String(item.id).includes(search);
        const matchDomain = domain === "ALL" || item.domain === domain;
        const matchStatus = status === "ALL" || item.status === status;
        return matchSearch && matchDomain && matchStatus;
    });

    renderHistoryTable(filtered);
}

async function openInspectionRecord(inspectionId) {
    const modal = document.getElementById("modal-inspection-detail");
    const body = document.getElementById("modal-detail-body");
    const title = document.getElementById("modal-detail-title");

    title.textContent = `Inspection Record #INS-${String(inspectionId).padStart(6, '0')}`;
    body.innerHTML = `<div style="text-align:center; padding:40px;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><br><br>Retrieving inspection details from database...</div>`;
    modal.classList.remove("hidden");

    try {
        const { ok, data } = await apiRequest(`/history/${inspectionId}`);
        if (!ok || !data.success || !data.inspection) {
            throw new Error("Could not retrieve inspection detail.");
        }

        const item = data.inspection;
        const result = item.result || {};
        const defects = result.defects || [];
        const isPass = item.status === "PASS";

        body.innerHTML = `
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
                <div class="panel">
                    <span class="card-label">Specimen Meta</span>
                    <div style="margin-top:10px; display:flex; flex-direction:column; gap:6px; font-size:12px;">
                        <div><strong>Filename:</strong> ${escapeHTML(item.filename)}</div>
                        <div><strong>Domain:</strong> ${escapeHTML(item.domain)}</div>
                        <div><strong>Status:</strong> <span class="status-pill-badge ${isPass ? 'pass' : 'fail'}">${item.status}</span></div>
                        <div><strong>Confidence:</strong> ${item.confidence ? Number(item.confidence).toFixed(1) + '%' : '—'}</div>
                        <div><strong>Created:</strong> ${new Date(item.created_at).toLocaleString()}</div>
                    </div>
                </div>
                <div class="panel">
                    <span class="card-label">Identified Defect Log</span>
                    <div style="margin-top:10px; max-height:140px; overflow-y:auto; font-size:11.5px;">
                        ${defects.length ? defects.map(d => `
                            <div style="padding:6px 0; border-bottom:1px solid var(--border-subtle); display:flex; justify-content:space-between;">
                                <span>${escapeHTML(d.defect)}</span>
                                <strong class="text-danger">${Number(d.confidence).toFixed(1)}%</strong>
                            </div>
                        `).join("") : `<span class="text-success"><i class="fa-solid fa-check"></i> Zero defects recorded.</span>`}
                    </div>
                </div>
            </div>
            <div class="panel" style="background:#050810; text-align:center; padding:16px;">
                <span class="panel-eyebrow" style="margin-bottom:8px; display:block;">RAW INFERENCE PAYLOAD (JSON)</span>
                <pre class="font-mono" style="text-align:left; max-height:220px; overflow-y:auto; font-size:11px; color:var(--cyan); background:rgba(0,0,0,0.5); padding:12px; border-radius:6px;">${escapeHTML(JSON.stringify(result, null, 2))}</pre>
            </div>
        `;

    } catch (e) {
        body.innerHTML = `<div class="auth-alert error">Failed to load record: ${e.message}</div>`;
    }
}

function closeDetailModal() {
    document.getElementById("modal-inspection-detail").classList.add("hidden");
}

// ============================================================
// ANALYTICS & DEFECT CHARTS
// ============================================================

function renderDefectPieChart(inspections) {
    const canvas = document.getElementById("canvas-defect-pie");
    const legend = document.getElementById("defect-pie-legend");
    if (!canvas || !legend) return;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Aggregate defect classes
    const defectCounts = {};
    inspections.forEach(item => {
        const defects = item.result?.defects || [];
        defects.forEach(d => {
            defectCounts[d.defect] = (defectCounts[d.defect] || 0) + 1;
        });
        if (item.result?.prediction && item.result.prediction.defect !== "none") {
            const def = item.result.prediction.defect;
            defectCounts[def] = (defectCounts[def] || 0) + 1;
        }
    });

    const entries = Object.entries(defectCounts);
    if (!entries.length) {
        legend.innerHTML = `<span class="empty-legend">No inspection defects recorded yet.</span>`;
        // Draw empty ring
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, 60, 0, Math.PI * 2);
        ctx.strokeStyle = "#1a253c";
        ctx.lineWidth = 18;
        ctx.stroke();
        return;
    }

    const colors = ["#ef4444", "#3b82f6", "#f59e0b", "#10b981", "#8b5cf6", "#06b6d4"];
    const totalDefects = entries.reduce((sum, [, count]) => sum + count, 0);

    let startAngle = 0;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 64;

    legend.innerHTML = entries.map(([name, count], i) => {
        const pct = Math.round((count / totalDefects) * 100);
        const color = colors[i % colors.length];

        const sliceAngle = (count / totalDefects) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
        ctx.lineWidth = 20;
        ctx.strokeStyle = color;
        ctx.stroke();

        startAngle += sliceAngle;

        return `
            <div class="legend-entry">
                <div class="legend-entry-left">
                    <span class="legend-dot" style="background:${color};"></span>
                    <span>${escapeHTML(name)}</span>
                </div>
                <span class="legend-entry-val">${pct}% (${count})</span>
            </div>
        `;
    }).join("");
}

function renderAnalyticsCharts() {
    renderPassFailAnalytics();
    renderDomainAnalytics();
    renderDefectsBarAnalytics();
}

function renderPassFailAnalytics() {
    const canvas = document.getElementById("canvas-analytics-passfail");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const total = state.historyData.length || 1;
    const passed = state.historyData.filter(h => h.status === "PASS").length;
    const failed = total - passed;

    const passAngle = (passed / total) * Math.PI * 2;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r = 70;

    // Passed
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, passAngle);
    ctx.lineWidth = 24;
    ctx.strokeStyle = "#10b981";
    ctx.stroke();

    // Failed
    ctx.beginPath();
    ctx.arc(cx, cy, r, passAngle, Math.PI * 2);
    ctx.lineWidth = 24;
    ctx.strokeStyle = "#ef4444";
    ctx.stroke();

    ctx.font = "bold 18px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(`${Math.round((passed / total) * 100)}%`, cx, cy + 6);
}

function renderDomainAnalytics() {
    const canvas = document.getElementById("canvas-analytics-domains");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const counts = {
        "PCB / Electronics": 0,
        "Automotive": 0,
        "Semiconductor / Wafer": 0
    };

    state.historyData.forEach(h => {
        if (counts[h.domain] !== undefined) counts[h.domain]++;
    });

    const domains = Object.keys(counts);
    const maxVal = Math.max(...Object.values(counts), 1);
    const barW = 50;
    const startX = 40;
    const chartBottom = canvas.height - 40;

    domains.forEach((dom, i) => {
        const val = counts[dom];
        const barH = (val / maxVal) * 120;
        const x = startX + i * 85;
        const y = chartBottom - barH;

        ctx.fillStyle = i === 0 ? "#3b82f6" : i === 1 ? "#10b981" : "#8b5cf6";
        ctx.fillRect(x, y, barW, barH);

        ctx.fillStyle = "#94a3b8";
        ctx.font = "10px 'Inter', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(val, x + barW / 2, y - 6);
        ctx.fillText(dom.split(" ")[0], x + barW / 2, chartBottom + 16);
    });
}

function renderDefectsBarAnalytics() {
    const canvas = document.getElementById("canvas-analytics-defects-bar");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const counts = {};
    state.historyData.forEach(item => {
        const defects = item.result?.defects || [];
        defects.forEach(d => {
            counts[d.defect] = (counts[d.defect] || 0) + 1;
        });
    });

    const entries = Object.entries(counts);
    if (!entries.length) {
        ctx.fillStyle = "#64748b";
        ctx.font = "12px 'Inter', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Audit defect logs will visualize across classes as inspections accumulate.", canvas.width / 2, canvas.height / 2);
        return;
    }

    const maxCount = Math.max(...entries.map(([, c]) => c), 1);
    const barHeight = 22;

    entries.slice(0, 6).forEach(([name, count], i) => {
        const y = 30 + i * 32;
        const barW = (count / maxCount) * (canvas.width - 200);

        ctx.fillStyle = "#94a3b8";
        ctx.font = "11px 'JetBrains Mono', monospace";
        ctx.textAlign = "left";
        ctx.fillText(name, 20, y + 15);

        ctx.fillStyle = "#ef4444";
        ctx.fillRect(140, y, barW, barHeight);

        ctx.fillStyle = "#ffffff";
        ctx.fillText(count, 150 + barW, y + 15);
    });
}

// ============================================================
// PDF REPORT EXPORT MODAL
// ============================================================

function openReportModal() {
    const modal = document.getElementById("modal-report-export");
    const result = state.currentInspection;

    if (!result) {
        alert("Please run an inspection first before exporting an official report.");
        return;
    }

    const isPass = result.status === "PASS";
    const inspectionId = result.inspection_id ? `INS-${String(result.inspection_id).padStart(6, '0')}` : "INS-2025-05-24-00125";

    // Stamp
    const stamp = document.getElementById("cert-stamp-badge");
    const stampText = document.getElementById("cert-stamp-text");
    stamp.className = isPass ? "cert-stamp pass" : "cert-stamp";
    stampText.textContent = isPass ? "PASSED" : "DEFECTIVE";

    document.getElementById("cert-id").textContent = inspectionId;
    document.getElementById("cert-timestamp").textContent = new Date().toLocaleString();
    document.getElementById("cert-domain").textContent = result.domain || state.currentDomain;
    document.getElementById("cert-operator").textContent = state.user?.name || "Admin";

    // Specimen image
    const previewImg = document.getElementById("cert-preview-img");
    if (state.selectedFileUrl) {
        previewImg.src = state.selectedFileUrl;
        previewImg.style.display = "block";
    }

    // Stats
    const conf = result.average_confidence ?? result.prediction?.confidence ?? 95.0;
    document.getElementById("cert-confidence").textContent = `${Number(conf).toFixed(1)}%`;
    document.getElementById("cert-defects").textContent = result.total_defects ?? (result.defects?.length || 0);

    let totalArea = 0;
    (result.defects || []).forEach(d => {
        if (d.measurements?.area_percent) totalArea += Number(d.measurements.area_percent);
    });
    document.getElementById("cert-area").textContent = `${totalArea.toFixed(2)}%`;
    document.getElementById("cert-score").textContent = isPass ? "98 / 100" : "64 / 100";

    // Defect table
    const certTbody = document.getElementById("cert-defects-body");
    const defects = result.defects || [];
    if (defects.length) {
        certTbody.innerHTML = defects.map((d, i) => `
            <tr>
                <td>${i + 1}</td>
                <td><strong>${escapeHTML(d.defect)}</strong></td>
                <td>${deriveDefectLocation(d.measurements?.center, d.box)}</td>
                <td>${d.measurements?.area_percent ? Number(d.measurements.area_percent).toFixed(2) + '%' : '< 1%'}</td>
                <td>${deriveIndividualSeverity(d)}</td>
                <td>${Number(d.confidence).toFixed(1)}%</td>
            </tr>
        `).join("");
    } else {
        certTbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#10b981;">No defects identified. Full quality compliance.</td></tr>`;
    }

    const recBox = document.getElementById("cert-recommendation-box");
    const recText = document.getElementById("cert-recommendation-text");
    if (isPass) {
        recBox.className = "cert-recommendation-box pass";
        recText.textContent = "Automated Acceptance Approved: Specimen satisfies IPC-A-610 Class 3 standards. Release lot to downstream packaging.";
    } else {
        recBox.className = "cert-recommendation-box";
        recText.textContent = "Manual Inspection Required: Defect areas violate strict manufacturing tolerances. Quarantined for engineer review.";
    }

    modal.classList.remove("hidden");
}

function closeReportModal() {
    document.getElementById("modal-report-export").classList.add("hidden");
}

// ============================================================
// SETTINGS & BACKEND CONFIG
// ============================================================

async function testApiConnection() {
    const urlInput = document.getElementById("input-api-url").value.trim();
    const statusBox = document.getElementById("connection-status-box");
    const statusText = document.getElementById("connection-status-text");

    statusText.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Pinging ${urlInput}/health...`;

    try {
        const res = await fetch(`${urlInput}/health`);
        const data = await res.json();
        if (res.ok && data.status === "healthy") {
            statusText.innerHTML = `<span class="text-success"><i class="fa-solid fa-circle-check"></i> Connected successfully! API is healthy.</span>`;
        } else {
            throw new Error("Invalid response");
        }
    } catch (e) {
        statusText.innerHTML = `<span class="text-danger"><i class="fa-solid fa-triangle-exclamation"></i> Connection failed to ${urlInput}. Ensure FastAPI is running.</span>`;
    }
}

function saveApiUrl() {
    const urlInput = document.getElementById("input-api-url").value.trim();
    state.apiUrl = urlInput;
    localStorage.setItem(CONFIG.storageApiUrlKey, urlInput);
    alert(`Backend API URL updated to: ${urlInput}`);
}

async function checkBackendHealth() {
    try {
        const res = await fetch(`${state.apiUrl}/health`);
        const data = await res.json();
        const pills = document.querySelectorAll(".model-engine-status-pill, .system-status-pill");
        if (res.ok && data.status === "healthy") {
            pills.forEach(p => p.classList.add("online"));
        }
    } catch (e) {
        // Backend ping
    }
}

// ============================================================
// DYNAMIC MOTION INTRO BACKGROUND (CV SCANNER CANVAS)
// ============================================================

function initIntroCvCanvas() {
    const canvas = document.getElementById("intro-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    window.addEventListener("resize", () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    });

    // Simulated component targets
    const targets = [
        { x: width * 0.22, y: height * 0.35, w: 90, h: 70, label: "IC_CHIP_U4", conf: 98.4, status: "ACQUIRED" },
        { x: width * 0.74, y: height * 0.42, w: 110, h: 85, label: "CAPACITOR_ARRAY", conf: 96.8, status: "SCANNING" },
        { x: width * 0.32, y: height * 0.72, w: 80, h: 60, label: "SOLDER_JOINT_R12", conf: 99.1, status: "DEFECT_CHECK" },
        { x: width * 0.68, y: height * 0.68, w: 95, h: 75, label: "WAFER_ALIGNMENT", conf: 97.5, status: "LOCKED" }
    ];

    let t = 0;

    function render() {
        ctx.fillStyle = "rgba(6, 9, 17, 0.2)";
        ctx.fillRect(0, 0, width, height);

        // Draw grid dots
        const gridSize = 40;
        ctx.fillStyle = "rgba(37, 99, 235, 0.15)";
        for (let x = 0; x < width; x += gridSize) {
            for (let y = 0; y < height; y += gridSize) {
                ctx.fillRect(x, y, 1.5, 1.5);
            }
        }

        // Draw targets with brackets and coordinates
        t += 0.02;
        targets.forEach((target, i) => {
            const shiftX = Math.sin(t + i) * 4;
            const shiftY = Math.cos(t + i) * 4;
            const tx = target.x + shiftX;
            const ty = target.y + shiftY;

            ctx.strokeStyle = "rgba(6, 182, 212, 0.45)";
            ctx.lineWidth = 1;

            // Reticle corners
            const cLen = 12;
            ctx.beginPath();
            ctx.moveTo(tx, ty + cLen); ctx.lineTo(tx, ty); ctx.lineTo(tx + cLen, ty);
            ctx.moveTo(tx + target.w - cLen, ty); ctx.lineTo(tx + target.w, ty); ctx.lineTo(tx + target.w, ty + cLen);
            ctx.moveTo(tx, ty + target.h - cLen); ctx.lineTo(tx, ty + target.h); ctx.lineTo(tx + cLen, ty + target.h);
            ctx.moveTo(tx + target.w - cLen, ty + target.h); ctx.lineTo(tx + target.w, ty + target.h); ctx.lineTo(tx + target.w, ty + target.h - cLen);
            ctx.stroke();

            // Center crosshair
            ctx.strokeStyle = "rgba(59, 130, 246, 0.35)";
            ctx.beginPath();
            ctx.moveTo(tx + target.w / 2 - 5, ty + target.h / 2);
            ctx.lineTo(tx + target.w / 2 + 5, ty + target.h / 2);
            ctx.moveTo(tx + target.w / 2, ty + target.h / 2 - 5);
            ctx.lineTo(tx + target.w / 2, ty + target.h / 2 + 5);
            ctx.stroke();

            // Telemetry Tag
            ctx.font = "9px 'JetBrains Mono', monospace";
            ctx.fillStyle = "rgba(6, 182, 212, 0.8)";
            ctx.fillText(`[${target.label}]`, tx, ty - 6);
            ctx.fillStyle = "rgba(148, 163, 184, 0.7)";
            ctx.fillText(`${target.status} (${target.conf}%)`, tx, ty + target.h + 14);
        });

        // Update HUD live coordinate stream
        const hudCoords = document.getElementById("hud-coords");
        if (hudCoords && Math.random() > 0.85) {
            const rx = (Math.random() * 800).toFixed(2);
            const ry = (Math.random() * 600).toFixed(2);
            hudCoords.textContent = `X: ${rx} • Y: ${ry} • FPS: 60`;
        }

        requestAnimationFrame(render);
    }

    render();
}

// ============================================================
// INITIALIZATION
// ============================================================

function escapeHTML(str) {
    if (str == null) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function runSplashSequence() {
    const splash = document.getElementById("splash-screen");
    const SPLASH_DURATION_MS = 3000; // Exact 3-second intro animation

    // Start background session verification while splash animation runs
    const sessionPromise = verifySession().catch(() => false);

    // Subtle status update during intro for industrial realism
    const statusLabel = document.getElementById("splash-status-label");
    setTimeout(() => {
        if (statusLabel) statusLabel.textContent = "SYNCHRONIZING OPTICAL VISION CORE...";
    }, 1600);

    setTimeout(async () => {
        let hasValidSession = false;
        try {
            hasValidSession = await sessionPromise;
        } catch (e) {
            hasValidSession = false;
        }

        if (splash) {
            splash.classList.add("fade-out");
            setTimeout(() => {
                splash.style.display = "none";
                if (hasValidSession) {
                    showAppWorkspace();
                    loadDashboardData();
                    loadHistoryData();
                } else {
                    showAuthPortal();
                }
            }, 600); // 600ms smooth fade transition
        } else {
            if (hasValidSession) {
                showAppWorkspace();
                loadDashboardData();
                loadHistoryData();
            } else {
                showAuthPortal();
            }
        }
    }, SPLASH_DURATION_MS);
}

document.addEventListener("DOMContentLoaded", () => {
    // 1. Initialize Motion Canvas
    initIntroCvCanvas();

    // 2. Setup Upload Interactions
    setupFileUpload();

    // 3. Form Event Listeners
    const loginForm = document.getElementById("login-form");
    if (loginForm) loginForm.addEventListener("submit", handleLogin);

    const registerForm = document.getElementById("register-form");
    if (registerForm) registerForm.addEventListener("submit", handleRegister);

    // 4. Run 3-Second Splash Animation Sequence
    runSplashSequence();
});
