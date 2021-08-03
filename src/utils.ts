export function addTimeoutToPromise<T>(promise: Promise<T>, timeoutMillis: number, errorMessage: string): Promise<T> {
    return new Promise(async (resolve, reject) => { // eslint-disable-line
        const timeout = setTimeout(() => reject(new Error(errorMessage)), timeoutMillis);
        try {
            const data = await promise;
            resolve(data);
        } catch (err) {
            reject(err);
        } finally {
            clearTimeout(timeout);
        }
    });
};
