3.0.0 / 2021/10/17
====================
- fix: skip proxy-chain #53

The API remains the same, although it may be breaking. Proxies are handled entirely by puppeteer now.\
Launching a browser does not create a proxy server anymore.

2.0.4 / 2021/10/05
====================
- fix `proxyUrl` in incognito context (#51), closes apify/apify-js#1195

2.0.3 / 2021/09/06
====================
- fix browser profile leak (#50)

2.0.2 / 2021/09/06
====================
- fix race condition on `newPage` (#44)
- attempt to fix types (#47)

2.0.1 / 2021/08/31
====================
- fix incognito mode (#43)

2.0.0 / 2021/08/24
====================

- Converted library to TypeScript (which may have some side effects in the event of misuse)

1.1.2 / 2021/03/18
====================

- Fixed an error where chains of errors in `preLaunchHooks` and `postLaunchHooks` would cause browser(controller)s to be stuck in limbo forever.

1.1.1 / 2021/02/25
====================

- Fixed `playwrightPlugin.launch()` returning `BrowserContext` instead of `Browser` when `useIncognitoPages: false` was used.
- Fixed user data directory not being correctly created when using Firefox in Docker.

1.1.0 / 2021/02/04
====================

- Added `useIncognitoPages` and `userDataDir` to `LaunchContext`.
- `PlaywrightPlugin` now launches persistent context by default.
- Improved `playwright` context customization and management.

1.0.1 / 2021/01/01
====================

- Fixed a bug where `prePageCreateHooks` would get triggered before `postLaunchHooks` in some cases.

1.0.0 / 2021/01/01
====================

- Initial release
