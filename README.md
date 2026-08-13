# Epic and GOG Ownership Checker for Steam

A Tampermonkey userscript that shows Epic Games Store and GOG ownership directly on Steam.

## Features

- Shows Epic ownership on Steam game pages.
- Shows GOG ownership on Steam game pages.
- Supports Steam search results.
- Supports recommendation and similar-game cards.
- Supports Steam **More Like This** pages such as `/recommended/morelike/app/.../`.
- Works with dynamically loaded Steam cards.
- Shows small green `Epic ✓` and `GOG ✓` badges for owned games.
- Does not show `✕` or `?` markers on small Steam cards for games you do not own.
- Caches Epic and GOG ownership data locally for 7 days.
- Uses the browser's existing Epic and GOG login sessions.

## Installation

1. Install Tampermonkey.
2. Create a new userscript.
3. Copy `Epic-and-GOG-Ownership-Checker-for-Steam.user.js` into it.
4. Save the script.
5. Open Steam.

## Synchronization

Open your Epic transactions page and use the **Sync Epic Library** button.

Open your GOG account page and use the **Sync GOG Library** button.

You must already be logged in to the respective service.

## Privacy

The userscript does not contain or hard-code account IDs, usernames, email addresses, passwords, API keys, authentication tokens, or personal cookies.

Ownership data is stored locally using Tampermonkey storage. The script does not send your ownership list to a separate third-party server.

The script uses the browser's existing login session when communicating with Epic and GOG.

## Permissions

The script uses `GM_getValue`, `GM_setValue`, and `GM_xmlhttpRequest`.

Epic requires `GM_xmlhttpRequest()` because its ownership endpoint does not provide the CORS headers required for a normal browser `fetch()` request.

## License

MIT License. See [LICENSE](LICENSE).

## Credits

Created by **Theodoros OhYeah and ChatGPT**.

This is an unofficial userscript and is not affiliated with Valve, Steam, Epic Games, or GOG.
