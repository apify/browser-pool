import type { Page, LaunchOptions, Browser, BrowserType, FirefoxBrowser, ChromiumBrowser, WebKitBrowser } from 'playwright';
import BrowserController, { BrowserControllerCookie } from '../abstract-classes/browser-controller';
import type BrowserPlugin from '../abstract-classes/browser-plugin';

export type PlaywrightControllerPageOptions = NonNullable<Parameters<Browser['newPage']>[0]>;

/**
 * playwright
 */
export default class PlaywrightController<T extends FirefoxBrowser | ChromiumBrowser | WebKitBrowser>
    extends BrowserController<BrowserType<T>, Browser, Page, LaunchOptions, PlaywrightControllerPageOptions> {
    constructor(options: BrowserPlugin<BrowserType<T>, Browser, Page, LaunchOptions, PlaywrightControllerPageOptions>) {
        super(options);

        this.supportsPageOptions = true;
    }

    async _newPage(pageOptions: PlaywrightControllerPageOptions) {
        const page = await this.browser.newPage(pageOptions);

        page.once('close', async () => {
            this.activePages--;
        });

        return page;
    }

    async _close() {
        await this.browser.close();
    }

    async _kill() {
        // TODO We need to be absolutely sure the browser dies.
        await this.browser.close(); // Playwright does not have the browser child process attached to normal browser server
    }

    async _getCookies(page: Page): Promise<BrowserControllerCookie[]> {
        const context = page.context();
        return context.cookies() as any;
    }

    async _setCookies(page: Page, cookies: BrowserControllerCookie[]) {
        const context = page.context();
        return context.addCookies(cookies);
    }
}
