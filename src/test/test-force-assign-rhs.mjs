'use strict'

import assert from 'assert'
//import fs from 'fs'
import Rpp from '../rpp-lib.mjs'

const far = Rpp.forceAssignRHS
function main() {
  assert.deepStrictEqual(
    far({ a: { c: "C" } }, null, { a: "A" }),
    { a: "A" }
  )
  assert.deepStrictEqual(
    far({ a: { c: "C" } }, 'a.b', 'B'),
    {a:{b:'B',c:'C'}}
  )
  assert.deepStrictEqual(
    far({ a: { c: "C" } }, 'a.c', {d:'D'}),
    {a:{c:{d:'D'}}}
  )
  assert.deepStrictEqual(
    far({ a: { b: "B",x:"X" } }, 'a.b.c', {d:'D'}),
    {a:{x:"X", b:{c:{d:'D'}}}}
  )
  console.log('test forceAssignRHS SUCCESS')
}
main()