export const addTimeoutToPromise = <T extends Promise<any>>(promise: T, timeoutMillis: number, errorMessage: string): Promise<T extends Promise<infer U> ? U : any> => {
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
