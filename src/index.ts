import BrowserPool, {
    BrowserPoolOptions,
    BrowserPoolNewPageOptions,
    BrowserPoolPostLaunchHook,
    BrowserPoolPostPageCloseHook,
    BrowserPoolPostPageCreateHook,
    BrowserPoolPreLaunchHook,
    BrowserPoolPrePageCloseHook,
    BrowserPoolPrePageCreateHook,
} from './browser-pool';
import BrowserPlugin, { BrowserPluginOptions, Browser } from './abstract-classes/browser-plugin';
import BrowserController, { BrowserControllerCookie } from './abstract-classes/browser-controller';
import PuppeteerPlugin from './puppeteer/puppeteer-plugin';
import PlaywrightPlugin, { PlaywrightLaunchContext } from './playwright/playwright-plugin';

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
 */
export {
    Browser,
    BrowserPool,
    BrowserPlugin,
    BrowserController,
    BrowserPoolOptions,
    BrowserPluginOptions,
    BrowserPoolNewPageOptions,
    BrowserPoolPostLaunchHook,
    BrowserPoolPostPageCloseHook,
    BrowserPoolPostPageCreateHook,
    BrowserPoolPreLaunchHook,
    BrowserPoolPrePageCloseHook,
    BrowserPoolPrePageCreateHook,
    BrowserControllerCookie,
    PlaywrightPlugin,
    PlaywrightLaunchContext,
    PuppeteerPlugin,
};
