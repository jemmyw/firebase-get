export declare type SpecValue = string | number | boolean | Array<string>;
export interface ByChildSpec {
    [propName: string]: SpecValue;
}
export interface Spec {
    [propName: string]: SpecValue | ByChildSpec;
}
export interface FirebaseRecord {
    $key: string;
    [key: string]: any;
}
export interface FulfilledSpec {
    [propName: string]: any | any[];
}
