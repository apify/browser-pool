const BrowserPlugin = require('../abstract-classes/browser-plugin');
const PlaywrightController = require('../browser-controllers/playwright-controller');
const { BROWSER_CONTROLLER_EVENTS: { BROWSER_TERMINATED } } = require('../events');

class PlaywrightPlugin extends BrowserPlugin {
    /**
     *
     * @param launchContext {object}
     * @return {Promise<PlaywrightController>}
     * @private
     */
    async _launch(launchContext) {
        const { pluginLaunchOptions, proxyUrl, anonymizedProxyUrl } = launchContext;
        const browser = await this.library.launch(pluginLaunchOptions);

        const playwrightController = new PlaywrightController({
            browser,
            proxyUrl,
            anonymizedProxyUrl,
            launchContext,
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
     * @param launchContext {object}
     * @return {Promise<void>}
     * @private
     */
    async _addProxyToLaunchOptions(launchContext) {
        const { pluginLaunchOptions, proxyUrl } = launchContext;
        const anonymizedProxyUrl = await this._getAnonymizedProxyUrl(proxyUrl);
        launchContext.anonymizedProxyUrl = anonymizedProxyUrl;

        pluginLaunchOptions.proxy = { server: anonymizedProxyUrl };
    }
}

module.exports = PlaywrightPlugin;
