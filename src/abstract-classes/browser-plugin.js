const _ = require('lodash');
const proxyChain = require('proxy-chain');
const BrowserControllerContext = require('./browser-controlller-context');
const { throwImplementationNeeded } = require('./utils');

class BrowserPlugin {
    /**
     *
     * @param library {object}
     * @param options {object}
     */
    constructor(library, options = {}) {
        const {
            launchOptions = {},
            // IMHO - createBrowserControllerContextFunction is a little bit too much :)
            createContextFunction = this._defaultCreateContextFunction,
            proxyUrl,
        } = options;

        this.name = this.constructor.name;
        this.library = library;
        this.launchOptions = launchOptions;
        this.createContextFunction = createContextFunction;
        this.proxyUrl = proxyUrl;
    }

    /**
     * Clones and returns the launchOptions
     * @return {Promise<BrowserControllerContext>}
     */
    async createBrowserControllerContext() {
        const pluginLaunchOptions = _.cloneDeep(this.launchOptions);

        const browserControllerContext = await this.createContextFunction(pluginLaunchOptions, this);

        if (!(browserControllerContext instanceof BrowserControllerContext)) {
            throw new Error('"createContextFunction" must return instance of "BrowserControllerContext"');
        }

        if (browserControllerContext.isProxyUsed()) {
            await this._addProxyToLaunchOptions(browserControllerContext);
        }

        return browserControllerContext;
    }

    /**
     *
     *
     * @param browserControllerContext {BrowserControllerContext}
     * @return {Promise<BrowserController>}
     */
    async launch(browserControllerContext) {
        return this._launch(browserControllerContext);
    }

    /**
     *
     * @param browserControllerContext {BrowserControllerContext}
     * @return {Promise<void>}
     * @private
     */
    async _addProxyToLaunchOptions(browserControllerContext) { // eslint-disable-line
        throwImplementationNeeded('_addProxyToLaunchOptions');
    }

    /**
     *
     * @param browserControllerContext {BrowserControllerContext}
     * @return {Promise<BrowserController>}
     * @private
     */
    async _launch(browserControllerContext) { // eslint-disable-line
        throwImplementationNeeded('_launch');
    }

    /**
     * Starts proxy-chain server - https://www.npmjs.com/package/proxy-chain#anonymizeproxyproxyurl-callback
     * @param proxyUrl {String} - proxy url with username and password;
     * @return {Promise<string>} - URL of the anonymization proxy server that needs to be closed after the proxy is not used anymore.
     */
    async _getAnonymizedProxyUrl(proxyUrl) {
        let anonymizedProxyUrl;

        try {
            anonymizedProxyUrl = await proxyChain.anonymizeProxy(proxyUrl);
        } catch (e) {
            throw new Error(`BrowserPool: Could not anonymize proxyUrl: ${proxyUrl}. Reason: ${e.message}.`);
        }

        return anonymizedProxyUrl;
    }

    /**
     *
     * @param proxyUrl {string} - anonymized proxy url.
     * @return {Promise<any>}
     * @private
     */
    async _closeAnonymizedProxy(proxyUrl) {
        return proxyChain.closeAnonymizedProxy(proxyUrl, true).catch(); // Nothing to do here really.
    }

    async _defaultCreateContextFunction(pluginLaunchOptions, plugin) {
        return new BrowserControllerContext({ pluginLaunchOptions, proxyUrl: this.proxyUrl });
    }
}

module.exports = BrowserPlugin;
