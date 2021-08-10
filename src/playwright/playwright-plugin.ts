import { Browser as PlaywrightBrowser, BrowserType } from 'playwright';
import { BrowserController } from '../abstract-classes/browser-controller';
import { BrowserPlugin } from '../abstract-classes/browser-plugin';
import { LaunchContext } from '../launch-context';
import { noop } from '../utils';
import { Browser as ApifyBrowser } from './browser';
import { PlaywrightController } from './playwright-controller';

export type PlaywrightPluginBrowsers = ApifyBrowser | PlaywrightBrowser;

/**
 * Playwright
 */
export class PlaywrightPlugin extends BrowserPlugin<BrowserType, Parameters<BrowserType['launch']>[0], PlaywrightPluginBrowsers> {
    private _browserVersion!: string;

    protected _launch(launchContext: LaunchContext<BrowserType> & { useIncognitoPages: true }): Promise<PlaywrightBrowser>;

    protected _launch(launchContext: LaunchContext<BrowserType> & { useIncognitoPages: false }): Promise<ApifyBrowser>;

    protected async _launch(launchContext: LaunchContext<BrowserType>): Promise<ApifyBrowser | PlaywrightBrowser> {
        const {
            launchOptions,
            anonymizedProxyUrl,
            useIncognitoPages,
            userDataDir,
        } = launchContext;
        let browser: ApifyBrowser | PlaywrightBrowser;

        if (useIncognitoPages) {
            browser = await this.library.launch(launchOptions);
        } else {
            const browserContext = await this.library.launchPersistentContext(userDataDir, launchOptions);

            if (!this._browserVersion) {
                // Launches unused browser just to get the browser version.

                const inactiveBrowser = await this.library.launch(launchOptions);
                this._browserVersion = inactiveBrowser.version();

                inactiveBrowser.close().catch(noop);
            }

            browser = new ApifyBrowser({ browserContext, version: this._browserVersion });
        }

        if (anonymizedProxyUrl) {
            browser.once('disconnected', () => {
                this._closeAnonymizedProxy(anonymizedProxyUrl as string);
            });
        }

        return browser;
    }

    protected _createController(): BrowserController<BrowserType, Parameters<BrowserType['launch']>[0], PlaywrightPluginBrowsers> {
        return new PlaywrightController(this);
    }

    protected async _addProxyToLaunchOptions(launchContext: LaunchContext<BrowserType>): Promise<void> {
        launchContext.launchOptions ??= {};

        const { launchOptions, proxyUrl } = launchContext;

        if (proxyUrl) {
            if (this._shouldAnonymizeProxy(proxyUrl)) {
                const anonymizedProxyUrl = await this._getAnonymizedProxyUrl(proxyUrl);
                launchContext.anonymizedProxyUrl = anonymizedProxyUrl;
                launchOptions.proxy = { server: anonymizedProxyUrl };
            } else {
                launchOptions.proxy = { server: proxyUrl };
            }
        }
    }
}
