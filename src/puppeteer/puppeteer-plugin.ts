import type * as Puppeteer from 'puppeteer';
import { BrowserController } from '../abstract-classes/browser-controller';
import { BrowserPlugin } from '../abstract-classes/browser-plugin';
import { LaunchContext } from '../launch-context';
import { log } from '../logger';
import { noop } from '../utils';
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

        const typedAnonymizedProxyUrl = anonymizedProxyUrl as string | undefined;

        const finalLaunchOptions = {
            ...launchOptions,
            userDataDir: launchOptions?.userDataDir ?? userDataDir,
        };

        let browser = await this.library.launch(finalLaunchOptions);

        browser.on('targetcreated', async (target: Puppeteer.Target) => {
            try {
                const page = await target.page();

                if (page) {
                    page.on('error', (error) => {
                        log.exception(error, 'Page crashed.');
                        page.close().catch(noop);
                    });
                }
            } catch (error: any) {
                log.exception(error, 'Failed to retrieve page from target.');
            }
        });

        if (useIncognitoPages) {
            browser = new Proxy(browser, {
                get: (target, property: keyof typeof browser) => {
                    if (property === 'newPage') {
                        return (async (...args) => {
                            const incognitoContext = await browser.createIncognitoBrowserContext({
                                proxyServer: typedAnonymizedProxyUrl || launchContext.proxyUrl,
                            });

                            return incognitoContext.newPage(...args);
                        }) as typeof browser.newPage;
                    }

                    return target[property];
                },
            });
        }

        if (typedAnonymizedProxyUrl) {
            browser.once('disconnected', () => {
                this._closeAnonymizedProxy(typedAnonymizedProxyUrl);
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
