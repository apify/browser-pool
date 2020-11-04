const path = require('path');

module.exports = {
    testEnvironment: 'node',
    verbose: true,
    rootDir: path.join(__dirname, './'),
    testTimeout: 30000,
    testMatch: ['**/?(*.)+(spec|test).[tj]s?(x)'],
};
