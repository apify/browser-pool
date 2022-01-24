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
 * @module browser-pool
 */
export * from './browser-pool';
export * from './playwright/playwright-plugin';
export * from './puppeteer/puppeteer-plugin';
export * from './events';
export {
    BrowserName,
    DeviceCategory,
    OperatingSystemsName,
} from './fingerprinting/types';

// Type exports
export type {
    BrowserController,
    BrowserControllerEvents,
    Cookie,
} from './abstract-classes/browser-controller';
export type {
    CommonPage,
    BrowserPlugin,
    BrowserPluginOptions,
    CreateLaunchContextOptions,
} from './abstract-classes/browser-plugin';
export type {
    LaunchContext,
    LaunchContextOptions,
} from './launch-context';
export type {
    BrowserSpecification,
    FingerprintGenerator,
    FingerprintGeneratorOptions,
    GetFingerprintReturn,
} from './fingerprinting/types';
export type { InferBrowserPluginArray } from './utils';
