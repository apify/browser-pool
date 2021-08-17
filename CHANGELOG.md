2.0.0 / 2021/08/17
====================

- Converted library to TypeScript

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
