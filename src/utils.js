const addTimeoutToPromise = (promise, timeoutMillis, errorMessage) => {
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

module.exports = {
    addTimeoutToPromise,
};
