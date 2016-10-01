"use strict";
const tape = require('tape-async');
function test(filename, name, fn) {
    const mainModule = process.mainModule;
    if (mainModule && mainModule.filename === filename) {
        tape(name, fn);
    }
}
exports.test = test;
//# sourceMappingURL=test.js.map