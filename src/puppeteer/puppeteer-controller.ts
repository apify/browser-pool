import type { Page, Browser, BrowserLaunchArgumentOptions, BrowserContext } from 'puppeteer'; // eslint-disable-line import/no-duplicates
import type * as Puppeteer from 'puppeteer'; // eslint-disable-line import/no-duplicates
import log from '../logger';
import BrowserController, { BrowserControllerCookie } from '../abstract-classes/browser-controller';

const noop = require('lodash.noop');

const PROCESS_KILL_TIMEOUT_MILLIS = 5000;

/**
 * puppeteer
 */
export default class PuppeteerController extends BrowserController<typeof Puppeteer, Browser, Page, BrowserLaunchArgumentOptions, never> {
    async _newPage() {
        const { useIncognitoPages } = this.launchContext;
        let page: Page;
        let context: BrowserContext;

        if (useIncognitoPages) {
            context = await this.browser.createIncognitoBrowserContext();
            page = await context.newPage();
        } else {
            page = await this.browser.newPage();
        }

        page.once('close', () => {
            this.activePages--;

            if (useIncognitoPages) {
                context.close().catch(noop);
            }
        });

        page.once('error', (error) => {
            log.exception(error, 'Page crashed.');
            page.close().catch(noop);
        });

        return page;
    }

    async _close() {
        await this.browser.close();
    }

    async _kill() {
        const browserProcess = this.browser.process();

        if (!browserProcess) {
            // TODO: LOG browser was connected using the `puppeteer.connect` method no browser to kill.
            return;
        }

        const timeout = setTimeout(() => {
            // This is here because users reported that it happened
            // that error `TypeError: Cannot read property 'kill' of null` was thrown.
            // Likely Chrome process wasn't started due to some error ...
            if (browserProcess) browserProcess.kill('SIGKILL');
        }, PROCESS_KILL_TIMEOUT_MILLIS);

        try {
            await this.browser.close();
            clearTimeout(timeout);
        } catch (e) {
            // TODO: LOG Browser was already killed.
        }
    }

    async _getCookies(page: Page) {
        return page.cookies();
    }

    async _setCookies(page: Page, cookies: BrowserControllerCookie[]) {
        return page.setCookie(...cookies);
    }
}
