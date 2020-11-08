const _ = require('lodash');
const proxyChain = require('proxy-chain');
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
            createProxyUrlFunction,
            proxyUrl,
        } = options;

        this.name = this.constructor.name;
        this.library = library;
        this.launchOptions = launchOptions;
        // proxy options
        this.createProxyUrlFunction = createProxyUrlFunction;
        this.proxyUrl = proxyUrl;

        // internal proxy info
        this.anonymizedProxyToOriginal = new Map();
    }

    /**
     * Clones and returns the launchOptions
     * @return {Promise<object>}
     */
    async createLaunchOptions() {
        const launchOptions = _.cloneDeep(this.launchOptions);

        if (this.isProxyUsed()) {
            const proxyUrl = await this._getProxyUrl();
            await this._addProxyToLaunchOptions(proxyUrl, launchOptions);
        }

        return launchOptions;
    }

    /**
     *
     * @param finalLaunchOptions {Object}
     * @return {Promise<BrowserController>}
     */
    async launch(finalLaunchOptions) {
        return this._launch(finalLaunchOptions);
    }

    /**
     *
     * @param proxyUrl {string}
     * @param options {object}
     * @return {Promise<void>}
     * @private
     */
    async _addProxyToLaunchOptions(proxyUrl, options) { // eslint-disable-line
        throwImplementationNeeded('_addProxyToLaunchOptions');
    }

    /**
     *
     * @param finalLaunchOptions {object}
     * @return {Promise<void>}
     * @private
     */
    async _launch(finalLaunchOptions) { // eslint-disable-line
        throwImplementationNeeded('_launch');
    }

    /**
     *
     * @return {Promise<string>}
     * @private
     */
    async _getProxyUrl() {
        if (this.proxyUrl) {
            return this.proxyUrl;
        }

        return this.createProxyUrlFunction(this);
    }

    /**
     *
     * @return {boolean}
     */
    isProxyUsed() {
        return Boolean(this.proxyUrl || this.createProxyUrlFunction);
    }

    /**
     * Starts proxy-chain server - https://www.npmjs.com/package/proxy-chain#anonymizeproxyproxyurl-callback
     * @return {Promise<string>} - URL of the anonymization proxy server that needs to be closed after the proxy is not used anymore.
     */
    async _getAnonymizedProxyUrl() {
        const proxyUrl = await this._getProxyUrl();
        const anonymizedProxyUrl = await proxyChain.anonymizeProxy(proxyUrl);
        this.anonymizedProxyToOriginal[anonymizedProxyUrl] = proxyUrl;

        return anonymizedProxyUrl;
    }

    /**
     *
     * @param proxyUrl {string}
     * @return {Promise<any>}
     * @private
     */
    async _closeAnonymizedProxy(proxyUrl) {
        delete this.anonymizedProxyToOriginal[proxyUrl];
        return proxyChain.closeAnonymizedProxy(proxyUrl, true).catch(); // Nothing to do here really.
    }
}

module.exports = BrowserPlugin;
