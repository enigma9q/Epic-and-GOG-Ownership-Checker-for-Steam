# Epic and GOG Ownership Checker for Steam

A Tampermonkey userscript that shows Epic Games Store, GOG, and Amazon Games ownership on Steam and GG.deals.

## Features

- **Single Unified Ownership Indicator**: Shows a clean `Owned: [Epic] [GOG] [Amazon]` box next to the game title on Steam game pages.
  - Displays the store icon for stores where you own the game.
  - If you do not own the game on any supported store, displays a single `✕`.
  - Clicking a store badge opens that store's search or library page.
  - Includes a dropdown down-arrow (`▼`) before `Owned:` with links to update each store database and view last sync timestamps.
- **Edition Detection & Info Tooltips (`(?)`)**: On Steam game pages, the existing ownership box and `(?)` controls show owned editions and versions. On Steam cards and GG.deals, click a store badge to open a tooltip listing the owned version titles.
- **Special Characters & Separator Normalization**: Properly normalizes symbols, trademark characters (`®`, `™`, `©`), and word separators (`_`, `/`, `\`, `|`, `-`). Fixes cross-store matching for games like `Watch_Dogs® 2` vs `Watch Dogs 2` with two-tier fallback matching (exact + collapsed whitespace).
- **Multi-Edition Ownership Support**: Automatically detects and groups owned editions from your Epic or GOG library so you can see every version you own at a glance.
- **Smart Incremental Sync (Quick Sync)**: Fast incremental sync mode that stops scanning when it reaches previously synced purchases, merging newly acquired games automatically.
- **Full Sync**: Option to perform a full scan of all library pages whenever needed.
- **Header-Integrated Sync Buttons**: Adds a sleek **`Sync to Steam`** button next to **Purchases** on Epic Games Store and **My Collection** on GOG, with a compact dropdown popup displaying owned titles, last purchase, and exact last sync timestamp.
- **Amazon Games Support**: Syncs titles marked “Delivered to your Amazon Games library” (or with a crown marker) from the Amazon Games collection page and stores ownership locally.
- **Steam Cards Support**: Shows `Epic`, `GOG`, and `Amazon` badges on search results, recommendations, and similar-game cards. Click a badge to view owned version titles; a `?` marks editions the store entry does not confirm.
- **GG.deals Support**: Shows ownership badges across GG.deals game listings, search results, game pages, and wishlist entries. Listing badges sit on the game artwork; search results show them beside the title.
- **Epic and GOG Game Pages**: Shows an `Owned:` indicator beside game titles when that game matches one of your synced libraries. Product pages show the ownership indicator without the library sync button.
- **Edition-Preserving Sync**: Stores distinct editions separately, so the tooltip can list every owned edition and Quick Sync can detect a newly purchased edition of an already owned game.
- **Local Storage Caching**: Caches all three stores' ownership data locally using Tampermonkey storage.
- **Privacy Friendly**: Uses your existing store login sessions and does not transmit ownership data to third parties.

## Installation

1. Install Tampermonkey.
2. Create a new userscript.
3. Copy `Epic-and-GOG-Ownership-Checker-for-Steam.user.js` into it.
4. Save the script.
5. Open Steam or a supported GG.deals game or wishlist page to see ownership badges.

## Synchronization

1. **Epic Games Store**:
   - Open your Epic transactions page: `https://accounts.epicgames.com/account/transactions/purchases`
   - Click the **`Sync to Steam`** button next to the **Purchases** heading.
   - Choose **Quick Sync** (fast incremental) or **Full Sync**.

2. **GOG**:
   - Open your GOG account page: `https://www.gog.com/account`
   - Click the **`Sync to Steam`** button next to the **My Collection** dropdown.
   - Choose **Quick Sync** (fast incremental) or **Full Sync**.

3. **Amazon Games**:
   - Open your Amazon Games collection, such as `https://luna.amazon.com.be/claims/my-collection`.
   - On first use, choose your Amazon region. The script remembers it and uses that regional collection URL when you open Amazon Games from Steam.
   - Choose **Other Amazon region…** and enter your Luna collection host if it is not listed.
   - Choose **Quick Sync** to scan newest periods first and stop at the first title already in the saved library, or **Full Sync** to scan every period and every **See more** batch.
   - The script saves games marked “Delivered to your Amazon Games library” and games with a crown marker.
   - The script automatically cycles through every available period, clicks **See more** until all titles in that period are loaded, merges the titles, and returns the collection page to the period you had selected.
   - To change regions later, use **Set Amazon Games region** in the userscript manager menu.

You must be logged in to the respective service in your browser. Amazon collection access and available years may vary by region and account.

## Privacy

The userscript does not contain or hard-code account IDs, usernames, email addresses, passwords, API keys, authentication tokens, or personal cookies. Ownership data and your selected Amazon region are stored locally in your browser via Tampermonkey storage.

## Permissions

The script uses `GM_getValue`, `GM_setValue`, `GM_xmlhttpRequest`, and `GM_registerMenuCommand`.

## License

MIT License. See [LICENSE](LICENSE).

## Credits

Created by **Theodoros OhYeah, ChatGPT, Codex, and Antigravity**.

This is an unofficial userscript and is not affiliated with Valve, Steam, Epic Games, GOG, or Amazon.

Owned status

<img width="1144" height="594" alt="image" src="https://github.com/user-attachments/assets/d4799231-80c1-40cb-b6ed-fb4ef7550193" />

<img width="1131" height="797" alt="image" src="https://github.com/user-attachments/assets/3b3b0ec8-85ca-4fa8-8576-938d90e3d94e" />


Sync menu

<img width="429" height="434" alt="image" src="https://github.com/user-attachments/assets/fc510983-6d6c-4197-b5c0-b9dd5418ae21" />


Sync buttons in game stores

<img width="1498" height="384" alt="image" src="https://github.com/user-attachments/assets/65807572-56fa-4d4f-912c-7931bd46a6dd" />

<img width="561" height="480" alt="image" src="https://github.com/user-attachments/assets/fc092229-5960-4132-8363-a82cb945e8f8" />

<img width="1014" height="508" alt="image" src="https://github.com/user-attachments/assets/c8bc43fc-34f5-4090-80f5-5c960c9ee080" />

In gg.deals

<img width="1377" height="443" alt="image" src="https://github.com/user-attachments/assets/aa3417fb-d942-4c7e-949f-193723bc200e" />




