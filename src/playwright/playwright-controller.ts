import type { Browser, BrowserType, Page } from 'playwright';
import { tryCancel } from '@apify/timeout';
import { BrowserController, Cookie } from '../abstract-classes/browser-controller';
import { anonymizeProxySugar } from '../anonymize-proxy';

const tabIds = new WeakMap<Page, number>();

export class PlaywrightController extends BrowserController<BrowserType, Parameters<BrowserType['launch']>[0], Browser> {
    normalizeProxyOptions(proxyUrl: string | undefined, pageOptions: any): Record<string, unknown> {
        if (!proxyUrl) {
            return {};
        }

        const url = new URL(proxyUrl);
        const username = decodeURIComponent(url.username);
        const password = decodeURIComponent(url.password);

        return {
            proxy: {
                server: url.origin,
                username,
                password,
                bypass: pageOptions?.proxy?.bypass,
            },
        };
    }

    protected async _newPage(contextOptions?: Parameters<Browser['newPage']>[0]): Promise<Page> {
        if (contextOptions !== undefined && !this.launchContext.useIncognitoPages) {
            throw new Error('A new page can be created with provided context only when using incognito pages.');
        }

        // eslint-disable-next-line @typescript-eslint/no-empty-function
        let close = async () => {};
        if (contextOptions?.proxy) {
            const [anonymizedProxyUrl, closeProxy] = await anonymizeProxySugar(
                contextOptions.proxy.server,
                contextOptions.proxy.username,
                contextOptions.proxy.password,
            );

            if (anonymizedProxyUrl) {
                contextOptions.proxy = {
                    server: anonymizedProxyUrl,
                    bypass: contextOptions.proxy.bypass,
                };
            }

            close = closeProxy;
        }

        try {
            const page = await this.browser.newPage(contextOptions);

            page.once('close', async () => {
                this.activePages--;

                await close();
            });

            if (this.launchContext.experimentalContainers) {
                await page.goto('data:text/plain,tabid');
                await page.waitForNavigation();
                const { tabid } = JSON.parse(decodeURIComponent(page.url().slice('about:blank#'.length)));

                tabIds.set(page, tabid);
            }

            tryCancel();

            return page;
        } catch (error) {
            await close();

            throw error;
        }
    }

    protected async _close(): Promise<void> {
        await this.browser.close();
    }

    protected async _kill(): Promise<void> {
        // TODO: We need to be absolutely sure the browser dies.
        await this.browser.close(); // Playwright does not have the browser child process attached to normal browser server
    }

    protected async _getCookies(page: Page): Promise<Cookie[]> {
        const context = page.context();
        const cookies = await context.cookies();

        if (this.launchContext.experimentalContainers) {
            const key = `${tabIds.get(page)}.`;

            return cookies
                .filter((cookie) => cookie.name.startsWith(key))
                .map((cookie) => ({
                    ...cookie,
                    name: cookie.name.slice(key.length),
                }));
        }

        return cookies;
    }

    protected _setCookies(page: Page, cookies: Cookie[]): Promise<void> {
        const context = page.context();

        if (this.launchContext.experimentalContainers) {
            const key = `${tabIds.get(page)}.`;

            cookies = cookies.map((cookie) => ({
                ...cookie,
                name: `${key}${cookie.name}`,
            }));
        }

        return context.addCookies(cookies);
    }
}
