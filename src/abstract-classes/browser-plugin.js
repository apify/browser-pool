const fs = require('fs-extra');
const _ = require('lodash');
const proxyChain = require('proxy-chain');
const LaunchContext = require('../launch-context');
const log = require('../logger');
const { throwImplementationNeeded } = require('./utils');

/**
 * The `BrowserPlugin` serves two purposes. First, it is the base class that
 * specialized controllers like `PuppeteerPlugin` or `PlaywrightPlugin` extend.
 * Second, it allows the user to configure the automation libraries and
 * feed them to {@link BrowserPool} for use.
 */
class BrowserPlugin {
    /**
     * @param {object} library
     *  Each plugin expects an instance of the object with the `.launch()` property.
     *  For Puppeteer, it is the `puppeteer` module itself, whereas for Playwright
     *  it is one of the browser types, such as `puppeteer.chromium`.
     *  `BrowserPlugin` does not include the library. You can choose any version
     *  or fork of the library. It also keeps `browser-pool` installation small.
     * @param {object} [options]
     * @param {object} [options.launchOptions]
     *  Options that will be passed down to the automation library. E.g.
     *  `puppeteer.launch(launchOptions);`. This is a good place to set
     *  options that you want to apply as defaults. To dynamically override
     *  those options per-browser, see the `preLaunchHooks` of {@link BrowserPool}.
     * @param {string} [options.proxyUrl]
     *  Automation libraries configure proxies differently. This helper allows you
     *  to set a proxy URL without worrying about specific implementations.
     *  It also allows you use an authenticated proxy without extra code.
     * @property {boolean} [useIncognitoPages=false]
     *  By default pages share the same browser context.
     *  If set to true each page uses its own context that is destroyed once the page is closed or crashes.
     * @property {object} [userDataDir]
     *  Path to a User Data Directory, which stores browser session data like cookies and local storage.
     */
    constructor(library, options = {}) {
        const {
            launchOptions = {},
            proxyUrl,
            useIncognitoPages = false,
            userDataDir,
        } = options;

        this.name = this.constructor.name;
        this.library = library;
        this.launchOptions = launchOptions;
        this.proxyUrl = proxyUrl && new URL(proxyUrl).href;
        this.userDataDir = userDataDir;
        this.useIncognitoPages = useIncognitoPages;
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
     * @property {boolean} [useIncognitoPages]
     *  If set to false pages use share the same browser context.
     *  If set to true each page uses its own context that is destroyed once the page is closed or crashes.
     * @property {object} [userDataDir]
     *  Path to a User Data Directory, which stores browser session data like cookies and local storage.
     * @return {LaunchContext}
     * @ignore
     */
    createLaunchContext(options = {}) {
        const {
            id,
            launchOptions = {},
            proxyUrl = this.proxyUrl,
            useIncognitoPages = this.useIncognitoPages,
            userDataDir = this.userDataDir,
        } = options;

        return new LaunchContext({
            id,
            launchOptions: _.merge({}, this.launchOptions, launchOptions),
            browserPlugin: this,
            proxyUrl,
            useIncognitoPages,
            userDataDir,
        });
    }

    /**
     * @return {BrowserController}
     * @ignore
     */
    createController() {
        return this._createController();
    }

    /**
     * Launches the browser using provided launch context.
     *
     * @param {LaunchContext} [launchContext]
     * @return {Promise<Browser>}
     * @ignore
     */
    async launch(launchContext = this.createLaunchContext()) {
        const { proxyUrl, useIncognitoPages, userDataDir } = launchContext;

        if (proxyUrl) {
            await this._addProxyToLaunchOptions(launchContext);
        }

        if (!useIncognitoPages) {
            await this._ensureDir(userDataDir);
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
     * @return {Promise<Browser>}
     * @private
     */
    async _launch(launchContext) { // eslint-disable-line
        throwImplementationNeeded('_launch');
    }

    /**
     * @return {BrowserController}
     * @private
     */
    _createController() {
        throwImplementationNeeded('_createController');
    }

    /**
     * Starts proxy-chain server - https://www.npmjs.com/package/proxy-chain#anonymizeproxyproxyurl-callback
     * @param {string} proxyUrl
     *  Proxy URL with username and password.
     * @return {Promise<string>}
     *  URL of the anonymization proxy server that needs to be closed after the proxy is not used anymore.
     * @private
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

    /**
     * Checks if proxy URL should be anonymized.
     * @param {string} proxyUrl
     * @return {boolean}
     * @private
     */
    _shouldAnonymizeProxy(proxyUrl) {
        const parsedProxyUrl = proxyChain.parseUrl(proxyUrl);
        if (parsedProxyUrl.username || parsedProxyUrl.password) {
            if (parsedProxyUrl.scheme !== 'http') {
                throw new Error('Invalid "proxyUrl" option: authentication is only supported for HTTP proxy type.');
            }
            return true;
        }

        return false;
    }

    /**
     *
     * @param {string} dir - Absolute path to the directory.
     * @returns {Promise<void>}
     */
    async _ensureDir(dir) {
        return fs.ensureDir(dir);
    }
}

module.exports = BrowserPlugin;
