// ==UserScript==
// @name         Epic and GOG Ownership Checker for Steam
// @namespace    https://steam-multi-ownership.local/
// @version      3.4
// @author       Theodoros OhYeah & ChatGPT
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
            .replace(/[:\-–—]/g, ' ')
            .replace(/[^\p{L}\p{N}\s]/gu, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function removePurchasePrefix(title) {
        return title
            .replace(/^purchased\s+/i, '')
            .replace(/^purchase\s+/i, '')
            .trim();
    }

    function removeEditionSuffix(title) {
        let result = title;

        const suffixes = [
            ' game of the year edition',
            ' game of the year',
            ' goty edition',
            ' goty',
            ' complete edition',
            ' complete',
            ' ultimate edition',
            ' ultimate',
            ' deluxe edition',
            ' deluxe',
            ' definitive edition',
            ' definitive',
            ' enhanced edition',
            ' enhanced',
            ' legendary edition',
            ' legendary',
            ' gold edition',
            ' gold',
            ' platinum edition',
            ' platinum',
            ' premium edition',
            ' premium',
            ' founders edition',
            ' founders',
            ' standard edition',
            ' standard',
            ' anniversary edition',
            ' anniversary',
            ' special edition',
            ' special'
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

        return result;
    }

    function getComparisonTitle(title) {
        let result = normalizeTitle(title);
        result = removePurchasePrefix(result);
        result = removeEditionSuffix(result);
        return result;
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

    function findEpicOwnedTitle(normalizedTitle) {
        if (!isEpicCacheValid()) return null;

        const library = getEpicLibrary();

        for (const entry of library) {
            const epicTitle =
                typeof entry === 'string'
                    ? getComparisonTitle(entry)
                    : entry.normalized;

            if (epicTitle === normalizedTitle) {
                return typeof entry === 'string'
                    ? entry
                    : entry.original;
            }
        }

        return null;
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

    function syncEpicLibrary(onProgress, onSuccess, onError) {
        const games = [];
        let page = 0;

        function loadPage(nextPageToken) {
            page++;

            if (onProgress) {
                onProgress(
                    `Syncing Epic library... page ${page}`
                );
            }

            fetchEpicPage(
                nextPageToken,

                function (data) {
                    if (!Array.isArray(data.orders)) {
                        onError(
                            'Unexpected Epic response format'
                        );
                        return;
                    }

                    data.orders.forEach(function (order) {
                        if (!Array.isArray(order.items)) return;

                        order.items.forEach(function (item) {
                            if (
                                !item ||
                                typeof item.description !== 'string'
                            ) {
                                return;
                            }

                            const title = item.description.trim();
                            if (!title) return;

                            const normalized =
                                getComparisonTitle(title);

                            if (!normalized) return;

                            games.push({
                                original: title,
                                normalized: normalized
                            });
                        });
                    });

                    if (data.nextPageToken) {
                        loadPage(data.nextPageToken);
                        return;
                    }

                    const unique = new Map();

                    games.forEach(function (game) {
                        if (!unique.has(game.normalized)) {
                            unique.set(
                                game.normalized,
                                game.original
                            );
                        }
                    });

                    const library =
                        Array.from(unique.entries()).map(
                            function (entry) {
                                return {
                                    normalized: entry[0],
                                    original: entry[1]
                                };
                            }
                        );

                    GM_setValue(
                        EPIC_LIBRARY_KEY,
                        library
                    );

                    GM_setValue(
                        EPIC_SYNC_TIME_KEY,
                        Date.now()
                    );

                    console.log(
                        '[Steam → Epic] Sync complete:',
                        library.length,
                        'titles'
                    );

                    onSuccess(library);
                },

                function (error) {
                    console.error(
                        '[Steam → Epic] Sync failed:',
                        error
                    );
                    onError(error);
                }
            );
        }

        loadPage('');
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

    function findGogOwnedTitle(normalizedTitle) {
        if (!isGogCacheValid()) return null;

        const library = getGogLibrary();

        for (const entry of library) {
            const gogTitle =
                typeof entry === 'string'
                    ? getComparisonTitle(entry)
                    : entry.normalized;

            if (gogTitle === normalizedTitle) {
                return typeof entry === 'string'
                    ? entry
                    : entry.original;
            }
        }

        return null;
    }

    function fetchGogPage(page) {
        const params = new URLSearchParams({
            mediaType: '1',
            page: String(page),
            sortBy: 'title',
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
                    console.log(
                        '[Steam → GOG] GOG response:',
                        response.status
                    );

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
                        const data =
                            JSON.parse(
                                response.responseText
                            );

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
                    reject(
                        new Error(
                            'Could not connect to GOG.'
                        )
                    );
                },

                ontimeout: function () {
                    reject(
                        new Error(
                            'GOG request timed out.'
                        )
                    );
                }
            });
        });
    }

    async function fetchGogGames(updateProgress) {
        updateProgress(
            'Requesting GOG library...'
        );

        const firstPage =
            await fetchGogPage(1);

        if (
            !firstPage ||
            !Array.isArray(firstPage.products)
        ) {
            throw new Error(
                'GOG did not return a valid game library.'
            );
        }

        const products = [
            ...firstPage.products
        ];

        const totalPages =
            Number(firstPage.totalPages) || 1;

        updateProgress(
            `GOG library: page 1 of ${totalPages}...`
        );

        for (
            let page = 2;
            page <= totalPages;
            page++
        ) {
            updateProgress(
                `GOG library: page ${page} of ${totalPages}...`
            );

            const data =
                await fetchGogPage(page);

            if (
                data &&
                Array.isArray(data.products)
            ) {
                products.push(...data.products);
            }
        }

        return products;
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

            const normalized =
                getComparisonTitle(title);

            if (!normalized) continue;

            library.push({
                original: title,
                normalized: normalized
            });
        }

        const unique = new Map();

        for (const game of library) {
            if (!unique.has(game.normalized)) {
                unique.set(
                    game.normalized,
                    game.original
                );
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

    async function syncGogLibrary(updateProgress) {
        updateProgress(
            'Downloading GOG library...'
        );

        const products =
            await fetchGogGames(updateProgress);

        console.log(
            '[Steam → GOG] Products received:',
            products.length
        );

        const library =
            extractGogLibrary(products);

        console.log(
            '[Steam → GOG] Games extracted:',
            library.length
        );

        if (!library.length) {
            throw new Error(
                'GOG returned no owned games. Make sure you are logged in to GOG.'
            );
        }

        await GM_setValue(
            GOG_LIBRARY_KEY,
            library
        );

        await GM_setValue(
            GOG_SYNC_TIME_KEY,
            Date.now()
        );

        console.log(
            `[Steam → GOG] Sync complete: ${library.length} titles`
        );

        return library;
    }

    function getSteamTitleElement() {
        return document.querySelector('.apphub_AppName');
    }

    function captureOriginalSteamTitle() {
        const element =
            getSteamTitleElement();

        if (!element) return null;

        if (!originalSteamTitle) {
            const clone =
                element.cloneNode(true);

            clone
                .querySelectorAll(
                    [
                        '#steam-epic-indicator',
                        '#steam-gog-indicator',
                        '#steam-amazon-indicator',
                        '#gg-deals-search-button'
                    ].join(', ')
                )
                .forEach(function (node) {
                    node.remove();
                });

            let text =
                clone.textContent.trim();

            text =
                text
                    .replace(
                        /Current:\s*[\d.,]+€?/gi,
                        ''
                    )
                    .replace(
                        /Historical:\s*[\d.,]+€?/gi,
                        ''
                    )
                    .trim();

            if (text) {
                originalSteamTitle = text;
            }
        }

        return originalSteamTitle;
    }

    function createGamePageRefreshButton(platform) {
        const refresh =
            document.createElement('a');

        refresh.href =
            platform === 'epic'
                ? EPIC_TRANSACTIONS_URL
                : GOG_LIBRARY_URL;

        refresh.target = '_blank';
        refresh.rel = 'noopener noreferrer';
        refresh.textContent = '↻';

        refresh.title =
            platform === 'epic'
                ? 'Open Epic Transactions'
                : 'Open GOG account';

        refresh.style.cssText = `
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 16px;
            height: 16px;
            margin-left: 5px;
            padding: 0;
            color: #79a8d8;
            text-decoration: none !important;
            font-family: Arial,sans-serif;
            font-size: 15px;
            font-weight: 700;
            line-height: 16px;
            cursor: pointer;
            opacity: .9;
        `;

        return refresh;
    }

    function addGamePageBadge(
        platform,
        state,
        tooltip
    ) {
        const title =
            getSteamTitleElement();

        if (!title) return false;

        const id =
            platform === 'epic'
                ? 'steam-epic-indicator'
                : 'steam-gog-indicator';

        const existing =
            document.getElementById(id);

        if (existing) {
            existing.remove();
        }

        title.style.display = 'inline-flex';
        title.style.alignItems = 'center';

        const wrapper =
            document.createElement('span');

        wrapper.id = id;
        wrapper.title = tooltip;

        const background =
            platform === 'epic'
                ? '#2a475e'
                : '#4b0082';

        const border =
            platform === 'epic'
                ? '#4f6b7f'
                : '#7b4ca8';

        const hoverBackground =
            platform === 'epic'
                ? '#355b75'
                : '#663399';

        const hoverBorder =
            platform === 'epic'
                ? '#6f91a8'
                : '#9666c2';

        wrapper.style.cssText = `
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            margin-left: 10px;
            height: 24px;
            padding: 0 6px;
            background: ${background};
            border: 1px solid ${border};
            box-sizing: border-box;
            border-radius: 3px;
            vertical-align: middle;
            color: #ffffff;
            font-size: 12px;
            font-weight: bold;
            line-height: 24px;
            white-space: nowrap;
            flex-shrink: 0;
        `;

        const label =
            document.createElement('span');

        label.textContent =
            platform === 'epic'
                ? 'Epic:'
                : 'GOG:';

        const icon =
            document.createElement('span');

        icon.textContent =
            state === 'owned'
                ? '✓'
                : state === 'not-owned'
                    ? '✕'
                    : '?';

        icon.style.cssText = `
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 15px;
            height: 15px;
            border-radius: 2px;
            background: ${
                state === 'owned'
                    ? '#67d46a'
                    : state === 'not-owned'
                        ? '#e57373'
                        : '#999999'
            };
            color: #1b2838;
            font-size: 10px;
            font-weight: 900;
            line-height: 15px;
        `;

        wrapper.appendChild(label);
        wrapper.appendChild(icon);

        wrapper.appendChild(
            createGamePageRefreshButton(platform)
        );

        wrapper.addEventListener(
            'mouseenter',
            function () {
                wrapper.style.background =
                    hoverBackground;

                wrapper.style.borderColor =
                    hoverBorder;
            }
        );

        wrapper.addEventListener(
            'mouseleave',
            function () {
                wrapper.style.background =
                    background;

                wrapper.style.borderColor =
                    border;
            }
        );

        title.appendChild(wrapper);

        return true;
    }

    function checkGamePage() {
        const steamTitle =
            captureOriginalSteamTitle();

        if (!steamTitle) return;

        const comparisonTitle =
            getComparisonTitle(steamTitle);

        if (!isEpicCacheValid()) {
            addGamePageBadge(
                'epic',
                'unknown',
                'Epic library cache is missing or older than 7 days. Click ↻ to open Epic Transactions.'
            );
        } else {
            const epicOwned =
                findEpicOwnedTitle(
                    comparisonTitle
                );

            addGamePageBadge(
                'epic',
                epicOwned
                    ? 'owned'
                    : 'not-owned',
                epicOwned
                    ? `You own "${epicOwned}" on Epic Games Store.`
                    : 'You do not own this game on Epic Games Store.'
            );
        }

        if (!isGogCacheValid()) {
            addGamePageBadge(
                'gog',
                'unknown',
                'GOG library cache is missing or older than 7 days. Click ↻ to open your GOG account.'
            );
        } else {
            const gogOwned =
                findGogOwnedTitle(
                    comparisonTitle
                );

            addGamePageBadge(
                'gog',
                gogOwned
                    ? 'owned'
                    : 'not-owned',
                gogOwned
                    ? `You own "${gogOwned}" through GOG.`
                    : 'You do not own this game through GOG.'
            );
        }
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
            } catch (_) {}
        }

        return false;
    }

    function cleanCardText(text) {
        if (!text) return null;

        let result =
            String(text)
                .replace(/\s+/g, ' ')
                .trim();

        result =
            result.replace(
                /\b\d+(?:[.,]\d{1,2})?\s*€\b/gi,
                ''
            );

        result =
            result.replace(
                /\b\d+(?:[.,]\d{1,2})?\s*(?:EUR|USD|GBP)\b/gi,
                ''
            );

        return result
            .replace(/\s+/g, ' ')
            .trim();
    }

    function getTitleFromSlug(href) {
        if (!href) return null;

        const match =
            href.match(
                /\/app\/\d+\/([^/?#]+)/
            );

        if (!match) return null;

        let slug = match[1];

        try {
            slug = decodeURIComponent(slug);
        } catch (_) {}

        return cleanCardText(
            slug.replace(/_/g, ' ')
        );
    }

    function getCardTitleFromAttributes(element) {
        const attributes = [
            'aria-label',
            'data-tooltip-text',
            'title'
        ];

        for (const attribute of attributes) {
            const value =
                element.getAttribute(attribute);

            const cleaned =
                cleanCardText(value);

            if (
                cleaned &&
                /^(in library|add to library|wishlist)$/i.test(
                    cleaned
                )
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
            const nodes =
                element.querySelectorAll(selector);

            for (const node of nodes) {
                const cleaned =
                    cleanCardText(node.textContent);

                if (
                    cleaned &&
                    !/^(in library|add to library|wishlist)$/i.test(
                        cleaned
                    ) &&
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
        const images =
            element.querySelectorAll('img');

        for (const image of images) {
            const alt =
                cleanCardText(
                    image.getAttribute('alt')
                );

            if (
                alt &&
                !/^(in library|add to library|wishlist)$/i.test(
                    alt
                ) &&
                alt.length > 1 &&
                alt.length < 150
            ) {
                return alt;
            }
        }

        return null;
    }

    function getCardTitle(element) {
        let title =
            getCardTitleFromKnownElements(element);

        if (title) return title;

        title =
            getCardTitleFromImage(element);

        if (title) return title;

        title =
            getCardTitleFromAttributes(element);

        if (title) return title;

        const link =
            element.matches &&
            element.matches('a[href*="/app/"]')
                ? element
                : element.querySelector(
                    'a[href*="/app/"]'
                );

        if (link) {
            title =
                getTitleFromSlug(
                    link.getAttribute('href')
                );

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

        const elements =
            document.querySelectorAll(
                selectors.join(', ')
            );

        return [
            ...new Set(elements)
        ];
    }

    function getCardFromAppLink(link) {
        if (!link) return null;

        if (isSteamPopup(link)) {
            return null;
        }

        const directKnownCard =
            link.closest(
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

        if (
            directKnownCard &&
            !isSteamPopup(directKnownCard)
        ) {
            return directKnownCard;
        }

        let current = link.parentElement;
        let bestCard = null;
        let bestArea = Infinity;

        for (
            let depth = 0;
            current &&
            depth < 8;
            depth++
        ) {
            if (isSteamPopup(current)) {
                return null;
            }

            const appLinks =
                current.querySelectorAll(
                    'a[href*="/app/"]'
                );

            if (appLinks.length === 1) {
                const hasImage =
                    !!current.querySelector('img');

                const hasTitle =
                    !!current.querySelector(
                        '.title, .game_name, .search_name, .tab_item_name, [class*="Title"], [class*="title"]'
                    );

                if (hasImage || hasTitle) {
                    const rect =
                        current.getBoundingClientRect();

                    const width = rect.width;
                    const height = rect.height;

                    if (
                        width >= 80 &&
                        height >= 40 &&
                        width <= 900 &&
                        height <= 600
                    ) {
                        const area =
                            width * height;

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

    /*
     * Small Steam cards only receive badges for games that
     * are actually owned. Not-owned games get no badge.
     */
    function createCardBadge(
        platform,
        state,
        tooltip
    ) {
        if (state !== 'owned') {
            return null;
        }

        const badge =
            document.createElement('span');

        badge.className =
            platform === 'epic'
                ? EPIC_CARD_BADGE_CLASS
                : GOG_CARD_BADGE_CLASS;

        const label =
            platform === 'epic'
                ? 'Epic'
                : 'GOG';

        badge.textContent =
            `${label} ✓`;

        badge.title = tooltip;

        /*
         * Same green background and same dark text
         * for Epic and GOG.
         */
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

    function insertCardBadges(
        card,
        epicOwnedTitle,
        gogOwnedTitle
    ) {
        if (!card) return;

        card
            .querySelectorAll(
                `.${EPIC_CARD_BADGE_CLASS}, .${GOG_CARD_BADGE_CLASS}, .steam-platform-badges`
            )
            .forEach(function (badge) {
                badge.remove();
            });

        /*
         * No ownership = absolutely nothing displayed.
         */
        if (
            !epicOwnedTitle &&
            !gogOwnedTitle
        ) {
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
            const element =
                card.querySelector(selector);

            if (
                element &&
                element.textContent.trim()
            ) {
                titleElement = element;
                break;
            }
        }

        if (titleElement) {
            titleElement.style.display =
                'inline-flex';

            titleElement.style.alignItems =
                'center';

            titleElement.style.flexWrap =
                'wrap';

            if (epicOwnedTitle) {
                const badge =
                    createCardBadge(
                        'epic',
                        'owned',
                        `You own "${epicOwnedTitle}" on Epic Games Store.`
                    );

                if (badge) {
                    titleElement.appendChild(badge);
                }
            }

            if (gogOwnedTitle) {
                const badge =
                    createCardBadge(
                        'gog',
                        'owned',
                        `You own "${gogOwnedTitle}" through GOG.`
                    );

                if (badge) {
                    titleElement.appendChild(badge);
                }
            }

            return;
        }

        const appLink =
            card.querySelector(
                'a[href*="/app/"]'
            );

        if (!appLink) return;

        const computed =
            window.getComputedStyle(card);

        if (computed.position === 'static') {
            card.style.position = 'relative';
        }

        const badges =
            document.createElement('div');

        badges.className =
            'steam-platform-badges';

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
            const epicBadge =
                createCardBadge(
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
            const gogBadge =
                createCardBadge(
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

        const title =
            getCardTitle(card);

        if (!title) return;

        const normalized =
            getComparisonTitle(title);

        if (!normalized) return;

        let epicOwnedTitle = null;

        if (isEpicCacheValid()) {
            epicOwnedTitle =
                findEpicOwnedTitle(normalized);
        }

        let gogOwnedTitle = null;

        if (isGogCacheValid()) {
            gogOwnedTitle =
                findGogOwnedTitle(normalized);
        }

        /*
         * Not owned on either platform:
         * show absolutely nothing.
         */
        if (
            !epicOwnedTitle &&
            !gogOwnedTitle
        ) {
            return;
        }

        insertCardBadges(
            card,
            epicOwnedTitle,
            gogOwnedTitle
        );
    }

    function scanKnownSteamCards() {
        const cards =
            getKnownSteamCards();

        for (const card of cards) {
            processSteamCard(card);
        }
    }

    function scanSteamAppLinks() {
        const links =
            document.querySelectorAll(
                'a[href*="/app/"]'
            );

        const cards = new Set();

        links.forEach(function (link) {
            if (isSteamPopup(link)) {
                return;
            }

            if (
                link.closest(
                    '.apphub_AppName'
                )
            ) {
                return;
            }

            const card =
                getCardFromAppLink(link);

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

            timer =
                setTimeout(
                    function () {
                        timer = null;
                        scanSteamCards();
                    },
                    200
                );
        }

        const observer =
            new MutationObserver(
                function (mutations) {
                    for (const mutation of mutations) {
                        if (
                            mutation.addedNodes &&
                            mutation.addedNodes.length
                        ) {
                            scheduleScan();
                            return;
                        }
                    }
                }
            );

        observer.observe(
            document.body,
            {
                childList: true,
                subtree: true
            }
        );

        setTimeout(scanSteamCards, 300);
        setTimeout(scanSteamCards, 700);
        setTimeout(scanSteamCards, 1500);
        setTimeout(scanSteamCards, 3000);
        setTimeout(scanSteamCards, 5000);
        setTimeout(scanSteamCards, 8000);
        setTimeout(scanSteamCards, 12000);
    }

    function createEpicSyncUI() {
        if (
            document.getElementById(
                'steam-epic-sync-panel'
            )
        ) {
            return;
        }

        if (!document.body) return;

        const panel =
            document.createElement('div');

        panel.id =
            'steam-epic-sync-panel';

        panel.style.cssText = `
            position: fixed;
            right: 20px;
            bottom: 20px;
            z-index: 999999;
            background: #202020;
            color: #fff;
            padding: 14px 16px;
            border-radius: 8px;
            box-shadow: 0 4px 18px rgba(0,0,0,.45);
            font-family: Arial,sans-serif;
            font-size: 14px;
            min-width: 270px;
        `;

        const heading =
            document.createElement('div');

        heading.textContent =
            'Steam → Epic';

        heading.style.cssText = `
            font-size: 16px;
            font-weight: 700;
            margin-bottom: 8px;
        `;

        const status =
            document.createElement('div');

        status.style.cssText = `
            margin-bottom: 10px;
            color: #bbb;
        `;

        const button =
            document.createElement('button');

        button.textContent =
            'Sync Epic Library';

        button.style.cssText = `
            border: 0;
            border-radius: 5px;
            padding: 7px 12px;
            cursor: pointer;
            font-weight: 600;
        `;

        button.addEventListener(
            'click',
            function () {
                button.disabled = true;
                status.textContent =
                    'Starting sync...';

                syncEpicLibrary(
                    function (message) {
                        status.textContent =
                            message;
                    },

                    function (library) {
                        status.textContent =
                            `Epic library synced: ${library.length} titles.`;

                        button.disabled = false;

                        checkGamePage();
                        scanSteamCards();
                    },

                    function (error) {
                        status.textContent =
                            `Sync failed: ${error}`;

                        button.disabled = false;
                    }
                );
            }
        );

        panel.appendChild(heading);
        panel.appendChild(status);
        panel.appendChild(button);

        document.body.appendChild(panel);

        const syncTime =
            getEpicSyncTime();

        if (!syncTime) {
            status.textContent =
                'No Epic library synced yet.';
            return;
        }

        const age =
            Date.now() - syncTime;

        if (age > CACHE_DURATION) {
            status.textContent =
                'Epic library needs updating.';
        } else {
            const days =
                Math.floor(
                    age / 86400000
                );

            status.textContent =
                days === 0
                    ? 'Library synced today.'
                    : `Library synced ${days} day${
                        days === 1 ? '' : 's'
                    } ago.`;
        }
    }

    function createGogSyncUI() {
        if (
            document.getElementById(
                'steam-gog-sync-panel'
            )
        ) {
            return;
        }

        if (!document.body) return;

        const panel =
            document.createElement('div');

        panel.id =
            'steam-gog-sync-panel';

        panel.style.cssText = `
            position: fixed;
            right: 20px;
            bottom: 20px;
            z-index: 999999;
            background: #202020;
            color: #fff;
            padding: 14px 16px;
            border-radius: 8px;
            box-shadow: 0 4px 18px rgba(0,0,0,.45);
            font-family: Arial,sans-serif;
            font-size: 14px;
            min-width: 270px;
        `;

        const heading =
            document.createElement('div');

        heading.textContent =
            'Steam → GOG';

        heading.style.cssText = `
            font-size: 16px;
            font-weight: 700;
            margin-bottom: 8px;
        `;

        const status =
            document.createElement('div');

        status.style.cssText = `
            margin-bottom: 10px;
            color: #bbb;
        `;

        const button =
            document.createElement('button');

        button.textContent =
            'Sync GOG Library';

        button.style.cssText = `
            border: 0;
            border-radius: 5px;
            padding: 7px 12px;
            cursor: pointer;
            font-weight: 600;
        `;

        button.addEventListener(
            'click',
            async function () {
                button.disabled = true;
                status.textContent =
                    'Starting sync...';

                try {
                    const library =
                        await syncGogLibrary(
                            function (message) {
                                status.textContent =
                                    message;
                            }
                        );

                    status.textContent =
                        `GOG library synced: ${library.length} titles.`;

                    button.disabled = false;

                    checkGamePage();
                    scanSteamCards();

                } catch (error) {
                    console.error(
                        '[Steam → GOG] Sync failed:',
                        error
                    );

                    status.textContent =
                        `Sync failed: ${
                            error.message || error
                        }`;

                    button.disabled = false;
                }
            }
        );

        panel.appendChild(heading);
        panel.appendChild(status);
        panel.appendChild(button);

        document.body.appendChild(panel);

        const syncTime =
            getGogSyncTime();

        if (!syncTime) {
            status.textContent =
                'No GOG library synced yet.';
            return;
        }

        const age =
            Date.now() - syncTime;

        if (age > CACHE_DURATION) {
            status.textContent =
                'GOG library needs updating.';
        } else {
            const days =
                Math.floor(
                    age / 86400000
                );

            status.textContent =
                days === 0
                    ? 'Library synced today.'
                    : `Library synced ${days} day${
                        days === 1 ? '' : 's'
                    } ago.`;
        }
    }

    console.log(
        '[Steam → Epic + GOG] Script loaded:',
        location.href
    );

    if (isEpicPage()) {
        if (document.body) {
            createEpicSyncUI();
        } else {
            window.addEventListener(
                'DOMContentLoaded',
                createEpicSyncUI,
                { once: true }
            );
        }

    } else if (isGogPage()) {
        if (document.body) {
            createGogSyncUI();
        } else {
            window.addEventListener(
                'DOMContentLoaded',
                createGogSyncUI,
                { once: true }
            );
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
                                'steam-epic-indicator'
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
