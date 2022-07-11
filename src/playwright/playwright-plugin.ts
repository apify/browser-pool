import type { Browser as PlaywrightBrowser, BrowserType } from 'playwright';
import path from 'path';
import { Browser as PlaywrightBrowserWithPersistentContext } from './browser';
import { PlaywrightController } from './playwright-controller';
import { BrowserController } from '../abstract-classes/browser-controller';
import { BrowserPlugin } from '../abstract-classes/browser-plugin';
import { LaunchContext } from '../launch-context';
import { log } from '../logger';
import { getLocalProxyAddress } from '../proxy-server';
import { anonymizeProxySugar } from '../anonymize-proxy';

// __dirname = browser-pool/dist/playwright
const taacPath = path.join(__dirname, '..', '..', 'tab-as-a-container');

export class PlaywrightPlugin extends BrowserPlugin<BrowserType, Parameters<BrowserType['launch']>[0], PlaywrightBrowser> {
    private _browserVersion?: string;

    protected async _launch(launchContext: LaunchContext<BrowserType>): Promise<PlaywrightBrowser> {
        const {
            launchOptions,
            useIncognitoPages,
            userDataDir,
            proxyUrl,
        } = launchContext;
        let browser: PlaywrightBrowser;

        // Required for the `proxy` context option to work.
        launchOptions!.proxy = {
            server: await getLocalProxyAddress(),
            ...launchOptions!.proxy,
        };

        const [anonymizedProxyUrl, close] = await anonymizeProxySugar(proxyUrl);
        if (anonymizedProxyUrl) {
            launchOptions!.proxy = {
                server: anonymizedProxyUrl,
                bypass: launchOptions!.proxy.bypass,
            };
        }

        try {
            if (useIncognitoPages) {
                browser = await this.library.launch(launchOptions);

                if (anonymizedProxyUrl) {
                    browser.on('disconnected', async () => {
                        await close();
                    });
                }
            } else {
                if (launchContext.experimentalContainers) {
                    launchOptions!.args = [
                        ...(launchOptions!.args ?? []),
                    ];

                    // Use native headless mode so we can load an extension
                    if (launchOptions!.headless) {
                        launchOptions!.args.push('--headless=chrome');
                    }

                    launchOptions!.args.push(`--disable-extensions-except=${taacPath}`, `--load-extension=${taacPath}`);
                }

                const browserContext = await this.library.launchPersistentContext(userDataDir, launchOptions);

                if (launchContext.experimentalContainers) {
                    // Wait for the extension to load.
                    let [backgroundPage] = browserContext.backgroundPages();
                    if (!backgroundPage) {
                        backgroundPage = await browserContext.waitForEvent('backgroundpage');
                    }

                    // @ts-expect-error loading is defined inside background script
                    await backgroundPage.evaluate(() => loading);
                }

                if (anonymizedProxyUrl) {
                    browserContext.on('close', async () => {
                        await close();
                    });
                }

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
        } catch (error) {
            await close();

            throw error;
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

    protected _isChromiumBasedBrowser(): boolean {
        const name = this.library.name();
        return name === 'chromium';
    }
}
