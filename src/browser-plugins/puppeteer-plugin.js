const rimraf = require('rimraf');
const BrowserPlugin = require('../abstract-classes/browser-plugin');
const PuppeteerController = require('../browser-controllers/puppeteer-controller');
const log = require('../logger');

const { USER_DATA_DIR_PREFIX } = require('../constants');

const PROXY_SERVER_ARG = '--proxy-server=';

/**
 * puppeteer
 */
class PuppeteerPlugin extends BrowserPlugin {
    /**
     * @param {LaunchContext} launchContext
     * @return {Promise<Browser>}
     * @private
     */
    async _launch(launchContext) {
        const {
            launchOptions,
            anonymizedProxyUrl,
            userDataDir,
            useIncognitoPages,
        } = launchContext;

        const finalLaunchOptions = {
            ...launchOptions,
            userDataDir: launchOptions.userDataDir || userDataDir,
        };

        const browser = await this.library.launch(finalLaunchOptions);

        if (anonymizedProxyUrl) {
            browser.once('disconnected', () => {
                this._closeAnonymizedProxy(anonymizedProxyUrl);
            });
        }

        const shouldRemoveRandomTempDir = !useIncognitoPages && userDataDir.includes(USER_DATA_DIR_PREFIX);

        if (shouldRemoveRandomTempDir) {
            browser.once('disconnected', () => {
                rimraf(userDataDir, (error) => {
                    log.debug('Could not delete browser userDataDir after browser disconected', { error });
                });
            });
        }
        return browser;
    }

    /**
     * @return {PuppeteerController}
     * @private
     */
    _createController() {
        return new PuppeteerController(this);
    }

    /**
     *
     * @param launchContext {object}
     * @return {Promise<void>}
     * @private
     */
    async _addProxyToLaunchOptions(launchContext) {
        const { launchOptions, proxyUrl } = launchContext;
        let finalProxyUrl = proxyUrl;

        if (this._shouldAnonymizeProxy(proxyUrl)) {
            finalProxyUrl = await this._getAnonymizedProxyUrl(proxyUrl);
            launchContext.anonymizedProxyUrl = finalProxyUrl;
        }

        const proxyArg = `${PROXY_SERVER_ARG}${finalProxyUrl}`;

        if (Array.isArray(launchOptions.args)) {
            launchOptions.args.push(proxyArg);
        } else {
            launchOptions.args = [proxyArg];
        }
    }
}

module.exports = PuppeteerPlugin;
