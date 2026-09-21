# Yellow Battery

Стартовая страница yellow-battery.com для Cloudflare Workers Static Assets.

## Публикация из GitHub

- Репозиторий: `SirotkinAA/yellow-battery-website`.
- Production branch: `main`.
- Project name: `yellow-battery-website`.
- Build command: оставить пустым, сборка не требуется.
- Deploy command: `npx wrangler deploy`.
- Root directory: корень репозитория.

Cloudflare публикует только содержимое `public/`, указанное в
`wrangler.jsonc`. Подключение домена выполняется отдельно в Cloudflare
после первой успешной публикации. Почтовый сервис пока не настроен.

Стартовая страница содержит `noindex`: при запуске полноценного сайта
нужно убрать эту директиву для разрешения поисковой индексации.
