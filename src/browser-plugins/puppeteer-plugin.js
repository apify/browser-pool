const proxyChain = require('proxy-chain');

const BrowserPlugin = require('../interfaces/browser-plugin');
const PuppeteerController = require('../browser-controllers/puppeteer-controller');

const PROXY_SERVER_ARG = '--proxy-server=';

class PuppeteerPlugin extends BrowserPlugin {
    /**
     *
     * @param finalLaunchOptions {object}
     * @return {Promise<PuppeteerController>}
     * @private
     */
    async _launch(finalLaunchOptions) {
        let proxyUrl;
        const browser = await this.library.launch(finalLaunchOptions);

        if (this.isProxyUsed()) {
            proxyUrl = await this._parseProxyFromLaunchOptions(finalLaunchOptions);

            browser.once('disconnected', () => {
                console.log('CLOSING!!');
                proxyChain.closeAnonymizedProxy(proxyUrl, true).catch(); // Nothing to do here really.
            });
        }

        return new PuppeteerController({ browser, proxyUrl, browserPlugin: this });
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

    /**
     * Starts proxy-chain server - https://www.npmjs.com/package/proxy-chain#anonymizeproxyproxyurl-callback
     * @return {Promise<string>} - URL of the anonymization proxy server that needs to be closed after the proxy is not used anymore.
     */
    _getAnonymizedProxyUrl() {
        const proxyUrl = this._getProxyUrl();
        return proxyChain.anonymizeProxy(proxyUrl);
    }
}

module.exports = PuppeteerPlugin;
