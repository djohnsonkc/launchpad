# Production Deployment

Where the live Launchpad instance runs and how its pieces are wired together. Update this page whenever hosting, DNS, or configuration changes.

## At a glance

| | |
|---|---|
| **URL** | https://launchpad.inspiredeffect.com |
| **Host** | Heroku, single web dyno (Node.js buildpack, `Procfile`: `web: npm start`). Heroku app name: _add here_ |
| **Deploys** | `git push heroku main` — Heroku runs `npm run build` and restarts the dyno |
| **DNS** | Managed by Winhost (cp.winhost.com), which hosts the `inspiredeffect.com` zone |
| **TLS** | Heroku Automated Certificate Management (Let's Encrypt), renews automatically |

Run a single dyno only: dynos don't share a filesystem, and the bundle archive restore assumes one instance (see [persistence.md](./persistence.md)).

### Two hosts, two roles

| Host | What it is | Runs on |
|---|---|---|
| `launchpad.inspiredeffect.com` | Launchpad itself: dashboard, deployed apps, `/api/deploy` | Heroku |
| `inspiredeffect.com` | The bundle archive API, `launchpad.ashx` (`ARCHIVE_URL`) | Winhost (IIS) |

The archive API stays at `inspiredeffect.com/launchpad.ashx`. Don't point `ARCHIVE_URL` at the `launchpad.` subdomain: that name resolves to Heroku, so Launchpad would be calling itself.

### inspiredeffect.com as the hub

`inspiredeffect.com` is the core backend site; `launchpad.` is the first of what will likely be several subdomains fronting it. Each new subdomain is a CNAME (or A record) in the Winhost DNS panel, like the one below.

Launchpad serves **uploaded, unreviewed JavaScript** on its subdomain, which shapes how the other `inspiredeffect.com` hosts handle cookies:

- **Keep core-site cookies host-only.** Never set `Domain=.inspiredeffect.com` on sensitive cookies; script on any subdomain could read them. Today `UserCookies.Set` sets no domain, so they stay on `inspiredeffect.com` only.
- **Never trust a cookie's value as proof of identity.** A subdomain can *plant* a cookie for `.inspiredeffect.com` that the core site will receive. Authorization must come from server-side state (session or a signed token), not a value like `loggedIn=1`.
- **Think before putting other trusted apps on subdomains** alongside Launchpad. If a future subdomain needs shared sign-in with the core site, use a signed token rather than a domain-wide cookie.

## DNS

The custom domain is a CNAME in the Winhost control panel pointing at the DNS target Heroku assigned to the app:

| Type | Host | Points to |
|---|---|---|
| CNAME | `launchpad` | `comparative-camarasaurus-7t423g0ppo57llm9921r1ydb.herokudns.com` |

The target comes from `heroku domains`. If the domain is ever removed and re-added in Heroku, or the app is recreated, Heroku issues a **new** target: update the CNAME in Winhost to match, or the site goes down.

The rest of `inspiredeffect.com` (the ASP.NET site on Winhost) is unaffected by this record.

## TLS

Heroku ACM issues and renews the Let's Encrypt certificate for `launchpad.inspiredeffect.com` automatically. It requires the CNAME above to resolve to Heroku; if renewal fails, `heroku certs:auto` shows why. (Certificate checked 2026-10-28: valid until 2027-01-26.)

Note that `inspiredeffect.com` itself does **not** currently serve HTTPS, which matters for the bundle archive below.

## Configuration (Heroku config vars)

| Variable | Purpose | Status (2026-10-28) |
|---|---|---|
| `DEPLOY_TOKEN` | Required bearer token for `POST /api/deploy` and `DELETE /api/deploy/:folder` | **Not set** — deploy and delete are open to anyone. Set it from `.env` (see [below](#deploying-apps-to-production)) |
| `ARCHIVE_URL` | Bundle archive page that makes deploys survive dyno restarts | Not set — archive page not yet deployed to inspiredeffect.com |
| `ARCHIVE_TOKEN` | Token for the archive page (same value as its `App_Data/launchpad/token.txt`) | Not set |
| `MAX_UPLOAD_MB` | Upload cap | Default (100 MB) |
| `PORT` | Set by Heroku | — |

Until `ARCHIVE_URL` is set, **every deployed app is lost when the dyno restarts** (at least daily, and on every `git push heroku main`). Setup steps: [persistence.md runbook](./persistence.md#runbook-heroku-bundle-archive). Because `inspiredeffect.com` has no HTTPS yet, the archive URL would have to be `http://`, sending the archive token and every zip unencrypted. Enable a certificate for `inspiredeffect.com` in Winhost first, then use `ARCHIVE_URL=https://inspiredeffect.com/launchpad.ashx`.

## Deploying apps to production

The `/launch` skill targets this instance by default (`LAUNCHPAD_SERVER_URL` overrides it). Run it from this repo against any site — `/launch ../marketsignal/client` — so there's one copy of the skill and nothing to add to the other repos. See [skills.md](./skills.md).

**The deploy token lives in this repo's `.env`** (gitignored) as `LAUNCHPAD_DEPLOY_TOKEN`, and the skill reads it from there. Heroku's `DEPLOY_TOKEN` must hold the same value. Set it from `.env` without displaying it:

```bash
heroku config:set DEPLOY_TOKEN="$(grep '^LAUNCHPAD_DEPLOY_TOKEN=' .env | cut -d= -f2-)"
```

To rotate: replace the value in `.env`, then re-run that command.
