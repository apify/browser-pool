import { Fingerprint } from 'fingerprint-injector';
import QuickLRU from 'quick-lru';

export default class FingerprintToProxyCache {
    // eslint-disable-next-line @typescript-eslint/ban-types
    cache: QuickLRU<string, Fingerprint>;

    constructor({ maxSize = 1000 }: {maxSize: number}) {
        this.cache = new QuickLRU({ maxSize }); ;
    }

    // eslint-disable-next-line @typescript-eslint/ban-types
    get(proxyUrl: string): Fingerprint | undefined {
        return this.cache.get(proxyUrl);
    }

    has(proxyUrl: string): boolean {
        return this.cache.has(proxyUrl);
    }

    set(proxyUrl: string, fingerprint: Fingerprint): void {
        this.cache.set(proxyUrl, fingerprint);
    }
}
