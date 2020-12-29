const _ = require('lodash');
const proxyChain = require('proxy-chain');
const LaunchContext = require('../launch_context');
const log = require('../logger');
const { throwImplementationNeeded } = require('./utils');

class BrowserPlugin {
    /**
     * @param {object} library
     * @param {object} [options]
     * @param {object} [options.launchOptions]
     * @param {string} [options.proxyUrl]
     */
    constructor(library, options = {}) {
        const {
            launchOptions = {},
            proxyUrl,
        } = options;

        this.name = this.constructor.name;
        this.library = library;
        this.launchOptions = launchOptions;
        this.proxyUrl = proxyUrl && new URL(proxyUrl).href;
    }

    /**
     * Creates a `LaunchContext` with all the information needed
     * to launch a browser. Aside from library specific launch options,
     * it also includes internal properties used by `BrowserPool` for
     * management of the pool and extra features.
     *
     * @param {object} [options]
     * @param {string} [options.id]
     * @param {object} [options.launchOptions]
     * @param {string} [options.proxyUrl]
     * @return {LaunchContext}
     */
    createLaunchContext(options = {}) {
        const {
            id,
            launchOptions = {},
            proxyUrl = this.proxyUrl,
        } = options;

        return new LaunchContext({
            id,
            launchOptions: _.merge({}, this.launchOptions, launchOptions),
            browserPlugin: this,
            proxyUrl,
        });
    }

    /**
     * Launches the browser using provided launch context.
     *
     * @param {LaunchContext} launchContext
     * @return {Promise<BrowserController>}
     */
    async launch(launchContext) {
        if (launchContext.proxyUrl) {
            await this._addProxyToLaunchOptions(launchContext);
        }

        return this._launch(launchContext);
    }

    /**
     * @param {LaunchContext} launchContext
     * @return {Promise<void>}
     * @private
     */
    async _addProxyToLaunchOptions(launchContext) { // eslint-disable-line
        throwImplementationNeeded('_addProxyToLaunchOptions');
    }

    /**
     * @param {LaunchContext} launchContext
     * @return {Promise<BrowserController>}
     * @private
     */
    async _launch(launchContext) { // eslint-disable-line
        throwImplementationNeeded('_launch');
    }

    /**
     * Starts proxy-chain server - https://www.npmjs.com/package/proxy-chain#anonymizeproxyproxyurl-callback
     * @param {string} proxyUrl
     *  Proxy URL with username and password.
     * @return {Promise<string>}
     *  URL of the anonymization proxy server that needs to be closed after the proxy is not used anymore.
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
     * @param {string} proxyUrl
     *  Anonymized proxy URL of a running proxy server.
     * @return {Promise<any>}
     * @private
     */
    async _closeAnonymizedProxy(proxyUrl) {
        return proxyChain.closeAnonymizedProxy(proxyUrl, true).catch((err) => {
            log.debug(`Could not close anonymized proxy server.\nCause:${err.message}`);
        });
    }
}

module.exports = BrowserPlugin;
