const BrowserController = require('../abstract-classes/browser-controller');

/**
 * playwright
 * @extends BrowserController
 */
class PlaywrightController extends BrowserController {
    async _newPage(pageOptions) {
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

    async _getCookies(page) {
        const context = page.context();
        return context.cookies();
    }

    async _setCookies(page, cookies) {
        const context = page.context();
        return context.addCookies(cookies);
    }
}

module.exports = PlaywrightController;
