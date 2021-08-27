import { Browser as PlaywrightBrowser, BrowserType } from 'playwright';
import { Browser as PlaywrightBrowserWithPersistentContext } from './browser';
import { PlaywrightController } from './playwright-controller';
import { BrowserController } from '../abstract-classes/browser-controller';
import { BrowserPlugin } from '../abstract-classes/browser-plugin';
import { LaunchContext } from '../launch-context';

let browserVersion: string;

export class PlaywrightPlugin extends BrowserPlugin<BrowserType, Parameters<BrowserType['launch']>[0], PlaywrightBrowser> {
    protected async _launch(launchContext: LaunchContext<BrowserType>): Promise<PlaywrightBrowser> {
        const {
            launchOptions,
            anonymizedProxyUrl,
            useIncognitoPages,
            userDataDir,
        } = launchContext;
        let browser: PlaywrightBrowser;

        if (useIncognitoPages) {
            browser = await this.library.launch(launchOptions);
        } else {
            const browserContext = await this.library.launchPersistentContext(userDataDir, launchOptions);

            if (!browserVersion) {
                // Launches unused browser just to get the browser version.
                const inactiveBrowser = await this.library.launch(launchOptions);
                browserVersion = inactiveBrowser.version();

                await inactiveBrowser.close();
            }

            browser = new PlaywrightBrowserWithPersistentContext({ browserContext, version: browserVersion });
        }

        if (anonymizedProxyUrl) {
            browser.once('disconnected', () => {
                this._closeAnonymizedProxy(anonymizedProxyUrl as string);
            });
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
