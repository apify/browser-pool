const proxyChain = require('proxy-chain');

const BrowserPlugin = require('../interfaces/browser-plugin');
const PlaywrightController = require('../browser-controllers/playwright-controller');

class PlaywrightPlugin extends BrowserPlugin {
    async _launch(finalLaunchOptions) {
        const { apifyInternalProxyUrl } = finalLaunchOptions;
        const browser = await this.library.launch(finalLaunchOptions);
        return new PlaywrightController({ browser, proxyUrl: apifyInternalProxyUrl, browserPlugin: this });
    }

    async _addProxyToLaunchOptions(proxyUrl, options) {
        options.proxy = { server: await proxyChain.anonymizeProxy(proxyUrl) };
    }
}

module.exports = PlaywrightPlugin;
