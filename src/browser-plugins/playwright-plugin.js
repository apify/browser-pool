const proxyChain = require('proxy-chain');

const BrowserPlugin = require('../interfaces/browser-plugin');
const PlaywrightController = require('../browser-controllers/playwright-controller');

class PlaywrightPlugin extends BrowserPlugin {
    async _launch(finalLaunchOptions) {
        const browser = await this.library.launch(finalLaunchOptions);
        return new PlaywrightController({ browser });
    }

    async _addProxyToLaunchOptions(proxyUrl, options) {
        options.proxy = { server: await proxyChain.anonymizeProxy(proxyUrl) };
    }
}

module.exports = PlaywrightPlugin;
