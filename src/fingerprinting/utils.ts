import { PlaywrightPlugin, PuppeteerPlugin } from '..';
import { BrowserPlugin } from '../abstract-classes/browser-plugin';
import { LaunchContext } from '../launch-context';
import { BrowserName, DeviceCategory, FingerprintGeneratorOptions, OperatingSystemsName } from './types';

export const getGeneratorDefaultOptions = (launchContext: LaunchContext): FingerprintGeneratorOptions => {
    const { browserPlugin, launchOptions } = launchContext;

    const options = {
        devices: [DeviceCategory.desktop],
        locales: ['en-US'],
        browsers: [getBrowserName(browserPlugin, launchOptions)],
        operatingSystems: [getOperatingSystem()],
    };

    return options;
};

export const mergeArgsToHideWebdriver = (originalArgs: string[]): string[] => {
    if (originalArgs && originalArgs.length) {
        const argumentIndex = originalArgs.findIndex((arg: string) => arg.startsWith('--disable-blink-features='));
        const hasArgument = argumentIndex !== -1;

        if (hasArgument) {
            const arg = originalArgs[argumentIndex];
            // Append our argument.
            originalArgs[argumentIndex] = `${arg},AutomationControlled`;
        } else {
            originalArgs.push('--disable-blink-features=AutomationControlled');
        }

        return originalArgs;
    }

    return ['--disable-blink-features=AutomationControlled'];
};

const getBrowserName = (browserPlugin: BrowserPlugin, launchOptions: any): BrowserName => {
    const { library } = browserPlugin;
    let browserName;

    if (browserPlugin instanceof PlaywrightPlugin) {
        browserName = library.name!();
    } if (browserPlugin instanceof PuppeteerPlugin) {
        browserName = launchOptions.product || library.product;
    }

    switch (browserName) {
        case 'webkit':
            return BrowserName.safari;
        case 'firefox':
            return BrowserName.firefox;
        default:
            return BrowserName.chrome;
    }
};

const getOperatingSystem = (): OperatingSystemsName => {
    const { platform } = process;

    switch (platform) {
        case 'win32':
            // platform is win32 even for 64-bit
            return OperatingSystemsName.windows;
        case 'darwin':
            return OperatingSystemsName.macos;
        default:
            // consider everything else a linux
            return OperatingSystemsName.linux;
    }
};
