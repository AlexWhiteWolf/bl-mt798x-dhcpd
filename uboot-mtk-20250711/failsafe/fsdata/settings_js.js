/* SPDX-License-Identifier: GPL-2.0 */
/*
 * Copyright (C) 2026 Yuzhii0718
 *
 * All rights reserved.
 *
 * This file is part of the project bl-mt798x-dhcpd
 * You may not use, copy, modify or distribute this file except in compliance with the license agreement.
 */

(function () {
    "use strict";

    const SETTINGS_STATUS_ID = "settings_status";
    const ACCENT_HOST_ID = "settings_accent_host";
    const MTD_SECTION_ID = "set_mtd_section";
    const MTD_SELECT_ID = "set_mtd_layout";

    let lastEnvSnapshot = {};

    function setStatus(message) {
        const el = document.getElementById(SETTINGS_STATUS_ID);
        if (el) el.textContent = message || "";
    }

    function parseEnvList(text) {
        const map = Object.create(null);
        if (!text) return map;
        for (const line of text.split("\n")) {
            const idx = line.indexOf("=");
            if (idx <= 0) continue;
            const key = line.substring(0, idx);
            const value = line.substring(idx + 1);
            map[key] = value;
        }
        return map;
    }

    function applyCurrentValues(envMap) {
        for (const node of document.querySelectorAll("[data-env]")) {
            const name = node.getAttribute("data-env");
            if (!name) continue;
            const value = envMap[name];
            node.value = value === undefined ? "" : value;
        }
    }

    function snapshotCurrentValues() {
        const snapshot = Object.create(null);
        for (const node of document.querySelectorAll("[data-env]")) {
            const name = node.getAttribute("data-env");
            if (!name) continue;
            snapshot[name] = (node.value || "").trim();
        }
        return snapshot;
    }

    async function populateMtdLayouts() {
        const select = document.getElementById(MTD_SELECT_ID);
        const section = document.getElementById(MTD_SECTION_ID);
        if (!select) return;
        let text = "";
        try {
            const response = await fetch("/getmtdlayout", { method: "GET", cache: "no-store" });
            if (!response.ok) return;
            text = (await response.text()).trim();
        } catch { return; }

        if (!text || text === "error") return;

        const parts = text.split(";").filter((s) => s.length > 0);
        if (parts.length < 2) return;

        const previousValue = select.value;
        select.options.length = 0;

        const blank = document.createElement("option");
        blank.value = "";
        blank.textContent = t("settings.value.default", "Default");
        select.appendChild(blank);

        for (let i = 1; i < parts.length; i++) {
            const name = parts[i];
            const opt = document.createElement("option");
            opt.value = name;
            opt.textContent = name;
            select.appendChild(opt);
        }

        if (previousValue) select.value = previousValue;
        if (section) section.style.display = "";
    }

    function buildAccentControls() {
        const host = document.getElementById(ACCENT_HOST_ID);
        if (!host || host.dataset.rendered === "1") return;
        if (typeof appendAccentControls !== "function") return;

        appendAccentControls(host);
        host.dataset.rendered = "1";

        if (typeof applyI18n === "function") applyI18n(host);
    }

    async function refresh() {
        setStatus(t("env.status.loading", "Loading..."));
        try {
            const response = await fetch("/env/list", { method: "GET", cache: "no-store" });
            if (!response.ok) {
                setStatus(t("env.status.http", "HTTP error:") + " " + response.status);
                return;
            }
            const text = await response.text();
            const envMap = parseEnvList(text);
            applyCurrentValues(envMap);
            lastEnvSnapshot = snapshotCurrentValues();
            setStatus(t("env.status.ready", "Ready."));
        } catch (error) {
            setStatus(t("env.status.error", "Error:") + " " +
                (error && error.message ? error.message : String(error)));
        }
    }

    async function postEnvUnset(name) {
        const fd = new FormData();
        fd.append("name", name);
        const response = await fetch("/env/unset", { method: "POST", body: fd });
        const body = await response.text();
        if (!response.ok)
            throw new Error(name + ": " + (body || response.status));
    }

    async function postEnvSet(name, value) {
        const fd = new FormData();
        fd.append("name", name);
        fd.append("value", value);
        const response = await fetch("/env/set", { method: "POST", body: fd });
        const body = await response.text();
        if (!response.ok)
            throw new Error(name + ": " + (body || response.status));
    }

    async function saveSetting(name, value, previousValue) {
        if (value === previousValue) return false;
        if (value === "")
            await postEnvUnset(name);
        else
            await postEnvSet(name, value);
        return true;
    }

    async function save() {
        const current = snapshotCurrentValues();
        const previous = lastEnvSnapshot || {};
        const keys = Object.keys(current);

        setStatus(t("env.status.saving", "Saving..."));

        let changed = 0;
        let firstError = null;

        for (const key of keys) {
            try {
                if (await saveSetting(key, current[key], previous[key] || ""))
                    changed++;
            } catch (error) {
                if (!firstError) firstError = error;
            }
        }

        if (firstError) {
            setStatus(t("env.status.error", "Error:") + " " +
                (firstError.message ? firstError.message : String(firstError)));
            return;
        }

        if (!changed) {
            setStatus(t("settings.status.nochange", "No changes."));
            return;
        }

        setStatus(t("env.status.saved", "Saved."));
        await refresh();
    }

    function init() {
        buildAccentControls();
        populateMtdLayouts();
        refresh();
    }

    /* publish */
    window.settingsInit = init;
    window.settingsRefresh = refresh;
    window.settingsSave = save;
})();
