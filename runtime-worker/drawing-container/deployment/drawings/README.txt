YELLOW drawings — Cloudflare container preparation

Private Worker: yellow-drawings-test (no workers.dev or preview URL).
Call it from the test site's Worker using a service binding named DRAWINGS_SERVICE.
No public routes, D1 binding, supplier prices or user credentials are copied.
One named container is used; basic instance, 60-second inactivity timeout.
Container has no Internet access. HTTP accepts only PDF/DWG/DXF JSON up to 32 KiB.
At most two rendering requests run in parallel; each native CAD process has a timeout.
DWG is checked by round-trip on every export; files are temporary and not retained.

Build (from repository root):
  docker build --platform linux/amd64 -f deployment/drawings/Dockerfile -t yellow-drawings-test .
The build includes smoke.py: generates PDF, editable DXF and round-trip-verified DWG
with Cyrillic letters. It must pass before deployment.

The image uses a Linux build of LibreDWG 0.13.4, verified source SHA256 and our
CP1251 patch. PDF uses Liberation Sans (not a copied macOS proprietary font).
GNU source and patch provenance: tools/cad/dependencies.json.

Deployment requires an active Workers Paid plan, Docker/Workers Builds or CI,
and restored Cloudflare authorization. Do not change a subscription automatically.
The Docker build and Cloudflare deployment must be verified separately; preparing
this source is not evidence that an image has been built or deployed.
