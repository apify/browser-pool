const BrowserController = require('../interfaces/browser-controller');

class PlaywrightController extends BrowserController {
    async _newPage() {
        const page = await this.browser.newPage();

        page.once('close', () => {
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
}

module.exports = PlaywrightController;
