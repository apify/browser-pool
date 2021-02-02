const BrowserPlugin = require('../abstract-classes/browser-plugin');
const PlaywrightController = require('../browser-controllers/playwright-controller');

/**
 * playwright
 */
class PlaywrightPlugin extends BrowserPlugin {
    /**
     * @param {LaunchContext} launchContext
     * @return {Promise<Browser>}
     * @private
     */
    async _launch(launchContext) {
        const { launchOptions, anonymizedProxyUrl, usePersistentContext = false } = launchContext;
        let browser;

        if (usePersistentContext) {
            browser = await this.library.launchPersistentContext('', launchOptions); // @TODO: allow to set the userDataDir
        } else {
            browser = await this.library.launch(launchOptions);
        }

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

        if (this._shouldAnonymizeProxy(proxyUrl)) {
            const anonymizedProxyUrl = await this._getAnonymizedProxyUrl(proxyUrl);
            launchContext.anonymizedProxyUrl = anonymizedProxyUrl;
            launchOptions.proxy = { server: anonymizedProxyUrl };
            return;
        }

        launchOptions.proxy = { server: proxyUrl };
    }
}

module.exports = PlaywrightPlugin;
