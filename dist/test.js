"use strict";
function test(filename, name, fn) {
    const mainModule = process.mainModule;
    if (mainModule && mainModule.filename === filename) {
        const tape = require('tape-async');
        tape(name, fn);
    }
}
exports.test = test;
//# sourceMappingURL=test.js.map