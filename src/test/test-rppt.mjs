'use strict'
import Rpp from '../rpp-lib.mjs'
//import dedent from 'dedent'
import stream from 'stream'
import util from 'util'

const RppTransform = Rpp.Transform

class Workaround extends stream.Writable {
  // for https://github.com/nodejs/node/issues/26550 
  constructor() {
    super()
  }
  _write(chunk, enc, callback) {
    process.stdout.write(chunk)
    callback(null)
  }
  _final(callback) {
    process.stdout.write('Workaround _final was called\n')
    callback(null)
  }
}

async function testOne(inData, expectErr=false) {
  //let rppt = new ReversiblePreprocTransform()
  let readable = new stream.PassThrough()

  let p = util.promisify(stream.pipeline)(
    readable,
    new RppTransform(),
    //process.stdout,
    new Workaround(),
    // (err) => {
    //   if (err){
    //     console.log('FAILURE')
    //     console.log(err)
    //   }
    //   else
    //     console.log('SUCCESS')
    // }
  )
  readable.write(inData)
  //readable.write(Buffer.from(inData, 'utf-8'))
  readable.end()
  let wasErr=false
  await p.catch((e) => {
    //console.log('FAILURE')
    wasErr=true
    console.log(e)
  })
  if (wasErr===expectErr){
    console.log('SUCCESS')
    return true
  } else {
    console.log('FAILURE')
    return false
  }
}

async function test() {
  if (! await testOne('abc \r\n abc\r\n//--xyz \n xyz\n pqr ', true)){
    process.exitCode=1
    return
  }
  if (! await testOne('abc \r\n abc\r\nxyz \n xyz\n pqr ')){
    process.exitCode=1
    return
  }
}
test()

