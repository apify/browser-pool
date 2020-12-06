const BrowserPool = require('./browser-pool');
const BrowserControllerContext = require('./browser-controlller-context');

const PuppeteerPlugin = require('./browser-plugins/puppeteer-plugin');
const PlaywrightPlugin = require('./browser-plugins/playwright-plugin');

const BrowserController = require('./abstract-classes/browser-controller');
const BrowserPlugin = require('./abstract-classes/browser-plugin');

module.exports = {
    BrowserPool,
    BrowserControllerContext,

    PuppeteerPlugin,
    PlaywrightPlugin,

    BrowserController,
    BrowserPlugin,
};
