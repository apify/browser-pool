const BrowserController = require('../interfaces/browser-controller');

const PROCESS_KILL_TIMEOUT_MILLIS = 5000;

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
}

module.exports = PuppeteerController;
