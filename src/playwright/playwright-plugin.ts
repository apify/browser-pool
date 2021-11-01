import type { Browser as PlaywrightBrowser, BrowserType } from 'playwright';
import { Browser as PlaywrightBrowserWithPersistentContext } from './browser';
import { PlaywrightController } from './playwright-controller';
import { BrowserController } from '../abstract-classes/browser-controller';
import { BrowserPlugin } from '../abstract-classes/browser-plugin';
import { LaunchContext } from '../launch-context';
import { log } from '../logger';

export class PlaywrightPlugin extends BrowserPlugin<BrowserType, Parameters<BrowserType['launch']>[0], PlaywrightBrowser> {
    private _browserVersion?: string;

    protected async _launch(launchContext: LaunchContext<BrowserType>): Promise<PlaywrightBrowser> {
        const {
            launchOptions,
            useIncognitoPages,
            userDataDir,
        } = launchContext;
        let browser: PlaywrightBrowser;

        // https://github.com/microsoft/playwright/blob/2e4722d460b5142267e0e506ca7ea9a259556b5f/packages/playwright-core/src/server/browserContext.ts#L423-L427
        launchOptions!.proxy = { server: 'http://per-context' };

        if (useIncognitoPages) {
            browser = await this.library.launch(launchOptions);
        } else {
            const browserContext = await this.library.launchPersistentContext(userDataDir, launchOptions);

            if (!this._browserVersion) {
                // Launches unused browser just to get the browser version.
                const inactiveBrowser = await this.library.launch(launchOptions);
                this._browserVersion = inactiveBrowser.version();

                inactiveBrowser.close().catch((error) => {
                    log.exception(error, 'Failed to close browser.');
                });
            }

            browser = new PlaywrightBrowserWithPersistentContext({ browserContext, version: this._browserVersion });
        }

        return new Proxy(browser, {
            get: (target, property: keyof typeof browser) => {
                if (property === 'newPage') {
                    return (async (pageOptions: Parameters<(typeof browser)['newPage']>[0]) => {
                        return browser.newPage({
                            ...pageOptions,
                            proxy: {
                                server: '',
                                ...pageOptions?.proxy,
                            },
                        });
                    });
                }

                return target[property];
            },
        });
    }

    protected _createController(): BrowserController<BrowserType, Parameters<BrowserType['launch']>[0], PlaywrightBrowser> {
        return new PlaywrightController(this);
    }

    protected async _addProxyToLaunchOptions(launchContext: LaunchContext<BrowserType>): Promise<void> {
        launchContext.launchOptions ??= {};

        const { launchOptions, proxyUrl } = launchContext;

        if (proxyUrl) {
            const url = new URL(proxyUrl);

            launchOptions.proxy = {
                server: url.origin,
                username: decodeURIComponent(url.username),
                password: decodeURIComponent(url.password),
            };
        }
    }
}
