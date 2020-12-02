const BrowserController = require('../abstract-classes/browser-controller');

class PlaywrightController extends BrowserController {
    constructor(options) {
        super(options);

        this.pagesToContext = new WeakMap();
    }

    async _newPage() {
        const context = this.browser.newContext();
        const page = await context.newPage();

        this.pagesToContext[page] = context;

        page.once('close', () => {
            context.close(); // .catch();
            this.activePages--;
        });

        return page;
    }

    async _close() {
        await this.browser.close();
    }

    async _kill() {
        await this._close(); // Puppeteer does not have the browser child process attached to normal browser server
    }

    async getCookies(page) {
        return this.pagesToContext[page].cookies();
    }

    async setCookies(page, cookies) {
        return this.pagesToContext[page].addCookies(cookies);
    }
}

module.exports = PlaywrightController;
