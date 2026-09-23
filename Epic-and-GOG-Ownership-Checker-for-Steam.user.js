// ==UserScript==
// @name         Epic and GOG Ownership Checker for Steam
// @namespace    https://steam-multi-ownership.local/
// @version      4.1
// @author       Theodoros OhYeah (enigma9q), ChatGPT & Antigravity
// @description  Shows Epic and GOG ownership on Steam game pages, search results, library cards, similar games and recommendation cards
// @match        https://store.steampowered.com/*
// @match        https://accounts.epicgames.com/account/*
// @match        https://www.epicgames.com/account/*
// @match        https://www.gog.com/*
// @match        https://gog.com/*
// @match        https://embed.gog.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      accounts.epicgames.com
// @connect      www.epicgames.com
// @connect      embed.gog.com
// @updateURL     https://raw.githubusercontent.com/enigma9q/Epic-and-GOG-Ownership-Checker-for-Steam/main/Epic-and-GOG-Ownership-Checker-for-Steam.user.js
// @downloadURL   https://raw.githubusercontent.com/enigma9q/Epic-and-GOG-Ownership-Checker-for-Steam/main/Epic-and-GOG-Ownership-Checker-for-Steam.user.js
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const EPIC_LIBRARY_KEY = 'epicOwnershipLibrary';
    const EPIC_SYNC_TIME_KEY = 'epicOwnershipSyncTime';
    const GOG_LIBRARY_KEY = 'gogOwnershipLibrary';
    const GOG_SYNC_TIME_KEY = 'gogOwnershipSyncTime';

    const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000;

    const EPIC_TRANSACTIONS_URL =
        'https://accounts.epicgames.com/account/transactions/purchases';

    const EPIC_API_URL =
        'https://accounts.epicgames.com/account/v2/payment/ajaxGetOrderHistory';

    const GOG_LIBRARY_URL = 'https://www.gog.com/account';

    const GOG_API_URL =
        'https://embed.gog.com/account/getFilteredProducts';

    const EPIC_CARD_BADGE_CLASS = 'steam-epic-card-badge';
    const GOG_CARD_BADGE_CLASS = 'steam-gog-card-badge';

    let originalSteamTitle = null;

    function isEpicPage() {
        return (
            location.hostname === 'accounts.epicgames.com' ||
            location.hostname === 'www.epicgames.com'
        );
    }

    function isGogPage() {
        return (
            location.hostname === 'www.gog.com' ||
            location.hostname === 'gog.com' ||
            location.hostname === 'embed.gog.com'
        );
    }

    function isSteamPage() {
        return location.hostname === 'store.steampowered.com';
    }

    function normalizeTitle(title) {
        return String(title || '')
            .toLowerCase()
            .replace(/[™®©]/g, '')
            .replace(/&/g, ' and ')
            .replace(/[’']/g, '')
            .replace(/[:\-–—_/\\|]/g, ' ')
            .replace(/[^\p{L}\p{N}\s]/gu, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function normalizeCollapsed(title) {
        return normalizeTitle(title).replace(/\s+/g, '');
    }

    function removePurchasePrefix(title) {
        return title
            .replace(/^purchased[:\-–—\s]+/i, '')
            .replace(/^purchase[:\-–—\s]+/i, '')
            .trim();
    }

    function removeEditionSuffix(title) {
        let result = title;

        const suffixes = [
            ' game of the year edition',
            ' game of the year',
            ' goty edition',
            ' goty',
            ' game of the yorha edition',
            ' complete edition',
            ' complete collection',
            ' complete',
            ' ultimate edition',
            ' ultimate',
            ' digital deluxe edition',
            ' digital deluxe',
            ' deluxe edition',
            ' deluxe',
            ' definitive edition',
            ' definitive experience',
            ' definitive',
            ' enhanced edition',
            ' enhanced',
            ' legendary edition',
            ' legendary',
            ' gold edition',
            ' gold',
            ' platinum edition',
            ' platinum',
            ' diamond edition',
            ' premium edition',
            ' premium',
            ' founders edition',
            ' founders',
            ' standard edition',
            ' standard',
            ' anniversary edition',
            ' anniversary',
            ' special edition',
            ' special',
            ' collectors edition',
            ' collector edition',
            ' collectors',
            ' directors cut',
            ' director cut',
            ' final cut',
            ' royal edition',
            ' imperial edition',
            ' legacy edition',
            ' master collection',
            ' remastered',
            ' remaster',
            ' year one edition',
            ' year 1 edition',
            ' day one edition',
            ' launch edition',
            ' vr edition',
            ' vr'
        ];

        let changed = true;

        while (changed) {
            changed = false;

            for (const suffix of suffixes) {
                if (result.endsWith(suffix)) {
                    result = result.slice(0, -suffix.length).trim();
                    changed = true;
                    break;
                }
            }
        }

        // Generic "<Word> edition" removal if title has at least one other word remaining
        const genericEditionMatch = result.match(/^(.*\b[a-z0-9]+)\s+([a-z0-9]+)\s+edition$/i);
        if (genericEditionMatch && genericEditionMatch[1].trim().length > 1) {
            result = genericEditionMatch[1].trim();
        }

        return result;
    }

    function getComparisonTitle(title) {
        let result = normalizeTitle(title);
        result = removePurchasePrefix(result);
        result = removeEditionSuffix(result);
        return result;
    }

    function detectEditionName(originalTitle, baseComparisonTitle) {
        if (!originalTitle) return null;
        const norm = normalizeTitle(originalTitle);

        const editionPatterns = [
            { pattern: /\bgame\s+of\s+the\s+year(\s+edition)?\b|\bgoty(\s+edition)?\b/i, name: 'Game of the Year Edition' },
            { pattern: /\bgame\s+of\s+the\s+yorha(\s+edition)?\b/i, name: 'Game of the YoRHa Edition' },
            { pattern: /\bcomplete\s+edition\b|\bcomplete\s+collection\b/i, name: 'Complete Edition' },
            { pattern: /\bultimate\s+edition\b/i, name: 'Ultimate Edition' },
            { pattern: /\bdigital\s+deluxe(\s+edition)?\b/i, name: 'Digital Deluxe Edition' },
            { pattern: /\bdeluxe\s+edition\b/i, name: 'Deluxe Edition' },
            { pattern: /\bdefinitive\s+edition\b|\bdefinitive\s+experience\b/i, name: 'Definitive Edition' },
            { pattern: /\benhanced\s+edition\b/i, name: 'Enhanced Edition' },
            { pattern: /\bdirector['’]?s\s+cut\b/i, name: "Director's Cut" },
            { pattern: /\bfinal\s+cut\b/i, name: 'Final Cut' },
            { pattern: /\bcollector['’]?s\s+edition\b/i, name: "Collector's Edition" },
            { pattern: /\blegendary\s+edition\b/i, name: 'Legendary Edition' },
            { pattern: /\bgold\s+edition\b/i, name: 'Gold Edition' },
            { pattern: /\bplatinum\s+edition\b/i, name: 'Platinum Edition' },
            { pattern: /\bpremium\s+edition\b/i, name: 'Premium Edition' },
            { pattern: /\banniversary\s+edition\b/i, name: 'Anniversary Edition' },
            { pattern: /\bspecial\s+edition\b/i, name: 'Special Edition' },
            { pattern: /\broyal\s+edition\b/i, name: 'Royal Edition' },
            { pattern: /\bimperial\s+edition\b/i, name: 'Imperial Edition' },
            { pattern: /\bstandard\s+edition\b/i, name: 'Standard Edition' },
            { pattern: /\bfounders\s+edition\b/i, name: 'Founders Edition' },
            { pattern: /\bremastered\b|\bremaster\b/i, name: 'Remastered' },
            { pattern: /\bvr\s+edition\b|\b\(vr\)\b/i, name: 'VR Edition' }
        ];

        for (const ep of editionPatterns) {
            if (ep.pattern.test(originalTitle) || ep.pattern.test(norm)) {
                return ep.name;
            }
        }

        const genericMatch = originalTitle.match(/\b([A-Za-z0-9]+)\s+Edition\b/i);
        if (genericMatch) {
            const word = genericMatch[1];
            return `${word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()} Edition`;
        }

        if (baseComparisonTitle && getComparisonTitle(originalTitle) === baseComparisonTitle) {
            return null;
        }

        return null;
    }

    function findLibraryMatches(library, targetComparisonTitle) {
        if (!Array.isArray(library) || library.length === 0 || !targetComparisonTitle) {
            return [];
        }

        const targetNorm = targetComparisonTitle;
        const targetCollapsed = targetNorm.replace(/\s+/g, '');
        const matches = [];
        const seenOriginals = new Set();

        for (const entry of library) {
            const original =
                typeof entry === 'string'
                    ? entry
                    : (entry.original || entry.normalized || '');

            if (!original || seenOriginals.has(original)) continue;

            const entryNorm = getComparisonTitle(original);
            const entryCollapsed = entryNorm.replace(/\s+/g, '');

            let matchType = null;
            if (entryNorm === targetNorm) {
                matchType = 'exact';
            } else if (targetCollapsed && entryCollapsed === targetCollapsed) {
                matchType = 'collapsed';
            }

            if (matchType) {
                seenOriginals.add(original);
                const edition = detectEditionName(original, targetNorm);
                matches.push({
                    original: original,
                    edition: edition,
                    matchType: matchType
                });
            }
        }

        return matches;
    }

    function getEpicLibrary() {
        const library = GM_getValue(EPIC_LIBRARY_KEY, []);
        return Array.isArray(library) ? library : [];
    }

    function getEpicSyncTime() {
        return GM_getValue(EPIC_SYNC_TIME_KEY, 0);
    }

    function isEpicCacheValid() {
        const library = getEpicLibrary();
        const syncTime = getEpicSyncTime();

        return (
            library.length > 0 &&
            syncTime > 0 &&
            Date.now() - syncTime <= CACHE_DURATION
        );
    }

    function findEpicOwnedMatches(comparisonTitle) {
        if (!isEpicCacheValid()) return [];
        return findLibraryMatches(getEpicLibrary(), comparisonTitle);
    }

    function findEpicOwnedTitle(normalizedTitle) {
        const matches = findEpicOwnedMatches(normalizedTitle);
        return matches.length > 0 ? matches[0].original : null;
    }

    function getGogLibrary() {
        const library = GM_getValue(GOG_LIBRARY_KEY, []);
        return Array.isArray(library) ? library : [];
    }

    function getGogSyncTime() {
        return GM_getValue(GOG_SYNC_TIME_KEY, 0);
    }

    function isGogCacheValid() {
        const library = getGogLibrary();
        const syncTime = getGogSyncTime();

        return (
            library.length > 0 &&
            syncTime > 0 &&
            Date.now() - syncTime <= CACHE_DURATION
        );
    }

    function findGogOwnedMatches(comparisonTitle) {
        if (!isGogCacheValid()) return [];
        return findLibraryMatches(getGogLibrary(), comparisonTitle);
    }

    function findGogOwnedTitle(normalizedTitle) {
        const matches = findGogOwnedMatches(normalizedTitle);
        return matches.length > 0 ? matches[0].original : null;
    }

    function formatSyncDate(timestamp) {
        if (!timestamp || timestamp <= 0) return 'Never';
        try {
            const date = new Date(timestamp);
            const now = new Date();
            const isToday = date.toDateString() === now.toDateString();
            const timeStr = date.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });
            if (isToday) {
                return `Today at ${timeStr}`;
            }
            const dateStr = date.toLocaleDateString([], {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
            return `${dateStr} ${timeStr}`;
        } catch (_) {
            return new Date(timestamp).toLocaleDateString();
        }
    }

    function getEpicSearchUrl(title) {
        return `https://store.epicgames.com/en-US/browse?q=${encodeURIComponent(title || '')}`;
    }

    function getGogSearchUrl(title) {
        return `https://www.gog.com/en/games?query=${encodeURIComponent(title || '')}`;
    }

    // Epic must use GM_xmlhttpRequest rather than fetch().
    // Epic's endpoint does not provide the CORS header needed by fetch().
    function fetchEpicPage(nextPageToken, onSuccess, onError) {
        let url =
            EPIC_API_URL +
            '?count=100' +
            '&sortDir=DESC' +
            '&sortBy=DATE' +
            '&locale=en-US';

        if (nextPageToken) {
            url +=
                '&nextPageToken=' +
                encodeURIComponent(nextPageToken);
        }

        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            timeout: 20000,
            anonymous: false,

            headers: {
                'Accept': 'application/json, text/plain, */*',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': 'https://accounts.epicgames.com/'
            },

            onload: function (response) {
                if (response.status < 200 || response.status >= 300) {
                    console.error(
                        '[Steam → Epic] HTTP error:',
                        response.status,
                        response.responseText
                    );

                    onError(
                        `Epic returned HTTP ${response.status}`
                    );
                    return;
                }

                try {
                    const json = JSON.parse(response.responseText);
                    onSuccess(json);
                } catch (error) {
                    console.error(
                        '[Steam → Epic] Invalid response:',
                        response.responseText
                    );

                    onError(
                        `Invalid Epic response: ${error.message}`
                    );
                }
            },

            onerror: function () {
                onError('Epic request failed');
            },

            ontimeout: function () {
                onError('Epic request timed out');
            }
        });
    }

    function syncEpicLibrary(options, onSuccessCb, onErrorCb) {
        let isFullSync = false;
        let onProgress = null;
        let onSuccess = onSuccessCb;
        let onError = onErrorCb;

        if (typeof options === 'function') {
            onProgress = options;
        } else if (options && typeof options === 'object') {
            isFullSync = !!options.isFullSync;
            onProgress = options.onProgress;
            if (options.onSuccess) onSuccess = options.onSuccess;
            if (options.onError) onError = options.onError;
        }

        const existingLibrary = getEpicLibrary();
        const existingSet = new Set(
            existingLibrary.map(item => item.normalized)
        );
        const isSmart = !isFullSync && existingSet.size > 0;

        const newlyFoundGames = [];
        let page = 0;
        let shouldStop = false;

        function loadPage(nextPageToken) {
            page++;

            if (onProgress) {
                onProgress(
                    `Syncing Epic library (${isSmart ? 'Smart Mode' : 'Full Mode'})... page ${page}`
                );
            }

            fetchEpicPage(
                nextPageToken,
                function (data) {
                    if (!Array.isArray(data.orders)) {
                        if (onError) onError('Unexpected Epic response format');
                        return;
                    }

                    for (const order of data.orders) {
                        if (!Array.isArray(order.items)) continue;

                        for (const item of order.items) {
                            if (
                                !item ||
                                typeof item.description !== 'string'
                            ) {
                                continue;
                            }

                            const title = item.description.trim();
                            if (!title) continue;

                            const normalized = getComparisonTitle(title);
                            if (!normalized) continue;

                            if (isSmart && existingSet.has(normalized)) {
                                shouldStop = true;
                                break;
                            }

                            newlyFoundGames.push({
                                original: title,
                                normalized: normalized
                            });
                        }

                        if (shouldStop) break;
                    }

                    if (!shouldStop && data.nextPageToken) {
                        loadPage(data.nextPageToken);
                        return;
                    }

                    let combined;
                    if (isSmart) {
                        combined = [...newlyFoundGames, ...existingLibrary];
                    } else {
                        combined = newlyFoundGames;
                    }

                    const unique = new Map();
                    combined.forEach(function (game) {
                        if (!unique.has(game.normalized)) {
                            unique.set(game.normalized, game.original);
                        }
                    });

                    const finalLibrary = Array.from(unique.entries()).map(
                        function (entry) {
                            return {
                                normalized: entry[0],
                                original: entry[1]
                            };
                        }
                    );

                    GM_setValue(EPIC_LIBRARY_KEY, finalLibrary);
                    GM_setValue(EPIC_SYNC_TIME_KEY, Date.now());

                    console.log(
                        '[Steam → Epic] Sync complete:',
                        finalLibrary.length,
                        'titles'
                    );

                    if (onSuccess) {
                        onSuccess(finalLibrary, newlyFoundGames.length, isSmart);
                    }
                },
                function (error) {
                    console.error('[Steam → Epic] Sync failed:', error);
                    if (onError) onError(error);
                }
            );
        }

        loadPage('');
    }

    function fetchGogPage(page) {
        const params = new URLSearchParams({
            mediaType: '1',
            page: String(page),
            sortBy: 'date_purchased',
            hiddenFlag: '0',
            isUpdated: '0',
            hasHiddenProducts: 'false'
        });

        const url =
            GOG_API_URL +
            '?' +
            params.toString();

        return new Promise(function (resolve, reject) {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                anonymous: false,
                cookie: true,
                timeout: 30000,

                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },

                onload: function (response) {
                    if (
                        response.status < 200 ||
                        response.status >= 300
                    ) {
                        reject(
                            new Error(
                                `GOG returned HTTP ${response.status}`
                            )
                        );
                        return;
                    }

                    try {
                        const data = JSON.parse(response.responseText);
                        resolve(data);
                    } catch (error) {
                        reject(
                            new Error(
                                'GOG returned an invalid response.'
                            )
                        );
                    }
                },

                onerror: function () {
                    reject(new Error('Could not connect to GOG.'));
                },

                ontimeout: function () {
                    reject(new Error('GOG request timed out.'));
                }
            });
        });
    }

    async function fetchGogGames(updateProgress, isFullSync) {
        const existingLibrary = getGogLibrary();
        const existingSet = new Set(
            existingLibrary.map(item => item.normalized)
        );
        const isSmart = !isFullSync && existingSet.size > 0;

        updateProgress(
            `Requesting GOG library (${isSmart ? 'Smart Mode' : 'Full Mode'})...`
        );

        const firstPage = await fetchGogPage(1);

        if (
            !firstPage ||
            !Array.isArray(firstPage.products)
        ) {
            throw new Error('GOG did not return a valid game library.');
        }

        const products = [];
        let hitExisting = false;

        for (const product of firstPage.products) {
            if (!product || product.isMovie === true || product.isGame === false) continue;
            if (!product.title || typeof product.title !== 'string') continue;
            const norm = getComparisonTitle(product.title);
            if (!norm) continue;

            if (isSmart && existingSet.has(norm)) {
                hitExisting = true;
                break;
            }
            products.push(product);
        }

        const totalPages = Number(firstPage.totalPages) || 1;

        if (!hitExisting && totalPages > 1) {
            for (let page = 2; page <= totalPages; page++) {
                updateProgress(
                    `GOG library: page ${page} of ${totalPages}...`
                );

                const data = await fetchGogPage(page);

                if (data && Array.isArray(data.products)) {
                    for (const product of data.products) {
                        if (!product || product.isMovie === true || product.isGame === false) continue;
                        if (!product.title || typeof product.title !== 'string') continue;
                        const norm = getComparisonTitle(product.title);
                        if (!norm) continue;

                        if (isSmart && existingSet.has(norm)) {
                            hitExisting = true;
                            break;
                        }
                        products.push(product);
                    }
                }

                if (hitExisting) break;
            }
        }

        return { products, isSmart };
    }

    function extractGogLibrary(products) {
        const library = [];

        for (const product of products) {
            if (!product) continue;
            if (product.isMovie === true) continue;
            if (product.isGame === false) continue;

            if (
                !product.title ||
                typeof product.title !== 'string'
            ) {
                continue;
            }

            const title = product.title.trim();
            const normalized = getComparisonTitle(title);
            if (!normalized) continue;

            library.push({
                original: title,
                normalized: normalized
            });
        }

        const unique = new Map();
        for (const game of library) {
            if (!unique.has(game.normalized)) {
                unique.set(game.normalized, game.original);
            }
        }

        return Array.from(unique.entries()).map(
            function ([normalized, original]) {
                return {
                    normalized: normalized,
                    original: original
                };
            }
        );
    }

    async function syncGogLibrary(options) {
        let isFullSync = false;
        let updateProgress = function () { };

        if (typeof options === 'function') {
            updateProgress = options;
        } else if (options && typeof options === 'object') {
            isFullSync = !!options.isFullSync;
            if (typeof options.onProgress === 'function') {
                updateProgress = options.onProgress;
            }
        }

        updateProgress('Downloading GOG library...');

        const { products, isSmart } =
            await fetchGogGames(updateProgress, isFullSync);

        const newlyExtracted = extractGogLibrary(products);
        const existingLibrary = getGogLibrary();

        let combined;
        if (isSmart && existingLibrary.length > 0) {
            combined = [...newlyExtracted, ...existingLibrary];
        } else {
            combined = newlyExtracted;
        }

        const unique = new Map();
        for (const game of combined) {
            if (!unique.has(game.normalized)) {
                unique.set(game.normalized, game.original);
            }
        }

        const library = Array.from(unique.entries()).map(
            function ([normalized, original]) {
                return {
                    normalized: normalized,
                    original: original
                };
            }
        );

        if (!library.length) {
            throw new Error(
                'GOG returned no owned games. Make sure you are logged in to GOG.'
            );
        }

        await GM_setValue(GOG_LIBRARY_KEY, library);
        await GM_setValue(GOG_SYNC_TIME_KEY, Date.now());

        console.log(
            `[Steam → GOG] Sync complete: ${library.length} titles`
        );

        return {
            library: library,
            newCount: newlyExtracted.length,
            isSmart: isSmart
        };
    }

    function getSteamTitleElement() {
        return document.querySelector('.apphub_AppName');
    }

    function captureOriginalSteamTitle() {
        const element = getSteamTitleElement();
        if (!element) return null;

        if (!originalSteamTitle) {
            const clone = element.cloneNode(true);

            clone
                .querySelectorAll(
                    [
                        '#steam-ownership-indicator',
                        '#steam-epic-indicator',
                        '#steam-gog-indicator',
                        '#steam-amazon-indicator',
                        '#gg-deals-search-button'
                    ].join(', ')
                )
                .forEach(function (node) {
                    node.remove();
                });

            let text = clone.textContent.trim();

            text = text
                .replace(/Current:\s*[\d.,]+€?/gi, '')
                .replace(/Historical:\s*[\d.,]+€?/gi, '')
                .trim();

            if (text) {
                originalSteamTitle = text;
            }
        }

        return originalSteamTitle;
    }

    function createEditionInfoIcon(platform, matches) {
        if (!matches || matches.length === 0) return null;

        const storeName = platform === 'epic' ? 'Epic Games' : 'GOG';
        const accentColor = platform === 'epic' ? '#0074e4' : '#7a35d9';
        const accentBorder = platform === 'epic' ? '#4aa3ff' : '#b185e8';

        const btn = document.createElement('span');
        btn.className = `steam-${platform}-edition-info-btn`;
        btn.textContent = '?';
        btn.setAttribute('role', 'button');
        btn.setAttribute('tabindex', '0');
        btn.setAttribute('title', `Click or hover to view owned ${storeName} edition(s)`);
        btn.style.cssText = `
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.25);
            color: #d2dbe3;
            font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
            font-size: 10.5px;
            font-weight: 700;
            line-height: 1;
            cursor: pointer;
            user-select: none;
            box-sizing: border-box;
            transition: all 0.15s ease;
            margin-left: 2px;
            flex-shrink: 0;
        `;

        let tooltipEl = null;

        function showTooltip() {
            if (tooltipEl) return;

            btn.style.background = accentColor;
            btn.style.borderColor = accentBorder;
            btn.style.color = '#ffffff';
            btn.style.transform = 'scale(1.15)';

            tooltipEl = document.createElement('div');
            tooltipEl.className = 'steam-ownership-edition-tooltip';
            tooltipEl.style.cssText = `
                position: fixed;
                background: #171d25;
                border: 1px solid #4f6b7f;
                border-radius: 5px;
                padding: 10px 12px;
                color: #e1e8ee;
                font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
                font-size: 12px;
                line-height: 1.45;
                box-shadow: 0 8px 24px rgba(0,0,0,0.75);
                z-index: 9999999;
                pointer-events: none;
                max-width: 320px;
                min-width: 180px;
                box-sizing: border-box;
                text-align: left;
            `;

            const header = document.createElement('div');
            header.style.cssText = `
                display: flex;
                align-items: center;
                gap: 5px;
                margin-bottom: 6px;
                padding-bottom: 5px;
                border-bottom: 1px solid rgba(255,255,255,0.1);
                font-size: 11px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                color: ${accentBorder};
            `;
            header.textContent = `${storeName} Library`;

            const subheader = document.createElement('div');
            subheader.style.cssText = `
                font-size: 10.5px;
                color: #8f98a0;
                margin-bottom: 6px;
            `;
            subheader.textContent =
                matches.length > 1
                    ? 'Owned editions / versions:'
                    : 'Owned edition / version:';

            const list = document.createElement('ul');
            list.style.cssText = `
                margin: 0;
                padding: 0 0 0 14px;
                list-style-type: disc;
                font-size: 11.5px;
            `;

            for (const m of matches) {
                const li = document.createElement('li');
                li.style.cssText = 'margin-bottom: 4px; color: #ffffff;';

                const titleSpan = document.createElement('span');
                titleSpan.textContent = m.original;
                titleSpan.style.fontWeight = '600';
                li.appendChild(titleSpan);

                if (m.edition) {
                    const edSpan = document.createElement('span');
                    edSpan.textContent = ` [${m.edition}]`;
                    edSpan.style.cssText = `color: ${accentBorder}; font-size: 10.5px; margin-left: 4px; font-weight: normal;`;
                    li.appendChild(edSpan);
                }

                list.appendChild(li);
            }

            tooltipEl.appendChild(header);
            tooltipEl.appendChild(subheader);
            tooltipEl.appendChild(list);
            document.body.appendChild(tooltipEl);

            const rect = btn.getBoundingClientRect();
            const tooltipRect = tooltipEl.getBoundingClientRect();

            let top = rect.bottom + 6;
            if (top + tooltipRect.height > window.innerHeight - 10) {
                top = Math.max(10, rect.top - tooltipRect.height - 6);
            }

            let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
            if (left + tooltipRect.width > window.innerWidth - 10) {
                left = window.innerWidth - tooltipRect.width - 10;
            }
            if (left < 10) {
                left = 10;
            }

            tooltipEl.style.top = `${top}px`;
            tooltipEl.style.left = `${left}px`;
        }

        function hideTooltip() {
            if (tooltipEl) {
                tooltipEl.remove();
                tooltipEl = null;
            }
            btn.style.background = 'rgba(255, 255, 255, 0.08)';
            btn.style.borderColor = 'rgba(255, 255, 255, 0.25)';
            btn.style.color = '#d2dbe3';
            btn.style.transform = 'scale(1)';
        }

        btn.addEventListener('mouseenter', showTooltip);
        btn.addEventListener('mouseleave', hideTooltip);
        btn.addEventListener('focus', showTooltip);
        btn.addEventListener('blur', hideTooltip);

        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (tooltipEl) {
                hideTooltip();
            } else {
                showTooltip();
            }
        });

        document.addEventListener('click', function (e) {
            if (tooltipEl && !btn.contains(e.target)) {
                hideTooltip();
            }
        });

        return btn;
    }

    /*
     * Renders a single unified indicator on Steam Game Pages:
     * Owned: [Epic Icon] (?) [GOG Icon] (?)
     * Shows icon for store where owned, else X (or single X if not owned on both).
     * Includes a down arrow before Owned for store updater dropdown.
     */
    function renderUnifiedOwnershipBox(steamTitle, epicOwnedTitle, gogOwnedTitle, epicMatches = [], gogMatches = []) {
        const titleElement = getSteamTitleElement();
        if (!titleElement) return false;

        const existing = document.getElementById('steam-ownership-indicator');
        if (existing) {
            existing.remove();
        }

        titleElement.style.display = 'inline-flex';
        titleElement.style.alignItems = 'center';
        titleElement.style.flexWrap = 'wrap';

        const hasEpic = !!epicOwnedTitle;
        const hasGog = !!gogOwnedTitle;
        const hasAny = hasEpic || hasGog;

        const container = document.createElement('span');
        container.id = 'steam-ownership-indicator';
        container.style.cssText = `
            display: inline-flex;
            align-items: center;
            margin-left: 10px;
            height: 26px;
            padding: 2px 6px 2px 4px;
            background: #171d25;
            border: 1px solid #3d4450;
            border-radius: 4px;
            vertical-align: middle;
            color: #c6d4df;
            font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
            font-size: 12px;
            box-sizing: border-box;
            position: relative;
            user-select: none;
            flex-shrink: 0;
            gap: 5px;
            z-index: 100;
        `;

        // 1. Dropdown Arrow Button before "Owned:"
        const arrowBtn = document.createElement('button');
        arrowBtn.type = 'button';
        arrowBtn.title = 'Sync databases & view sync timestamps';
        arrowBtn.innerHTML = `
            <svg width="9" height="9" viewBox="0 0 12 12" fill="none" style="display:block;">
                <path d="M2.5 4.5L6 8L9.5 4.5" stroke="#79a8d8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
        arrowBtn.style.cssText = `
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 3px;
            padding: 0;
            cursor: pointer;
            height: 18px;
            width: 18px;
            box-sizing: border-box;
            transition: background 0.15s ease, border-color 0.15s ease;
        `;

        arrowBtn.addEventListener('mouseenter', function () {
            arrowBtn.style.background = 'rgba(255, 255, 255, 0.15)';
            arrowBtn.style.borderColor = '#79a8d8';
        });
        arrowBtn.addEventListener('mouseleave', function () {
            arrowBtn.style.background = 'rgba(255, 255, 255, 0.06)';
            arrowBtn.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        });

        // Dropdown Menu
        const dropdownMenu = document.createElement('div');
        dropdownMenu.style.cssText = `
            position: absolute;
            top: 30px;
            left: 0;
            background: #1b2838;
            border: 1px solid #4f6b7f;
            border-radius: 5px;
            padding: 8px 10px;
            box-shadow: 0 6px 18px rgba(0,0,0,0.6);
            z-index: 99999;
            display: none;
            min-width: 250px;
            font-size: 12px;
            color: #e1e8ee;
            text-align: left;
            white-space: normal;
        `;

        const epicSyncTime = getEpicSyncTime();
        const gogSyncTime = getGogSyncTime();
        const epicLib = getEpicLibrary();
        const gogLib = getGogLibrary();

        dropdownMenu.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 6px; font-size: 11px; text-transform: uppercase; color: #8f98a0; letter-spacing: 0.5px;">
                Sync to Database
            </div>
            <a href="${EPIC_TRANSACTIONS_URL}" target="_blank" rel="noopener noreferrer" style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 6px 8px;
                background: #213244;
                border-radius: 4px;
                color: #ffffff;
                text-decoration: none;
                margin-bottom: 6px;
                border: 1px solid #334d66;
            " onmouseover="this.style.background='#2a475e'" onmouseout="this.style.background='#213244'">
                <div>
                    <div style="font-weight: 600; color: #67c1f5;">Update Epic Store</div>
                    <div style="font-size: 10px; color: #8f98a0; margin-top: 2px;">
                        Last: ${formatSyncDate(epicSyncTime)} (${epicLib.length} games)
                    </div>
                </div>
                <span style="font-size: 14px; margin-left: 6px; color: #79a8d8;">↗</span>
            </a>
            <a href="${GOG_LIBRARY_URL}" target="_blank" rel="noopener noreferrer" style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 6px 8px;
                background: #2a203b;
                border-radius: 4px;
                color: #ffffff;
                text-decoration: none;
                border: 1px solid #4c376c;
            " onmouseover="this.style.background='#3d2c57'" onmouseout="this.style.background='#2a203b'">
                <div>
                    <div style="font-weight: 600; color: #c499f5;">Update GOG Store</div>
                    <div style="font-size: 10px; color: #8f98a0; margin-top: 2px;">
                        Last: ${formatSyncDate(gogSyncTime)} (${gogLib.length} games)
                    </div>
                </div>
                <span style="font-size: 14px; margin-left: 6px; color: #b185e8;">↗</span>
            </a>
        `;

        function toggleDropdown(e) {
            e.stopPropagation();
            const isOpen = dropdownMenu.style.display === 'block';
            dropdownMenu.style.display = isOpen ? 'none' : 'block';
        }

        arrowBtn.addEventListener('click', toggleDropdown);

        document.addEventListener('click', function (e) {
            if (!container.contains(e.target)) {
                dropdownMenu.style.display = 'none';
            }
        });

        container.appendChild(arrowBtn);
        container.appendChild(dropdownMenu);

        // 2. "Owned:" Label
        const label = document.createElement('span');
        label.textContent = 'Owned:';
        label.style.cssText = `
            font-weight: 700;
            font-size: 11px;
            color: #8f98a0;
            margin-right: 2px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        `;
        container.appendChild(label);

        // 3. Store Badges / Icons
        if (hasEpic) {
            const epicGroup = document.createElement('span');
            epicGroup.style.cssText = 'display: inline-flex; align-items: center; gap: 3px;';

            const epicLink = document.createElement('a');
            epicLink.href = getEpicSearchUrl(epicOwnedTitle || steamTitle);
            epicLink.target = '_blank';
            epicLink.rel = 'noopener noreferrer';
            epicLink.title = `Owned on Epic Games Store ("${epicOwnedTitle}")\nClick to search on Epic Games Store`;
            epicLink.innerHTML = `
                <div style="display: inline-flex; align-items: center; gap: 4px;">
                    <svg width="11" height="13" viewBox="0 0 24 28" fill="none" style="display:block; flex-shrink: 0;">
                        <path fill-rule="evenodd" clip-rule="evenodd" d="M12 0.5L1 4.5v17.2C1 26.5 12 28 12 28s11-1.5 11-6.3V4.5L12 0.5zm0 2.4l8.8 3.2v14.6c0 3.2-8.8 4.8-8.8 4.8s-8.8-1.6-8.8-4.8V6.1L12 2.9zm-5 5.5h10v2.4H10v2.2h6.5v2.4H10v2.3h7.2v2.4H7V8.4z" fill="#ffffff"/>
                    </svg>
                    <span style="font-weight: 800; font-size: 10.5px; color: #ffffff; letter-spacing: 0.5px; line-height: 1;">EPIC</span>
                </div>
            `;
            epicLink.style.cssText = `
                display: inline-flex;
                align-items: center;
                justify-content: center;
                height: 20px;
                padding: 0 6px;
                background: #0074e4;
                border: 1px solid #4aa3ff;
                border-radius: 3px;
                cursor: pointer;
                text-decoration: none;
                box-shadow: 0 1px 3px rgba(0,0,0,0.35);
                transition: transform 0.1s ease, background 0.15s ease, border-color 0.15s ease;
            `;
            epicLink.addEventListener('mouseenter', function () {
                epicLink.style.background = '#0062c4';
                epicLink.style.borderColor = '#80bfff';
                epicLink.style.transform = 'scale(1.05)';
            });
            epicLink.addEventListener('mouseleave', function () {
                epicLink.style.background = '#0074e4';
                epicLink.style.borderColor = '#4aa3ff';
                epicLink.style.transform = 'scale(1)';
            });
            epicGroup.appendChild(epicLink);

            if (epicMatches && epicMatches.length > 0) {
                const epicInfoBtn = createEditionInfoIcon('epic', epicMatches);
                if (epicInfoBtn) epicGroup.appendChild(epicInfoBtn);
            }

            container.appendChild(epicGroup);
        }

        if (hasGog) {
            const gogGroup = document.createElement('span');
            gogGroup.style.cssText = 'display: inline-flex; align-items: center; gap: 3px;';

            const gogLink = document.createElement('a');
            gogLink.href = getGogSearchUrl(gogOwnedTitle || steamTitle);
            gogLink.target = '_blank';
            gogLink.rel = 'noopener noreferrer';
            gogLink.title = `Owned on GOG ("${gogOwnedTitle}")\nClick to search on GOG`;
            gogLink.innerHTML = `
                <div style="display: inline-flex; align-items: center; gap: 4px;">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" style="display:block; flex-shrink: 0;">
                        <circle cx="12" cy="12" r="10" stroke="#ffffff" stroke-width="2.5"/>
                        <circle cx="12" cy="12" r="4.5" fill="#ffffff"/>
                    </svg>
                    <span style="font-weight: 800; font-size: 10.5px; color: #ffffff; letter-spacing: 0.5px; line-height: 1;">GOG</span>
                </div>
            `;
            gogLink.style.cssText = `
                display: inline-flex;
                align-items: center;
                justify-content: center;
                height: 20px;
                padding: 0 6px;
                background: #7a35d9;
                border: 1px solid #b185e8;
                border-radius: 3px;
                cursor: pointer;
                text-decoration: none;
                box-shadow: 0 1px 3px rgba(0,0,0,0.35);
                transition: transform 0.1s ease, background 0.15s ease, border-color 0.15s ease;
            `;
            gogLink.addEventListener('mouseenter', function () {
                gogLink.style.background = '#6928c7';
                gogLink.style.borderColor = '#d9baff';
                gogLink.style.transform = 'scale(1.05)';
            });
            gogLink.addEventListener('mouseleave', function () {
                gogLink.style.background = '#7a35d9';
                gogLink.style.borderColor = '#b185e8';
                gogLink.style.transform = 'scale(1)';
            });
            gogGroup.appendChild(gogLink);

            if (gogMatches && gogMatches.length > 0) {
                const gogInfoBtn = createEditionInfoIcon('gog', gogMatches);
                if (gogInfoBtn) gogGroup.appendChild(gogInfoBtn);
            }

            container.appendChild(gogGroup);
        }

        // If not owned on both stores, display a single X
        if (!hasAny) {
            const notOwnedBadge = document.createElement('a');
            notOwnedBadge.href = getEpicSearchUrl(steamTitle);
            notOwnedBadge.target = '_blank';
            notOwnedBadge.rel = 'noopener noreferrer';
            notOwnedBadge.title = 'Not owned on Epic or GOG\nClick to search on Epic Games Store';
            notOwnedBadge.textContent = '✕';
            notOwnedBadge.style.cssText = `
                display: inline-flex;
                align-items: center;
                justify-content: center;
                height: 20px;
                padding: 0 7px;
                border-radius: 3px;
                background: rgba(229, 115, 115, 0.18);
                border: 1px solid rgba(229, 115, 115, 0.45);
                color: #ff7676;
                font-size: 11px;
                font-weight: 900;
                text-decoration: none;
                cursor: pointer;
                box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease;
            `;
            notOwnedBadge.addEventListener('mouseenter', function () {
                notOwnedBadge.style.background = 'rgba(229, 115, 115, 0.28)';
                notOwnedBadge.style.borderColor = 'rgba(229, 115, 115, 0.7)';
                notOwnedBadge.style.transform = 'scale(1.05)';
            });
            notOwnedBadge.addEventListener('mouseleave', function () {
                notOwnedBadge.style.background = 'rgba(229, 115, 115, 0.18)';
                notOwnedBadge.style.borderColor = 'rgba(229, 115, 115, 0.45)';
                notOwnedBadge.style.transform = 'scale(1)';
            });
            container.appendChild(notOwnedBadge);
        }

        titleElement.appendChild(container);
        return true;
    }

    function checkGamePage() {
        const steamTitle = captureOriginalSteamTitle();
        if (!steamTitle) return;

        const comparisonTitle = getComparisonTitle(steamTitle);

        let epicMatches = [];
        if (isEpicCacheValid()) {
            epicMatches = findEpicOwnedMatches(comparisonTitle);
        }

        let gogMatches = [];
        if (isGogCacheValid()) {
            gogMatches = findGogOwnedMatches(comparisonTitle);
        }

        const epicOwnedTitle = epicMatches.length > 0 ? epicMatches[0].original : null;
        const gogOwnedTitle = gogMatches.length > 0 ? gogMatches[0].original : null;

        renderUnifiedOwnershipBox(steamTitle, epicOwnedTitle, gogOwnedTitle, epicMatches, gogMatches);
    }

    function isSteamPopup(element) {
        if (!element) return false;

        const popupSelectors = [
            '.store_hover',
            '.hover_box',
            '.hover_body',
            '.popup_block',
            '.popup_menu',
            '.store_tooltip',
            '.game_hover',
            '.search_result_row_hover',
            '[class*="hover_content"]',
            '[class*="HoverContent"]',
            '[class*="tooltip"]',
            '[class*="Tooltip"]'
        ];

        for (const selector of popupSelectors) {
            try {
                if (element.closest(selector)) {
                    return true;
                }
            } catch (_) { }
        }

        return false;
    }

    function cleanCardText(text) {
        if (!text) return null;

        let result = String(text)
            .replace(/\s+/g, ' ')
            .trim();

        result = result.replace(
            /\b\d+(?:[.,]\d{1,2})?\s*€\b/gi,
            ''
        );

        result = result.replace(
            /\b\d+(?:[.,]\d{1,2})?\s*(?:EUR|USD|GBP)\b/gi,
            ''
        );

        return result.replace(/\s+/g, ' ').trim();
    }

    function getTitleFromSlug(href) {
        if (!href) return null;

        const match = href.match(/\/app\/\d+\/([^/?#]+)/);
        if (!match) return null;

        let slug = match[1];

        try {
            slug = decodeURIComponent(slug);
        } catch (_) { }

        return cleanCardText(slug.replace(/_/g, ' '));
    }

    function getCardTitleFromAttributes(element) {
        const attributes = [
            'aria-label',
            'data-tooltip-text',
            'title'
        ];

        for (const attribute of attributes) {
            const value = element.getAttribute(attribute);
            const cleaned = cleanCardText(value);

            if (
                cleaned &&
                /^(in library|add to library|wishlist)$/i.test(cleaned)
            ) {
                continue;
            }

            if (
                cleaned &&
                cleaned.length > 1 &&
                cleaned.length < 150
            ) {
                return cleaned;
            }
        }

        return null;
    }

    function getCardTitleFromKnownElements(element) {
        const selectors = [
            '.search_name',
            '.tab_item_name',
            '.title',
            '.game_name',
            '.home_smallcap_title',
            '.home_smallcap2',
            '.salepreviewwidgets_Title',
            '.recommendation_name',
            '.recommendation_name_text',
            '.similar_grid_item_name',
            '.store_capsule .game_name',
            '.store_capsule .name'
        ];

        for (const selector of selectors) {
            const nodes = element.querySelectorAll(selector);

            for (const node of nodes) {
                const cleaned = cleanCardText(node.textContent);

                if (
                    cleaned &&
                    !/^(in library|add to library|wishlist)$/i.test(cleaned) &&
                    cleaned.length > 1 &&
                    cleaned.length < 150
                ) {
                    return cleaned;
                }
            }
        }

        return null;
    }

    function getCardTitleFromImage(element) {
        const images = element.querySelectorAll('img');

        for (const image of images) {
            const alt = cleanCardText(image.getAttribute('alt'));

            if (
                alt &&
                !/^(in library|add to library|wishlist)$/i.test(alt) &&
                alt.length > 1 &&
                alt.length < 150
            ) {
                return alt;
            }
        }

        return null;
    }

    function getCardTitle(element) {
        let title = getCardTitleFromKnownElements(element);
        if (title) return title;

        title = getCardTitleFromImage(element);
        if (title) return title;

        title = getCardTitleFromAttributes(element);
        if (title) return title;

        const link =
            element.matches && element.matches('a[href*="/app/"]')
                ? element
                : element.querySelector('a[href*="/app/"]');

        if (link) {
            title = getTitleFromSlug(link.getAttribute('href'));
            if (title) return title;
        }

        return null;
    }

    function getKnownSteamCards() {
        const selectors = [
            '.search_result_row',
            '.search_result_row_spacer',
            '.recommendation',
            '.recommendation_card',
            '.recommendation_card_container',
            '.game_area_recommendation',
            '.similar_grid_item',
            '.similar_grid',
            '.recommended_grid',
            '.small_cap',
            '.small_cap_hover',
            '.home_smallcap',
            '.store_capsule',
            '.dailydeal',
            '.tab_item',
            '.friendplaytime_game',
            '.specials_item',
            '.game_area_dlc_row',
            '.curator_recommendation',
            '.carousel_items > a'
        ];

        const elements = document.querySelectorAll(selectors.join(', '));
        return [...new Set(elements)];
    }

    function getCardFromAppLink(link) {
        if (!link) return null;
        if (isSteamPopup(link)) return null;

        const directKnownCard = link.closest(
            [
                '.search_result_row',
                '.recommendation',
                '.recommendation_card',
                '.recommendation_card_container',
                '.similar_grid_item',
                '.store_capsule',
                '.small_cap',
                '.home_smallcap',
                '.tab_item',
                '.dailydeal',
                '.specials_item',
                '.curator_recommendation'
            ].join(', ')
        );

        if (directKnownCard && !isSteamPopup(directKnownCard)) {
            return directKnownCard;
        }

        let current = link.parentElement;
        let bestCard = null;
        let bestArea = Infinity;

        for (let depth = 0; current && depth < 8; depth++) {
            if (isSteamPopup(current)) {
                return null;
            }

            const appLinks = current.querySelectorAll('a[href*="/app/"]');

            if (appLinks.length === 1) {
                const hasImage = !!current.querySelector('img');
                const hasTitle = !!current.querySelector(
                    '.title, .game_name, .search_name, .tab_item_name, [class*="Title"], [class*="title"]'
                );

                if (hasImage || hasTitle) {
                    const rect = current.getBoundingClientRect();
                    const width = rect.width;
                    const height = rect.height;

                    if (
                        width >= 80 &&
                        height >= 40 &&
                        width <= 900 &&
                        height <= 600
                    ) {
                        const area = width * height;
                        if (area < bestArea) {
                            bestArea = area;
                            bestCard = current;
                        }
                    }
                }
            }

            current = current.parentElement;
        }

        return bestCard;
    }

    function createCardBadge(platform, state, tooltip) {
        if (state !== 'owned') {
            return null;
        }

        const badge = document.createElement('span');
        badge.className =
            platform === 'epic'
                ? EPIC_CARD_BADGE_CLASS
                : GOG_CARD_BADGE_CLASS;

        const label = platform === 'epic' ? 'Epic' : 'GOG';
        badge.textContent = `${label} ✓`;
        badge.title = tooltip;

        badge.style.cssText = `
            display: inline-flex;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            height: 20px;
            min-width: 40px;
            padding: 0 7px;
            margin-left: 5px;
            margin-right: 4px;
            border-radius: 3px;
            border: 1px solid #67d46a;
            background: #67d46a;
            color: #1b2838;
            font-family: Arial,sans-serif;
            font-size: 10px;
            font-weight: 700;
            line-height: 18px;
            white-space: nowrap;
            pointer-events: none;
            user-select: none;
            vertical-align: middle;
            z-index: 50;
        `;

        return badge;
    }

    function insertCardBadges(card, epicOwnedTitle, gogOwnedTitle) {
        if (!card) return;

        card
            .querySelectorAll(
                `.${EPIC_CARD_BADGE_CLASS}, .${GOG_CARD_BADGE_CLASS}, .steam-platform-badges`
            )
            .forEach(function (badge) {
                badge.remove();
            });

        if (!epicOwnedTitle && !gogOwnedTitle) {
            return;
        }

        const titleSelectors = [
            '.search_name',
            '.tab_item_name',
            '.title',
            '.game_name',
            '.home_smallcap_title',
            '.home_smallcap2',
            '.salepreviewwidgets_Title',
            '.recommendation_name',
            '.recommendation_name_text',
            '.similar_grid_item_name'
        ];

        let titleElement = null;

        for (const selector of titleSelectors) {
            const element = card.querySelector(selector);
            if (element && element.textContent.trim()) {
                titleElement = element;
                break;
            }
        }

        if (titleElement) {
            titleElement.style.display = 'inline-flex';
            titleElement.style.alignItems = 'center';
            titleElement.style.flexWrap = 'wrap';

            if (epicOwnedTitle) {
                const badge = createCardBadge(
                    'epic',
                    'owned',
                    `You own "${epicOwnedTitle}" on Epic Games Store.`
                );
                if (badge) titleElement.appendChild(badge);
            }

            if (gogOwnedTitle) {
                const badge = createCardBadge(
                    'gog',
                    'owned',
                    `You own "${gogOwnedTitle}" through GOG.`
                );
                if (badge) titleElement.appendChild(badge);
            }

            return;
        }

        const appLink = card.querySelector('a[href*="/app/"]');
        if (!appLink) return;

        const computed = window.getComputedStyle(card);
        if (computed.position === 'static') {
            card.style.position = 'relative';
        }

        const badges = document.createElement('div');
        badges.className = 'steam-platform-badges';
        badges.style.cssText = `
            position: absolute;
            top: 7px;
            right: 7px;
            z-index: 50;
            display: flex;
            gap: 4px;
            align-items: center;
        `;

        if (epicOwnedTitle) {
            const epicBadge = createCardBadge(
                'epic',
                'owned',
                `You own "${epicOwnedTitle}" on Epic Games Store.`
            );
            if (epicBadge) {
                epicBadge.style.margin = '0';
                badges.appendChild(epicBadge);
            }
        }

        if (gogOwnedTitle) {
            const gogBadge = createCardBadge(
                'gog',
                'owned',
                `You own "${gogOwnedTitle}" through GOG.`
            );
            if (gogBadge) {
                gogBadge.style.margin = '0';
                badges.appendChild(gogBadge);
            }
        }

        if (badges.children.length === 0) {
            return;
        }

        card.appendChild(badges);
    }

    function processSteamCard(card) {
        if (!card) return;
        if (isSteamPopup(card)) return;

        const title = getCardTitle(card);
        if (!title) return;

        const normalized = getComparisonTitle(title);
        if (!normalized) return;

        let epicMatches = [];
        if (isEpicCacheValid()) {
            epicMatches = findEpicOwnedMatches(normalized);
        }

        let gogMatches = [];
        if (isGogCacheValid()) {
            gogMatches = findGogOwnedMatches(normalized);
        }

        if (epicMatches.length === 0 && gogMatches.length === 0) {
            return;
        }

        const epicOwnedTitle = epicMatches.length > 0
            ? epicMatches.map(m => m.original + (m.edition ? ` [${m.edition}]` : '')).join(', ')
            : null;

        const gogOwnedTitle = gogMatches.length > 0
            ? gogMatches.map(m => m.original + (m.edition ? ` [${m.edition}]` : '')).join(', ')
            : null;

        insertCardBadges(card, epicOwnedTitle, gogOwnedTitle);
    }

    function scanKnownSteamCards() {
        const cards = getKnownSteamCards();
        for (const card of cards) {
            processSteamCard(card);
        }
    }

    function scanSteamAppLinks() {
        const links = document.querySelectorAll('a[href*="/app/"]');
        const cards = new Set();

        links.forEach(function (link) {
            if (isSteamPopup(link)) return;
            if (link.closest('.apphub_AppName')) return;

            const card = getCardFromAppLink(link);
            if (card) {
                cards.add(card);
            }
        });

        cards.forEach(function (card) {
            processSteamCard(card);
        });
    }

    function scanSteamCards() {
        if (!isSteamPage()) return;
        scanKnownSteamCards();
        scanSteamAppLinks();
    }

    function observeSteamCards() {
        scanSteamCards();

        if (!document.body) return;

        let timer = null;

        function scheduleScan() {
            if (timer) {
                clearTimeout(timer);
            }

            timer = setTimeout(function () {
                timer = null;
                scanSteamCards();
            }, 200);
        }

        const observer = new MutationObserver(function (mutations) {
            for (const mutation of mutations) {
                if (
                    mutation.addedNodes &&
                    mutation.addedNodes.length
                ) {
                    scheduleScan();
                    return;
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        setTimeout(scanSteamCards, 300);
        setTimeout(scanSteamCards, 700);
        setTimeout(scanSteamCards, 1500);
        setTimeout(scanSteamCards, 3000);
        setTimeout(scanSteamCards, 5000);
        setTimeout(scanSteamCards, 8000);
        setTimeout(scanSteamCards, 12000);
    }

    function formatExactSyncDate(timestamp) {
        if (!timestamp || timestamp <= 0) return 'Never';
        const d = new Date(timestamp);
        const pad = (n) => String(n).padStart(2, '0');
        const day = pad(d.getDate());
        const month = pad(d.getMonth() + 1);
        const year = d.getFullYear();
        const hours = pad(d.getHours());
        const minutes = pad(d.getMinutes());
        const seconds = pad(d.getSeconds());
        return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds}`;
    }

    function createEpicSyncUI() {
        if (document.getElementById('steam-epic-sync-wrapper')) {
            return;
        }

        function findPurchasesHeader() {
            const candidates = document.querySelectorAll(
                'h1, h2, h3, [class*="heading"], [class*="Heading"], [class*="title"], [class*="Title"]'
            );
            for (const el of candidates) {
                if (/^purchases/i.test(el.textContent.trim())) {
                    return el;
                }
            }
            return document.querySelector('h1') || document.querySelector('[data-component="Heading"]');
        }

        const headerEl = findPurchasesHeader();
        const targetParent = headerEl ? headerEl.parentElement : document.body;
        if (!targetParent && !document.body) return;

        const wrapper = document.createElement('span');
        wrapper.id = 'steam-epic-sync-wrapper';

        if (headerEl) {
            headerEl.style.display = 'inline-flex';
            headerEl.style.alignItems = 'center';
            headerEl.style.flexWrap = 'wrap';
            wrapper.style.cssText = `
                position: relative;
                display: inline-flex;
                align-items: center;
                margin-left: 12px;
                vertical-align: middle;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
                z-index: 99999;
            `;
        } else {
            wrapper.style.cssText = `
                position: fixed;
                right: 20px;
                bottom: 20px;
                display: inline-flex;
                align-items: center;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
                z-index: 999999;
            `;
        }

        // Trigger Button: "Sync to Steam"
        const triggerBtn = document.createElement('button');
        triggerBtn.id = 'steam-epic-sync-trigger';
        triggerBtn.type = 'button';
        triggerBtn.textContent = 'Sync to Steam';
        triggerBtn.style.cssText = `
            background: #0b76e0;
            color: #ffffff;
            border: 1px solid rgba(0,0,0,0.25);
            border-radius: 4px;
            padding: 0 14px;
            height: 32px;
            box-sizing: border-box;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            text-shadow: 0 1px 2px rgba(0,0,0,0.3);
            transition: background 0.15s ease, transform 0.1s ease;
            user-select: none;
            white-space: nowrap;
            line-height: 1;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            vertical-align: middle;
        `;

        triggerBtn.addEventListener('mouseenter', function () {
            triggerBtn.style.background = '#0961b8';
        });
        triggerBtn.addEventListener('mouseleave', function () {
            triggerBtn.style.background = '#0b76e0';
        });

        // Compressed Popup Box
        const popup = document.createElement('div');
        popup.id = 'steam-epic-sync-panel';
        popup.style.cssText = `
            position: absolute;
            top: calc(100% + 6px);
            left: 0;
            background: #111822;
            color: #ffffff;
            padding: 12px 14px 10px 14px;
            border-radius: 6px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.75);
            border: 1px solid #283545;
            font-size: 12px;
            min-width: 270px;
            max-width: 320px;
            display: none;
            box-sizing: border-box;
            z-index: 100000;
            line-height: 1.4;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        `;

        const title = document.createElement('div');
        title.textContent = 'Steam Epic Ownership';
        title.style.cssText = `
            font-size: 14px;
            font-weight: 700;
            color: #ffffff;
            margin-bottom: 2px;
        `;

        const status = document.createElement('div');
        status.style.cssText = `
            color: #c0c6d0;
            font-size: 12px;
            margin-bottom: 10px;
        `;

        const btnRow = document.createElement('div');
        btnRow.style.cssText = `
            display: flex;
            gap: 8px;
            margin-bottom: 10px;
        `;

        const quickBtn = document.createElement('button');
        quickBtn.type = 'button';
        quickBtn.textContent = 'Quick Sync';
        quickBtn.title = 'Syncs only new games since your last sync (Fast)';
        quickBtn.style.cssText = `
            flex: 1;
            background: #0b76e0;
            color: #ffffff;
            border: 0;
            border-radius: 4px;
            padding: 7px 12px;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            text-align: center;
            transition: background 0.15s ease;
        `;
        quickBtn.addEventListener('mouseenter', function () {
            quickBtn.style.background = '#0961b8';
        });
        quickBtn.addEventListener('mouseleave', function () {
            quickBtn.style.background = '#0b76e0';
        });

        const fullBtn = document.createElement('button');
        fullBtn.type = 'button';
        fullBtn.textContent = 'Full Sync';
        fullBtn.title = 'Performs a full scan of all purchases';
        fullBtn.style.cssText = `
            flex: 1;
            background: #0b76e0;
            color: #ffffff;
            border: 0;
            border-radius: 4px;
            padding: 7px 12px;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            text-align: center;
            transition: background 0.15s ease;
        `;
        fullBtn.addEventListener('mouseenter', function () {
            fullBtn.style.background = '#0961b8';
        });
        fullBtn.addEventListener('mouseleave', function () {
            fullBtn.style.background = '#0b76e0';
        });

        const ownedInfo = document.createElement('div');
        ownedInfo.style.cssText = `
            color: #5bb35f;
            font-weight: 700;
            font-size: 12px;
            margin-bottom: 3px;
        `;

        const lastPurchaseInfo = document.createElement('div');
        lastPurchaseInfo.style.cssText = `
            color: #e69138;
            font-size: 11px;
            margin-bottom: 3px;
            word-break: break-word;
            display: none;
        `;

        const lastSyncInfo = document.createElement('div');
        lastSyncInfo.style.cssText = `
            color: #94a3b8;
            font-size: 11px;
            margin-bottom: 2px;
        `;

        const footerRow = document.createElement('div');
        footerRow.style.cssText = `
            display: flex;
            justify-content: flex-end;
            margin-top: 4px;
        `;

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.textContent = '✕';
        closeBtn.title = 'Close';
        closeBtn.style.cssText = `
            background: #252e3b;
            border: 1px solid #3b4758;
            color: #cbd5e1;
            border-radius: 4px;
            width: 22px;
            height: 22px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            cursor: pointer;
            transition: background 0.15s ease, color 0.15s ease;
        `;
        closeBtn.addEventListener('mouseenter', function () {
            closeBtn.style.background = '#323e50';
            closeBtn.style.color = '#ffffff';
        });
        closeBtn.addEventListener('mouseleave', function () {
            closeBtn.style.background = '#252e3b';
            closeBtn.style.color = '#cbd5e1';
        });
        closeBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            popup.style.display = 'none';
        });

        function updateDisplay() {
            const syncTime = getEpicSyncTime();
            const library = getEpicLibrary();
            status.textContent = library.length > 0 ? 'Epic library is loaded.' : 'No library synced yet.';
            ownedInfo.textContent = `Owned titles: ${library.length}`;

            if (library.length > 0 && library[0] && library[0].original) {
                lastPurchaseInfo.textContent = `Last purchase: ${library[0].original}`;
                lastPurchaseInfo.style.display = 'block';
            } else {
                lastPurchaseInfo.style.display = 'none';
            }

            lastSyncInfo.textContent = `Last sync: ${formatExactSyncDate(syncTime)}`;
        }

        function runSync(isFull) {
            quickBtn.disabled = true;
            fullBtn.disabled = true;
            quickBtn.style.opacity = '0.6';
            fullBtn.style.opacity = '0.6';

            status.textContent = `Syncing Epic library (${isFull ? 'Full Mode' : 'Quick Mode'})...`;

            syncEpicLibrary(
                {
                    isFullSync: isFull,
                    onProgress: function (msg) {
                        status.textContent = msg;
                    },
                    onSuccess: function (library, newCount, isSmart) {
                        if (isSmart) {
                            status.textContent = `Quick sync complete! Added ${newCount} new games.`;
                        } else {
                            status.textContent = `Full sync complete! Total: ${library.length} games.`;
                        }
                        ownedInfo.textContent = `Owned titles: ${library.length}`;
                        if (library.length > 0 && library[0] && library[0].original) {
                            lastPurchaseInfo.textContent = `Last purchase: ${library[0].original}`;
                            lastPurchaseInfo.style.display = 'block';
                        }
                        lastSyncInfo.textContent = `Last sync: ${formatExactSyncDate(Date.now())}`;

                        quickBtn.disabled = false;
                        fullBtn.disabled = false;
                        quickBtn.style.opacity = '1';
                        fullBtn.style.opacity = '1';
                    },
                    onError: function (err) {
                        status.textContent = `Sync failed: ${err}`;
                        quickBtn.disabled = false;
                        fullBtn.disabled = false;
                        quickBtn.style.opacity = '1';
                        fullBtn.style.opacity = '1';
                    }
                }
            );
        }

        quickBtn.addEventListener('click', function () {
            runSync(false);
        });

        fullBtn.addEventListener('click', function () {
            runSync(true);
        });

        triggerBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            const isHidden = popup.style.display === 'none' || !popup.style.display;
            popup.style.display = isHidden ? 'block' : 'none';
            if (isHidden) {
                updateDisplay();
            }
        });

        document.addEventListener('click', function (e) {
            if (!wrapper.contains(e.target)) {
                popup.style.display = 'none';
            }
        });

        updateDisplay();

        btnRow.appendChild(quickBtn);
        btnRow.appendChild(fullBtn);

        footerRow.appendChild(closeBtn);

        popup.appendChild(title);
        popup.appendChild(status);
        popup.appendChild(btnRow);
        popup.appendChild(ownedInfo);
        popup.appendChild(lastPurchaseInfo);
        popup.appendChild(lastSyncInfo);
        popup.appendChild(footerRow);

        wrapper.appendChild(triggerBtn);
        wrapper.appendChild(popup);

        if (headerEl) {
            headerEl.appendChild(wrapper);
        } else {
            document.body.appendChild(wrapper);
        }
    }

    function createGogSyncUI() {
        if (document.getElementById('steam-gog-sync-wrapper')) {
            return;
        }

        function findCollectionHeader() {
            const candidates = document.querySelectorAll(
                '.account__header, .account-header, .collection-header, .header__dropdown, [class*="collection"], [class*="Collection"], h1, h2'
            );
            for (const el of candidates) {
                if (/my collection/i.test(el.textContent.trim())) {
                    return el;
                }
            }
            const all = document.querySelectorAll('*');
            for (const el of all) {
                if (el.children.length === 0 && /my collection/i.test(el.textContent.trim())) {
                    return el.parentElement || el;
                }
            }
            return document.querySelector('.account-nav') || document.querySelector('.account__header') || document.querySelector('h1');
        }

        const headerEl = findCollectionHeader();
        if (!headerEl && !document.body) return;

        const wrapper = document.createElement('span');
        wrapper.id = 'steam-gog-sync-wrapper';

        if (headerEl) {
            headerEl.style.display = 'inline-flex';
            headerEl.style.alignItems = 'center';
            headerEl.style.flexWrap = 'wrap';
            wrapper.style.cssText = `
                position: relative;
                display: inline-flex;
                align-items: center;
                margin-left: 12px;
                vertical-align: middle;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
                z-index: 99999;
            `;
        } else {
            wrapper.style.cssText = `
                position: fixed;
                right: 20px;
                bottom: 20px;
                display: inline-flex;
                align-items: center;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
                z-index: 999999;
            `;
        }

        // Trigger Button: "Sync to Steam"
        const triggerBtn = document.createElement('button');
        triggerBtn.id = 'steam-gog-sync-trigger';
        triggerBtn.type = 'button';
        triggerBtn.textContent = 'Sync to Steam';
        triggerBtn.style.cssText = `
            background: #7a35d9;
            color: #ffffff;
            border: 1px solid rgba(0,0,0,0.25);
            border-radius: 4px;
            padding: 0 14px;
            height: 32px;
            box-sizing: border-box;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            text-shadow: 0 1px 2px rgba(0,0,0,0.3);
            transition: background 0.15s ease, transform 0.1s ease;
            user-select: none;
            white-space: nowrap;
            line-height: 1;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            vertical-align: middle;
        `;

        triggerBtn.addEventListener('mouseenter', function () {
            triggerBtn.style.background = '#6928c7';
        });
        triggerBtn.addEventListener('mouseleave', function () {
            triggerBtn.style.background = '#7a35d9';
        });

        // Compressed Popup Box
        const popup = document.createElement('div');
        popup.id = 'steam-gog-sync-panel';
        popup.style.cssText = `
            position: absolute;
            top: calc(100% + 6px);
            left: 0;
            background: #111822;
            color: #ffffff;
            padding: 12px 14px 10px 14px;
            border-radius: 6px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.75);
            border: 1px solid #3d2f52;
            font-size: 12px;
            min-width: 270px;
            max-width: 320px;
            display: none;
            box-sizing: border-box;
            z-index: 100000;
            line-height: 1.4;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        `;

        const title = document.createElement('div');
        title.textContent = 'Steam GOG Ownership';
        title.style.cssText = `
            font-size: 14px;
            font-weight: 700;
            color: #ffffff;
            margin-bottom: 2px;
        `;

        const status = document.createElement('div');
        status.style.cssText = `
            color: #c0c6d0;
            font-size: 12px;
            margin-bottom: 10px;
        `;

        const btnRow = document.createElement('div');
        btnRow.style.cssText = `
            display: flex;
            gap: 8px;
            margin-bottom: 10px;
        `;

        const quickBtn = document.createElement('button');
        quickBtn.type = 'button';
        quickBtn.textContent = 'Quick Sync';
        quickBtn.title = 'Syncs only new games since your last sync (Fast)';
        quickBtn.style.cssText = `
            flex: 1;
            background: #7a35d9;
            color: #ffffff;
            border: 0;
            border-radius: 4px;
            padding: 7px 12px;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            text-align: center;
            transition: background 0.15s ease;
        `;
        quickBtn.addEventListener('mouseenter', function () {
            quickBtn.style.background = '#6928c7';
        });
        quickBtn.addEventListener('mouseleave', function () {
            quickBtn.style.background = '#7a35d9';
        });

        const fullBtn = document.createElement('button');
        fullBtn.type = 'button';
        fullBtn.textContent = 'Full Sync';
        fullBtn.title = 'Performs a full scan of all library pages';
        fullBtn.style.cssText = `
            flex: 1;
            background: #7a35d9;
            color: #ffffff;
            border: 0;
            border-radius: 4px;
            padding: 7px 12px;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            text-align: center;
            transition: background 0.15s ease;
        `;
        fullBtn.addEventListener('mouseenter', function () {
            fullBtn.style.background = '#6928c7';
        });
        fullBtn.addEventListener('mouseleave', function () {
            fullBtn.style.background = '#7a35d9';
        });

        const ownedInfo = document.createElement('div');
        ownedInfo.style.cssText = `
            color: #5bb35f;
            font-weight: 700;
            font-size: 12px;
            margin-bottom: 3px;
        `;

        const lastPurchaseInfo = document.createElement('div');
        lastPurchaseInfo.style.cssText = `
            color: #e69138;
            font-size: 11px;
            margin-bottom: 3px;
            word-break: break-word;
            display: none;
        `;

        const lastSyncInfo = document.createElement('div');
        lastSyncInfo.style.cssText = `
            color: #94a3b8;
            font-size: 11px;
            margin-bottom: 2px;
        `;

        const footerRow = document.createElement('div');
        footerRow.style.cssText = `
            display: flex;
            justify-content: flex-end;
            margin-top: 4px;
        `;

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.textContent = '✕';
        closeBtn.title = 'Close';
        closeBtn.style.cssText = `
            background: #252e3b;
            border: 1px solid #3b4758;
            color: #cbd5e1;
            border-radius: 4px;
            width: 22px;
            height: 22px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            cursor: pointer;
            transition: background 0.15s ease, color 0.15s ease;
        `;
        closeBtn.addEventListener('mouseenter', function () {
            closeBtn.style.background = '#323e50';
            closeBtn.style.color = '#ffffff';
        });
        closeBtn.addEventListener('mouseleave', function () {
            closeBtn.style.background = '#252e3b';
            closeBtn.style.color = '#cbd5e1';
        });
        closeBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            popup.style.display = 'none';
        });

        function updateDisplay() {
            const syncTime = getGogSyncTime();
            const library = getGogLibrary();
            status.textContent = library.length > 0 ? 'GOG library is loaded.' : 'No library synced yet.';
            ownedInfo.textContent = `Owned titles: ${library.length}`;

            if (library.length > 0 && library[0] && library[0].original) {
                lastPurchaseInfo.textContent = `Last purchase: ${library[0].original}`;
                lastPurchaseInfo.style.display = 'block';
            } else {
                lastPurchaseInfo.style.display = 'none';
            }

            lastSyncInfo.textContent = `Last sync: ${formatExactSyncDate(syncTime)}`;
        }

        async function runSync(isFull) {
            quickBtn.disabled = true;
            fullBtn.disabled = true;
            quickBtn.style.opacity = '0.6';
            fullBtn.style.opacity = '0.6';

            status.textContent = `Syncing GOG library (${isFull ? 'Full Mode' : 'Quick Mode'})...`;

            try {
                const res = await syncGogLibrary({
                    isFullSync: isFull,
                    onProgress: function (msg) {
                        status.textContent = msg;
                    }
                });

                if (res.isSmart) {
                    status.textContent = `Quick sync complete! Added ${res.newCount} new games.`;
                } else {
                    status.textContent = `Full sync complete! Total: ${res.library.length} games.`;
                }
                ownedInfo.textContent = `Owned titles: ${res.library.length}`;
                if (res.library.length > 0 && res.library[0] && res.library[0].original) {
                    lastPurchaseInfo.textContent = `Last purchase: ${res.library[0].original}`;
                    lastPurchaseInfo.style.display = 'block';
                }
                lastSyncInfo.textContent = `Last sync: ${formatExactSyncDate(Date.now())}`;
            } catch (err) {
                status.textContent = `Sync failed: ${err.message || err}`;
            } finally {
                quickBtn.disabled = false;
                fullBtn.disabled = false;
                quickBtn.style.opacity = '1';
                fullBtn.style.opacity = '1';
            }
        }

        quickBtn.addEventListener('click', function () {
            runSync(false);
        });

        fullBtn.addEventListener('click', function () {
            runSync(true);
        });

        triggerBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            const isHidden = popup.style.display === 'none' || !popup.style.display;
            popup.style.display = isHidden ? 'block' : 'none';
            if (isHidden) {
                updateDisplay();
            }
        });

        document.addEventListener('click', function (e) {
            if (!wrapper.contains(e.target)) {
                popup.style.display = 'none';
            }
        });

        updateDisplay();

        btnRow.appendChild(quickBtn);
        btnRow.appendChild(fullBtn);

        footerRow.appendChild(closeBtn);

        popup.appendChild(title);
        popup.appendChild(status);
        popup.appendChild(btnRow);
        popup.appendChild(ownedInfo);
        popup.appendChild(lastPurchaseInfo);
        popup.appendChild(lastSyncInfo);
        popup.appendChild(footerRow);

        wrapper.appendChild(triggerBtn);
        wrapper.appendChild(popup);

        if (headerEl) {
            headerEl.appendChild(wrapper);
        } else {
            document.body.appendChild(wrapper);
        }
    }

    console.log(
        '[Steam → Epic + GOG] Script loaded:',
        location.href
    );

    if (isEpicPage()) {
        const initEpic = function () {
            createEpicSyncUI();
            const observer = new MutationObserver(function () {
                if (!document.getElementById('steam-epic-sync-wrapper')) {
                    createEpicSyncUI();
                }
            });
            if (document.body) {
                observer.observe(document.body, { childList: true, subtree: true });
            }
        };

        if (document.body) {
            initEpic();
        } else {
            window.addEventListener('DOMContentLoaded', initEpic, { once: true });
        }

    } else if (isGogPage()) {
        const initGog = function () {
            createGogSyncUI();
            const observer = new MutationObserver(function () {
                if (!document.getElementById('steam-gog-sync-wrapper')) {
                    createGogSyncUI();
                }
            });
            if (document.body) {
                observer.observe(document.body, { childList: true, subtree: true });
            }
        };

        if (document.body) {
            initGog();
        } else {
            window.addEventListener('DOMContentLoaded', initGog, { once: true });
        }

    } else if (isSteamPage()) {

        if (
            /\/app\/\d+\/[^/]+/.test(
                window.location.pathname
            )
        ) {
            if (getSteamTitleElement()) {
                captureOriginalSteamTitle();
                checkGamePage();
            } else {
                const observer =
                    new MutationObserver(
                        function () {
                            if (
                                getSteamTitleElement()
                            ) {
                                observer.disconnect();

                                captureOriginalSteamTitle();
                                checkGamePage();
                            }
                        }
                    );

                observer.observe(
                    document.documentElement,
                    {
                        childList: true,
                        subtree: true
                    }
                );

                setTimeout(
                    function () {
                        if (
                            !document.getElementById(
                                'steam-ownership-indicator'
                            )
                        ) {
                            captureOriginalSteamTitle();
                            checkGamePage();
                        }
                    },
                    1500
                );
            }
        }

        observeSteamCards();
    }

})();
