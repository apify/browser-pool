const BrowserPlugin = require('../abstract-classes/browser-plugin');
const PuppeteerController = require('../browser-controllers/puppeteer-controller');

const PROXY_SERVER_ARG = '--proxy-server=';

class PuppeteerPlugin extends BrowserPlugin {
    /**
     * @param {LaunchContext} launchContext
     * @return {Promise<Browser>}
     * @private
     */
    async _launch(launchContext) {
        const { launchOptions, anonymizedProxyUrl } = launchContext;
        const browser = await this.library.launch(launchOptions);

        if (anonymizedProxyUrl) {
            browser.once('disconnected', () => {
                this._closeAnonymizedProxy(anonymizedProxyUrl);
            });
        }

        return browser;
    }

    /**
     * @return {PuppeteerController}
     * @private
     */
    _createController() {
        return new PuppeteerController(this);
    }

    /**
     *
     * @param launchContext {object}
     * @return {Promise<void>}
     * @private
     */
    async _addProxyToLaunchOptions(launchContext) {
        const { launchOptions, proxyUrl } = launchContext;
        const newProxyUrl = await this._getAnonymizedProxyUrl(proxyUrl);
        launchContext.anonymizedProxyUrl = newProxyUrl;

        const proxyArg = `${PROXY_SERVER_ARG}${newProxyUrl}`;

        if (Array.isArray(launchOptions.args)) {
            launchOptions.args.push(proxyArg);
        } else {
            launchOptions.args = [proxyArg];
        }
    }
}

module.exports = PuppeteerPlugin;
