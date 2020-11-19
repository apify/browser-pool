const BrowserPlugin = require('../abstract-classes/browser-plugin');
const PlaywrightController = require('../browser-controllers/playwright-controller');
const { BROWSER_CONTROLLER_EVENTS: { BROWSER_TERMINATED } } = require('../events');

class PlaywrightPlugin extends BrowserPlugin {
    /**
     *
     * @param finalLaunchOptions {object}
     * @return {Promise<PlaywrightController>}
     * @private
     */
    async _launch(finalLaunchOptions) {
        let proxyUrl;
        const browser = await this.library.launch(finalLaunchOptions);

        if (this.isProxyUsed()) {
            proxyUrl = await this._parseProxyFromLaunchOptions(finalLaunchOptions);
        }

        const playwrightController = new PlaywrightController({ browser, proxyUrl: this.anonymizedProxyToOriginal[proxyUrl], browserPlugin: this });

        if (proxyUrl) {
            playwrightController.once(BROWSER_TERMINATED, () => { // Maybe we can set this event inside the controller in the constructor?
                this._closeAnonymizedProxy(proxyUrl); // Nothing to do here really.
            });
        }

        return playwrightController;
    }

    /**
     *
     * @param proxyUrl {string}
     * @param options {object}
     * @return {Promise<void>}
     * @private
     */
    async _addProxyToLaunchOptions(proxyUrl, options) {
        options.proxy = { server: await this._getAnonymizedProxyUrl() };
    }

    /**
     *
     * @param finalLaunchOptions {object}
     * @return {Promise<string|StringChain|_.LodashReplace1x2|void|*>}
     * @private
     */
    async _parseProxyFromLaunchOptions(finalLaunchOptions) {
        return finalLaunchOptions.proxy.server;
    }
}

module.exports = PlaywrightPlugin;
