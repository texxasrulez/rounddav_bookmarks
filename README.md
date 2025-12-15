# RoundDAV Bookmarks

[![Packagist Downloads](https://img.shields.io/packagist/dt/texxasrulez/rounddav_bookmarks?style=plastic&logo=packagist&logoColor=white&label=Downloads&labelColor=blue&color=gold)](https://packagist.org/packages/texxasrulez/rounddav_bookmarks)
[![Packagist Version](https://img.shields.io/packagist/v/texxasrulez/rounddav_bookmarks?style=plastic&logo=packagist&logoColor=white&label=Version&labelColor=blue&color=limegreen)](https://packagist.org/packages/texxasrulez/rounddav_bookmarks)
[![Github License](https://img.shields.io/github/license/texxasrulez/rounddav_bookmarks?style=plastic&logo=github&label=License&labelColor=blue&color=coral)](https://github.com/texxasrulez/rounddav_bookmarks/LICENSE)
[![GitHub Stars](https://img.shields.io/github/stars/texxasrulez/rounddav_bookmarks?style=plastic&logo=github&label=Stars&labelColor=blue&color=deepskyblue)](https://github.com/texxasrulez/rounddav_bookmarks/stargazers)
[![GitHub Issues](https://img.shields.io/github/issues/texxasrulez/rounddav_bookmarks?style=plastic&logo=github&label=Issues&labelColor=blue&color=aqua)](https://github.com/texxasrulez/rounddav_bookmarks/issues)
[![GitHub Contributors](https://img.shields.io/github/contributors/texxasrulez/rounddav_bookmarks?style=plastic&logo=github&logoColor=white&label=Contributors&labelColor=blue&color=orchid)](https://github.com/texxasrulez/rounddav_bookmarks/graphs/contributors)
[![GitHub Forks](https://img.shields.io/github/forks/texxasrulez/rounddav_bookmarks?style=plastic&logo=github&logoColor=white&label=Forks&labelColor=blue&color=darkorange)](https://github.com/texxasrulez/rounddav_bookmarks/forks)
[![Donate Paypal](https://img.shields.io/badge/Paypal-Money_Please!-blue.svg?style=plastic&labelColor=blue&color=forestgreen&logo=paypal)](https://www.paypal.me/texxasrulez)

Rich bookmark management for Roundcube that talks to the RoundDAV backend. It lets users store private links, publish domain-wide bookmark collections, and drag a bookmarklet into their browser for one-click saving – all without leaving Roundcube.

---

## Features

- Full CRUD UI under **Settings → Bookmarks** with filtering, folders, favorites, and recent activity.
- Private **and** domain/shared scopes so teams can keep a curated list of links.
- Optional fine-grained sharing (specific users or entire domains) when RoundDAV is configured for it.
- Drag-to-toolbar bookmarklet that opens a compact “Quick Add” dialog for the current tab.
- Uses the trusted RoundDAV provisioning API (same token as the `rounddav_provision` plugin), so no extra credentials are stored in Roundcube.

---

## Requirements

1. **Roundcube** 1.6.x (or newer) with the `rounddav_provision` plugin enabled and configured.  
   `rounddav_bookmarks` relies on the `rounddav_api_credentials` hook exposed by that plugin.
2. **RoundDAV Server** with the Bookmarks engine enabled (`config/config.php → bookmarks.enabled = true`).  
   Make sure `provision.shared_secret` (or `bookmarks.shared_secret` if you override it) matches the token you configured in Roundcube.

---

## Installation

1. Copy the plugin into Roundcube, e.g.:
   ```text
   roundcube/plugins/rounddav_bookmarks/
   ```
2. Enable it alongside the rest of the RoundDAV suite (usually `rounddav_provision` and `rounddav_files`) in `config/config.inc.php`:
   ```php
   $config['plugins'][] = 'rounddav_bookmarks';
   ```
3. Clear Roundcube’s cache (`bin/cleandb.sh` or `php bin/console cache:clear` depending on your setup) so the new localization strings and skins are picked up.
4. Log into Roundcube, open **Settings → Bookmarks**, and drag the **RoundDAV Quick Add** link into your browser’s bookmarks bar if you want the bookmarklet.

No additional configuration file is required; all credentials are pulled from `rounddav_provision`.

---

## Usage Tips

- **Folders:** Click “Create folder” to build a hierarchy. Shared folders show up automatically for users in the same email domain.
- **Filters:** The sidebar filters let you search, scope to private/shared, limit to a folder, or view favorites only.
- **Sharing controls:** When you choose “Shared” visibility you can either make the bookmark available to the entire domain or limit it to specific user emails / domains.
- **Bookmarklet:** Drag the “RoundDAV Quick Add” link to your browser toolbar. When you’re on a page you want to save, click it – a mini Roundcube window appears so you can confirm the details.

---

## Troubleshooting

- **Missing credentials / greyed out UI:** Ensure `rounddav_provision` is enabled and has `rounddav_api_url` + `rounddav_api_token` configured. Check Roundcube’s `logs/errors` for `rounddav_bookmarks` messages.
- **403 / Invalid API token:** Verify `config/config.php → provision.shared_secret` (or `bookmarks.shared_secret`) matches `rounddav_api_token` in the Roundcube plugin config.
- **Shared bookmarks not appearing:** Confirm that the email address Roundcube uses matches the RoundDAV principal (`user@domain`). Shared entries are keyed by domain.
- **Bookmarklet blocked by pop-up blocker:** Allow pop-ups from your Roundcube origin; the bookmarklet opens a small window to submit the URL.

Logs for this plugin go to the standard Roundcube log channels, so check `logs/roundcube` and `logs/rounddav` when debugging.

---

## License

Same license as the rest of the RoundDAV Suite. See the repository root for details.
