exports.getAllMethodNames = (obj) => {
    const methods = new Set();
    while (obj = Reflect.getPrototypeOf(obj)) { // eslint-disable-line
        const keys = Reflect.ownKeys(obj);
        keys.forEach((k) => methods.add(k));
    }
    return methods;
};
