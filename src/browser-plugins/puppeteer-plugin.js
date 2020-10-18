const proxyChain = require('proxy-chain');

const BrowserPlugin = require('../interfaces/browser-plugin');
const PuppeteerController = require('../browser-controllers/puppeteer-controller');

class PuppeteerPlugin extends BrowserPlugin {
    async _launch(finalLaunchOptions) {
        const { apifyInternalProxyUrl } = finalLaunchOptions;
        const browser = await this.library.launch(finalLaunchOptions);
        return new PuppeteerController({ browser, proxyUrl: apifyInternalProxyUrl, browserPlugin: this });
    }

    async _addProxyToLaunchOptions(proxyUrl, options) {
        const newProxyUrl = await proxyChain.anonymizeProxy(proxyUrl);
        const proxyArg = `--proxy-server=${newProxyUrl}`;

        if (Array.isArray(options.args)) {
            options.args.push(proxyArg);
        } else {
            options.args = [proxyArg];
        }
    }
}

module.exports = PuppeteerPlugin;
