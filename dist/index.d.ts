import { Spec, FulfilledSpec } from "./types";
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
export declare function get(stuff: Spec): Promise<FulfilledSpec>;
