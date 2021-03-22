import type { Page, BrowserLaunchArgumentOptions, Browser } from 'puppeteer'; // eslint-disable-line import/no-duplicates
import type * as Puppeteer from 'puppeteer'; // eslint-disable-line import/no-duplicates
import BrowserPlugin from '../abstract-classes/browser-plugin';
import PuppeteerController from './puppeteer-controller';
import type { LaunchContextOptions } from '../launch-context';

const PROXY_SERVER_ARG = '--proxy-server=';

export interface PuppeteerLaunchContext extends LaunchContextOptions<typeof Puppeteer, Browser, Page, BrowserLaunchArgumentOptions, never> {
    anonymizedProxyUrl?: string;
}

/**
 * puppeteer
 */
export default class PuppeteerPlugin extends BrowserPlugin<typeof Puppeteer, Browser, Page, BrowserLaunchArgumentOptions, never> {
    /**
     * @private
     */
    async _launch(launchContext: PuppeteerLaunchContext): Promise<Browser> {
        const {
            launchOptions,
            anonymizedProxyUrl,
            userDataDir,
        } = launchContext;

        const finalLaunchOptions = {
            ...launchOptions,
            userDataDir: launchOptions?.userDataDir || userDataDir,
        };

        const browser = await this.library.launch(finalLaunchOptions);

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
    _createController(): PuppeteerController {
        return new PuppeteerController(this);
    }

    /**
     * @private
     */
    async _addProxyToLaunchOptions(launchContext: PuppeteerLaunchContext): Promise<void> {
        const { launchOptions, proxyUrl } = launchContext;
        let finalProxyUrl = proxyUrl;

        if (proxyUrl && this._shouldAnonymizeProxy(proxyUrl)) {
            finalProxyUrl = await this._getAnonymizedProxyUrl(proxyUrl);
            launchContext.anonymizedProxyUrl = finalProxyUrl;
        }

        const proxyArg = `${PROXY_SERVER_ARG}${finalProxyUrl}`;

        if (launchOptions) {
            if (Array.isArray(launchOptions.args)) {
                launchOptions.args.push(proxyArg);
            } else {
                launchOptions.args = [proxyArg];
            }
        }
    }
}
