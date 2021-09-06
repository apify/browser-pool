import { Browser, BrowserType, Page } from 'playwright';
import {Page as pp} from 'playwright';
import { BrowserController, Cookie } from '../abstract-classes/browser-controller';

export class PlaywrightController extends BrowserController<BrowserType, Parameters<BrowserType['launch']>[0], Browser> {
    override supportsPageOptions = true;

    protected async _newPage(pageOptions?: Parameters<Browser['newPage']>[0]): Promise<Page> {
        const page = await this.browser.newPage(pageOptions);

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
