const BrowserPool = require('./browser-pool');
// eslint-disable-next-line import/extensions
const { PuppeteerPlugin } = require('./puppeteer/puppeteer-plugin');
// eslint-disable-next-line import/extensions
const { PlaywrightPlugin } = require('./playwright/playwright-plugin');

/**
 * The `browser-pool` module exports three constructors. One for `BrowserPool`
 * itself and two for the included Puppeteer and Playwright plugins.
 *
 * **Example:**
 * ```js
 * const {
 *  BrowserPool,
 *  PuppeteerPlugin,
 *  PlaywrightPlugin
 * } = require('browser-pool');
 * const puppeteer = require('puppeteer');
 * const playwright = require('playwright');
 *
 * const browserPool = new BrowserPool({
 *     browserPlugins: [
 *         new PuppeteerPlugin(puppeteer),
 *         new PlaywrightPlugin(playwright.chromium),
 *     ]
 * });
 * ```
 *
 * @property {BrowserPool} BrowserPool
 * @property {PuppeteerPlugin} PuppeteerPlugin
 * @property {PlaywrightPlugin} PlaywrightPlugin
 * @module browser-pool
 */
module.exports = {
    BrowserPool,
    PuppeteerPlugin,
    PlaywrightPlugin,
};
