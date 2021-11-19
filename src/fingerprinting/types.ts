import { Fingerprint } from 'fingerprint-injector';

export interface FingerprintGenerator {
    getFingerprint: (fingerprintGeneratorOptions?: FingerprintGeneratorOptions) => GetFingerprintReturn;
}

export type GetFingerprintReturn = {
    fingerprint: Fingerprint;
}

export type FingerprintGeneratorOptions = {
    browsers?: BrowserName[] | BrowserSpecification[];
    operatingSystems?: OperatingSystemsName[];
    devices?: DeviceCategory[];
    locales?: string[];

}

export enum BrowserName {
    chrome = 'chrome',
    firefox = 'firefox',
    safari = 'safari',
}

type BrowserSpecification = {
    name: BrowserName;
    minVersion?: number;
    maxVersion?: number;
}

export enum OperatingSystemsName {
    linux = 'linux',
    macos = 'macos',
    windows = 'windows',
}

export enum DeviceCategory {
    mobile = 'mobile',
    desktop = 'desktop',
}
