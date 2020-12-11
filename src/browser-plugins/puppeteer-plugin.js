const BrowserPlugin = require('../abstract-classes/browser-plugin');
const PuppeteerController = require('../browser-controllers/puppeteer-controller');
const { BROWSER_CONTROLLER_EVENTS: { BROWSER_TERMINATED } } = require('../events');

const PROXY_SERVER_ARG = '--proxy-server=';

class PuppeteerPlugin extends BrowserPlugin {
    /**
     *
     * @param browserControllerContext {BrowserControllerContext}
     * @return {Promise<PuppeteerController>}
     * @private
     */
    async _launch(browserControllerContext) {
        const { pluginLaunchOptions, proxyUrl, anonymizedProxyUrl, ...rest } = browserControllerContext;
        const browser = await this.library.launch(pluginLaunchOptions);

        const puppeteerController = new PuppeteerController({
            browser,
            browserPlugin: this,
            proxyUrl,
            anonymizedProxyUrl,
            ...rest,
        });

        if (anonymizedProxyUrl) {
            puppeteerController.once(BROWSER_TERMINATED, () => { // Maybe we can set this event inside the controller in the constructor?
                this._closeAnonymizedProxy(anonymizedProxyUrl); // Nothing to do here really.
            });
        }

        return puppeteerController;
    }

    /**
     *
     * @param browserControllerContext {BrowserControllerContext}
     * @return {Promise<void>}
     * @private
     */
    async _addProxyToLaunchOptions(browserControllerContext) {
        const { pluginLaunchOptions, proxyUrl } = browserControllerContext;
        const newProxyUrl = await this._getAnonymizedProxyUrl(proxyUrl);
        browserControllerContext.anonymizedProxyUrl = newProxyUrl;

        const proxyArg = `${PROXY_SERVER_ARG}${newProxyUrl}`;

        if (Array.isArray(pluginLaunchOptions.args)) {
            pluginLaunchOptions.args.push(proxyArg);
        } else {
            pluginLaunchOptions.args = [proxyArg];
        }
    }
}

module.exports = PuppeteerPlugin;
