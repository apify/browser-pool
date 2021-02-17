const rimraf = require('rimraf');
const BrowserPlugin = require('../abstract-classes/browser-plugin');
const PlaywrightController = require('../browser-controllers/playwright-controller');
const { USER_DATA_DIR_PREFIX } = require('../constants');
const log = require('../logger');

/**
 * playwright
 */
class PlaywrightPlugin extends BrowserPlugin {
    /**
     * @param {LaunchContext} launchContext
     * @return {Promise<Browser>}
     * @private
     */
    async _launch(launchContext) {
        const {
            launchOptions,
            anonymizedProxyUrl,
            useIncognitoPages,
            userDataDir,
        } = launchContext;
        let browser;

        if (useIncognitoPages) {
            browser = await this.library.launch(launchOptions);
        } else {
            browser = await this.library.launchPersistentContext(userDataDir, launchOptions);
        }
        // @TODO: Rework the disconnected events once the browser context vs browser issue is fixed
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
     * @return {PlaywrightController}
     * @private
     */
    _createController() {
        return new PlaywrightController(this);
    }

    /**
     *
     * @param {LaunchContext} launchContext
     * @return {Promise<void>}
     * @private
     */
    async _addProxyToLaunchOptions(launchContext) {
        const { launchOptions, proxyUrl } = launchContext;

        if (this._shouldAnonymizeProxy(proxyUrl)) {
            const anonymizedProxyUrl = await this._getAnonymizedProxyUrl(proxyUrl);
            launchContext.anonymizedProxyUrl = anonymizedProxyUrl;
            launchOptions.proxy = { server: anonymizedProxyUrl };
            return;
        }

        launchOptions.proxy = { server: proxyUrl };
    }
}

module.exports = PlaywrightPlugin;
