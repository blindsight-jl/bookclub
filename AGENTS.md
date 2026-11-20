# TollerBuchClub V2 — Agent Guide

## Project overview

TollerBuchClub V2 is a private book-club website built with Eleventy (11ty) and Supabase. It combines a statically generated site shell with browser-side JavaScript for authentication and data access. There is no application server, API layer, database migration directory, or server-side rendering runtime in this repository.

The main features are:

- Email/password sign-in, password recovery, invite/password-setup handling, and logout.
- A home page featuring the latest read and up to four previous books.
- A read-book archive grouped by month.
- Book creation, editing, and deletion.
- Five-star ratings and comments for each read book.
- A general discussion on the home page.
- An unread-book list grouped by genre, with add, edit, and remove operations.
- Per-user display-name settings.
- A small Markdown blog with tags, a sitemap, and a custom 404 page.

The site metadata in `_data/metadata.js` identifies the production site as `https://tollerbuchclub.com/` and the title as `TollerBuchClub V2`. The package name and much of `README.md` still come from the upstream `eleventy-base-blog` starter; use the source files and this guide to understand the custom application.

## Technology stack and runtime architecture

- **Static generation:** Eleventy 3, Nunjucks, Markdown, JavaScript data files, and JavaScript front matter.
- **Build-time language:** JavaScript ES modules (`package.json` has `"type": "module"`). There is no TypeScript.
- **Browser code:** Plain JavaScript ES modules and DOM APIs; no frontend framework and no browser bundler or transpiler.
- **Backend services:** Supabase Auth and Postgres, accessed directly from the browser with the Supabase JavaScript client.
- **Browser dependency loading:** `public/js/supabase-client.js` imports `https://esm.sh/@supabase/supabase-js@2`. The npm `@supabase/supabase-js` dependency is also present, but the browser modules do not import the npm copy.
- **Styling:** Handwritten CSS with custom properties, a light/dark color scheme, responsive layouts, Google-hosted Lora and Vollkorn fonts, and system UI/monospace font stacks.
- **Node:** `.nvmrc` selects Node 20. `package.json` declares Node 18 or newer; prefer Node 20 for consistency with the repository.

At build time, Eleventy reads `SUPABASE_URL` and `SUPABASE_ANON_KEY` through `_data/supabase.js`. `eleventy.config.js` imports `dotenv/config`, so a local `.env` can supply them. `_includes/layouts/base.njk` writes both values to `window.SUPABASE_URL` and `window.SUPABASE_ANON_KEY` in generated HTML.

When `supabase.url` is nonempty, the base layout also loads the global authentication guard and navigation authentication script. Most page-specific dynamic modules are included conditionally as well. Without Supabase configuration, Eleventy can still generate static files, but the dynamic application is unavailable or inert and the login module cannot initialize. Changing either environment variable requires a new build and deploy.

At runtime in the configured site:

1. `public/js/auth-guard.js` initially leaves the document hidden, allows `/login/`, and redirects every other route without a Supabase session to `/login/`.
2. `public/js/auth.js` adds the settings/display-name link and logout control for a signed-in user, or a login link otherwise.
3. Page modules query or mutate Supabase tables directly and render the results into static container elements.
4. Book detail pages use a single static route, `/book/?slug=<slug>`, rather than generating one page per database record.

The browser also depends on the Supabase CDN, Google Fonts, and any externally hosted book-cover URLs. Database content is not fetched during the Eleventy build.

## Install, build, and run

Use the lockfile for reproducible installation:

```sh
npm ci
npm run build
npm start
```

- `npm run build` runs `npx @11ty/eleventy` and writes the deployable static site to `_site/`.
- `npm start` runs Eleventy's development server with `--serve --quiet` and live reload.
- `npm run build-nocolor` disables colors for build logs.
- `npm run debug` and `npm run debugstart` enable `DEBUG=Eleventy*` for a build or development server.
- `npm run benchmark` enables Eleventy benchmark diagnostics.

For full local application behavior, create a local `.env` containing:

```sh
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

Do not print or commit the contents of the real `.env`. Use a development Supabase project or safe test data for manual mutation tests.

Do not edit `_site/`; it is generated output and is gitignored. `node_modules/`, `.cache`, `.env`, and `.env.local` are also ignored.

## Source layout and responsibilities

- `eleventy.config.js` — Eleventy configuration, draft handling, passthrough copies, watch targets, CSS/JS bundles, Markdown customization, plugins, image optimization, filters, and input/output directories.
- `_config/filters.js` — Date formatting, collection slicing, tag filtering/sorting, and other Nunjucks filters.
- `_data/metadata.js` — Site title, canonical base URL, language, description, and author.
- `_data/supabase.js` — Build-time mapping of the two Supabase environment variables.
- `_data/eleventyDataSchema.js` — Zod validation that `draft` is boolean when present.
- `_includes/layouts/base.njk` — Global HTML shell, metadata, fonts, CSS/JS bundles, Supabase bootstrap values, authentication scripts, navigation, and footer.
- `_includes/layouts/home.njk` — Default thin wrapper around `base.njk`.
- `_includes/layouts/post.njk` — Markdown post layout, syntax highlighting, post navigation, and optional rating/comment widgets for posts tagged `book`.
- `_includes/postslist.njk` — Reusable list for Markdown posts.
- `content/` — Eleventy input directory. Page routes come from these files.
- `content/content.11tydata.js` — Makes `layouts/home.njk` the default layout.
- `content/blog/blog.11tydata.js` — Adds every Markdown blog item to the `posts` collection and applies the post layout.
- `public/` — Copied unchanged to the root of `_site/`; browser modules live in `public/js/`, and static covers live in `public/images/covers/`.
- `css/index.css` — Main global and feature stylesheet, included in the inline Eleventy CSS bundle by `base.njk`.
- `css/prism-diff.css` — Diff syntax styles loaded by the post layout.
- `css/message-box.css` — Standalone message-box styles retained from the starter; it is not loaded by the base layout.
- `scripts/` — Currently empty.
- `_site/` — Generated output; never a source of truth.

### Routes and browser modules

| Route | Source and module | Behavior |
| --- | --- | --- |
| `/` | `content/index.njk`, `books-home.js`, `comments.js` | Loads five most recent read books, displays the latest plus four previous books with average ratings, and provides general discussion using slug `general`. |
| `/blog/` | `content/blog.njk`, `books-archive.js` | Displays all database books grouped by `month_read`. Despite the route name, this is the read-book archive, not the Markdown post list. |
| `/book/?slug=...` | `content/book.njk`, `book-page.js`, `rating-widget.js`, `comments.js` | Loads one book by slug and provides ratings/comments; signed-in users see edit and delete controls. |
| `/books-new/` | `content/books-new.njk`, `book-form.js` | Creates a book with a slug derived from its title. |
| `/unread/` | `content/unread.njk`, `unread-books.js` | Lists unread books by genre and supports add, inline edit, and removal. |
| `/login/` | `content/login.njk` | Contains its own inline ES module for sign-in, recovery, invite/password setup, and logout. |
| `/settings/` | `content/settings.njk`, `settings.js` | Reads and saves the current user's profile username. |
| `/blog/welcome/` | `content/blog/welcome.md` | Static Markdown post using the common post layout. |
| `/tags/`, `/tags/<tag>/` | `content/tags.njk`, `content/tag-pages.njk` | Tag index and paginated tag pages for Eleventy collections/Markdown content, not database books. |
| `/sitemap.xml` | `content/sitemap.xml.njk` | Lists statically generated collection pages; it does not enumerate database book slugs. |
| `/404.html` | `content/404.md` | Static not-found page. |

`books-home.js`, `books-archive.js`, `book-page.js`, `book-form.js`, and `unread-books.js` own book-list and book-management behavior. `rating-widget.js` and `comments.js` are shared widgets initialized from `window.BOOK_SLUG`. `settings.js` owns profile persistence. Keep page-specific initialization in the relevant module rather than adding it to the global authentication scripts.

Deleting a read book currently deletes only its `books` row. The confirmation text explicitly notes that its ratings and comments remain in the database; preserve or deliberately change that behavior when working on deletion.

## Eleventy and content conventions

- Input is `content`, includes are `_includes`, global data is `_data`, and output is `_site`.
- Supported template formats are Markdown, Nunjucks, HTML, Liquid, and `11ty.js`. Markdown and HTML are preprocessed with Nunjucks.
- Use YAML front matter or JavaScript front matter (`---js`) matching the neighboring page. JavaScript front matter is used for navigation and pagination configuration.
- Add a page to the top navigation with an `eleventyNavigation` object containing `key` and `order`. The current ordered dynamic pages are Archive (2), Unread (3), and Add Book (4). Authentication links are injected separately by `auth.js`.
- The default layout comes from the data cascade. Override it in page front matter only when needed, as `book.njk`, `login.njk`, and `settings.njk` do.
- A `draft: true` value adds `(draft)` to the title and excludes the page from full production builds. Drafts remain available in serve/watch mode. Non-boolean draft values fail schema validation.
- Database books are application records, not Markdown posts. Adding a Markdown file does not add a book to the home page or `/blog/` archive.
- Markdown posts under `content/blog/` inherit the `posts` tag and post layout. A post additionally tagged `book` receives rating/comment widgets keyed by its Eleventy `page.fileSlug`.
- Markdown allows raw HTML, line breaks, and automatic link detection. Absolute HTTP(S) links are rewritten to open in a new tab with `rel="noopener noreferrer"`.
- Image transformation generates AVIF, WebP, and an automatic fallback format, with lazy loading and asynchronous decoding. Files under `public/` are only copied; they do not pass through that transform.
- CSS is collected into per-page bundles and inlined in `base.njk`. The bundled JavaScript file is emitted under `dist`; standalone modules under `public/js/` are copied and loaded directly. Inline scripts marked `eleventy:ignore` must remain outside the bundle where their timing or page-specific values matter.

## Supabase data contracts

No SQL schema, policies, or migrations are stored here. The following fields are the contracts used by the current browser code; confirm constraints, defaults, and Row Level Security in the Supabase project before changing them.

- **`books`**: `id`, `slug`, `title`, `author`, `cover_url`, `genre`, `month_read`, `description`, `added_by`, and `created_at` are read or written. New slugs are lowercase, ASCII-normalized, hyphenated titles. The form maps database error `23505` to a duplicate-title message, so the implementation expects slug uniqueness. Month inputs are stored as the first day of the month (`YYYY-MM-01`). Optional text, URL, description, and month values are stored as `null` when empty.
- **`unread_books`**: `id`, `title`, `author`, `genre`, `page_count`, `release_year`, `link`, and `added_by`. Rows are ordered by genre and title. Page count and release year are optional integers; the forms constrain them to 1–9999 and 1900–2099 respectively.
- **`ratings`**: `book_slug`, `user_id`, and integer `rating` from 1 to 5. Ratings are keyed logically by book and user. Updating a rating currently deletes the user's existing row and inserts a replacement, with client-side rollback on failure.
- **`comments`**: `id`, `book_slug`, `user_id`, `display_name`, `body`, and `created_at`. Comments are ordered oldest first. The general discussion uses `book_slug = 'general'`; dynamic book pages use the URL slug; tagged Markdown book posts use their file slug. The UI only exposes deletion on the current user's own comments.
- **`profiles`**: `id` and `username`, where `id` is the Supabase Auth user ID. Settings updates an existing profile or inserts one if absent. Comments prefer the profile username and fall back to the email local part.

The UI generally exposes book and unread-book mutations to any signed-in user, ratings to signed-in users, and comment deletion only to the comment author. These interface checks are not authorization boundaries; database policies must enforce the actual rules.

## Code style guidelines

- Follow `.editorconfig`: UTF-8, LF line endings, tabs for indentation (display width 2), a final newline, and no trailing whitespace.
- Match the surrounding file's quote and formatting style. Browser modules generally use single quotes and semicolons; Eleventy configuration commonly uses double quotes.
- Keep browser modules framework-free and page-scoped. The established pattern is a small state object, an `init()` function, and DOM-building/render functions.
- Use `document.createElement`, `textContent`, and explicit attributes for database/user content. Existing fixed `innerHTML` strings contain only trusted literals; do not introduce untrusted data into `innerHTML` or unsafe Nunjucks interpolation.
- Reuse the central CSS custom properties and classes in `css/index.css`. The existing visual language uses warm book-inspired colors, serif body/display type, chapter-style ruled headings, and compact system-font UI labels.
- Preserve accessibility behavior already present: semantic controls, labels, skip navigation, keyboard focus styles, alt text where appropriate, and reduced-motion handling.
- The site uses root-absolute browser URLs such as `/js/...`, `/login/`, and `/book/?slug=...`, and static page URLs conventionally end in `/`. Audit all of these if changing hosting paths or URL behavior.
- No formatter, linter, or type checker is configured. Do not claim checks that do not exist.
- `.claude/skills/frontend-design/SKILL.md` contains additional local guidance for substantial visual design work; use it when that environment invokes the skill, while preserving the established product direction.

## Testing and verification

There are currently no automated unit, integration, end-to-end, lint, or type-check tests in the repository, and `package.json` has no `test` script. Verification is build-based plus manual browser testing.

At minimum after a change:

1. Run `npm run build` and resolve Eleventy/schema errors.
2. Run `npm start` with development Supabase configuration.
3. Exercise every changed flow in a real browser, including its failure/empty states where practical.

Relevant manual coverage includes:

- Unauthenticated redirect to `/login/`, successful sign-in/logout, and password recovery.
- Home and archive rendering, cover handling, month grouping, and average ratings.
- Add, edit, open, and delete read-book flows using `/book/?slug=...`.
- Unread-book add, inline edit, grouping, and removal.
- Rating creation and replacement, comment creation, own-comment deletion, and the home page's `general` discussion.
- Profile username creation/update and its use in comments.
- Static Markdown/tag pages when layouts, collections, navigation, or Eleventy configuration change.

Avoid destructive verification against production data. Build success alone does not verify Supabase queries, browser authentication, CDN availability, or Row Level Security.

## Security considerations

- `.env` and `.env.local` are gitignored. Never commit them or expose their contents in logs, patches, or summaries.
- The generated site intentionally contains the Supabase project URL and **anon** key. Never substitute a service-role key or any privileged secret; anything written into Eleventy output is public.
- Because browsers query and mutate Postgres directly, Supabase Row Level Security is essential for every table and operation. The auth guard, hidden controls, and session checks are user experience measures, not security enforcement.
- Keep user and database content on safe DOM paths such as `textContent`. Review URL fields and externally hosted images as untrusted input.
- Authentication sessions are managed by Supabase's browser client. Do not add custom token storage or logging.
- `resetPasswordForEmail` redirects to `<current origin>/login/`. Configure Supabase Auth site/redirect URLs for each deployed origin and use HTTPS in production.
- The site currently uses inline styles/scripts, root-loaded module scripts, `esm.sh`, and Google Fonts. A Content Security Policy must account for all of them; there is no CSP or hosting header configuration in the repository.

## Deployment and inherited starter artifacts

### Netlify

`netlify.toml` is the explicit deployment configuration:

```toml
[build]
  publish = "_site"
  command = "npm run build"
```

Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the Netlify build environment. Deploy the generated `_site` directory only after a successful build.

### Vercel

`vercel.json` only sets `{ "trailingSlash": true }`. Configure the Eleventy build/output and Supabase environment variables in Vercel; there is no custom build command in that file.

### GitHub Pages and CI

There is no active CI workflow. `.github/workflows/gh-pages.yml.sample` is an inactive upstream sample and would need to be renamed and reviewed before use. In particular:

- It uses Node 18 while `.nvmrc` selects Node 20.
- `build-ghpages` and `start-ghpages` still hardcode `/eleventy-base-blog/`.
- Browser modules contain root-absolute routes, so changing Eleventy's path prefix alone does not make the complete application subpath-safe.

Do not describe GitHub Pages deployment as currently configured.

### Other stale upstream material

- `README.md` primarily documents `eleventy-base-blog`, not the custom Supabase application.
- `package.json` retains the starter's package name, repository, author, homepage, and issue URLs.
- The welcome post says comments require GitHub, but the implemented comments use Supabase Auth.
- `base.njk` links to `/feed/feed.xml`, but there is currently no feed source template and the RSS plugin is not registered in `eleventy.config.js`; the verified build does not generate that feed.
