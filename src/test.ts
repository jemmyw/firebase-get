export function test(filename:string, name:string, fn:any):void {
  const mainModule = (process as any).mainModule;
  if (mainModule && mainModule.filename === filename) {
    const tape = require('tape-async');
    tape(name, fn)
  }
}
