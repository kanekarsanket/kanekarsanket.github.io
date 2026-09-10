# Putting this site online with GitHub Pages

GitHub Pages hosts static websites for free. You upload the files, flip one
switch, and GitHub gives you a public web address. There is no server to
manage and nothing to pay for.

Two routes are described below. **Route A uses only your web browser** and
needs nothing installed — start there. Route B is the command line, which is
worth learning later because it makes updates a two-second job.

---

## Route A — browser only, about ten minutes

### 1. Create a GitHub account

Go to <https://github.com> and sign up if you do not already have an account.
Pick a username you are happy appearing in the site's web address, because it
will: your site ends up at `https://YOURNAME.github.io/REPOSITORY/`.

### 2. Create the repository

1. Click the **+** in the top-right corner, then **New repository**.
2. **Repository name:** `money-banking` (or whatever you prefer — it becomes
   part of the URL).
3. **Description:** optional.
4. Choose **Public**. GitHub Pages needs public repositories on free accounts.
5. Leave "Add a README file" **unticked** — this project already has one.
6. Click **Create repository**.

### 3. Upload the files

On the empty repository page, click **uploading an existing file** in the
"Quick setup" box. Then:

1. Unzip the project folder on your computer if it is still zipped.
2. Open the unzipped folder, select **everything inside it** — the seven
   `.html` files, the `assets` folder, `README.md`, `SETUP-GITHUB.md` and
   `.nojekyll` — and drag them all into the browser window.
   - Drag the **contents** of the folder, not the folder itself. If GitHub
     ends up showing a single folder rather than a list of files, delete the
     upload and try again.
   - The `.nojekyll` file starts with a dot, so it may be hidden. On macOS
     press **Cmd + Shift + .** in Finder to show hidden files; on Windows,
     tick **Hidden items** on the View tab in File Explorer.
3. Wait until every file finishes uploading and `assets` appears in the list.
4. In the "Commit changes" box at the bottom, type a short message such as
   `Initial site`, then click **Commit changes**.

### 4. Turn on GitHub Pages

1. Click **Settings** in the repository's top menu.
2. In the left sidebar, click **Pages**.
3. Under **Source**, choose **Deploy from a branch**.
4. Under **Branch**, choose **main** and folder **/ (root)**, then **Save**.

### 5. Wait, then visit the site

The first build takes one to three minutes. Reload the Settings → Pages screen
and a green box appears with your address:

```
https://YOURNAME.github.io/money-banking/
```

Open it. The charts will show "Loading live data…" for a second or two while
they fetch the current figures, then draw.

### 6. Making changes later

To edit a page, open the file in the repository, click the pencil icon, make
your change, and click **Commit changes**. The live site updates in about a
minute. To replace a file entirely, use **Add file → Upload files** and upload
the new version under the same name.

---

## Route B — the command line

Worth setting up once, because after that every update is three short
commands.

### Install Git

- **macOS.** Open Terminal and type `git --version`. If Git is missing, macOS
  offers to install the developer tools; accept. Or install
  [Homebrew](https://brew.sh) and run `brew install git`.
- **Windows.** Download from <https://git-scm.com/download/win> and run the
  installer, accepting the defaults. Use the **Git Bash** program it installs
  for the commands below.
- **Linux.** `sudo apt install git` on Debian or Ubuntu, `sudo dnf install
  git` on Fedora.

### Tell Git who you are

Once per computer:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

### Push the site

Create the empty repository on GitHub as in Route A steps 1–2, then, in a
terminal:

```bash
cd path/to/money-banking-site      # the folder containing index.html
git init
git add .
git commit -m "Initial site"
git branch -M main
git remote add origin https://github.com/YOURNAME/money-banking.git
git push -u origin main
```

GitHub will ask you to sign in. Modern Git opens a browser window for this; if
yours asks for a password in the terminal instead, it wants a **personal
access token**, not your account password. Create one at
**Settings → Developer settings → Personal access tokens → Tokens (classic)**,
give it the `repo` scope, and paste it where the password is requested.

Then enable Pages exactly as in Route A step 4.

### Updating after that

```bash
git add .
git commit -m "Describe what changed"
git push
```

---

## If something goes wrong

**The page loads but has no styling.** The `assets` folder did not upload, or
uploaded with a different name. Check that the repository contains
`assets/css/style.css` at exactly that path.

**The charts say "Could not reach the data service."** Open the page, press
**F12** to open the browser console, and reload. If the errors mention
`api.db.nomics.world`, the mirror is temporarily down; the page recovers by
itself when it returns. If they mention `Mixed Content`, you have opened the
site over `http://` rather than `https://` — use the https address.

**Nothing appears at the .github.io address.** Give it five minutes. Then
check Settings → Pages again: if the branch reset itself to "None", set it
back to `main` / `/ (root)` and save.

**A file called `.nojekyll` seems to be missing.** It is an empty file that
stops GitHub from trying to process the site as a blog. Nothing here depends
on it, but if the site behaves strangely, create it: **Add file → Create new
file**, type `.nojekyll` as the name, leave the body empty, and commit.

---

## Optional: your own domain

If you own a domain name, Settings → Pages has a **Custom domain** box. Enter
the domain, then at your domain registrar add a CNAME record pointing your
chosen subdomain (`money.yourdomain.com`, say) to `YOURNAME.github.io`.
GitHub issues an HTTPS certificate automatically once the DNS resolves, which
usually takes under an hour.
