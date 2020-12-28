const _ = require('lodash');
const proxyChain = require('proxy-chain');
const BrowserControllerContext = require('../browser-controller-context');
const { throwImplementationNeeded } = require('./utils');

class BrowserPlugin {
    /**
     *
     * @param library {object}
     * @param options {object}
     * @param options.launchOptions {object}
     */
    constructor(library, options = {}) {
        const {
            launchOptions = {},
        } = options;

        this.name = this.constructor.name;
        this.library = library;
        this.launchOptions = launchOptions;
    }

    /**
     * Clones and returns the launchOptions with context.
     * @param options {object} user provided options to include in the context.
     * @return {object}
     */
    createLaunchContext(options) {
        const pluginLaunchOptions = _.cloneDeep(this.launchOptions);

        const launchContext = {
            pluginLaunchOptions,
            ...options,
        };

        return launchContext;
    }

    /**
     *
     *
     * @param launchContext {object}
     * @return {Promise<BrowserController>}
     */
    async launch(launchContext) {
        if (launchContext.proxyUrl) {
            this._addProxyToLaunchOptions(launchContext);
        }

        return this._launch(launchContext);
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
     * @param launchContext {launchContext}
     * @return {Promise<BrowserController>}
     * @private
     */
    async _launch(launchContext) { // eslint-disable-line
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

    async _defaultCreateContextFunction() { // eslint-disable-line no-unused-vars
        return new BrowserControllerContext({ proxyUrl: this.proxyUrl });
    }
}

module.exports = BrowserPlugin;
