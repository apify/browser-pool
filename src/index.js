const BrowserPool = require('./browser-pool');

const PuppeteerPlugin = require('./browser-plugins/puppeteer-plugin');
const PlaywrightPlugin = require('./browser-plugins/playwright-plugin');

const BrowserController = require('./interfaces/browser-controller');
const BrowserPlugin = require('./interfaces/browser-plugin');

module.exports = {
    BrowserPool,
    PuppeteerPlugin,
    PlaywrightPlugin,
    BrowserController,
    BrowserPlugin,
};
