const BrowserPlugin = require('../abstract-classes/browser-plugin');
const PlaywrightController = require('../browser-controllers/playwright-controller');
const { BROWSER_CONTROLLER_EVENTS: { BROWSER_TERMINATED } } = require('../events');

class PlaywrightPlugin extends BrowserPlugin {
    /**
     *
     * @param browserControllerContext {BrowserControllerContext}
     * @return {Promise<PlaywrightController>}
     * @private
     */
    async _launch(browserControllerContext) {
        const { pluginLaunchOptions, proxyUrl, anonymizedProxyUrl, ...rest } = browserControllerContext;
        const browser = await this.library.launch(pluginLaunchOptions);

        const playwrightController = new PlaywrightController({
            browser,
            browserPlugin: this,
            proxyUrl,
            anonymizedProxyUrl,
            ...rest,
        });

        if (anonymizedProxyUrl) {
            playwrightController.once(BROWSER_TERMINATED, () => { // Maybe we can set this event inside the controller in the constructor?
                this._closeAnonymizedProxy(anonymizedProxyUrl); // Nothing to do here really.
            });
        }

        return playwrightController;
    }

    /**
     *
     * @param browserControllerContext {BrowserControllerContext}
     * @return {Promise<void>}
     * @private
     */
    async _addProxyToLaunchOptions(browserControllerContext) {
        const { pluginLaunchOptions, proxyUrl } = browserControllerContext;
        const anonymizedProxyUrl = await this._getAnonymizedProxyUrl(proxyUrl);
        browserControllerContext.anonymizedProxyUrl = anonymizedProxyUrl;

        pluginLaunchOptions.proxy = { server: anonymizedProxyUrl };
    }
}

module.exports = PlaywrightPlugin;
