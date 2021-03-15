import type { Browser, Page, ChromeArgOptions } from 'puppeteer';
import BrowserPlugin from '../abstract-classes/browser-plugin';
import PuppeteerController from './puppeteer-controller';
import type { LaunchContextOptions } from '../launch-context';

const PROXY_SERVER_ARG = '--proxy-server=';

export interface PuppeteerLaunchContext extends LaunchContextOptions<Browser, Page, ChromeArgOptions, never> {
    anonymizedProxyUrl?: string;
}
/**
 * puppeteer
 */
export default class PuppeteerPlugin extends BrowserPlugin<Browser, Page, ChromeArgOptions, never> {
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

        const browser = await (this.library as any).launch(finalLaunchOptions);

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
     *
     * @param launchContext {object}
     * @return {Promise<void>}
     * @private
     */
    async _addProxyToLaunchOptions(launchContext: PuppeteerLaunchContext) {
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
