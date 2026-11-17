# Saving edits straight to the site

The edit screens (`#admin` on the homepage and on `winners.html`) can save directly to this GitHub repository. You don't have to download `data.json` or `winners.json` and upload them by hand. Changes go live for everyone in about a minute or two.

You set this up **once on each device** you edit from: your computer, your phone, and so on.

---

## Step 1: Create an access token on GitHub (once)

An access token is like a password that only lets the edit screen change **this one repository**. GitHub's menu names change from time to time, so look for the closest match if a label is slightly different.

1. Sign in at **github.com**.
2. Click your profile picture (top right) → **Settings**.
3. Scroll to the bottom of the left menu → **Developer settings**.
4. **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
5. Fill in:
   - **Token name:** `CBHL site editing`
   - **Expiration:** pick a date, for example 1 year. You'll make a new token when it expires.
   - **Repository access:** **Only select repositories**, then choose this repository (for example `cbhl`).
   - **Permissions → Repository permissions → Contents:** set to **Read and write**. Leave everything else as it is.
6. Click **Generate token**.
7. **Copy the token right away.** It starts with `github_pat_`. GitHub only shows it once. If you lose it, just make a new one.

> ⚠️ Treat the token like a password. Don't email it, post it, or put it in any file in this repository. Anyone with it can change the site.

---

## Step 2: Connect the edit screen (once per device)

1. Open the site with `#admin` at the end, for example `https://www.thecbhl.com/#admin`, and click **Edit**.
2. Open the **GitHub connection** box under the yellow "Editing league data" box.
3. Fill in:
   - **GitHub username or organization:** the owner of this repository.
   - **Repository name:** this repository's name, for example `cbhl`.
   - **Branch:** `main` (leave as is unless you changed it).
   - **Access token:** paste the token from Step 1.
4. Click **Connect**. The dot turns green and says **Saving straight to owner/repo**.

The connection is remembered in that browser. The Past Winners edit screen uses the same connection automatically.

---

## Using it

**Scores, stats and schedule (homepage `#admin`):**
1. Click **Edit** and make your changes.
2. Click **Save to site** in the bar at the bottom.
3. When it says **Saved**, you're done. Everyone sees the changes in a minute or two.

**Past winners (`winners.html#admin`):**
1. Click **Edit**. Type names, pick photos, add seasons.
2. Click **Save to site**. Photos are shrunk to a web-friendly size, uploaded into the `photos` folder, and named automatically, so there are no file names to match.

**Download instead** is still available if you ever want a copy of the file or aren't connected.

---

## Troubleshooting

| Message | What to do |
|---|---|
| "GitHub didn't accept the access token" | The token is mistyped or has expired. Make a new one (Step 1) and paste it under **GitHub connection**. |
| "The access token can't write to this repository" | Edit the token on GitHub and set **Contents** to **Read and write**. |
| "GitHub couldn't find that repository" | Check the owner and repository spelling, and that the token's **Repository access** includes this repository. |
| "The file on GitHub changed since you opened this page" | Someone else saved, or you saved from another device. Reload the page, then make your edits again. This keeps one person from overwriting another's changes. |
| Saved, but the public page still shows the old data | Wait a minute or two for GitHub to rebuild, then hard refresh (Ctrl+Shift+R or Cmd+Shift+R). Check the repository's **Actions** tab for a green check. |

**Lost or shared your token by mistake?** On GitHub go to **Settings → Developer settings → Personal access tokens → Fine-grained tokens**, delete it, and create a new one. On a device you no longer use, open **GitHub connection** and click **Forget token on this device**.
