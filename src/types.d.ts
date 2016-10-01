declare namespace FirebaseGet {
  export type SpecValue = string | number | boolean | Array<string>

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
    [propName: string]: null | FirebaseRecord | FirebaseRecord[]
  }
}

declare module "firebase-get" {
  import Spec = FirebaseGet.Spec;
  import FulfilledSpec = FirebaseGet.FulfilledSpec;
  let get:(spec:Spec) => Promise<FulfilledSpec>;
  export = get;
}