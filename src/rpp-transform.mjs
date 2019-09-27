'use strict'
import stream from 'stream'
import string_decoder from 'string_decoder'
import { RppCore } from './rpp-core.mjs'

class RpptError extends Error {
  constructor(m) {
    super(m)
  }
}

class RppTransform extends stream.Transform {
  constructor(rppInstOrOpt, streamOptions) {
    super(streamOptions)
    this.decoder = new string_decoder.StringDecoder('utf8')
    this.remChunk = null
    this.reNonWS = RegExp("[^ \\t]")
    this.reEOL = RegExp('\\n')
    if (rppInstOrOpt instanceof RppCore) {
      this.rpp = rppInstOrOpt
    }
    else {
      this.rpp = new RppCore(rppInstOrOpt)
    }

  }
  _assert(cond, msg) {
    if (!cond)
      throw new RpptError(msg ? msg : 'assert fail')
  }
  rppLine(line, wsOff) {
    // testing
    //this.push("[[" + line.slice(0,wsOff) + "]]")
    //this.push(line.slice(wsOff) + "<<EOL>>\n")
    // TODO add functionality to rpp so that wsOff is used; (optimize)
    // eslint-disable-next-line no-unused-vars
    let [err, _] = this.rpp.line(line, this.push.bind(this), null, wsOff)
    return err
  }
  _transform(chunk, enc, callback) {
    if (enc === 'buffer') {
      chunk = this.decoder.write(chunk)
    }
    if (this.remChunk) {
      chunk = this.remChunk + chunk
      this.remChunk = null
    }
    let idx0 = 0
    let err
    // eslint-disable-next-line no-constant-condition
    while (true) {
      let wsOff = chunk.slice(idx0).search(this.reNonWS)
      if (wsOff === -1) {
        // no EOL, odd end of chunk, set remainder and break
        this.remChunk = chunk.slice(idx0)
        break
      }
      let len = chunk.slice(idx0 + wsOff).search(this.reEOL)
      if (len === -1) {
        // no EOL, odd end of chunk, set remainder and break
        this.remChunk = chunk.slice(idx0)
        break
      } else {
        let next = idx0 + wsOff + len + 1
        if (len > 0 && chunk.slice(idx0 + wsOff)[len - 1] === '\r')
          len--
        err = this.rppLine(chunk.slice(idx0, idx0 + wsOff + len), wsOff)
        if (err)
          break
        idx0 = next
      }
    }
    callback(err, null)
  }

  _flush(callback) {
    let err = null
    if (this.remChunk) {
      let wsOff = this.remChunk.search(this.reNonWS)
      err = this.rppLine(this.remChunk, wsOff)
    }
    callback(err, null)
  }
}

export { RppTransform, RppCore }

// the following alias class should eventually be deleted
// export default class ReversiblePreproc extends RppCore {
//   constructor(...args) { super(...args) }
// }

