# Columbus Ball Hockey League website

The league site: schedule, standings, stats and the official rule book.

## Files

| File | What it is |
|---|---|
| `index.html` | The page |
| `app.js`, `app.css` | How the page works and looks. You don't need to touch these. |
| `data.json` | **All league data**: teams, schedule, scores and player stats. This is the only file that changes during the season. |
| `cbhl-logo.png` | League logo |
| `CBHL_Official_Rulebook.pdf` | Rule book linked from the site |

## Put the site online (one time)

1. Sign in at github.com and click **New repository**. Name it (for example `cbhl`), set it to **Public**, and click **Create repository**.
2. On the new repository page, click **uploading an existing file**. Drag in all the files from this folder, then click **Commit changes**.
3. Go to **Settings → Pages**. Under **Build and deployment**, set **Source** to *Deploy from a branch*, pick the **main** branch and the **/ (root)** folder, and click **Save**.
4. After a minute or two the site is live at `https://YOUR-USERNAME.github.io/cbhl/`. The Pages settings screen shows the exact address.

## Update scores and stats

1. Open the site with `#admin` on the end of the address, for example `https://YOUR-USERNAME.github.io/cbhl/#admin`. An **Edit** button appears in the top bar. Players never see it unless they add `#admin` themselves, and even then nothing they change reaches the site.
2. Click **Edit**, then post scores, update stats or change the schedule. Entering both scores for a game marks it Final and updates the standings.
3. Click **Download data.json**.
4. In your GitHub repository, click **Add file → Upload files**, drag in the new `data.json`, and click **Commit changes**. It replaces the old one.
5. The site updates within a minute or two. If you don't see the change, refresh the page.

Your edits are kept in the browser tab until you download them. If the tab reloads first, use **Restore edits**.

## Change the rule book

Upload a new PDF with the same name, `CBHL_Official_Rulebook.pdf`, the same way you upload `data.json`.
