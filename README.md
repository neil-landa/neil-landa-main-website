# neil-landa-main-website

Source for neillanda.com: a static HTML/CSS/JS site on Azure Static Web Apps, with a small Functions API and an admin panel for editing the content.

## Editing the site (admin panel)

Go to `/admin/` and sign in with GitHub. Only the GitHub usernames listed in the `ADMIN_USERS` app setting can edit.

| Section | What you can change |
|---|---|
| Brand & logo | Logo (SVG or PNG), name, button labels, client portal link, page title and description, footer |
| Hero | Headline lines, intro paragraph, buttons, portrait photo, name plate, floating labels |
| Stats & banner | The four stats, the scrolling banner words, the large statement |
| Services | The 01 / 02 / 03 cards: number, title, text, bullet points, badge |
| Websites | Add, remove, and reorder portfolio sites; upload a screenshot (cropped and resized for you) |
| About | Paragraphs, buttons, certifications |
| How it works | The numbered steps |
| FAQ | Questions and answers |
| Contact | Heading, text, bullet points |
| Messages | Read-only list of contact form submissions |

Changes go live when you press **Save changes**. Wrap text in `**two asterisks**` to make it bold.

Every save also keeps a dated backup copy (the newest 40) in the `sitedata` container under `backups/`.

## App settings (Static Web App → Environment variables)

| Setting | Used for |
|---|---|
| `AZURE_STORAGE_CONNECTION_STRING` | Content, images, and contact messages in the storage account |
| `BLOB_BASE_URL` | Tells the API which container holds images (`.../mainimgs`) |
| `SHOW_PORTRAIT` | `true` shows the photo spot in the hero; `false` hides it and shows the large lion instead |
| `ADMIN_USERS` | Comma-separated GitHub usernames allowed into `/admin/` |
| `CONTACT_TABLE_NAME` | Optional. Overrides the contact table name (local testing uses `ContactMessagesTest`) |
| `CONTENT_CONTAINER` | Optional. Overrides the content container name (local testing uses `sitedata-test`) |

## Layout

| Path | What it is |
|---|---|
| `index.html`, `404.html` | The public pages. `index.html` holds the built-in default text, which saved content replaces on load |
| `assets/` | `site.css`, `site.js`, `boot.js`, the lion logo (`lion.svg`, `favicon.svg`), and `vendor/lenis.min.js` (smooth scrolling, MIT) |
| `admin/` | The admin panel (`index.html`, `admin.css`, `admin.js`) |
| `api/` | Azure Functions (Node 20) |
| `api/src/lib/default-content.json` | The default content, used until something is saved in the admin panel |
| `staticwebapp.config.json` | Routes, login rules, security headers, 404 handling |

After editing `site.css`, `site.js`, or `boot.js`, bump the `?v=N` on their links in `index.html` and `404.html`. If you change the default text, change it in both `index.html` and `default-content.json`.

## API

| Route | Access | What it does |
|---|---|---|
| `GET /api/content` | Public | The saved content plus the `SHOW_PORTRAIT` setting |
| `GET /api/img/{path}` | Public | Serves images from the private `mainimgs` container |
| `POST /api/contact` | Public | Saves a contact form message to the `ContactMessages` table. No email is sent |
| `GET` / `PUT /api/manage/content` | Admin | Load and save the content (`sitedata/content.json`) |
| `POST /api/manage/upload` | Admin | Upload a logo, portrait, or website screenshot |
| `GET /api/manage/messages` | Admin | List contact form messages |

## Running locally

Copy `api/local.settings.sample.json` to `api/local.settings.json`, add the connection string, run `npm install` in `api/`, then:

```bash
swa start . --api-location api
```

The emulator shows a mock sign-in page at `/admin/`; use the provider `github` and a username from `ADMIN_USERS`.
