const fs = require('fs-extra');
const jsdoc2md = require('jsdoc-to-markdown'); // eslint-disable-line
const path = require('path');

const TEMPLATE_PATH = path.join(__dirname, 'README.hbs');
const README_PATH = path.resolve(__dirname, '..', 'README.md');
const SRC_DIR = path.resolve(__dirname, '..', 'src');

const getRenderOptions = (template, data) => ({
    template,
    data,
    'name-format': true,
    separators: true,
    'param-list-format': 'table',
    'property-list-format': 'table',
    'heading-depth': 3,
});

const generateFinalMarkdown = (text) => {
    // Remove 'Kind' annotations.
    return text.replace(/\*\*Kind\*\*.*\n/g, '');
};

const main = async () => {
    const indexData = await jsdoc2md.getTemplateData({
        files: [
            path.join(SRC_DIR, 'index.js'),
            path.join(SRC_DIR, 'apify_api_error.js'),
        ],
    });

    const resourceClientData = await jsdoc2md.getTemplateData({
        files: [
            path.join(SRC_DIR, 'resource_clients/*'),
        ],
    });

    const sortAlphabetically = (a, b) => {
        const nameA = a.id.toLowerCase();
        const nameB = b.id.toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
    };
    resourceClientData.sort(sortAlphabetically);

    let templateData = indexData.concat(resourceClientData);

    const EMPTY = Symbol('empty');
    /* reduce templateData to an array of class names */
    templateData.forEach((identifier) => {
        // @hideconstructor does not work, so we nudge it
        if (identifier.hideconstructor) {
            const idx = templateData.findIndex((i) => i.id === `${identifier.name}()`);
            templateData[idx] = EMPTY;
        }
    });

    templateData = templateData.filter((d) => d !== EMPTY);

    const template = await fs.readFile(TEMPLATE_PATH, 'utf8');
    const output = jsdoc2md.renderSync(getRenderOptions(template, templateData));
    const markdown = generateFinalMarkdown(output);
    await fs.writeFile(README_PATH, markdown);
};

main().then(() => console.log('All docs built successfully.'));
