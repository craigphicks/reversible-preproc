'use strict'

// import ReversiblePreproc from 'lib/index'
// import split2 from 'split2'
// import through2 from 'through2'
// import fs from 'fs'
// import events from 'events'

//ReversiblePreproc = require('lib/index')
const RppCore = require('../lib/rpp-core.js')
var split2 = require('split2')
var through2 = require('through2')
var fs = require('fs')
var events = require('events')


async function PreProc(rpp, readable, writable) {
  function throughLineFunc(line, enc, callback, This) {
    function pushLine(line) {
      if (line)
        This.push(line)
    }
    let [err, _dummy] = rpp.line(line, pushLine)
    callback(err, null)
  }
  await events.once(
    readable
      .pipe(split2('\n'))
      .pipe(through2.obj(function (line, enc, callback) {
        throughLineFunc(line, enc, callback, this)
      }))
      .pipe(writable),'finish')
}

let rawdata = fs.readFileSync("./test/data/defines.demo0.json")
let defJson = JSON.parse(rawdata)
let rpp = new RppCore(defJson)
let readable = fs.createReadStream("./test/data/in.demo0.json")
//let writable = fs.createWriteStream(argv.outfile)
let writable = process.stdout
PreProc(rpp, readable, writable)
