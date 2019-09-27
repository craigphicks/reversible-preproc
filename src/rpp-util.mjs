'use strict'
import RppBaseError from './prependable-error.mjs'
import fs from 'fs'

export function queryVersion() { return "reversible-preproc 2.0.3" }

export class RppError extends RppBaseError {
  constructor(...params) {
    super(...params)
  }
}

// _assert with an underbar 
export function _assert(cond, msg) {
  if (!cond)
    throw new RppError(msg ? msg : 'assertion failed')
}

export function hasOwnKey(obj, key) {
  return Reflect.getOwnPropertyDescriptor(obj, key) !== undefined
}

export function createDottedIdentifierRegex() {
  const core = "[$A-Za-z_][0-9A-Za-z_$]*"
  return RegExp(`^${core}(.${core})*`)
}

export function forcePropertyValue(obj, keys, value) {
  _assert(keys && keys.length > 0, 'keys null or empty')
  _assert(typeof obj === 'object',
    `obj must be type "object" not ${typeof obj}`)
  let parent = obj
  for (let n = 0; n < keys.length - 1; n++) {
    if (!hasOwnKey(parent, keys[n])
      || typeof parent[keys[n]] !== 'object'
      || parent[keys[n]] instanceof Array)
      parent[keys[n]] = {}
    parent = parent[keys[n]]
  }
  parent[keys.slice(-1)] = value
}

// function lookupPropertyValue(obj, keys) {
//   _assert(keys && keys.length > 0, 'keys null or empty')
//   let parent = obj
//   for (let n = 0; n < keys.length; n++) {
//     _assert(typeof parent === 'object',
//       `must be type "object" not ${typeof parent}`)
//     _assert(hasOwnKey(parent, keys[n], `key ${keys[n]} not present`))
//     parent = parent[keys[n]]
//   }
//   return parent
// }

function LikelyTrueObject(obj) {
  return (typeof obj === 'object'
    && !(obj instanceof Array))
}

const symAssignJsonFile = Symbol("AssignJsonFile")
const symAssignJsonRaw = Symbol("AssignJsonRaw")
const symAssignJsonEnv = Symbol("AssignJsonEnv")

function _AssignJson(object, keyname, string, sym) {
  if (typeof keyname !== 'string') {
    _assert(keyname === undefined || keyname === null,
      `expecting non-string keyname to be undefined or null, ${keyname}`)
  }
  let raw, props
  if (sym === symAssignJsonFile)
    raw = fs.readFileSync(string)
  else if (sym === symAssignJsonRaw)
    raw = string
  else if (sym === symAssignJsonEnv){
    props = process.env
    if (!keyname)
      keyname='env'
  }
  else
    throw Error("programmer error")

  if (sym !== symAssignJsonEnv)
    props = JSON.parse(raw)

  if (!LikelyTrueObject(props)) {
    if (keyname) {
      object[keyname] = props
    } else {
      throw Error(`cannot assign non-object to top level, ${props}`)
    }
  } else {
    if (!keyname) {
      Object.assign(object, props)
    } else if (!LikelyTrueObject(object[keyname])) {
      object[keyname] = props
    } else {
      Object.assign(object[keyname], props)
    }
  }
} // _AssignJson

export class AssignJson {
  constructor() { }
  static symFile() { return symAssignJsonFile }
  static symRaw() { return symAssignJsonRaw }
  static symEnv() { return symAssignJsonEnv }
  static FromAny(object, keyname, string, sym) {
    _AssignJson(object, keyname, string, sym)
  }
  static FromFile(object, keyname, string) {
    _AssignJson(object, keyname, string, symAssignJsonFile)
  }
  static FromRaw(object, keyname, string) {
    _AssignJson(object, keyname, string, symAssignJsonRaw)
  }
  static FromEnv(object, keyname) {
    _AssignJson(object, keyname, null, symAssignJsonEnv)
  }
}

