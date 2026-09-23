# Epic and GOG Ownership Checker for Steam

A Tampermonkey userscript that shows Epic Games Store and GOG ownership directly on Steam.

## Features

- **Single Unified Ownership Indicator**: Shows a clean `Owned: [Epic] [GOG]` box next to the game title on Steam game pages.
  - Displays the store icon for stores where you own the game.
  - If you do not own the game on either store, displays a single `✕`.
  - Clicking any store icon redirects directly to a search for the game on that store (Epic Games Store or GOG).
  - Includes a dropdown down-arrow (`▼`) before `Owned:` with quick links to update your Epic and GOG databases and view last sync timestamps.
- **Edition Detection & Info Tooltips (`(?)`)**: Adds an interactive `(?)` info button next to store badges. Hovering over it (or clicking) displays a floating dark-mode tooltip listing the exact owned edition(s) and version(s) in your library (e.g. *Complete Edition*, *Director's Cut*, *Game of the Year*, *Deluxe Edition*, *Standard Edition*).
- **Special Characters & Separator Normalization**: Properly normalizes symbols, trademark characters (`®`, `™`, `©`), and word separators (`_`, `/`, `\`, `|`, `-`). Fixes cross-store matching for games like `Watch_Dogs® 2` vs `Watch Dogs 2` with two-tier fallback matching (exact + collapsed whitespace).
- **Multi-Edition Ownership Support**: Automatically detects and groups all owned editions of a title from your Epic or GOG library so you can see every version you own at a glance.
- **Smart Incremental Sync (Quick Sync)**: Fast incremental sync mode that stops scanning when it reaches previously synced purchases, merging newly acquired games automatically.
- **Full Sync**: Option to perform a full scan of all library pages whenever needed.
- **Header-Integrated Sync Buttons**: Adds a sleek **`Sync to Steam`** button next to **Purchases** on Epic Games Store and **My Collection** on GOG, with a compact dropdown popup displaying owned titles, last purchase, and exact last sync timestamp.
- **Steam Cards Support**: Shows small green `Epic ✓` and `GOG ✓` badges on search results, recommendations, and similar-game cards with detailed owned edition tooltips.
- **Local Storage Caching**: Caches Epic and GOG ownership data locally using Tampermonkey storage.
- **Privacy Friendly**: Uses the browser's existing Epic and GOG login sessions without transmitting data to third parties.

## Installation

1. Install Tampermonkey.
2. Create a new userscript.
3. Copy `Epic-and-GOG-Ownership-Checker-for-Steam.user.js` into it.
4. Save the script.
5. Open Steam.

## Synchronization

1. **Epic Games Store**:
   - Open your Epic transactions page: `https://accounts.epicgames.com/account/transactions/purchases`
   - Click the **`Sync to Steam`** button next to the **Purchases** heading.
   - Choose **Quick Sync** (fast incremental) or **Full Sync**.

2. **GOG**:
   - Open your GOG account page: `https://www.gog.com/account`
   - Click the **`Sync to Steam`** button next to the **My Collection** dropdown.
   - Choose **Quick Sync** (fast incremental) or **Full Sync**.

You must be logged in to the respective service in your browser.

## Privacy

The userscript does not contain or hard-code account IDs, usernames, email addresses, passwords, API keys, authentication tokens, or personal cookies. Ownership data is stored locally in your browser via Tampermonkey storage.

## Permissions

The script uses `GM_getValue`, `GM_setValue`, and `GM_xmlhttpRequest`.

## License

MIT License. See [LICENSE](LICENSE).

## Credits

Created by **Theodoros OhYeah, ChatGPT, and Antigravity**.

This is an unofficial userscript and is not affiliated with Valve, Steam, Epic Games, or GOG.

<img width="775" height="501" alt="image" src="https://github.com/user-attachments/assets/193f7755-dd30-4a43-930d-b1c7003a6f7b" />
<img width="1241" height="823" alt="image" src="https://github.com/user-attachments/assets/0c0e7ff4-22db-4cbe-a3c5-14fb61e4c46d" />
<img width="1498" height="384" alt="image" src="https://github.com/user-attachments/assets/65807572-56fa-4d4f-912c-7931bd46a6dd" />
<img width="561" height="480" alt="image" src="https://github.com/user-attachments/assets/fc092229-5960-4132-8363-a82cb945e8f8" />




