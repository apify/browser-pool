import * as Puppeteer from 'puppeteer';
import { BrowserController } from '../abstract-classes/browser-controller';
import { BrowserPlugin } from '../abstract-classes/browser-plugin';
import { LaunchContext } from '../launch-context';
import { PuppeteerController } from './puppeteer-controller';

const PROXY_SERVER_ARG = '--proxy-server=';

export class PuppeteerPlugin extends BrowserPlugin<typeof Puppeteer> {
    protected async _launch(launchContext: LaunchContext<typeof Puppeteer>): Promise<Puppeteer.Browser> {
        const {
            launchOptions,
            anonymizedProxyUrl,
            userDataDir,
            useIncognitoPages,
        } = launchContext;

        const finalLaunchOptions = {
            ...launchOptions,
            userDataDir: launchOptions?.userDataDir ?? userDataDir,
        };

        let browser = await this.library.launch(finalLaunchOptions);
        if (useIncognitoPages) {
            const incognitoContext = await browser.createIncognitoBrowserContext();

            browser = new Proxy(browser, {
                get: (target, property: keyof typeof browser) => {
                    if (property === 'newPage') {
                        return incognitoContext.newPage.bind(incognitoContext);
                    }

                    return target[property];
                },
            });
        }

        if (anonymizedProxyUrl) {
            browser.once('disconnected', () => {
                this._closeAnonymizedProxy(anonymizedProxyUrl as string);
            });
        }

        return browser;
    }

    protected _createController(): BrowserController<typeof Puppeteer> {
        return new PuppeteerController(this);
    }

    protected async _addProxyToLaunchOptions(
        launchContext: LaunchContext<typeof Puppeteer>,
    ): Promise<void> {
        launchContext.launchOptions ??= {};

        const { launchOptions, proxyUrl } = launchContext;
        let finalProxyUrl = proxyUrl;

        if (proxyUrl && this._shouldAnonymizeProxy(proxyUrl)) {
            finalProxyUrl = await this._getAnonymizedProxyUrl(proxyUrl);
            launchContext.anonymizedProxyUrl = finalProxyUrl;
        }

        const proxyArg = `${PROXY_SERVER_ARG}${finalProxyUrl}`;

        if (Array.isArray(launchOptions.args)) {
            launchOptions.args.push(proxyArg);
        } else {
            launchOptions.args = [proxyArg];
        }
    }
}
