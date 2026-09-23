# Runtime calculator — test deployment

Separate Cloudflare Python Worker for `test.yellow-battery.com/runtime`.
The root `wrangler.jsonc` and production placeholder are unchanged.

Uses the original Python calculation core, with synthetic fixtures only.
HR-M/HR-WM manufacturing data and Mathcad validation are pending.

## Cloudflare Workers Builds

- Repository: `SirotkinAA/yellow-battery-website`
- Branch: `codex/runtime-calculator`
- Root directory: `runtime-worker`
- Build command: `uv sync --locked`
- Deploy command: `uv run pywrangler deploy`
- Worker name: `yellow-battery-runtime-test`
- Custom domain: `test.yellow-battery.com` (in wrangler configuration)

Local validation: `python3 -m unittest discover -s tests/calculator -v`.
Local Worker: `uv run pywrangler dev`.
Only the `public/` directory is exposed as static files. Requests cannot supply
a replacement dataset. Public responses explicitly identify synthetic results.
