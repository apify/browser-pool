const BrowserController = require('../interfaces/browser-controller');

class PuppeteerController extends BrowserController {
    async _newPage() {
        const page = await this.browser.newPage();

        page.once('close', () => {
            this.activePages--;
        });

        page.once('error', (error) => {
            this.log.exception(error, 'Page crashed.');
            page.close().catch();
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

        try {
            return browserProcess.kill('SIGKILL');
        } catch (e) {
            // TODO: LOG Browser was already killed.
        }
    }
}

module.exports = PuppeteerController;
