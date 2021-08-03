const _ = require('lodash');
const { BrowserPlugin } = require('../abstract-classes/browser-plugin');
const PlaywrightController = require('./playwright-controller');
const Browser = require('./browser');

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
        const {
            launchOptions,
            anonymizedProxyUrl,
            useIncognitoPages,
            userDataDir,
        } = launchContext;
        let browser;

        if (useIncognitoPages) {
            browser = await this.library.launch(launchOptions);
        } else {
            const browserContext = await this.library.launchPersistentContext(userDataDir, launchOptions);

            if (!this._browserVersion) {
                // Launches unused browser just to get the browser version.

                const inactiveBrowser = await this.library.launch(launchOptions);
                this._browserVersion = inactiveBrowser.version();

                inactiveBrowser.close().catch(_.noop);
            }

            browser = new Browser({ browserContext, version: this._browserVersion });
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
