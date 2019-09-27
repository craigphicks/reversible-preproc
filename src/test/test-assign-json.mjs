'use strict'

import assert /*, { deepStrictEqual }*/ from 'assert'
import fs from 'fs'
import Rpp from '../rpp-lib.mjs'

const AssignJson = Rpp.AssignJson

function main() {
  const defines = {}
  AssignJson.FromRaw(defines, "foobar", '"test"')
  AssignJson.FromRaw(defines, null, '{"barfoo":1}')
  assert.ok(defines.foobar === 'test')
  assert.ok(defines.barfoo === 1)

  const filename = '/tmp/tmp.json'
  fs.writeFileSync(filename, '{"barfoo":2}')
  AssignJson.FromFile(defines, null, filename)
  fs.unlinkSync(filename)
  assert.ok(defines.barfoo === 2)

  //process.env['barfoo'] = 3
  // seems not possible to pass in plain integer values to env from codejs launch.json
  assert.ok(process.env['barfoo']==='3')
  AssignJson.FromEnv(defines, null) // key automatically set to 'env'
  AssignJson.FromEnv(defines, 'processEnv')
  assert.ok(defines.env.barfoo === '3')
  assert.ok(defines.processEnv.barfoo === '3')

  console.log("test-assign-json SUCCESS")
}
main()