const path = require('path');

module.exports = {
    testEnvironment: 'node',
    verbose: true,
    rootDir: path.join(__dirname, './'),
    testTimeout: 300000,
    testMatch: ['**/?(*.)+(spec|test).[tj]s?(x)'],
};
