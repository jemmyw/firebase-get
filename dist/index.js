"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const firebase = require('firebase');
const Inflection = require('inflection');
const Bluebird = require('bluebird');
const ramda_1 = require('ramda');
const test_1 = require('./test');
/**
 * Given an object with a single property return a pair of property and value.
 * @type {(x0:PairObject<any>)=>Array<Array<any>>}
 */
const pair = ramda_1.compose(ramda_1.head, ramda_1.toPairs);
let _app = firebase;
function getDependsOn(value) {
    const t = ramda_1.type(value);
    if (t === 'Object') {
        return getDependsOn(ramda_1.head(ramda_1.values(value)));
    }
    if (t === 'Array') {
        return ramda_1.head(value);
    }
    return null;
}
test_1.test(__filename, 'getDependsOn', function (t) {
    return __awaiter(this, void 0, void 0, function* () {
        t.equal(getDependsOn('whatever'), null, 'strings return null');
        t.equal(getDependsOn(1), null, 'numbers return null');
        t.equal(getDependsOn([3, 2, 1]), 3, 'arrays return head');
        t.equal(getDependsOn({ value: 'whatever' }), null, 'object returns getDependsOn value of first value');
        t.equal(getDependsOn({ value: [4, 5, 6] }), 4, 'object array returns head');
        t.equal(getDependsOn({ value: { value: { value: [6, 7, 8] } } }), 6, 'it goes deep');
    });
});
function resolveDependentValue(value, record) {
    if (ramda_1.type(value) === 'Object') {
        const bv = pair(value);
        return ramda_1.objOf(bv[0], resolveDependentValue(bv[1], record));
    }
    const lens = ramda_1.lensPath(ramda_1.tail(value));
    return ramda_1.view(lens, record);
}
test_1.test(__filename, 'resolveDependentValue', function (t) {
    return __awaiter(this, void 0, void 0, function* () {
        t.equal(resolveDependentValue('test', {}), undefined);
        t.deepEqual(resolveDependentValue([1], {}), {});
        t.equal(resolveDependentValue(['test', 'it'], { test: 'no', no: 'non', it: 'yes' }), 'yes');
        t.equal(resolveDependentValue(['test', 'it', 'out'], { it: { out: 'yes' } }), 'yes');
        t.deepEqual(resolveDependentValue({ something: ['test', 'it'] }, { it: 'yes' }), { something: 'yes' });
    });
});
function snapshotValue(snapshot) {
    return Object.assign({ $key: snapshot.key }, snapshot.val());
}
test_1.test(__filename, 'snapshotValue', function (t) {
    return __awaiter(this, void 0, void 0, function* () {
        t.deepEqual(snapshotValue({ val: () => ({ something: 'true' }), key: 'example' }), {
            $key: 'example',
            something: 'true'
        });
    });
});
function objToRows(obj) {
    return obj && ramda_1.keys(obj).map(key => ramda_1.merge(obj[key], { $key: key })) || [];
}
test_1.test(__filename, 'objToRows', function (t) {
    return __awaiter(this, void 0, void 0, function* () {
        const obj = {
            a: { one: 1, two: 2 },
            b: { three: 3, four: 4 },
            c: { hello: 'there' }
        };
        const rows = objToRows(obj);
        t.equal(rows.length, 3);
        t.deepEqual(rows[0], { $key: 'a', one: 1, two: 2 });
        t.deepEqual(rows[1], { $key: 'b', three: 3, four: 4 });
        t.deepEqual(rows[2], { $key: 'c', hello: 'there' });
        t.deepEqual(objToRows(null), [], 'null becomes empty array');
    });
});
function createPromiseFromString(ref, value) {
    return ref.child(value).once('value')
        .then(snapshotValue);
}
function createOneRecordPromiseFromKV(ref, key, value) {
    return ref.orderByChild(key)
        .equalTo(value)
        .limitToFirst(1)
        .once('value')
        .then(snapshotValue)
        .then(objToRows)
        .then(rows => rows[0]);
}
function createRecordsPromiseFromKV(ref, key, value) {
    return ref.orderByChild(key)
        .equalTo(value)
        .once('value')
        .then(snapshotValue)
        .then(objToRows);
}
function createPromise(spec) {
    const value = spec.value;
    if (ramda_1.not(value)) {
        return Promise.resolve(null);
    }
    const ref = _app.database().ref()
        .child(spec.model);
    if (typeof value === 'string') {
        return createPromiseFromString(ref, value);
    }
    const child = ramda_1.keys(value)[0];
    const childValue = ramda_1.values(value)[0];
    if (spec.isArray) {
        return createRecordsPromiseFromKV(ref, child, childValue);
    }
    else {
        return createOneRecordPromiseFromKV(ref, child, childValue);
    }
}
function createDependentPromises(spec, specs) {
    const dependentSpecs = ramda_1.compose(ramda_1.filter(ramda_1.propEq('dependsOn', spec.key)), ramda_1.values)(specs);
    dependentSpecs.forEach(ds => {
        ds.promise = spec.promise.then(r => {
            const value = resolveDependentValue(ds.value, r);
            return createPromise(ramda_1.merge(ds, { value }));
        });
        createDependentPromises(ds, specs);
    });
}
const createPromises = ramda_1.compose(ramda_1.fromPairs, ramda_1.map(ramda_1.applySpec([ramda_1.prop('key'), ramda_1.prop('promise')])), ramda_1.filter(ramda_1.prop('promise')), ramda_1.values);
const constructInternalSpecs = ramda_1.mapObjIndexed((value, key) => {
    const model = ramda_1.compose(Inflection.pluralize, Inflection.camelize)(key);
    const isArray = ramda_1.type(value) !== 'String' &&
        key === Inflection.pluralize(key);
    const dependsOn = getDependsOn(value);
    const isDeferred = Boolean(dependsOn);
    return {
        key,
        model,
        isArray,
        isDeferred,
        dependsOn,
        value,
    };
});
const noDependencies = ramda_1.compose(ramda_1.filter(ramda_1.complement(ramda_1.prop('dependsOn'))), ramda_1.values);
/**
 * Take a spec and return a bunch of things from firebase. The spec is an
 * object where the key is the name of a root ref, i.e. project, and the value
 * is either a string with the project key OR a key/value pair with the key
 * being the field.
 *
 * If the key is plural then it will resolve an array, otherwise will resolve a
 * single item.
 *
 * @example
 *
 *    const stuff = getStuff(models)({
 *     profile: {uid: '123'},
 *     project: 'abc',
 *     opps: {projectKey: ['project', '$key']}
 *   })
 *    stuff.then(({profile, project, opps}) =>
 *      console.log('profile:', profile, 'project:', project, 'opps:', opps))
 *
 * @param stuff
 * @returns {Promise<FulfilledSpec>}
 */
function Get(app) {
    if (app) {
        _app = app;
    }
    return function get(stuff) {
        const specs = constructInternalSpecs(stuff);
        noDependencies(specs).forEach(spec => {
            spec.promise = createPromise(spec);
            createDependentPromises(spec, specs);
        });
        const promise = Bluebird.props(createPromises(specs));
        return Promise.resolve(promise);
    };
}
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Get;
//# sourceMappingURL=index.js.map