import type { FirefoxBrowser, ChromiumBrowser, Page, WebKitBrowser, Browser as PlaywrightBrowser, BrowserType, LaunchOptions } from 'playwright';
import BrowserPlugin from '../abstract-classes/browser-plugin';
import PlaywrightController, { PlaywrightControllerPageOptions } from './playwright-controller';
import type { LaunchContextOptions } from '../launch-context';
import Browser from './browser';

const noop = require('lodash.noop');

export interface PlaywrightLaunchContext<T extends BrowserType<any>> extends LaunchContextOptions<T, Browser & PlaywrightBrowser, Page, LaunchOptions, PlaywrightControllerPageOptions> {
    anonymizedProxyUrl?: string;
}

/**
 * playwright
 */
export default class PlaywrightPlugin<T extends FirefoxBrowser | ChromiumBrowser | WebKitBrowser>
    extends BrowserPlugin<BrowserType<T>, PlaywrightBrowser, Page, LaunchOptions, PlaywrightControllerPageOptions> {
    _browserVersion: string | null = null;

    /**
     * TODO: find a way to make this work to remove any
     * @private
     */
    async _launch(launchContext: PlaywrightLaunchContext<any>): Promise<any> {
        const {
            launchOptions,
            anonymizedProxyUrl,
            useIncognitoPages,
            userDataDir,
        } = launchContext;
        let browser!: T;

        if (useIncognitoPages) {
            browser = await this.library.launch(launchOptions);
        } else {
            // TODO: userDataDir must be provided!
            const browserContext = await this.library.launchPersistentContext(userDataDir as any, launchOptions);

            if (!this._browserVersion) {
                // Launches unused browser just to get the browser version.

                const inactiveBrowser = await this.library.launch(launchOptions);
                this._browserVersion = inactiveBrowser.version();

                inactiveBrowser.close().catch(noop);
            }

            browser = new Browser({ browserContext, version: this._browserVersion }) as unknown as T;
        }
        // @TODO: Rework the disconnected events once the browser context vs browser issue is fixed
        if (anonymizedProxyUrl) {
            browser.once('disconnected', () => {
                this._closeAnonymizedProxy(anonymizedProxyUrl);
            });
        }

        return browser;
    }

    /**
     * @private
     */
    _createController(): PlaywrightController<T> {
        return new PlaywrightController(this);
    }

    /**
     * @private
     */
    async _addProxyToLaunchOptions(launchContext: PlaywrightLaunchContext<BrowserType<T>>) {
        const { launchOptions, proxyUrl } = launchContext;

        if (launchOptions) {
            if (proxyUrl) {
                if (this._shouldAnonymizeProxy(proxyUrl)) {
                    const anonymizedProxyUrl = await this._getAnonymizedProxyUrl(proxyUrl);
                    launchContext.anonymizedProxyUrl = anonymizedProxyUrl;
                    launchOptions.proxy = { server: anonymizedProxyUrl };
                    return;
                }

                launchOptions.proxy = { server: proxyUrl };
            }
        }
    }
}
