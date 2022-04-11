// eslint isn't compatible with `import type`
/* eslint-disable import/no-duplicates */
import type Puppeteer from './puppeteer-proxy-per-page';
import type { Browser, Target, BrowserContext } from './puppeteer-proxy-per-page';
import { BrowserController } from '../abstract-classes/browser-controller';
import { BrowserPlugin } from '../abstract-classes/browser-plugin';
import { LaunchContext } from '../launch-context';
import { log } from '../logger';
import { noop } from '../utils';
import { PuppeteerController } from './puppeteer-controller';
import { normalizeProxyUrl } from '../anonymize-proxy';

const PROXY_SERVER_ARG = '--proxy-server=';

export class PuppeteerPlugin extends BrowserPlugin<typeof Puppeteer> {
    protected async _launch(launchContext: LaunchContext<typeof Puppeteer>): Promise<Browser> {
        const {
            launchOptions,
            userDataDir,
            useIncognitoPages,
            proxyUrl,
        } = launchContext;

        let browser: Puppeteer.Browser;

        {
            const [anonymizedProxyUrl, close] = await normalizeProxyUrl(proxyUrl);

            const finalLaunchOptions = {
                ...launchOptions,
                userDataDir: launchOptions?.userDataDir ?? userDataDir,
            };

            if (proxyUrl) {
                const proxyArg = `${PROXY_SERVER_ARG}${anonymizedProxyUrl ?? proxyUrl}`;

                if (Array.isArray(finalLaunchOptions.args)) {
                    finalLaunchOptions.args.push(proxyArg);
                } else {
                    finalLaunchOptions.args = [proxyArg];
                }
            }

            try {
                browser = await this.library.launch(finalLaunchOptions);
            } catch (error) {
                await close();

                throw error;
            }
        }

        browser.on('targetcreated', async (target: Target) => {
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

        const newPage = browser.newPage.bind(browser);

        browser = new Proxy(browser, {
            get: (target, property: keyof typeof browser) => {
                if (property === 'newPage') {
                    return (async (...args: Parameters<BrowserContext['newPage']>) => {
                        let page: Puppeteer.Page;

                        if (useIncognitoPages) {
                            const [anonymizedProxyUrl, close] = await normalizeProxyUrl(proxyUrl);

                            try {
                                const context = await browser.createIncognitoBrowserContext({
                                    proxyServer: anonymizedProxyUrl ?? proxyUrl,
                                });

                                page = await context.newPage(...args);

                                if (anonymizedProxyUrl) {
                                    page.on('close', async () => {
                                        await close();
                                    });
                                }
                            } catch (error) {
                                await close();

                                throw error;
                            }
                        } else {
                            page = await newPage(...args);
                        }

                        /*
                        // DO NOT USE YET! DOING SO DISABLES CACHE WHICH IS 50% PERFORMANCE HIT!
                        if (useIncognitoPages) {
                            const context = await browser.createIncognitoBrowserContext({
                                proxyServer: proxyUrl,
                            });

                            page = await context.newPage(...args);
                        } else {
                            page = await newPage(...args);
                        }

                        if (proxyCredentials) {
                            await page.authenticate(proxyCredentials as Credentials);
                        }
                        */

                        return page;
                    });
                }

                return target[property];
            },
        });

        return browser;
    }

    protected _createController(): BrowserController<typeof Puppeteer> {
        return new PuppeteerController(this);
    }

    protected async _addProxyToLaunchOptions(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        launchContext: LaunchContext<typeof Puppeteer>,
    ): Promise<void> {
        /*
        // DO NOT USE YET! DOING SO DISABLES CACHE WHICH IS 50% PERFORMANCE HIT!
        launchContext.launchOptions ??= {};

        const { launchOptions, proxyUrl } = launchContext;

        if (proxyUrl) {
            const url = new URL(proxyUrl);

            if (url.username || url.password) {
                launchContext.proxyCredentials = {
                    username: decodeURIComponent(url.username),
                    password: decodeURIComponent(url.password),
                };
            }

            const proxyArg = `${PROXY_SERVER_ARG}${url.origin}`;

            if (Array.isArray(launchOptions.args)) {
                launchOptions.args.push(proxyArg);
            } else {
                launchOptions.args = [proxyArg];
            }
        }
        */
    }
}
