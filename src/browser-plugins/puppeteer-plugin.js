const BrowserPlugin = require('../interfaces/browser-plugin');
const PuppeteerController = require('../browser-controllers/puppeteer-controller');
const { BROWSER_CONTROLLER_EVENTS: { BROWSER_TERMINATED } } = require('../events');

const PROXY_SERVER_ARG = '--proxy-server=';

class PuppeteerPlugin extends BrowserPlugin {
    /**
     *
     * @param finalLaunchOptions {object}
     * @return {Promise<PuppeteerController>}
     * @private
     */
    async _launch(finalLaunchOptions = {}) {
        let proxyUrl;
        const browser = await this.library.launch(finalLaunchOptions);

        if (this.isProxyUsed()) {
            proxyUrl = await this._parseProxyFromLaunchOptions(finalLaunchOptions);
        }

        const puppeteerController = new PuppeteerController({ browser, proxyUrl, browserPlugin: this });

        if (proxyUrl) {
            puppeteerController.once(BROWSER_TERMINATED, () => { // Maybe we can set this event inside the controller in the constructor?
                this._closeAnonymizedProxy(proxyUrl); // Nothing to do here really.
            });
        }

        return puppeteerController;
    }

    /**
     *
     * @param proxyUrl {string}
     * @param options {object}
     * @return {Promise<void>}
     * @private
     */
    async _addProxyToLaunchOptions(proxyUrl, options) {
        const newProxyUrl = await this._getAnonymizedProxyUrl();
        const proxyArg = `${PROXY_SERVER_ARG}${newProxyUrl}`;

        if (Array.isArray(options.args)) {
            options.args.push(proxyArg);
        } else {
            options.args = [proxyArg];
        }
    }

    /**
     *
     * @param finalLaunchOptions {object}
     * @return {Promise<string|StringChain|_.LodashReplace1x2|void|*>}
     * @private
     */
    async _parseProxyFromLaunchOptions(finalLaunchOptions) {
        const proxyServerArg = finalLaunchOptions.args.find((arg) => arg.includes(PROXY_SERVER_ARG));

        return proxyServerArg.replace(PROXY_SERVER_ARG, '');
    }
}

module.exports = PuppeteerPlugin;
