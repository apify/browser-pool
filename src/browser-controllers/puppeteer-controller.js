const _ = require('lodash');

const BrowserController = require('../abstract-classes/browser-controller');

const PROCESS_KILL_TIMEOUT_MILLIS = 5000;

/**
 * puppeteer
 */
class PuppeteerController extends BrowserController {
    async _newPage() {
        const { useIncognitoPages } = this.launchContext;
        let page;
        let context;

        if (useIncognitoPages) {
            context = await this.browser.createIncognitoBrowserContext();
            page = await context.newPage();
        } else {
            page = await this.browser.newPage();
        }

        page.once('close', () => {
            this.activePages--;

            if (useIncognitoPages) {
                context.close().catch(_.noop);
            }
        });

        page.once('error', (error) => {
            this.log.exception(error, 'Page crashed.');
            page.close().catch(_.noop);
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

    async _getCookies(page) {
        return page.cookies();
    }

    async _setCookies(page, cookies) {
        return page.setCookie(...cookies);
    }
}

module.exports = PuppeteerController;
