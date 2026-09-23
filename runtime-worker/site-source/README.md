# YELLOW public test website

Build with `python3 build_worker.py` from runtime-worker. Pages live on test.yellow-battery.com only. Search indexing is disabled.

`data/products.json` contains public specifications extracted from the final approved English YELLOW datasheets, with SHA-256 provenance. PDFs and drawings are committed in public/downloads and public/assets/products. No legacy discharge audit is imported. The originating workspace importer is tools/build_website_catalog.py; rerun it against the approved output/yellow-public delivery, then review and copy refreshed metadata/assets here.

Website specifications are static, version-controlled content. Calculator discharge curves remain in its separately validated dataset/D1 workflow; editing that dataset does not edit public product-page specifications. Prices are not published.

RU/EN navigation shares yellow-site-language with the calculator. Product cards link to /runtime/?model= with a validated model identifier. Existing portal approval and API permission flows remain unchanged.
