import type { Browser as PlaywrightBrowser, BrowserType } from 'playwright';
import { Browser as PlaywrightBrowserWithPersistentContext } from './browser';
import { PlaywrightController } from './playwright-controller';
import { BrowserController } from '../abstract-classes/browser-controller';
import { BrowserPlugin } from '../abstract-classes/browser-plugin';
import { LaunchContext } from '../launch-context';
import { log } from '../logger';
import { getLocalProxyAddress } from '../proxy-server';

export class PlaywrightPlugin extends BrowserPlugin<BrowserType, Parameters<BrowserType['launch']>[0], PlaywrightBrowser> {
    private _browserVersion?: string;

    protected async _launch(launchContext: LaunchContext<BrowserType>): Promise<PlaywrightBrowser> {
        const {
            launchOptions,
            useIncognitoPages,
            userDataDir,
        } = launchContext;
        let browser: PlaywrightBrowser;

        // Required for the `proxy` context option to work.
        launchOptions!.proxy = {
            server: await getLocalProxyAddress(),
        };

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

        return browser;
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
