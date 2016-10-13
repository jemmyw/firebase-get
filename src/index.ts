import * as firebase from 'firebase';
import * as Inflection from 'inflection';
import * as Bluebird from 'bluebird';
import {
  applySpec, complement, compose, filter, fromPairs, head, keys, lensPath, map,
  mapObjIndexed, objOf, prop, propEq, tail, type, values, view, toPairs, not,
  merge
} from 'ramda';
import {test} from './test';
import {Test} from 'tape-async';
import Reference = firebase.database.Reference;
import {FirebaseRecord, Spec, FulfilledSpec} from "./types";

type PairObject<T> = {[name:string]:T}
type Pair<T> = [string, T]
/**
 * Given an object with a single property return a pair of property and value.
 * @type {(x0:PairObject<any>)=>Array<Array<any>>}
 */
const pair:<T>(object:PairObject<T>) => Pair<T> =
  compose<PairObject<any>, Array<Array<any>>, Pair<any>>(head, toPairs);

let _app = firebase;

function getDependsOn(value) {
  const t = type(value);

  if (t === 'Object') {
    return getDependsOn(head(values(value)));
  }

  if (t === 'Array') {
    return head(value);
  }

  return null;
}
test(__filename, 'getDependsOn', async function(t:Test) {
  t.equal(getDependsOn('whatever'), null, 'strings return null');
  t.equal(getDependsOn(1), null, 'numbers return null');
  t.equal(getDependsOn([3,2,1]), 3, 'arrays return head');
  t.equal(getDependsOn({value: 'whatever'}), null, 'object returns getDependsOn value of first value');
  t.equal(getDependsOn({value: [4,5,6]}), 4, 'object array returns head');
  t.equal(getDependsOn({value: {value: {value: [6,7,8]}}}), 6, 'it goes deep');
});

function resolveDependentValue(value:any, record:Object) {
  if (type(value) === 'Object') {
    const bv = pair(value);
    return objOf(bv[0], resolveDependentValue(bv[1], record));
  }

  const lens = lensPath(tail<string>(value));
  return view(lens, record);
}
test(__filename, 'resolveDependentValue', async function(t:Test) {
  t.equal(resolveDependentValue('test', {}), undefined);
  t.deepEqual(resolveDependentValue([1], {}), {});
  t.equal(resolveDependentValue(['test', 'it'], {test: 'no', no: 'non', it: 'yes'}), 'yes');
  t.equal(resolveDependentValue(['test', 'it', 'out'], {it: {out: 'yes'}}), 'yes');
  t.deepEqual(resolveDependentValue({something: ['test', 'it']}, {it: 'yes'}), {something: 'yes'});
});

function snapshotValue(snapshot):FirebaseRecord {
  return Object.assign({$key: snapshot.key}, snapshot.val());
}
test(__filename, 'snapshotValue', async function(t:Test) {
  t.deepEqual(snapshotValue({val: () => ({something:'true'}), key: 'example'}), {
    $key: 'example',
    something: 'true'
  });
});

function objToRows(obj:any): FirebaseRecord[] {
  return obj && keys(obj).map(key => merge(obj[key], {$key: key})) || [];
}
test(__filename, 'objToRows', async function(t:Test) {
  const obj = {
    a: {one: 1, two: 2},
    b: {three: 3, four: 4},
    c: {hello: 'there'}
  };

  const rows = objToRows(obj);
  t.equal(rows.length, 3);
  t.deepEqual(rows[0], {$key: 'a', one: 1, two: 2});
  t.deepEqual(rows[1], {$key: 'b', three: 3, four: 4});
  t.deepEqual(rows[2], {$key: 'c', hello: 'there'});

  t.deepEqual(objToRows(null), [], 'null becomes empty array');
});

function createPromiseFromString(ref:Reference, value:string) {
  return ref.child(value).once('value')
    .then(snapshotValue) as Promise<FirebaseRecord>;
}

function createOneRecordPromiseFromKV(ref:Reference, key:string, value:any):Promise<FirebaseRecord> {
  return ref.orderByChild(key)
    .equalTo(value)
    .limitToFirst(1)
    .once('value')
    .then(snapshotValue)
    .then(objToRows)
    .then(rows => rows[0]) as Promise<FirebaseRecord>;
}

function createRecordsPromiseFromKV(ref:Reference, key:string, value:string) {
  return ref.orderByChild(key)
    .equalTo(value)
    .once('value')
    .then(snapshotValue)
    .then(objToRows) as Promise<FirebaseRecord[]>;
}

function createPromise(spec):Promise<FirebaseRecord | FirebaseRecord[]> {
  const value = spec.value;
  if (not(value)) { return Promise.resolve(null); }

  const ref:Reference = _app.database().ref()
    .child(spec.model);

  if (typeof value === 'string') {
    return createPromiseFromString(ref, value);
  }

  const child = keys(value)[0];
  const childValue = values(value)[0] as any;

  if (spec.isArray) {
    return createRecordsPromiseFromKV(ref, child, childValue);
  } else {
    return createOneRecordPromiseFromKV(ref, child, childValue);
  }
}

function createDependentPromises(spec, specs) {
  const dependentSpecs = compose(filter(propEq('dependsOn', spec.key)), values)(specs);

  dependentSpecs.forEach(ds => {
    ds.promise = spec.promise.then(r => {
      const value = resolveDependentValue(ds.value, r);
      return createPromise(merge(ds, {value}));
    });

    createDependentPromises(ds, specs);
  });
}

const createPromises = compose(
  fromPairs,
  map(applySpec([prop('key'), prop('promise')])),
  filter(prop('promise')),
  values,
);

interface InternalSpec {
  key:string;
  model:string;
  isArray:boolean;
  isDeferred:boolean;
  dependsOn:string[];
  value:any;
  promise?:Promise<any>
}
interface InternalSpecs {
  [name:string]:InternalSpec;
}

const constructInternalSpecs = mapObjIndexed<any, InternalSpec>((value, key) => {
  const model = compose(
    Inflection.pluralize,
    Inflection.camelize
  )(key);

  const isArray = type(value) !== 'String' &&
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

const noDependencies = compose<InternalSpecs, InternalSpec[], InternalSpec[]>(
  filter(complement(prop('dependsOn'))),
  values
);

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
export default function Get(app?:any) {
  if (app) { _app = app; }

  return function get(stuff: Spec): Promise<FulfilledSpec> {
    const specs: InternalSpecs = constructInternalSpecs(stuff);

    noDependencies(specs).forEach(spec => {
      spec.promise = createPromise(spec);
      createDependentPromises(spec, specs);
    });

    const promise = Bluebird.props(createPromises(specs));
    return Promise.resolve(promise) as Promise<FulfilledSpec>;
  }
}
