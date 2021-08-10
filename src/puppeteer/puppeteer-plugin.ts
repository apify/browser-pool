import * as Puppeteer from 'puppeteer';
import { BrowserController } from '../abstract-classes/browser-controller';
import { BrowserPlugin } from '../abstract-classes/browser-plugin';
import { LaunchContext } from '../launch-context';
import { PuppeteerController } from './puppeteer-controller';

const PROXY_SERVER_ARG = '--proxy-server=';

/**
 * Puppeteer
 */
export class PuppeteerPlugin extends BrowserPlugin<typeof Puppeteer> {
    protected async _launch(launchContext: LaunchContext<typeof Puppeteer>): Promise<Puppeteer.Browser> {
        const {
            launchOptions,
            anonymizedProxyUrl,
            userDataDir,
        } = launchContext;

        const finalLaunchOptions = {
            ...launchOptions,
            userDataDir: launchOptions?.userDataDir ?? userDataDir,
        };

        const browser = await this.library.launch(finalLaunchOptions);

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
