/* SPDX-License-Identifier: GPL-2.0 */
/*
 * Copyright (C) 2026 Yuzhii0718
 *
 * All rights reserved.
 *
 * This file is part of the project bl-mt798x-dhcpd
 * You may not use, copy, modify or distribute this file except in compliance with the license agreement.
 */

function normalizeLang(input) {
    if (!input) return "en";
    var lowerCaseLanguage = String(input).toLowerCase();
    return lowerCaseLanguage.indexOf("zh") === 0 ? "zh-cn" : "en";
}

function detectLang() {
    var storedLang, navigatorLanguages;
    try {
        storedLang = localStorage.getItem("lang");
        if (storedLang) return normalizeLang(storedLang);
    } catch (error) { }
    navigatorLanguages = [];
    if (navigator.languages && navigator.languages.length) {
        navigatorLanguages = navigator.languages;
    } else if (navigator.language) {
        navigatorLanguages = [navigator.language];
    }
    return normalizeLang(navigatorLanguages[0]);
}

function detectTheme() {
    try {
        var storedTheme = localStorage.getItem("theme");
        if (storedTheme) return storedTheme;
    } catch (error) { }
    return "auto";
}

function normalizeThemeMode(input) {
    if (!input) return "auto";
    var normalizedMode = String(input).toLowerCase().trim();
    return normalizedMode === "light" || normalizedMode === "dark" || normalizedMode === "auto" ? normalizedMode : "auto";
}

function isI18nAvailable() {
    return typeof I18N !== "undefined" && I18N;
}

function isI18nEnabled() {
    return APP_STATE.i18nEnabled !== false;
}

function t(key, fallback) {
    var languageCode = APP_STATE.lang || "en";
    if (!isI18nEnabled() || !isI18nAvailable())
        return fallback !== undefined ? fallback : key;
    return I18N[languageCode] && I18N[languageCode][key] !== undefined ? I18N[languageCode][key] : I18N.en && I18N.en[key] !== undefined ? I18N.en[key] : (fallback !== undefined ? fallback : key);
}

function applyI18n(rootNode) {
    var scope = rootNode || document;
    var enabled = isI18nEnabled() && isI18nAvailable();
    var textNodes = scope.querySelectorAll("[data-i18n]");
    for (var textIndex = 0; textIndex < textNodes.length; textIndex++) {
        var textNode = textNodes[textIndex];
        var key = textNode.getAttribute("data-i18n");
        if (!textNode.hasAttribute("data-i18n-fallback"))
            textNode.setAttribute("data-i18n-fallback", textNode.textContent || "");
        var fallbackText = textNode.getAttribute("data-i18n-fallback") || "";
        textNode.textContent = enabled ? t(key, fallbackText) : fallbackText;
    }
    var htmlNodes = scope.querySelectorAll("[data-i18n-html]");
    for (var htmlIndex = 0; htmlIndex < htmlNodes.length; htmlIndex++) {
        var htmlNode = htmlNodes[htmlIndex];
        var htmlKey = htmlNode.getAttribute("data-i18n-html");
        if (!htmlNode.hasAttribute("data-i18n-html-fallback"))
            htmlNode.setAttribute("data-i18n-html-fallback", htmlNode.innerHTML || "");
        var fallbackHtml = htmlNode.getAttribute("data-i18n-html-fallback") || "";
        htmlNode.innerHTML = enabled ? t(htmlKey, fallbackHtml) : fallbackHtml;
    }
    var attributeNodes = scope.querySelectorAll("[data-i18n-attr]");
    for (var attrIndex = 0; attrIndex < attributeNodes.length; attrIndex++) {
        var attributeNode = attributeNodes[attrIndex];
        var attributeSpec = attributeNode.getAttribute("data-i18n-attr");
        if (!attributeSpec) continue;
        var attributeParts = attributeSpec.split(":");
        if (attributeParts.length < 2) continue;
        var attributeName = attributeParts[0];
        var translationKey = attributeParts.slice(1).join(":");
        var fallbackKey = "data-i18n-attr-fallback-" + attributeName;
        if (!attributeNode.hasAttribute(fallbackKey))
            attributeNode.setAttribute(fallbackKey, attributeNode.getAttribute(attributeName) || "");
        var fallbackAttribute = attributeNode.getAttribute(fallbackKey) || "";
        attributeNode.setAttribute(attributeName, enabled ? t(translationKey, fallbackAttribute) : fallbackAttribute);
    }
}

function setLang(language) {
    APP_STATE.lang = normalizeLang(language);
    try {
        localStorage.setItem("lang", APP_STATE.lang);
    } catch (error) { }
    applyI18n(document);
    typeof backupRefreshI18n == "function" && APP_STATE.page === "backup" && backupRefreshI18n();
    typeof renderSysInfo == "function" && renderSysInfo();
    updateDocumentTitle();
}

function updateThemeSelect() {
    var themeSelect = document.getElementById("theme_select");
    if (!themeSelect) return;
    themeSelect.value = APP_STATE.theme || "auto";
}

function setTheme(themeMode, options) {
    var resolvedOptions = options || {};
    var persistLocal = resolvedOptions.persistLocal !== false;
    var persistEnv = resolvedOptions.persistEnv === true;
    var silent = resolvedOptions.silent === true;
    APP_STATE.theme = normalizeThemeMode(themeMode || "auto");
    try {
        persistLocal && localStorage.setItem("theme", APP_STATE.theme);
    } catch (error) { }
    var rootElement = document.documentElement;
    if (window.__failsafeThemeApplyMode) {
        window.__failsafeThemeApplyMode(APP_STATE.theme, { silent: silent });
    } else {
        APP_STATE.theme === "auto" ? rootElement.removeAttribute("data-theme") : rootElement.setAttribute("data-theme", APP_STATE.theme);
    }
    updateThemeSelect();
    persistEnv && saveThemeMode(APP_STATE.theme);
}

var THEME_COLOR_ENV_KEY = "failsafe_theme_color";
var THEME_COLOR_CACHE_KEY = "failsafe_theme_color_cache";
var ACCENT_PRESETS = ["#2563eb", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#a855f7"];
var THEME_MODE_ENV_KEY = "failsafe_theme_mode";

function normalizeHexColor(input) {
    var value, hex;
    if (!input) return null;
    value = String(input).trim();
    if (value === "") return null;
    if (value[0] === "#") value = value.slice(1);
    if (!/^[0-9a-fA-F]{3}$/.test(value) && !/^[0-9a-fA-F]{6}$/.test(value)) return null;
    if (value.length === 3) {
        hex = "#" + value[0] + value[0] + value[1] + value[1] + value[2] + value[2];
    } else {
        hex = "#" + value;
    }
    return hex.toLowerCase();
}

function hexToRgb(hex) {
    var normalizedHex = normalizeHexColor(hex);
    if (!normalizedHex) return null;
    return {
        r: parseInt(normalizedHex.slice(1, 3), 16),
        g: parseInt(normalizedHex.slice(3, 5), 16),
        b: parseInt(normalizedHex.slice(5, 7), 16)
    };
}

function applyAccentVars(color) {
    var normalizedColor = normalizeHexColor(color);
    var rgb, rootElement, lighter;
    if (!normalizedColor) return false;
    rgb = hexToRgb(normalizedColor);
    if (!rgb) return false;
    rootElement = document.documentElement;
    rootElement.style.setProperty("--primary", normalizedColor);
    rootElement.style.setProperty("--primary-rgb", rgb.r + ", " + rgb.g + ", " + rgb.b);
    lighter = blendColor(normalizedColor, "#ffffff", 0.28);
    rootElement.style.setProperty("--primary-2", lighter);
    ensureThemeColorMeta(normalizedColor);
    return true;
}

function blendColor(sourceHex, targetHex, ratio) {
    var sourceRgb = hexToRgb(sourceHex);
    var targetRgb = hexToRgb(targetHex);
    if (!sourceRgb || !targetRgb) return sourceHex;
    var red = Math.round(sourceRgb.r + (targetRgb.r - sourceRgb.r) * ratio);
    var green = Math.round(sourceRgb.g + (targetRgb.g - sourceRgb.g) * ratio);
    var blue = Math.round(sourceRgb.b + (targetRgb.b - sourceRgb.b) * ratio);
    return "#" + red.toString(16).padStart(2, "0") + green.toString(16).padStart(2, "0") + blue.toString(16).padStart(2, "0");
}

function ensureThemeColorMeta(color) {
    if (!color) return;
    var meta = document.querySelector("meta[name='theme-color']");
    if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "theme-color");
        document.head && document.head.appendChild(meta);
    }
    meta.setAttribute("content", color);
}

function updateAccentControls(color) {
    var colorPicker = document.getElementById("accent_color_picker");
    var colorInput = document.getElementById("accent_color_input");
    var normalizedColor = normalizeHexColor(color);
    var swatches, swatchIndex, swatch;
    if (colorPicker && normalizedColor) colorPicker.value = normalizedColor;
    if (colorInput && normalizedColor) colorInput.value = normalizedColor;
    swatches = document.querySelectorAll(".color-swatch");
    for (swatchIndex = 0; swatchIndex < swatches.length; swatchIndex++) {
        swatch = swatches[swatchIndex];
        if (!swatch || !swatch.dataset) continue;
        if (normalizedColor && String(swatch.dataset.color || "").toLowerCase() === normalizedColor)
            swatch.classList.add("active");
        else
            swatch.classList.remove("active");
    }
}

function applyAccentColor(color) {
    var isApplied = applyAccentVars(color);
    if (!isApplied) return false;
    updateAccentControls(color);
    return true;
}

(function applyAccentFromCache() {
    try {
        var cachedColor = localStorage.getItem(THEME_COLOR_CACHE_KEY);
        if (cachedColor) applyAccentVars(cachedColor);
    } catch (error) { }
})();

async function saveThemeColor(color) {
    var normalizedColor = normalizeHexColor(color);
    if (!normalizedColor) return;
    try {
        localStorage.setItem(THEME_COLOR_CACHE_KEY, normalizedColor);
    } catch (error) { }
    try {
        var formData = new FormData();
        formData.append("color", normalizedColor);
        await fetch("/theme/set", { method: "POST", body: formData });
    } catch (error) { }
}

async function saveThemeMode(theme) {
    var normalizedMode = normalizeThemeMode(theme);
    try {
        localStorage.setItem("theme", normalizedMode);
    } catch (error) { }
    try {
        var formData = new FormData();
        formData.append("theme", normalizedMode);
        await fetch("/theme/set", { method: "POST", body: formData });
    } catch (error) { }
}

async function loadThemeColor() {
    var currentColor = null;
    var loadedFromEnv = false;
    try {
        var response = await fetch("/theme/get", { method: "GET" });
        if (response && response.ok) {
            var payload = await response.json();
            if (payload && payload.color) {
                currentColor = normalizeHexColor(payload.color);
                loadedFromEnv = !!currentColor;
            }
        }
    } catch (error) { }

    if (!currentColor) {
        try {
            currentColor = (getComputedStyle(document.documentElement).getPropertyValue("--primary") || "").trim();
            currentColor = normalizeHexColor(currentColor);
        } catch (error) { }
    }

    if (currentColor) {
        if (loadedFromEnv)
            applyAccentColor(currentColor);
        if (loadedFromEnv) {
            try {
                localStorage.setItem(THEME_COLOR_CACHE_KEY, currentColor);
            } catch (error) { }
        }
        updateAccentControls(currentColor);
    }
}

async function loadThemeMode() {
    var mode = null;
    try {
        var response = await fetch("/theme/get", { method: "GET" });
        if (response && response.ok) {
            var payload = await response.json();
            if (payload && payload.theme) mode = normalizeThemeMode(payload.theme);
        }
    } catch (error) { }

    if (mode) {
        setTheme(mode, { persistEnv: false, persistLocal: true, silent: true });
    }
}

function appendAccentControls(container) {
    if (!container) return;

    var row = document.createElement("div");
    row.className = "control-row control-row-color";

    var accentLabel = document.createElement("div");
    accentLabel.setAttribute("data-i18n", "control.accent");
    accentLabel.textContent = t("control.accent");
    row.appendChild(accentLabel);

    var picker = document.createElement("div");
    picker.className = "color-picker";

    var presets = document.createElement("div");
    presets.className = "color-presets";
    ACCENT_PRESETS.forEach(function (presetColor) {
        var swatchButton = document.createElement("button");
        swatchButton.type = "button";
        swatchButton.className = "color-swatch";
        swatchButton.dataset.color = presetColor.toLowerCase();
        swatchButton.style.backgroundColor = presetColor;
        swatchButton.onclick = function () {
            applyAccentColor(presetColor);
            saveThemeColor(presetColor);
        };
        presets.appendChild(swatchButton);
    });

    var inputs = document.createElement("div");
    inputs.className = "color-inputs";

    var colorTextInput = document.createElement("input");
    colorTextInput.type = "text";
    colorTextInput.id = "accent_color_input";
    colorTextInput.setAttribute("data-i18n-attr", "placeholder:theme.color.placeholder");
    colorTextInput.placeholder = t("theme.color.placeholder");
    colorTextInput.addEventListener("change", function () {
        var normalizedColor = normalizeHexColor(colorTextInput.value);
        if (!normalizedColor) return;
        applyAccentColor(normalizedColor);
        saveThemeColor(normalizedColor);
    });

    var colorPicker = document.createElement("input");
    colorPicker.type = "color";
    colorPicker.id = "accent_color_picker";
    colorPicker.setAttribute("data-i18n-attr", "title:theme.color.custom");
    colorPicker.title = t("theme.color.custom");
    colorPicker.addEventListener("input", function () {
        applyAccentColor(colorPicker.value);
        saveThemeColor(colorPicker.value);
    });

    inputs.appendChild(colorTextInput);
    inputs.appendChild(colorPicker);

    picker.appendChild(presets);
    picker.appendChild(inputs);

    row.appendChild(picker);
    container.appendChild(row);
}

function ensureFavicon() {
    var link = document.querySelector("link[rel='icon']");
    if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", "icon");
        link.setAttribute("type", "image/svg+xml");
        link.setAttribute("href", "/favicon.svg");
        document.head && document.head.appendChild(link);
    } else {
        link.setAttribute("href", "/favicon.svg");
    }
}

function updateDocumentTitle() {
    if (!isI18nEnabled() || !isI18nAvailable())
        return;
    if (APP_STATE.page) {
        var titleKey = APP_STATE.page + ".title";
        if (I18N[APP_STATE.lang] && I18N[APP_STATE.lang][titleKey]) {
            document.title = t(titleKey);
            return;
        }
        APP_STATE.page === "flashing" ? document.title = t("flashing.title.in_progress") : APP_STATE.page === "booting" && (document.title = t("booting.title.in_progress"));
    }
}

function ensureBranding() {
    var versionNode = document.getElementById("version"), nextSiblingNode, brandNode;
    versionNode && ((nextSiblingNode = versionNode.nextElementSibling, nextSiblingNode && nextSiblingNode.classList && nextSiblingNode.classList.contains("brand") && nextSiblingNode.parentNode && nextSiblingNode.parentNode.removeChild(nextSiblingNode), versionNode.querySelector && versionNode.querySelector(".brand-inline")) || (brandNode = document.createElement("span"), brandNode.className = "brand-inline", brandNode.textContent = "💡Yuzhii", versionNode.appendChild(document.createTextNode(" ")), versionNode.appendChild(brandNode)));
    if (!versionNode) return;
    if (versionNode.querySelector && versionNode.querySelector("#project-info")) return;
    var projectInfo = document.createElement("div");
    projectInfo.id = "project-info";
    projectInfo.innerHTML = 'You can find more infomation about this project: <a href="https://github.com/Yuzhii0718/bl-mt798x-dhcpd" target="_blank">Github</a>';
    versionNode.appendChild(projectInfo);
}

function ensureSidebar() {
    function createNavLink(path, i18nKey, navId) {
        var link = document.createElement("a"), iconSpan, labelSpan, normalizedPath, isActive;
        link.className = "nav-link";
        link.href = path;
        link.setAttribute("data-nav-id", navId);
        iconSpan = document.createElement("span");
        iconSpan.className = "dot";
        link.appendChild(iconSpan);
        labelSpan = document.createElement("span");
        labelSpan.setAttribute("data-i18n", i18nKey);
        labelSpan.textContent = t(i18nKey);
        link.appendChild(labelSpan);
        normalizedPath = path;
        normalizedPath !== "/" && normalizedPath.charAt(0) !== "/" && (normalizedPath = "/" + normalizedPath);
        isActive = normalizedPath === currentPath || normalizedPath === "/" && (currentPath === "/" || currentPath === "/index.html");
        isActive && link.classList.add("active");
        return link;
    }

    var sidebar = document.getElementById("sidebar"), currentPath, brandContainer, brandTitle, controlsContainer, languageRow, languageLabel, languageSelect, themeRow, themeLabel, themeSelect, autoOption, lightOption, darkOption, navContainer, basicSection, basicTitle, advancedSection, advancedTitle, systemSection, systemTitle, gptLink, simgLink;
    sidebar && sidebar.getAttribute("data-rendered") !== "1" && (sidebar.setAttribute("data-rendered", "1"), currentPath = location && location.pathname ? location.pathname : "", currentPath === "" && (currentPath = "/"), sidebar.innerHTML = "", brandContainer = document.createElement("div"), brandContainer.className = "sidebar-brand", brandTitle = document.createElement("div"), brandTitle.className = "title", brandTitle.setAttribute("data-i18n", "app.name"), brandTitle.textContent = t("app.name"), brandContainer.appendChild(brandTitle), sidebar.appendChild(brandContainer), controlsContainer = document.createElement("div"), controlsContainer.className = "sidebar-controls", languageRow = document.createElement("div"), languageRow.className = "control-row", languageLabel = document.createElement("div"), languageLabel.setAttribute("data-i18n", "control.language"), languageLabel.textContent = t("control.language"), languageRow.appendChild(languageLabel), languageSelect = document.createElement("select"), languageSelect.id = "lang_select", languageSelect.innerHTML = '<option value="en">English<\/option><option value="zh-cn">简体中文<\/option>', languageSelect.value = APP_STATE.lang, languageSelect.onchange = function () {
        setLang(this.value);
    }, languageRow.appendChild(languageSelect), controlsContainer.appendChild(languageRow), themeRow = document.createElement("div"), themeRow.className = "control-row", themeLabel = document.createElement("div"), themeLabel.setAttribute("data-i18n", "control.theme"), themeLabel.textContent = t("control.theme"), themeRow.appendChild(themeLabel), themeSelect = document.createElement("select"), themeSelect.id = "theme_select", autoOption = document.createElement("option"), autoOption.value = "auto", autoOption.setAttribute("data-i18n", "theme.auto"), autoOption.textContent = t("theme.auto"), lightOption = document.createElement("option"), lightOption.value = "light", lightOption.setAttribute("data-i18n", "theme.light"), lightOption.textContent = t("theme.light"), darkOption = document.createElement("option"), darkOption.value = "dark", darkOption.setAttribute("data-i18n", "theme.dark"), darkOption.textContent = t("theme.dark"), themeSelect.appendChild(autoOption), themeSelect.appendChild(lightOption), themeSelect.appendChild(darkOption), themeSelect.value = APP_STATE.theme, themeSelect.onchange = function () {
        setTheme(this.value, { persistEnv: true, persistLocal: true });
    }, themeRow.appendChild(themeSelect), controlsContainer.appendChild(themeRow), appendAccentControls(controlsContainer), sidebar.appendChild(controlsContainer), navContainer = document.createElement("div"), navContainer.className = "nav", basicSection = document.createElement("div"), basicSection.className = "nav-section", basicTitle = document.createElement("div"), basicTitle.className = "nav-section-title", basicTitle.setAttribute("data-i18n", "nav.basic"), basicTitle.textContent = t("nav.basic"), basicSection.appendChild(basicTitle), basicSection.appendChild(createNavLink("/", "nav.firmware", "firmware")), basicSection.appendChild(createNavLink("/uboot.html", "nav.uboot", "uboot")), navContainer.appendChild(basicSection), advancedSection = document.createElement("div"), advancedSection.className = "nav-section", advancedTitle = document.createElement("div"), advancedTitle.className = "nav-section-title", advancedTitle.setAttribute("data-i18n", "nav.advanced"), advancedTitle.textContent = t("nav.advanced"), advancedSection.appendChild(advancedTitle), advancedSection.appendChild(createNavLink("/bl2.html", "nav.bl2", "bl2")), gptLink = createNavLink("/gpt.html", "nav.gpt", "gpt"), gptLink.style.display = "none", advancedSection.appendChild(gptLink), simgLink = createNavLink("/simg.html", "nav.simg", "simg"), simgLink.style.display = "none", advancedSection.appendChild(simgLink), advancedSection.appendChild(createNavLink("/factory.html", "nav.factory", "factory")), advancedSection.appendChild(createNavLink("/initramfs.html", "nav.initramfs", "initramfs")), navContainer.appendChild(advancedSection), systemSection = document.createElement("div"), systemSection.className = "nav-section", systemTitle = document.createElement("div"), systemTitle.className = "nav-section-title", systemTitle.setAttribute("data-i18n", "nav.system"), systemTitle.textContent = t("nav.system"), systemSection.appendChild(systemTitle), systemSection.appendChild(createNavLink("/backup.html", "nav.backup", "backup")), systemSection.appendChild(createNavLink("/flash.html", "nav.flash", "flash")), systemSection.appendChild(createNavLink("/env.html", "nav.env", "env")), systemSection.appendChild(createNavLink("/console.html", "nav.console", "console")), systemSection.appendChild(createNavLink("/reboot.html", "nav.reboot", "reboot")), navContainer.appendChild(systemSection), sidebar.appendChild(navContainer), applyI18n(sidebar), updateGptNavVisibility(), updateSimgNavVisibility());
}

function ajax(request) {
    var xhr, method;
    xhr = window.XMLHttpRequest ? new XMLHttpRequest : new ActiveXObject("Microsoft.XMLHTTP");
    xhr.upload.addEventListener("progress", function (event) {
        request.progress && request.progress(event);
    });
    xhr.onreadystatechange = function () {
        xhr.readyState == 4 && xhr.status == 200 && request.done && request.done(xhr.responseText);
    };
    request.timeout && (xhr.timeout = request.timeout);
    method = "GET";
    request.data && (method = "POST");
    xhr.open(method, request.url);
    xhr.send(request.data);
}

function consoleInit() {
    var outputElement = document.getElementById("console_out");
    var commandInput = document.getElementById("console_cmd");
    var statusElement = document.getElementById("console_status");
    var tokenInput = document.getElementById("console_token");
    var persistKey = "failsafe_console_output";
    var persistMax = 200000;

    APP_STATE.console = APP_STATE.console || {
        running: false,
        pollTimer: null,
        history: [],
        histPos: -1,
        tokenKey: "failsafe_console_token"
    };

    function loadToken() {
        try {
            var storedToken = localStorage.getItem(APP_STATE.console.tokenKey);
            tokenInput && storedToken && (tokenInput.value = storedToken);
        } catch (error) { }
    }

    function saveToken() {
        try {
            tokenInput && localStorage.setItem(APP_STATE.console.tokenKey, tokenInput.value || "");
        } catch (error) { }
    }

    function setStatus(message) {
        statusElement && (statusElement.textContent = message || "");
    }

    function loadPersistedOutput() {
        if (!outputElement) return;
        try {
            var savedOutput = sessionStorage.getItem(persistKey);
            if (savedOutput) outputElement.textContent = savedOutput;
        } catch (error) { }
    }

    function savePersistedOutput() {
        if (!outputElement) return;
        try {
            var currentOutput = outputElement.textContent || "";
            if (currentOutput.length > persistMax)
                currentOutput = currentOutput.slice(currentOutput.length - persistMax);
            sessionStorage.setItem(persistKey, currentOutput);
        } catch (error) { }
    }

    function appendText(text) {
        if (!outputElement) return;
        if (!text) return;
        outputElement.textContent += text;
        if (outputElement.textContent.length > persistMax)
            outputElement.textContent = outputElement.textContent.slice(outputElement.textContent.length - persistMax);
        savePersistedOutput();
        outputElement.scrollTop = outputElement.scrollHeight;
    }

    async function pollOnce() {
        if (!APP_STATE.console.running) return;
        try {
            var formData = new FormData();
            if (tokenInput && tokenInput.value) formData.append("token", tokenInput.value);
            var response = await fetch("/console/poll", { method: "POST", body: formData });
            if (!response.ok) {
                setStatus(t("console.status.http") + " " + response.status);
                return;
            }
            var responseText = await response.text();
            var payload;
            try {
                payload = JSON.parse(responseText);
            } catch (error) {
                setStatus(t("console.status.parse"));
                return;
            }
            payload && payload.data && appendText(payload.data);
        } catch (error) {
            setStatus(t("console.status.error") + " " + (error && error.message ? error.message : String(error)));
        }
    }

    function schedulePoll() {
        APP_STATE.console.pollTimer && clearTimeout(APP_STATE.console.pollTimer);
        APP_STATE.console.pollTimer = setTimeout(async function () {
            await pollOnce();
            schedulePoll();
        }, 300);
    }

    window.consoleSend = async function () {
        if (!commandInput || !commandInput.value) return;
        saveToken();
        var commandLine = String(commandInput.value);
        commandInput.value = "";
        APP_STATE.console.history.unshift(commandLine);
        APP_STATE.console.history.length > 50 && (APP_STATE.console.history.length = 50);
        APP_STATE.console.histPos = -1;

        try {
            var formData = new FormData();
            formData.append("cmd", commandLine);
            if (tokenInput && tokenInput.value) formData.append("token", tokenInput.value);
            setStatus(t("console.status.running"));
            var response = await fetch("/console/exec", { method: "POST", body: formData });
            var responseText = await response.text();
            if (!response.ok) {
                setStatus(t("console.status.http") + " " + response.status + (responseText ? ": " + responseText : ""));
                return;
            }
            try {
                var payload = JSON.parse(responseText);
                setStatus(t("console.status.ret") + " " + (payload && typeof payload.ret !== "undefined" ? payload.ret : "?"));
            } catch (error) {
                setStatus(t("console.status.done"));
            }
        } catch (error) {
            setStatus(t("console.status.error") + " " + (error && error.message ? error.message : String(error)));
        }
    };

    window.consoleClear = async function () {
        saveToken();
        try {
            var formData = new FormData();
            if (tokenInput && tokenInput.value) formData.append("token", tokenInput.value);
            var response = await fetch("/console/clear", { method: "POST", body: formData });
            if (response.ok) {
                outputElement && (outputElement.textContent = "");
                try { sessionStorage.removeItem(persistKey); } catch (error) { }
                setStatus(t("console.status.cleared"));
            } else {
                setStatus(t("console.status.http") + " " + response.status);
            }
        } catch (error) {
            setStatus(t("console.status.error") + " " + (error && error.message ? error.message : String(error)));
        }
    };

    if (commandInput) {
        commandInput.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                event.preventDefault();
                window.consoleSend();
                return;
            }
            if (event.key === "ArrowUp") {
                var historyEntries = APP_STATE.console.history;
                if (!historyEntries || !historyEntries.length) return;
                APP_STATE.console.histPos = Math.min(historyEntries.length - 1, APP_STATE.console.histPos + 1);
                commandInput.value = historyEntries[APP_STATE.console.histPos] || "";
                event.preventDefault();
                return;
            }
            if (event.key === "ArrowDown") {
                var historyEntriesDown = APP_STATE.console.history;
                if (!historyEntriesDown || !historyEntriesDown.length) return;
                APP_STATE.console.histPos = Math.max(-1, APP_STATE.console.histPos - 1);
                commandInput.value = APP_STATE.console.histPos >= 0 ? (historyEntriesDown[APP_STATE.console.histPos] || "") : "";
                event.preventDefault();
            }
        });
    }

    APP_STATE.console.running = true;
    loadToken();
    loadPersistedOutput();
    setStatus(t("console.status.ready"));
    schedulePoll();
}

function envInit() {
    var listElement = document.getElementById("env_list");
    var nameInput = document.getElementById("env_name");
    var valueInput = document.getElementById("env_value");
    var statusElement = document.getElementById("env_status");
    var countElement = document.getElementById("env_count");
    var fileInput = document.getElementById("env_file");

    function setStatus(message) {
        statusElement && (statusElement.textContent = message || "");
    }

    function countLines(text) {
        if (!text) return 0;
        var lines = text.split("\n");
        var lineCount = 0;
        for (var lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            if (lines[lineIndex] && lines[lineIndex].indexOf("=") > 0)
                lineCount++;
        }
        return lineCount;
    }

    window.envRefresh = async function () {
        try {
            setStatus(t("env.status.loading"));
            var response = await fetch("/env/list", { method: "GET" });
            if (!response.ok) {
                setStatus(t("env.status.http") + " " + response.status);
                return;
            }
            var responseText = await response.text();
            listElement && (listElement.textContent = responseText || "");
            countElement && (countElement.textContent = t("env.count") + " " + countLines(responseText));
            setStatus(t("env.status.ready"));
        } catch (error) {
            setStatus(t("env.status.error") + " " + (error && error.message ? error.message : String(error)));
        }
    };

    window.envSet = async function () {
        if (!nameInput || !nameInput.value) {
            alert(t("env.error.no_name"));
            return;
        }
        try {
            var formData = new FormData();
            formData.append("name", nameInput.value);
            formData.append("value", valueInput ? valueInput.value : "");
            setStatus(t("env.status.saving"));
            var response = await fetch("/env/set", { method: "POST", body: formData });
            var responseText = await response.text();
            if (!response.ok) {
                setStatus(t("env.status.error") + " " + (responseText || response.status));
                return;
            }
            setStatus(t("env.status.saved"));
            window.envRefresh();
        } catch (error) {
            setStatus(t("env.status.error") + " " + (error && error.message ? error.message : String(error)));
        }
    };

    window.envUnset = async function () {
        if (!nameInput || !nameInput.value) {
            alert(t("env.error.no_name"));
            return;
        }
        if (!confirm(t("env.confirm.delete") + " " + nameInput.value + " ?"))
            return;
        try {
            var formData = new FormData();
            formData.append("name", nameInput.value);
            setStatus(t("env.status.saving"));
            var response = await fetch("/env/unset", { method: "POST", body: formData });
            var responseText = await response.text();
            if (!response.ok) {
                setStatus(t("env.status.error") + " " + (responseText || response.status));
                return;
            }
            setStatus(t("env.status.deleted"));
            window.envRefresh();
        } catch (error) {
            setStatus(t("env.status.error") + " " + (error && error.message ? error.message : String(error)));
        }
    };

    window.envReset = async function () {
        if (!confirm(t("env.confirm.reset")))
            return;
        try {
            setStatus(t("env.status.saving"));
            var response = await fetch("/env/reset", { method: "POST" });
            var responseText = await response.text();
            if (!response.ok) {
                setStatus(t("env.status.error") + " " + (responseText || response.status));
                return;
            }
            setStatus(t("env.status.reset"));
            window.envRefresh();
        } catch (error) {
            setStatus(t("env.status.error") + " " + (error && error.message ? error.message : String(error)));
        }
    };

    window.envRestore = async function () {
        if (!fileInput || !fileInput.files || !fileInput.files.length) {
            alert(t("env.error.no_file"));
            return;
        }
        if (!confirm(t("env.confirm.restore")))
            return;
        try {
            var formData = new FormData();
            formData.append("envfile", fileInput.files[0]);
            setStatus(t("env.status.saving"));
            var response = await fetch("/env/restore", { method: "POST", body: formData });
            var responseText = await response.text();
            if (!response.ok) {
                setStatus(t("env.status.error") + " " + (responseText || response.status));
                return;
            }
            setStatus(t("env.status.restored"));
            window.envRefresh();
        } catch (error) {
            setStatus(t("env.status.error") + " " + (error && error.message ? error.message : String(error)));
        }
    };

    window.envRefresh();
}

function appInit(pageName) {
    APP_STATE.page = pageName || "";
    APP_STATE.i18nEnabled = isI18nAvailable();
    APP_STATE.lang = detectLang();
    APP_STATE.theme = detectTheme();
    setTheme(APP_STATE.theme, { persistEnv: false, persistLocal: true, silent: true });
    setLang(APP_STATE.lang);
    ensureSidebar();
    ensureBranding();
    ensureFavicon();
    applyI18n(document);
    updateDocumentTitle();
    loadThemeColor();
    loadThemeMode();
    setTimeout(function () {
        document.body.classList.add("ready")
    }, 0);
    getversion();
    // Fetch system info and storage/partition info for display
    getSysInfo();
    getStorageInfoForSysinfo();
    // getCurrentMtdLayout();
    (pageName === "index" || pageName === "initramfs") && getmtdlayoutlist();
    pageName === "backup" && backupInit();
    pageName === "flash" && flashInit();
    pageName === "console" && consoleInit();
    pageName === "env" && envInit()

    const Yuzhii_VERSION = 'UBOOT-MTK-20250711';
    const Yuzhii_LINK = 'https://github.com/Yuzhii0718/';
    console.log('\n%c Yuzhii0718 ' + Yuzhii_VERSION + ' %c ' + Yuzhii_LINK + ' ', 'color: #fadfa3; background: #030307; padding:5px 0;', 'background: #fadfa3; padding:5px 0;');
}

function updateGptNavVisibility() {
    // Hide GPT update entry when no MMC is present (runtime detection).
    // If backupinfo is unavailable, keep it visible (fallback behavior).
    var gptNavLink = document.querySelector("#sidebar [data-nav-id='gpt']");
    if (!gptNavLink) return;
    var backupInfo = APP_STATE.backupinfo;
    if (!backupInfo || !backupInfo.mmc || typeof backupInfo.mmc.present === "undefined") {
        gptNavLink.style.display = "none";
        return;
    }
    gptNavLink.style.display = backupInfo.mmc.present === false ? "none" : "";
    console.warn("GPT nav visibility updated based on MMC presence:", backupInfo.mmc.present);
}

function updateSimgNavVisibility() {
    // Hide Single Image entry unless the page is actually served.
    var simgNavLink = document.querySelector("#sidebar [data-nav-id='simg']");
    if (!simgNavLink) return;
    simgNavLink.style.display = "none";

    // Avoid repeated probes.
    if (APP_STATE._simg_probe_done) return;
    APP_STATE._simg_probe_done = true;

    try {
        fetch("/simg.html?_probe=1", { method: "GET", cache: "no-store" })
            .then(function (response) {
                if (response && response.ok) {
                    simgNavLink.style.display = "";
                    return;
                }
                console.warn("SIMG probe HTTP status:", response ? response.status : "unknown");
                console.info("If SIMG feature is not enabled, this warning is expected.");
            })
            .catch(function () { });
    } catch (error) {
        console.warn("Unexpected error during SIMG probe:", error);
    }
}

function renderSysInfo() {
    var sysinfoContainer = document.getElementById("sysinfo"), sysinfoData, boardInfo, ramInfo;
    if (!sysinfoContainer) return;
    sysinfoData = APP_STATE.sysinfo;
    if (!sysinfoData) {
        sysinfoContainer.textContent = t("sysinfo.loading");
        return
    }
    boardInfo = sysinfoData.board || {};
    ramInfo = sysinfoData.ram || {};

    while (sysinfoContainer.firstChild) sysinfoContainer.removeChild(sysinfoContainer.firstChild);
    sysinfoContainer.classList.remove("sysinfo-expanded");

    var summary = document.createElement("div");
    summary.className = "sysinfo-summary";

    var boardLine = document.createElement("div");
    boardLine.className = "sysinfo-line";
    boardLine.textContent = t("sysinfo.board") + " " + (boardInfo.model || t("sysinfo.unknown"));
    summary.appendChild(boardLine);

    var ramLine = document.createElement("div");
    ramLine.className = "sysinfo-line";
    ramLine.textContent = t("sysinfo.ram") + " " + (ramInfo.size !== undefined && ramInfo.size !== null && ramInfo.size !== 0 ? bytesToHuman(ramInfo.size) : t("sysinfo.unknown"));
    summary.appendChild(ramLine);

    if (sysinfoData.storage && sysinfoData.storage.mtd_layout) {
        var mtdSummary = sysinfoData.storage.mtd_layout || {};
        if (mtdSummary.current) {
            var curLayoutLine = document.createElement("div");
            curLayoutLine.className = "sysinfo-line";
            curLayoutLine.textContent = t("sysinfo.mtd.current", "MTD layout") + " " + mtdSummary.current;
            summary.appendChild(curLayoutLine);
        }
    }

    sysinfoContainer.appendChild(summary);

    var details = document.createElement("details");
    details.className = "sysinfo-details";

    var summaryNode = document.createElement("summary");
    summaryNode.textContent = t("sysinfo.more", "More info");
    details.appendChild(summaryNode);

    var extra = document.createElement("div");
    extra.className = "sysinfo-extra";

    if (sysinfoData.storage && sysinfoData.storage.mtd_layout) {
        if (mtdSummary.current_parts) {
            var curPartsLine = document.createElement("div");
            curPartsLine.className = "sysinfo-line sysinfo-mtdparts";
            curPartsLine.textContent = t("sysinfo.mtd.parts", "MTD parts") + " " + mtdSummary.current_parts;
            extra.appendChild(curPartsLine);
        }
    }

    if (sysinfoData.build_variant) {
        var variantLine = document.createElement("div");
        variantLine.className = "sysinfo-line";
        variantLine.textContent = t("sysinfo.variant", "Variant") + " " + sysinfoData.build_variant;
        extra.appendChild(variantLine);
    }

    if (boardInfo.compatible) {
        var compatLine = document.createElement("div");
        compatLine.className = "sysinfo-line";
        compatLine.textContent = t("sysinfo.compat", "Compatible") + " " + boardInfo.compatible;
        extra.appendChild(compatLine);
    }

    if (sysinfoData.storage && sysinfoData.storage.mtd_layout) {
        var mtdLayoutInfo = sysinfoData.storage.mtd_layout || {};
        var layouts = mtdLayoutInfo.layouts || [];
        if (layouts && layouts.length) {
            var layoutTitle = document.createElement("div");
            layoutTitle.className = "sysinfo-line sysinfo-section";
            layoutTitle.textContent = t("sysinfo.mtd.layouts", "MTD layouts");
            extra.appendChild(layoutTitle);

            var layoutList = document.createElement("ul");
            layoutList.className = "sysinfo-list";
            for (var layoutIndex = 0; layoutIndex < layouts.length; layoutIndex++) {
                var item = layouts[layoutIndex] || {};
                var entry = document.createElement("li");
                var parts = item.parts ? " " + item.parts : "";
                entry.textContent = (item.label || "-") + ":" + parts;
                layoutList.appendChild(entry);
            }
            extra.appendChild(layoutList);
        }
    }

    if (sysinfoData.storage && sysinfoData.storage.mmc && sysinfoData.storage.mmc.present) {
        var mmcInfo = sysinfoData.storage.mmc;
        var mmcTitle = document.createElement("div");
        mmcTitle.className = "sysinfo-line sysinfo-section";
        mmcTitle.textContent = t("sysinfo.mmc", "MMC partitions");
        extra.appendChild(mmcTitle);

        if (mmcInfo.parts && mmcInfo.parts.length) {
            var list = document.createElement("ul");
            list.className = "sysinfo-list";
            for (var partitionIndex = 0; partitionIndex < mmcInfo.parts.length; partitionIndex++) {
                var partition = mmcInfo.parts[partitionIndex];
                var listItem = document.createElement("li");
                var sizeText = partition.size ? bytesToHuman(partition.size) : t("sysinfo.unknown");
                listItem.textContent = (partition.name || "-") + " (" + sizeText + ")";
                list.appendChild(listItem);
            }
            extra.appendChild(list);
        } else {
            var empty = document.createElement("div");
            empty.className = "sysinfo-line";
            empty.textContent = t("sysinfo.mmc.none", "No partitions");
            extra.appendChild(empty);
        }
    }

    if (extra.childNodes.length) {
        details.appendChild(extra);
        sysinfoContainer.appendChild(details);

        var toggleExpanded = function () {
            details.open ? sysinfoContainer.classList.add("sysinfo-expanded") : sysinfoContainer.classList.remove("sysinfo-expanded");
        };
        details.addEventListener("toggle", toggleExpanded);
        toggleExpanded();
    }
}

function getSysInfo() {
    // Always fetch sysinfo into APP_STATE (used by features like backup filename),
    // but only render when the sysinfo element exists on current page.
    var sysinfoElement = document.getElementById("sysinfo");
    sysinfoElement && renderSysInfo();
    ajax({
        url: "/sysinfo",
        done: function (responseText) {
            try {
                APP_STATE.sysinfo = JSON.parse(responseText)
            } catch (error) {
                return
            }
            sysinfoElement && renderSysInfo()
        }
    })
}

async function ensureSysInfoLoaded() {
    // On pages without #sysinfo (e.g. backup.html), we still need board model.
    if (APP_STATE.sysinfo && APP_STATE.sysinfo.board && APP_STATE.sysinfo.board.model)
        return APP_STATE.sysinfo;

    if (APP_STATE._sysinfo_promise)
        return await APP_STATE._sysinfo_promise;

    APP_STATE._sysinfo_promise = (async function () {
        try {
            var response = await fetch("/sysinfo", { method: "GET" });
            if (!response || !response.ok) return null;
            var payload = await response.json();
            payload && (APP_STATE.sysinfo = payload);
            return payload;
        } catch (error) {
            return null;
        } finally {
            // allow retry later
            APP_STATE._sysinfo_promise = null;
        }
    })();

    return await APP_STATE._sysinfo_promise;
}

function getStorageInfoForSysinfo() {
    // Pull /backup/info to render current partition table in the sysinfo box
    if (APP_STATE.backupinfo) {
        updateGptNavVisibility();
        return;
    }
    ajax({
        url: "/backup/info",
        done: function (responseText) {
            try {
                APP_STATE.backupinfo = JSON.parse(responseText);
            } catch (error) { return; }
            updateGptNavVisibility();
            renderSysInfo();
        }
    });
}

function getCurrentMtdLayout() {
    // Get current mtd layout label if multi-layout is enabled
    ajax({
        url: "/getmtdlayout",
        done: function (resp) {
            if (!resp || resp === "error") return;
            var parts = resp.split(";");
            if (parts.length > 0 && parts[0]) {
                APP_STATE.mtd_layout_current = parts[0];
                renderSysInfo();
            }
        }
    });
}

function startup() {
    appInit("index")
}

function getmtdlayoutlist() {
    ajax({
        url: "/getmtdlayout",
        done: function (responseText) {
            var layoutNames, currentLayoutElement, chooseLayoutElement, layoutSelect, layoutIndex, layoutContainer;
            if (responseText != "error" && (layoutNames = responseText.split(";"), currentLayoutElement = document.getElementById("current_mtd_layout"), currentLayoutElement && (currentLayoutElement.innerHTML = t("label.current_mtd") + layoutNames[0]), chooseLayoutElement = document.getElementById("choose_mtd_layout"), chooseLayoutElement && (chooseLayoutElement.textContent = t("label.choose_mtd")), layoutSelect = document.getElementById("mtd_layout_label"), layoutSelect)) {
                for (layoutSelect.options.length = 0, layoutIndex = 1; layoutIndex < layoutNames.length; layoutIndex++) layoutNames[layoutIndex].length > 0 && layoutSelect.options.add(new Option(layoutNames[layoutIndex], layoutNames[layoutIndex]));
                layoutContainer = document.getElementById("mtd_layout");
                layoutContainer && (layoutContainer.style.display = "")
            }
        }
    })
}

function getversion() {
    ajax({
        url: "/version",
        done: function (versionText) {
            var versionElement = document.getElementById("version");
            versionElement && (versionElement.innerHTML = versionText);
            ensureBranding()
        }
    })
}

function upload(formFieldName) {
    var selectedFile = document.getElementById("file").files[0],
        formElement, hintElement, progressBarElement, formData, layoutSelect, layoutIndex, selectedLayoutName;
    selectedFile && (selectedLayoutName = selectedFile.name || "", formElement = document.getElementById("form"), formElement && (formElement.style.display = "none"), hintElement = document.getElementById("hint"), hintElement && (hintElement.style.display = "none"), progressBarElement = document.getElementById("bar"), progressBarElement && (progressBarElement.style.display = "block"), formData = new FormData, formData.append(formFieldName, selectedFile), layoutSelect = document.getElementById("mtd_layout_label"), layoutSelect && layoutSelect.options.length > 0 && (layoutIndex = layoutSelect.selectedIndex, formData.append("mtd_layout", layoutSelect.options[layoutIndex].value)), ajax({
        url: "/upload",
        data: formData,
        done: function (responseText) {
            var responseParts, sizeElement, md5Element, mtdElement, upgradeElement, filenameElement, md5InName, md5Hint, md5Ok, md5Match, md5Class;
            responseText == "fail" ? location = "/fail.html" : (responseParts = responseText.split(" "), filenameElement = document.getElementById("filename"), filenameElement && selectedLayoutName && (filenameElement.style.display = "block", filenameElement.innerHTML = "<span class=\"filename-label\">" + t("label.file") + "</span><span class=\"filename-value\">" + selectedLayoutName + "</span>"), sizeElement = document.getElementById("size"), sizeElement && (sizeElement.style.display = "block", sizeElement.innerHTML = t("label.size") + responseParts[0]), md5Element = document.getElementById("md5"), md5Match = selectedLayoutName ? /(?:^|[._-])md5-([0-9a-fA-F]{32})(?:$|[._-])/.exec(selectedLayoutName) : null, md5InName = md5Match && md5Match[1] ? md5Match[1] : "", md5Element && (md5Element.style.display = "block", md5Ok = responseParts[1] && md5InName && String(responseParts[1]).toLowerCase() === String(md5InName).toLowerCase(), md5Hint = md5InName ? (md5Ok ? t("md5.match") : t("md5.mismatch")) : "", md5Class = md5InName ? (md5Ok ? "md5-ok" : "md5-bad") : "", md5Element.innerHTML = t("label.md5") + responseParts[1] + (md5Hint ? " <span class=\"md5-status " + md5Class + "\">" + md5Hint + "</span>" : "")), mtdElement = document.getElementById("mtd"), mtdElement && responseParts[2] && (mtdElement.style.display = "block", mtdElement.innerHTML = t("label.mtd") + responseParts[2]), upgradeElement = document.getElementById("upgrade"), upgradeElement && (upgradeElement.style.display = "block"))
        },
        progress: function (progressEvent) {
            if (progressEvent.total) {
                var percent = parseInt(progressEvent.loaded / progressEvent.total * 100),
                    progressElement = document.getElementById("bar");
                progressElement && (progressElement.style.display = "block", progressElement.style.setProperty("--percent", percent))
            }
        }
    }))
}

function bytesToHuman(bytes) {
    var numericBytes;
    return bytes === null || bytes === undefined ? "" : (numericBytes = Number(bytes), !isFinite(numericBytes) || numericBytes < 0) ? "" : numericBytes >= 1024 * 1024 * 1024 ? (numericBytes / (1024 * 1024 * 1024)).toFixed(2) + " GiB" : numericBytes >= 1024 * 1024 ? (numericBytes / (1024 * 1024)).toFixed(2) + " MiB" : numericBytes >= 1024 ? (numericBytes / 1024).toFixed(2) + " KiB" : String(Math.floor(numericBytes)) + " B"
}

function parseFilenameFromDisposition(dispositionHeader) {
    var quotedFilenameMatch, unquotedFilenameMatch;
    return dispositionHeader ? (quotedFilenameMatch = /filename\s*=\s*"([^"]+)"/i.exec(dispositionHeader), quotedFilenameMatch && quotedFilenameMatch[1]) ? quotedFilenameMatch[1] : (unquotedFilenameMatch = /filename\s*=\s*([^;\s]+)/i.exec(dispositionHeader), unquotedFilenameMatch && unquotedFilenameMatch[1] ? unquotedFilenameMatch[1].replace(/^"|"$/g, "") : "") : ""
}

function sanitizeFilenameComponent(value) {
    return value ? String(value).replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 48) : ""
}

function getNowYYYYMMDD() {
    var now = new Date, year = now.getFullYear(), month = now.getMonth() + 1, day = now.getDate();
    return String(year) + String(month).padStart(2, "0") + String(day).padStart(2, "0")
}

function makeBackupDownloadName(originalName) {
    var boardModel = (APP_STATE.sysinfo && APP_STATE.sysinfo.board && APP_STATE.sysinfo.board.model) ? APP_STATE.sysinfo.board.model : "";
    var boardComponent = sanitizeFilenameComponent(boardModel) || "board";
    var dateStamp = getNowYYYYMMDD();
    var downloadName = String(originalName || "backup.bin");

    // Ensure it starts with backup_
    downloadName.indexOf("backup_") === 0 || (downloadName = "backup_" + downloadName.replace(/^_+/, ""));

    // Insert board right after backup_ if not already
    downloadName.indexOf("backup_" + boardComponent + "_") === 0 || (downloadName = downloadName.replace(/^backup_/, "backup_" + boardComponent + "_"));

    // Ensure .bin extension
    /\.[A-Za-z0-9]+$/.test(downloadName) || (downloadName = downloadName + ".bin");

    // Append date before extension if not already present
    /_\d{8}\.[A-Za-z0-9]+$/.test(downloadName) || (downloadName = downloadName.replace(/(\.[A-Za-z0-9]+)$/, "_" + dateStamp + "$1"));

    return downloadName
}

function parseUserLen(input) {
    var match, numericValue, suffix;
    if (!input) return null;
    if (input = String(input).trim(), input === "") return null;
    match = /^\s*(0x[0-9a-fA-F]+|\d+)\s*([a-zA-Z]*)\s*$/.exec(input);
    if (!match) return null;
    numericValue = match[1].toLowerCase().indexOf("0x") === 0 ? parseInt(match[1], 16) : parseInt(match[1], 10);
    if (!isFinite(numericValue) || numericValue < 0) return null;
    suffix = (match[2] || "").toLowerCase();
    return suffix === "" ? numericValue : suffix === "k" || suffix === "kb" || suffix === "kib" ? numericValue * 1024 : null
}

function flashSetStatus(message) {
    var statusElement = document.getElementById("flash_status");
    var txt = document.getElementById("flash_status_text");
    var spin = document.getElementById("flash_spinner");
    var busy = message === t("flash.status.uploading") || message === t("flash.status.restoring");
    if (!statusElement) return;
    statusElement.style.display = message ? "flex" : "none";
    txt && (txt.textContent = message || "");
    spin && (spin.style.display = busy ? "block" : "none");
}

function flashSetProgress(percent) {
    var progressElement = document.getElementById("flash_restore_bar"), boundedPercent;
    if (!progressElement) return;
    if (percent === null || percent === undefined) {
        progressElement.style.display = "none";
        return;
    }
    boundedPercent = Math.max(0, Math.min(100, parseInt(percent || 0)));
    progressElement.style.display = "block";
    progressElement.style.setProperty("--percent", boundedPercent)
}

function flashUpdateRangeHint() {
    var rangeHintElement = document.getElementById("flash_range_hint"), startValue, endValue, rangeSize;
    if (!rangeHintElement) return;
    startValue = parseUserLen(document.getElementById("flash_start").value);
    endValue = parseUserLen(document.getElementById("flash_end").value);
    startValue === null || endValue === null ? rangeHintElement.textContent = t("backup.range.hint") : (rangeSize = endValue >= startValue ? endValue - startValue : 0, rangeHintElement.textContent = "Start=" + bytesToHuman(startValue) + ", End=" + bytesToHuman(endValue) + ", Size=" + bytesToHuman(rangeSize))
}

function flashPadHex(value, width) {
    var hexString = value.toString(16).toUpperCase();
    while (hexString.length < width) hexString = "0" + hexString;
    return hexString
}

function flashExtractBytes(text) {
    var bytes = [];
    if (!text) return bytes;
    var byteMatches = text.match(/[0-9a-fA-F]{2}/g);
    if (!byteMatches) return bytes;
    for (var byteIndex = 0; byteIndex < byteMatches.length; byteIndex++) bytes.push(parseInt(byteMatches[byteIndex], 16));
    return bytes
}

function flashPosToByteIndex(text, pos) {
    var charIndex, hexDigitCount = 0;
    if (!text || pos <= 0) return 0;
    for (charIndex = 0; charIndex < pos && charIndex < text.length; charIndex++) {
        if (/[0-9a-fA-F]/.test(text[charIndex])) hexDigitCount++;
    }
    return Math.floor(hexDigitCount / 2)
}

function flashByteIndexToPos(byteIndex) {
    if (!isFinite(byteIndex) || byteIndex < 0) return 0;
    var lineIndex = Math.floor(byteIndex / 16);
    var columnIndex = byteIndex % 16;
    return lineIndex * 48 + columnIndex * 3
}

function flashSetCaretToByte(byteIndex) {
    var data = document.getElementById("flash_data");
    if (!data) return;
    var pos = flashByteIndexToPos(byteIndex);
    data.focus();
    data.setSelectionRange(pos, pos);
    flashSyncScroll()
}

function flashFormatHexLines(bytes) {
    var lines = [];
    for (var byteIndex = 0; byteIndex < bytes.length; byteIndex++) {
        if (byteIndex && byteIndex % 16 === 0) lines.push("\n");
        lines.push(flashPadHex(bytes[byteIndex], 2));
        if (byteIndex % 16 !== 15 && byteIndex !== bytes.length - 1) lines.push(" ");
    }
    return lines.join("")
}

function flashRenderHexViews() {
    var dataElement = document.getElementById("flash_data");
    var offsetElement = document.getElementById("flash_offset");
    var asciiElement = document.getElementById("flash_ascii");
    var start = document.getElementById("flash_start");
    if (!dataElement || !offsetElement || !asciiElement) return;
    var bytes = flashExtractBytes(dataElement.value || "");
    var base = start ? parseUserLen(start.value) : 0;
    base = base === null ? 0 : base;
    var asciiLines = [];
    var offLines = [];
    var rowIndex, columnIndex, rowBytes, byteValue;
    for (rowIndex = 0; rowIndex < bytes.length; rowIndex += 16) {
        rowBytes = bytes.slice(rowIndex, rowIndex + 16);
        offLines.push("0x" + flashPadHex(base + rowIndex, 8));
        for (columnIndex = 0; columnIndex < rowBytes.length; columnIndex++) {
            byteValue = rowBytes[columnIndex];
            asciiLines.push(byteValue >= 0x20 && byteValue <= 0x7E ? String.fromCharCode(byteValue) : ".");
        }
        if (rowBytes.length < 16) {
            for (columnIndex = rowBytes.length; columnIndex < 16; columnIndex++) asciiLines.push(" ");
        }
        asciiLines.push("\n");
    }
    offsetElement.textContent = offLines.join("\n");
    asciiElement.textContent = asciiLines.join("").replace(/\n$/, "");
}

function flashNormalizeHexInput() {
    var dataElement = document.getElementById("flash_data");
    if (!dataElement) return;
    var bytes = flashExtractBytes(dataElement.value || "");
    dataElement.value = flashFormatHexLines(bytes);
    flashRenderHexViews()
}

function flashAlignInput(keepCaret) {
    var dataElement = document.getElementById("flash_data");
    if (!dataElement) return;
    var caretPosition = dataElement.selectionStart || 0;
    var byteIndex = flashPosToByteIndex(dataElement.value || "", caretPosition);
    var bytes = flashExtractBytes(dataElement.value || "");
    dataElement.value = flashFormatHexLines(bytes);
    if (keepCaret)
        flashSetCaretToByte(byteIndex);
    flashRenderHexViews()
}

function flashFormatData() {
    if (!confirm(t("flash.confirm.format"))) return;
    flashAlignInput(false);
    flashSetStatus(t("flash.status.formatted"))
}

function flashSnapCaret() {
    var dataElement = document.getElementById("flash_data");
    if (!dataElement) return;
    var caretPosition = dataElement.selectionStart || 0;
    var byteIndex = flashPosToByteIndex(dataElement.value || "", caretPosition);
    flashSetCaretToByte(byteIndex)
}

function flashSyncScroll() {
    var dataElement = document.getElementById("flash_data");
    var offsetElement = document.getElementById("flash_offset");
    var asciiElement = document.getElementById("flash_ascii");
    if (!dataElement || !offsetElement || !asciiElement) return;
    offsetElement.scrollTop = dataElement.scrollTop;
    asciiElement.scrollTop = dataElement.scrollTop
}

function flashJumpToOffset() {
    var jumpInput = document.getElementById("flash_jump");
    var start = document.getElementById("flash_start");
    var dataElement = document.getElementById("flash_data");
    if (!jumpInput || !dataElement) return;
    var targetOffset = parseUserLen(jumpInput.value);
    if (targetOffset === null) {
        flashSetStatus(t("flash.error.jump"));
        return
    }
    var base = start ? parseUserLen(start.value) : 0;
    base = base === null ? 0 : base;
    var bytes = flashExtractBytes(dataElement.value || "");
    var byteIndex = targetOffset - base;
    if (byteIndex < 0 || byteIndex >= bytes.length) {
        flashSetStatus(t("flash.error.jump"));
        return
    }
    flashSetCaretToByte(byteIndex);
    var lineHeight = parseFloat(getComputedStyle(dataElement).lineHeight) || 18;
    var lineIndex = Math.floor(byteIndex / 16);
    dataElement.scrollTop = lineIndex * lineHeight;
    flashSyncScroll();
    flashSetStatus("")
}

function flashFindLastBefore(str, sub, limit) {
    var idx = -1, cur = str.indexOf(sub);
    while (cur !== -1 && cur < limit) {
        idx = cur;
        cur = str.indexOf(sub, cur + 1)
    }
    return idx
}

function flashParseBackupFilename(name) {
    if (!name) return null;
    var rangeIdx = name.indexOf("_0x"), dashIdx, startStr, endStr, start, end;
    if (rangeIdx < 0) return null;
    dashIdx = name.indexOf("-0x", rangeIdx);
    if (dashIdx < 0) return null;
    startStr = name.slice(rangeIdx + 1, dashIdx);
    endStr = name.slice(dashIdx + 1);
    start = /^0x[0-9a-fA-F]+/.exec(startStr);
    end = /^0x[0-9a-fA-F]+/.exec(endStr);
    if (!start || !end) return null;
    start = parseInt(start[0], 16);
    end = parseInt(end[0], 16);
    if (!isFinite(start) || !isFinite(end) || end <= start) return null;
    var mtdIdx = flashFindLastBefore(name, "_mtd_", rangeIdx);
    var mmcIdx = flashFindLastBefore(name, "_mmc_", rangeIdx);
    var stypeIdx = mtdIdx >= 0 && mmcIdx >= 0 ? (mtdIdx > mmcIdx ? mtdIdx : mmcIdx) : (mtdIdx >= 0 ? mtdIdx : mmcIdx);
    if (stypeIdx < 0) return null;
    var storage = stypeIdx === mtdIdx ? "mtd" : "mmc";
    var seg = name.slice(stypeIdx + 5, rangeIdx);
    if (!seg) return null;
    var parts = seg.split("_");
    var target = parts[parts.length - 1];
    if (!target) return null;
    return { storage: storage, target: target, start: start, end: end }
}

function flashSelectTarget(val) {
    var targetSelect = document.getElementById("flash_target"), optionIndex;
    if (!targetSelect) return false;
    for (optionIndex = 0; optionIndex < targetSelect.options.length; optionIndex++) if (targetSelect.options[optionIndex].value === val) {
        targetSelect.selectedIndex = optionIndex;
        return true
    }
    return false
}

function flashGetDeviceNameByStorage(storage) {
    var backupInfo = APP_STATE && APP_STATE.backupinfo ? APP_STATE.backupinfo : null;
    var mmcName = "";
    var mtdName = "";
    if (backupInfo && backupInfo.mmc && backupInfo.mmc.present) {
        mmcName = [backupInfo.mmc.vendor || "", backupInfo.mmc.product || ""].join(" ").trim();
        if (!mmcName) mmcName = "MMC";
    }
    if (backupInfo && backupInfo.mtd && backupInfo.mtd.present) {
        mtdName = (backupInfo.mtd.model || "").trim();
        if (!mtdName) mtdName = "MTD";
    }
    if (storage === "mtd") return mtdName || "MTD";
    if (storage === "mmc") return mmcName || "MMC";
    return mtdName || mmcName || "device";
}

function flashBuildErasePlan() {
    var targetSelect = document.getElementById("flash_target");
    var startInput = document.getElementById("flash_start");
    var endInput = document.getElementById("flash_end");
    var targetValue, targetParts, storageType, targetName, isRawTarget;
    var startText, endText, hasStartRange, hasEndRange, startValue, endValue;
    var targetLabel, detailText;

    if (!targetSelect || !targetSelect.value)
        return { error: t("flash.error.no_target") };

    targetValue = String(targetSelect.value);
    targetParts = targetValue.split(":");
    storageType = targetParts.length > 1 ? targetParts[0] : "auto";
    targetName = targetParts.length > 1 ? targetParts.slice(1).join(":") : targetValue;
    isRawTarget = targetName === "raw";

    startText = startInput && startInput.value ? String(startInput.value).trim() : "";
    endText = endInput && endInput.value ? String(endInput.value).trim() : "";
    hasStartRange = !!startText;
    hasEndRange = !!endText;

    if (hasStartRange !== hasEndRange)
        return { error: t("flash.error.bad_range") };

    if (hasStartRange && hasEndRange) {
        startValue = parseUserLen(startText);
        endValue = parseUserLen(endText);
        if (startValue === null || endValue === null || endValue <= startValue)
            return { error: t("flash.error.bad_range") };
    }

    if (isRawTarget && !hasStartRange)
        return { error: t("flash.error.bad_range") + " (raw target requires start/end)" };

    targetLabel = isRawTarget ? "" : (targetName + " 分区");
    detailText = hasStartRange ? (isRawTarget ? ("0x" + startValue.toString(16) + "~0x" + endValue.toString(16)) : (targetLabel + " 的 0x" + startValue.toString(16) + "~0x" + endValue.toString(16))) : targetLabel;

    return {
        storage: storageType,
        target: targetValue,
        hasRange: hasStartRange,
        start: hasStartRange ? startValue : null,
        end: hasStartRange ? endValue : null,
        detail: detailText,
        deviceName: flashGetDeviceNameByStorage(storageType)
    };
}

function flashInit() {
    var targetSelect = document.getElementById("flash_target");
    var startInput = document.getElementById("flash_start");
    var endInput = document.getElementById("flash_end");
    var dataElement = document.getElementById("flash_data");
    var infoElement = document.getElementById("flash_info");
    var restoreInfoElement = document.getElementById("flash_restore_info");
    var backupInput = document.getElementById("flash_backup");

    startInput && (startInput.oninput = function () { flashUpdateRangeHint(); flashRenderHexViews(); });
    endInput && (endInput.oninput = flashUpdateRangeHint);
    flashUpdateRangeHint();
    flashRenderHexViews();
    flashSetStatus("");

    if (dataElement) {
        dataElement.addEventListener("input", function () { flashAlignInput(true); });
        dataElement.addEventListener("blur", function () { flashAlignInput(false); });
        dataElement.addEventListener("click", flashSnapCaret);
        dataElement.addEventListener("keyup", flashSnapCaret);
        dataElement.addEventListener("scroll", flashSyncScroll);
    }

    backupInput && (backupInput.onchange = function () {
        var selectedFile = backupInput.files && backupInput.files.length ? backupInput.files[0] : null;
        var parsedBackup = selectedFile ? flashParseBackupFilename(selectedFile.name) : null;
        if (!parsedBackup) {
            restoreInfoElement && (restoreInfoElement.textContent = t("flash.detected.none"));
            return;
        }
        restoreInfoElement && (restoreInfoElement.textContent = parsedBackup.storage + ":" + parsedBackup.target + " 0x" + parsedBackup.start.toString(16) + "-0x" + parsedBackup.end.toString(16));
        flashSelectTarget(parsedBackup.storage + ":" + parsedBackup.target);
        startInput && (startInput.value = "0x" + parsedBackup.start.toString(16));
        endInput && (endInput.value = "0x" + parsedBackup.end.toString(16));
        flashUpdateRangeHint();
        flashRenderHexViews();
    });

    ajax({
        url: "/backup/info",
        done: function (responseText) {
            var backupInfo, infoParts, placeholderOption, rawOption;
            try {
                backupInfo = JSON.parse(responseText);
            } catch (error) {
                flashSetStatus("backupinfo parse failed");
                return;
            }

            if (infoElement) {
                infoParts = [];
                backupInfo.mmc && backupInfo.mmc.present ? infoParts.push("MMC: " + (backupInfo.mmc.vendor || "") + " " + (backupInfo.mmc.product || "")) : infoParts.push("MMC: " + t("backup.storage.not_present"));
                backupInfo.mtd && backupInfo.mtd.present ? infoParts.push("MTD: " + (backupInfo.mtd.model || "")) : infoParts.push("MTD: " + t("backup.storage.not_present"));
                infoElement.textContent = infoParts.join(" | ");
            }

            if (!targetSelect) return;
            targetSelect.options.length = 0;
            placeholderOption = document.createElement("option");
            placeholderOption.value = "";
            placeholderOption.dataset.i18nKey = "backup.target.placeholder";
            targetSelect.appendChild(placeholderOption);

            if (backupInfo.mmc && backupInfo.mmc.present) {
                rawOption = document.createElement("option");
                rawOption.value = "mmc:raw";
                rawOption.textContent = "[MMC] raw";
                targetSelect.appendChild(rawOption);
                backupInfo.mmc.parts && backupInfo.mmc.parts.length && backupInfo.mmc.parts.forEach(function (partition) {
                    var partitionOption;
                    if (!partition || !partition.name) return;
                    partitionOption = document.createElement("option");
                    partitionOption.value = "mmc:" + partition.name;
                    partitionOption.textContent = "[MMC] " + partition.name + (partition.size ? " (" + bytesToHuman(partition.size) + ")" : "");
                    targetSelect.appendChild(partitionOption);
                });
            }

            if (backupInfo.mtd && backupInfo.mtd.present && backupInfo.mtd.parts && backupInfo.mtd.parts.length) {
                var mtdType = backupInfo.mtd.type;
                var hasMasterPartitions = mtdType === 3 || mtdType === 4 || mtdType === 8;
                var masterPartitions = [];

                if (hasMasterPartitions) {
                    backupInfo.mtd.parts.forEach(function (partition) {
                        if (partition && partition.name && partition.master)
                            masterPartitions.push(partition);
                    });
                }

                hasMasterPartitions && masterPartitions.length && masterPartitions.forEach(function (partition) {
                    var fullDiskOption = document.createElement("option");
                    fullDiskOption.value = "mtd:" + partition.name;
                    fullDiskOption.dataset.mtdName = partition.name;
                    fullDiskOption.dataset.size = partition.size ? String(partition.size) : "";
                    fullDiskOption.dataset.kind = "mtd-full";
                    targetSelect.appendChild(fullDiskOption);
                });

                backupInfo.mtd.parts.forEach(function (partition) {
                    var partitionOption;
                    if (!partition || !partition.name) return;
                    if (hasMasterPartitions && partition.master) return;
                    partitionOption = document.createElement("option");
                    partitionOption.value = "mtd:" + partition.name;
                    partitionOption.textContent = "[MTD] " + partition.name + (partition.size ? " (" + bytesToHuman(partition.size) + ")" : "");
                    partitionOption.dataset.kind = "mtd-part";
                    targetSelect.appendChild(partitionOption);
                });
            }

            targetSelect.options.length > 1 && (targetSelect.selectedIndex = 1);
            backupRefreshI18n();
        }
    });
}

async function flashRead() {
    var targetSelect = document.getElementById("flash_target");
    var startInput = document.getElementById("flash_start");
    var endInput = document.getElementById("flash_end");
    var dataElement = document.getElementById("flash_data");
    if (!targetSelect || !startInput || !endInput) return;
    if (!targetSelect.value) {
        alert(t("flash.error.no_target"));
        return;
    }
    if (!startInput.value || !endInput.value) {
        alert(t("flash.error.bad_range"));
        return;
    }
    try {
        flashSetStatus(t("flash.status.reading"));
        var formData = new FormData();
        formData.append("op", "read");
        formData.append("storage", "auto");
        formData.append("target", targetSelect.value);
        formData.append("start", startInput.value);
        formData.append("end", endInput.value);
        var response = await fetch("/flash/read", { method: "POST", body: formData });
        var responseText = await response.text();
        if (!response.ok) {
            flashSetStatus(t("flash.status.http") + " " + response.status + (responseText ? ": " + responseText : ""));
            return;
        }
        var payload;
        try { payload = JSON.parse(responseText); } catch (error) { flashSetStatus(t("flash.status.error") + " parse"); return; }
        if (!payload || !payload.ok) {
            flashSetStatus(t("flash.status.error") + " " + (payload && payload.error ? payload.error : ""));
            return;
        }
        dataElement && (dataElement.value = payload.data || "");
        flashNormalizeHexInput();
        flashSetStatus(t("flash.status.done"));
    } catch (error) {
        flashSetStatus(t("flash.status.error") + " " + (error && error.message ? error.message : String(error)));
    }
}

async function flashWrite() {
    var targetSelect = document.getElementById("flash_target");
    var startInput = document.getElementById("flash_start");
    var dataElement = document.getElementById("flash_data");
    if (!targetSelect || !startInput || !dataElement) return;
    if (!targetSelect.value) {
        alert(t("flash.error.no_target"));
        return;
    }
    if (!startInput.value) {
        alert(t("flash.error.bad_range"));
        return;
    }
    if (!dataElement.value || !dataElement.value.trim()) {
        alert(t("flash.error.no_data"));
        return;
    }
    if (!confirm(t("flash.confirm.write"))) return;
    try {
        flashSetStatus(t("flash.status.writing"));
        var formData = new FormData();
        formData.append("op", "write");
        formData.append("storage", "auto");
        formData.append("target", targetSelect.value);
        formData.append("start", startInput.value);
        formData.append("data", dataElement.value);
        var response = await fetch("/flash/write", { method: "POST", body: formData });
        var responseText = await response.text();
        if (!response.ok) {
            flashSetStatus(t("flash.status.http") + " " + response.status + (responseText ? ": " + responseText : ""));
            return;
        }
        var payload;
        try { payload = JSON.parse(responseText); } catch (error) { flashSetStatus(t("flash.status.error") + " parse"); return; }
        if (!payload || !payload.ok) {
            flashSetStatus(t("flash.status.error") + " " + (payload && payload.error ? payload.error : ""));
            return;
        }
        flashSetStatus(t("flash.status.done"));
    } catch (error) {
        flashSetStatus(t("flash.status.error") + " " + (error && error.message ? error.message : String(error)));
    }
}

async function flashErase() {
    var erasePlan = flashBuildErasePlan();
    if (erasePlan.error) {
        alert(erasePlan.error);
        return;
    }
    if (!confirm(t("flash.confirm.erase"))) return;
    var confirmDetail = t("flash.confirm.erase_detail").replace("{device}", erasePlan.deviceName).replace("{detail}", erasePlan.detail);
    if (!confirm(confirmDetail)) return;
    try {
        flashSetStatus(t("flash.status.erasing"));
        var formData = new FormData();
        formData.append("op", "erase");
        formData.append("storage", "auto");
        formData.append("target", erasePlan.target);
        if (erasePlan.hasRange) {
            formData.append("start", "0x" + erasePlan.start.toString(16));
            formData.append("end", "0x" + erasePlan.end.toString(16));
        }
        var response = await fetch("/flash/erase", { method: "POST", body: formData });
        var responseText = await response.text();
        if (!response.ok) {
            flashSetStatus(t("flash.status.http") + " " + response.status + (responseText ? ": " + responseText : ""));
            return;
        }
        var payload;
        try { payload = JSON.parse(responseText); } catch (error) { flashSetStatus(t("flash.status.error") + " parse"); return; }
        if (!payload || !payload.ok) {
            flashSetStatus(t("flash.status.error") + " " + (payload && payload.error ? payload.error : ""));
            return;
        }
        flashSetStatus(t("flash.status.done"));
    } catch (error) {
        flashSetStatus(t("flash.status.error") + " " + (error && error.message ? error.message : String(error)));
    }
}

async function flashRestore() {
    var targetSelect = document.getElementById("flash_target");
    var startInput = document.getElementById("flash_start");
    var endInput = document.getElementById("flash_end");
    var backupInput = document.getElementById("flash_backup");
    var backupFile, baseStart, baseEnd, totalSize;
    var chunkSize = 4 * 1024 * 1024;
    var useChunked;

    function toHex(n) {
        return "0x" + n.toString(16);
    }

    async function sendChunk(blob, chunkOffset, chunkEnd, totalSize, baseStart) {
        return await new Promise(function (resolve, reject) {
            var formData = new FormData();
            formData.append("op", "restore");
            formData.append("backup", blob, "restore_chunk.bin");
            targetSelect && targetSelect.value && formData.append("target", targetSelect.value);
            formData.append("start", toHex(baseStart + chunkOffset));
            formData.append("end", toHex(baseStart + chunkEnd));
            formData.append("storage", "auto");

            var xhr = new XMLHttpRequest();
            xhr.upload.onprogress = function (evt) {
                if (!evt || !evt.lengthComputable) return;
                flashSetProgress((chunkOffset + evt.loaded) / totalSize * 100);
            };
            xhr.upload.onload = function () {
                flashSetProgress((chunkOffset + (chunkEnd - chunkOffset)) / totalSize * 100);
                flashSetStatus(t("flash.status.restoring"));
            };
            xhr.onreadystatechange = function () {
                if (xhr.readyState !== 4) return;
                if (xhr.status !== 200) {
                    flashSetStatus(t("flash.status.http") + " " + xhr.status + (xhr.responseText ? ": " + xhr.responseText : ""));
                    flashSetProgress(null);
                    reject(new Error("http"));
                    return;
                }
                var payload;
                try { payload = JSON.parse(xhr.responseText); } catch (error) {
                    flashSetStatus(t("flash.status.error") + " parse");
                    flashSetProgress(null);
                    reject(error);
                    return;
                }
                if (!payload || !payload.ok) {
                    flashSetStatus(t("flash.status.error") + " " + (payload && payload.error ? payload.error : ""));
                    flashSetProgress(null);
                    reject(new Error("bad"));
                    return;
                }
                if (payload.alert)
                    window.__flash_restore_alert = payload.alert;
                resolve();
            };
            xhr.open("POST", "/flash/restore");
            xhr.send(formData);
        });
    }

    if (!backupInput || !backupInput.files || !backupInput.files.length) {
        alert(t("flash.error.no_file"));
        return;
    }
    if (!confirm(t("flash.confirm.restore"))) return;
    try {
        backupFile = backupInput.files[0];
        totalSize = backupFile ? backupFile.size : 0;
        baseStart = startInput ? parseUserLen(startInput.value) : null;
        baseEnd = endInput ? parseUserLen(endInput.value) : null;
        if ((baseStart === null || baseEnd === null) && backupFile && backupFile.name) {
            var parsedBackup = flashParseBackupFilename(backupFile.name);
            if (parsedBackup) {
                baseStart = parsedBackup.start;
                baseEnd = parsedBackup.end;
                if (targetSelect && !targetSelect.value && parsedBackup.storage && parsedBackup.target)
                    flashSelectTarget(parsedBackup.storage + ":" + parsedBackup.target);
                startInput && (startInput.value = toHex(baseStart));
                endInput && (endInput.value = toHex(baseEnd));
            }
        }
        if (baseStart === null || baseEnd === null || baseEnd <= baseStart) {
            flashSetStatus(t("flash.error.bad_range"));
            return;
        }
        if ((baseEnd - baseStart) !== totalSize) {
            flashSetStatus(t("flash.error.bad_range"));
            return;
        }

        useChunked = totalSize > chunkSize;
        flashSetProgress(0);
        flashSetStatus(t("flash.status.uploading"));

        if (!useChunked) {
            await sendChunk(backupFile, 0, totalSize, totalSize, baseStart);
        } else {
            var offset = 0;
            while (offset < totalSize) {
                var next = Math.min(offset + chunkSize, totalSize);
                var blob = backupFile.slice(offset, next);
                await sendChunk(blob, offset, next, totalSize, baseStart);
                offset = next;
            }
        }

        flashSetProgress(100);
        flashSetStatus(t("flash.status.done"));
        alert(t("flash.status.restored", window.__flash_restore_alert || "Backup restore completed."));
        window.__flash_restore_alert = "";
    } catch (error) {
        flashSetStatus(t("flash.status.error") + " " + (error && error.message ? error.message : String(error)));
    }
}

function setBackupStatus(message) {
    var statusElement = document.getElementById("backup_status");
    statusElement && (statusElement.style.display = message ? "block" : "none", statusElement.textContent = message || "")
}

function setBackupProgress(percent) {
    var progressElement = document.getElementById("bar"), boundedPercent;
    progressElement && (boundedPercent = Math.max(0, Math.min(100, parseInt(percent || 0))), progressElement.style.display = "block", progressElement.style.setProperty("--percent", boundedPercent))
}

function backupUpdateRangeHint() {
    var rangeHintElement = document.getElementById("backup_range_hint"), startValue, endValue, rangeSize;
    rangeHintElement && (startValue = parseUserLen(document.getElementById("backup_start").value), endValue = parseUserLen(document.getElementById("backup_end").value), startValue === null || endValue === null ? rangeHintElement.textContent = t("backup.range.hint") : (rangeSize = endValue >= startValue ? endValue - startValue : 0, rangeHintElement.textContent = "Start=" + bytesToHuman(startValue) + ", End=" + bytesToHuman(endValue) + ", Size=" + bytesToHuman(rangeSize)))
}

function backupRefreshI18n() {
    var targetSelect = document.getElementById("backup_target"), optionIndex, optionElement, mtdName;
    if (!targetSelect) return;
    for (optionIndex = 0; optionIndex < targetSelect.options.length; optionIndex++) optionElement = targetSelect.options[optionIndex], optionElement && optionElement.dataset && optionElement.dataset.i18nKey && (optionElement.textContent = window.t(optionElement.dataset.i18nKey));
    for (optionIndex = 0; optionIndex < targetSelect.options.length; optionIndex++) {
        optionElement = targetSelect.options[optionIndex];
        if (!optionElement || !optionElement.dataset) continue;
        optionElement.dataset.kind === "mtd-full" && (mtdName = optionElement.dataset.mtdName || "", optionElement.textContent = "[MTD] " + window.t("backup.target.full_disk") + (mtdName ? " (" + mtdName + ")" : "") + (optionElement.dataset.size ? " (" + bytesToHuman(parseInt(optionElement.dataset.size, 10)) + ")" : ""))
    }
}

function backupInit() {
    var modeSelect = document.getElementById("backup_mode"), rangeContainer = document.getElementById("backup_range"), targetSelect = document.getElementById("backup_target"), targetField = document.getElementById("backup_target_field"), targetRow = document.getElementById("backup_mode_target_row"), updateBackupUi, startInput, endInput;
    function selectTargetByValue(targetValue) {
        for (var optionIndex = 0; optionIndex < targetSelect.options.length; optionIndex++) if (targetSelect.options[optionIndex].value === targetValue) return targetSelect.selectedIndex = optionIndex, true;
        return false
    }
    function selectTargetByKind(targetKind) {
        for (var optionIndex = 0; optionIndex < targetSelect.options.length; optionIndex++) if (targetSelect.options[optionIndex].dataset && targetSelect.options[optionIndex].dataset.kind === targetKind) return targetSelect.selectedIndex = optionIndex, true;
        return false
    }
    function selectFirstNonEmptyTarget() {
        for (var optionIndex = 0; optionIndex < targetSelect.options.length; optionIndex++) if (targetSelect.options[optionIndex].value) {
            targetSelect.selectedIndex = optionIndex;
            return true
        }
        return false
    }
    function ensureValidTargetSelection() {
        var selectedOption, selectedKind;
        if (!targetSelect || targetSelect.options.length <= 1) return;
        selectedOption = targetSelect.options[targetSelect.selectedIndex];
        selectedKind = selectedOption && selectedOption.dataset ? selectedOption.dataset.kind : "";
        (selectedKind === "mmc-part" || selectedKind === "mtd-part" || !targetSelect.value) && (selectTargetByValue("mmc:raw") || selectTargetByKind("mtd-full") || selectFirstNonEmptyTarget())
    }
    modeSelect && rangeContainer && targetSelect && (updateBackupUi = function () {
        var isRangeMode = modeSelect.value === "range";
        isRangeMode ? (rangeContainer.style.display = "block", ensureValidTargetSelection(), backupUpdateRangeHint()) : (rangeContainer.style.display = "none");
        targetField && (targetField.style.display = isRangeMode ? "none" : "");
        targetRow && (targetRow.style.gridTemplateColumns = isRangeMode ? "1fr" : "")
    }, modeSelect.onchange = updateBackupUi, startInput = document.getElementById("backup_start"), endInput = document.getElementById("backup_end"), startInput && (startInput.oninput = backupUpdateRangeHint), endInput && (endInput.oninput = backupUpdateRangeHint), updateBackupUi(), setBackupStatus(""), ajax({
        url: "/backup/info",
        done: function (responseText) {
            var backupInfo, infoElement, optionElement, rawOption, fullDiskOption;
            try {
                backupInfo = JSON.parse(responseText)
            } catch (error) {
                setBackupStatus("backupinfo parse failed");
                return
            }
            infoElement = document.getElementById("backup_info");
            infoElement && (optionElement = [], backupInfo.mmc && backupInfo.mmc.present ? optionElement.push("MMC: " + (backupInfo.mmc.vendor || "") + " " + (backupInfo.mmc.product || "")) : optionElement.push("MMC: " + t("backup.storage.not_present")), backupInfo.mtd && backupInfo.mtd.present ? optionElement.push("MTD: " + (backupInfo.mtd.model || "")) : optionElement.push("MTD: " + t("backup.storage.not_present")), infoElement.textContent = optionElement.join(" | "));
            targetSelect.options.length = 0;
            optionElement = document.createElement("option");
            optionElement.value = "";
            optionElement.dataset.i18nKey = "backup.target.placeholder";
            targetSelect.appendChild(optionElement);
            backupInfo.mmc && backupInfo.mmc.present && (rawOption = document.createElement("option"), rawOption.value = "mmc:raw", rawOption.textContent = "[MMC] raw", rawOption.dataset.kind = "mmc-raw", targetSelect.appendChild(rawOption), backupInfo.mmc.parts && backupInfo.mmc.parts.length && backupInfo.mmc.parts.forEach(function (partition) {
                var partOption;
                partition && partition.name && (partOption = document.createElement("option"), partOption.value = "mmc:" + partition.name, partOption.textContent = "[MMC] " + partition.name + (partition.size ? " (" + bytesToHuman(partition.size) + ")" : ""), partOption.dataset.kind = "mmc-part", targetSelect.appendChild(partOption))
            }));

            if (backupInfo.mtd && backupInfo.mtd.present && backupInfo.mtd.parts && backupInfo.mtd.parts.length) {
                var mtdType = backupInfo.mtd.type, hasMasterPartitions = mtdType === 3 || mtdType === 4 || mtdType === 8, masterPartitions = [];
                hasMasterPartitions && backupInfo.mtd.parts.forEach(function (partition) {
                    partition && partition.name && partition.master && masterPartitions.push(partition)
                });

                hasMasterPartitions && masterPartitions.length && masterPartitions.forEach(function (partition) {
                    var fullDiskOptionElement = document.createElement("option");
                    fullDiskOptionElement.value = "mtd:" + partition.name;
                    fullDiskOptionElement.dataset.mtdName = partition.name;
                    fullDiskOptionElement.dataset.size = partition.size ? String(partition.size) : "";
                    fullDiskOptionElement.dataset.kind = "mtd-full";
                    targetSelect.appendChild(fullDiskOptionElement)
                });

                backupInfo.mtd.parts.forEach(function (partition) {
                    var partitionOption;
                    if (!partition || !partition.name) return;
                    if (hasMasterPartitions && partition.master) return;
                    partitionOption = document.createElement("option");
                    partitionOption.value = "mtd:" + partition.name;
                    partitionOption.textContent = "[MTD] " + partition.name + (partition.size ? " (" + bytesToHuman(partition.size) + ")" : "");
                    partitionOption.dataset.kind = "mtd-part";
                    targetSelect.appendChild(partitionOption)
                })
            }
            targetSelect.options.length > 1 && (targetSelect.selectedIndex = 1);
            backupRefreshI18n();
            updateBackupUi && updateBackupUi()
        }
    }))
}

async function startBackup() {
    var modeSelect = document.getElementById("backup_mode"), targetSelect = document.getElementById("backup_target"), backupMode, targetValue, formData, response, contentLength, expectedLength, downloadName, downloadedBytes, saveHandle, writableStream, reader, chunk, bufferedChunks;
    if (!modeSelect || !targetSelect) return;
    if (backupMode = modeSelect.value, targetValue = targetSelect.value, !targetValue) {
        alert(t("backup.error.no_target"));
        return
    }
    formData = new FormData;
    formData.append("mode", backupMode);
    formData.append("storage", "auto");
    formData.append("target", targetValue);
    if (backupMode === "range") {
        var startInput = document.getElementById("backup_start");
        var endInput = document.getElementById("backup_end");
        if (!startInput || !endInput || !startInput.value || !endInput.value) {
            alert(t("backup.error.bad_range"));
            return
        }
        formData.append("start", startInput.value);
        formData.append("end", endInput.value)
    }
    setBackupProgress(0);
    setBackupStatus(t("backup.status.starting"));
    try {
        response = await fetch("/backup/main", { method: "POST", body: formData });
        if (!response.ok) {
            setBackupStatus(t("backup.error.http") + " " + response.status);
            return
        }
        contentLength = response.headers.get("Content-Length");
        expectedLength = contentLength ? parseInt(contentLength, 10) : 0;
        downloadName = parseFilenameFromDisposition(response.headers.get("Content-Disposition"));
        downloadName || (downloadName = "backup.bin");
        // Ensure we have board info for filename even on pages without #sysinfo
        await ensureSysInfoLoaded();
        downloadName = makeBackupDownloadName(downloadName);
        downloadedBytes = 0;
        if (window.showSaveFilePicker) {
            saveHandle = await window.showSaveFilePicker({ suggestedName: downloadName, types: [{ description: "Binary", accept: { "application/octet-stream": [".bin"] } }] });
            writableStream = await saveHandle.createWritable();
            reader = response.body.getReader();
            while (true) {
                chunk = await reader.read();
                if (chunk.done) break;
                await writableStream.write(chunk.value);
                downloadedBytes += chunk.value.length;
                expectedLength ? setBackupProgress(downloadedBytes / expectedLength * 100) : setBackupProgress(0);
                setBackupStatus(t("backup.status.downloading") + " " + bytesToHuman(downloadedBytes) + (expectedLength ? " / " + bytesToHuman(expectedLength) : ""))
            }
            await writableStream.close();
            setBackupProgress(100);
            setBackupStatus(t("backup.status.done") + " " + downloadName)
        } else {
            bufferedChunks = [];
            reader = response.body.getReader();
            while (true) {
                chunk = await reader.read();
                if (chunk.done) break;
                bufferedChunks.push(chunk.value);
                downloadedBytes += chunk.value.length;
                expectedLength ? setBackupProgress(downloadedBytes / expectedLength * 100) : setBackupProgress(0);
                setBackupStatus(t("backup.status.downloading") + " " + bytesToHuman(downloadedBytes) + (expectedLength ? " / " + bytesToHuman(expectedLength) : ""))
            }
            setBackupProgress(100);
            setBackupStatus(t("backup.status.preparing"));
            var backupBlob = new Blob(bufferedChunks, { type: "application/octet-stream" });
            var downloadLink = document.createElement("a");
            downloadLink.href = URL.createObjectURL(backupBlob);
            downloadLink.download = downloadName;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            setBackupStatus(t("backup.status.done") + " " + downloadName)
        }
    } catch (error) {
        setBackupStatus(t("backup.error.exception") + " " + (error && error.message ? error.message : String(error)))
    }
}

APP_STATE = {
    lang: "en",
    theme: "auto",
    page: ""
}
