function throwImplementationNeeded(methodName) {
    throw new Error(`You need to implement method ${methodName}.`);
}

module.exports = {
    throwImplementationNeeded,
};
