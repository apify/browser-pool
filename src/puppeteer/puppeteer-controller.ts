import type Puppeteer from 'puppeteer';
import { BrowserController, Cookie } from '../abstract-classes/browser-controller';
import { log } from '../logger';

const PROCESS_KILL_TIMEOUT_MILLIS = 5000;

interface ContextOptions extends Puppeteer.BrowserContextOptions {
    proxyUsername?: string;
    proxyPassword?: string;
}

export class PuppeteerController extends BrowserController<typeof Puppeteer> {
    protected async _newPage(contextOptions?: ContextOptions): Promise<Puppeteer.Page> {
        if (contextOptions !== undefined) {
            if (!this.launchContext.useIncognitoPages) {
                throw new Error('A new page can be created with provided context only when using incognito pages.');
            }

            const context = await this.browser.createIncognitoBrowserContext(contextOptions);
            const page = await context.newPage();

            if (contextOptions.proxyUsername || contextOptions.proxyPassword) {
                await page.authenticate({
                    username: contextOptions.proxyUsername ?? '',
                    password: contextOptions.proxyPassword ?? '',
                });
            }

            page.once('close', async () => {
                this.activePages--;

                try {
                    await context.close();
                } catch (error: any) {
                    log.exception(error, 'Failed to close context.');
                }
            });

            return page;
        }

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
