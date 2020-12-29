const BrowserPlugin = require('../abstract-classes/browser-plugin');
const PuppeteerController = require('../browser-controllers/puppeteer-controller');
const { BROWSER_CONTROLLER_EVENTS: { BROWSER_TERMINATED } } = require('../events');

const PROXY_SERVER_ARG = '--proxy-server=';

class PuppeteerPlugin extends BrowserPlugin {
    /**
     *
     * @param launchContext {object}
     * @return {Promise<PuppeteerController>}
     * @private
     */
    async _launch(launchContext) {
        const { launchOptions, anonymizedProxyUrl } = launchContext;
        const browser = await this.library.launch(launchOptions);

        const puppeteerController = new PuppeteerController({
            browser,
            launchContext,
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
