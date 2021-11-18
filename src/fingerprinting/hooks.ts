import { FingerprintInjector } from 'fingerprint-injector';
import { BrowserPool, PlaywrightPlugin, PuppeteerPlugin } from '..';
import { BrowserController } from '../abstract-classes/browser-controller';
import { LaunchContext } from '../launch-context';
import { getGeneratorDefaultOptions } from './utils';

export const createFingerprintPreLaunchHook = (browserPool: BrowserPool<any,any,any,any,any>) => {
    const {
        fingerprintGenerator,
        fingerprintCache,
        fingerprintsOptions: {
            fingerprintGeneratorOptions,
        },
    } = browserPool;

    return (_pageId: string, launchContext: LaunchContext) => {
        const { useIncognitoPages, launchOptions, proxyUrl } = launchContext;
        // If no options are passed we try to pass best default options as possible to match browser and OS.
        const fingerprintGeneratorFinalOptions = fingerprintGeneratorOptions || getGeneratorDefaultOptions(launchContext);
        let fingerprint;

        if (proxyUrl && fingerprintCache?.has(proxyUrl)) {
            fingerprint = fingerprintCache.get(proxyUrl);
        } else if (proxyUrl) {
            fingerprint = fingerprintGenerator.getFingerprint(fingerprintGeneratorFinalOptions).fingerprint;
            fingerprintCache?.set(proxyUrl, fingerprint);
        } else {
            fingerprint = fingerprintGenerator.getFingerprint(fingerprintGeneratorFinalOptions).fingerprint;
        }

        launchContext.extend({ fingerprint });

        if (useIncognitoPages) {
            return;
        }
        const { userAgent, screen } = fingerprint;
        // @ts-expect-error I have no idea why I cannot assign property to unknown object.
        launchOptions.userAgent = userAgent;
        // @ts-expect-error Same as above.
        launchOptions.viewport = {
            width: screen.width,
            height: screen.height,
        };
    };
};

export const createPrePageCreateHook = () => {
    return (_pageId: string, browserController: BrowserController, pageOptions: any): void => {
        const { launchContext, browserPlugin } = browserController;
        const fingerprint = launchContext.fingerprint!;

        if (launchContext.useIncognitoPages && browserPlugin instanceof PlaywrightPlugin && pageOptions) {
            pageOptions.userAgent = fingerprint.userAgent;
            pageOptions.viewport = {
                width: fingerprint.screen.width,
                height: fingerprint.screen.height,
            };
        }
    };
};

export const createPostPageCreateHook = (fingerprintInjector: FingerprintInjector) => {
    return async (page: any, browserController: BrowserController): Promise<void> => {
        const { browserPlugin, launchContext } = browserController;
        const fingerprint = launchContext.fingerprint!;

        if (browserPlugin instanceof PlaywrightPlugin) {
            const { useIncognitoPages, isFingerprintInjected } = launchContext;

            if (isFingerprintInjected) {
                // If not incognitoPages are used we would add the injection script over and over which could cause memory leaks.
                return;
            }

            const context = page.context();
            await fingerprintInjector.attachFingerprintToPlaywright(context, fingerprint);

            if (!useIncognitoPages) {
                // There is only one context
                // We would add the injection script over and over which could cause memory/cpu leaks.
                launchContext.extend({ isFingerprintInjected: true });
            }
        } else if (browserPlugin instanceof PuppeteerPlugin) {
            await fingerprintInjector.attachFingerprintToPuppeteer(page, fingerprint);
        }
    };
};
