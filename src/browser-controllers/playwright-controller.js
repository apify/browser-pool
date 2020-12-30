const _ = require('lodash');
const BrowserController = require('../abstract-classes/browser-controller');

class PlaywrightController extends BrowserController {
    constructor(browserPlugin) {
        super(browserPlugin);

        this.pageToContext = new WeakMap();
    }

    async _newPage(pageOptions) {
        const context = await this.browser.newContext();
        const page = await context.newPage(pageOptions);

        this.pageToContext.set(page, context);

        page.once('close', async () => {
            await context.close().catch(_.noop);
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
        const context = this.pageToContext.get(page);
        return context.cookies();
    }

    async _setCookies(page, cookies) {
        const context = this.pageToContext.get(page);
        return context.addCookies(cookies);
    }
}

module.exports = PlaywrightController;
