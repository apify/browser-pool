import type * as Puppeteer from 'puppeteer';
import { BrowserController, Cookie } from '../abstract-classes/browser-controller';

const PROCESS_KILL_TIMEOUT_MILLIS = 5000;

export class PuppeteerController extends BrowserController<typeof Puppeteer> {
    protected async _newPage(): Promise<Puppeteer.Page> {
        const page = await this.browser.newPage();

        page.once('close', () => {
            this.activePages--;
        });

        return page;
    }

    protected async _close(): Promise<void> {
        await this.browser.close();
    }

    protected async _kill(): Promise<void> {
        const browserProcess = this.browser.process();

        if (!browserProcess) {
            // TODO: LOG browser was connected using the `puppeteer.connect` method no browser to kill.
            return;
        }

        const timeout = setTimeout(() => {
            // This is here because users reported that it happened
            // that error `TypeError: Cannot read property 'kill' of null` was thrown.
            // Likely Chrome process wasn't started due to some error ...
            browserProcess?.kill('SIGKILL');
        }, PROCESS_KILL_TIMEOUT_MILLIS);

        try {
            await this.browser.close();
            clearTimeout(timeout);
        } catch (e) {
            // TODO: LOG Browser was already killed.
        }
    }

    protected _getCookies(page: Puppeteer.Page): Promise<Cookie[]> {
        return page.cookies();
    }

    protected _setCookies(page: Puppeteer.Page, cookies: Cookie[]): Promise<void> {
        return page.setCookie(...cookies);
    }
}
