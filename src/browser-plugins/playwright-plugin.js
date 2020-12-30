const BrowserPlugin = require('../abstract-classes/browser-plugin');
const PlaywrightController = require('../browser-controllers/playwright-controller');

class PlaywrightPlugin extends BrowserPlugin {
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
     * @return {PlaywrightController}
     * @private
     */
    _createController() {
        return new PlaywrightController(this);
    }

    /**
     *
     * @param {LaunchContext} launchContext
     * @return {Promise<void>}
     * @private
     */
    async _addProxyToLaunchOptions(launchContext) {
        const { launchOptions, proxyUrl } = launchContext;
        const anonymizedProxyUrl = await this._getAnonymizedProxyUrl(proxyUrl);
        launchContext.anonymizedProxyUrl = anonymizedProxyUrl;

        launchOptions.proxy = { server: anonymizedProxyUrl };
    }
}

module.exports = PlaywrightPlugin;
