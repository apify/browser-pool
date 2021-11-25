import type { Browser, BrowserType, Page } from 'playwright';
import { tryCancel } from '@apify/timeout';
import { BrowserController, Cookie } from '../abstract-classes/browser-controller';

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

        const page = await this.browser.newPage(contextOptions);
        tryCancel();

        page.once('close', () => {
            this.activePages--;
        });

        return page;
    }

    protected async _close(): Promise<void> {
        await this.browser.close();
    }

    protected async _kill(): Promise<void> {
        // TODO: We need to be absolutely sure the browser dies.
        await this.browser.close(); // Playwright does not have the browser child process attached to normal browser server
    }

    protected _getCookies(page: Page): Promise<Cookie[]> {
        const context = page.context();
        return context.cookies();
    }

    protected _setCookies(page: Page, cookies: Cookie[]): Promise<void> {
        const context = page.context();
        return context.addCookies(cookies);
    }
}
