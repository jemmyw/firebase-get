import * as tape from 'tape-async';

export function test(filename:string, name:string, fn:any):void {
  const mainModule = (process as any).mainModule;
  if (mainModule.filename === filename) {
    tape(name, fn)
  }
}
