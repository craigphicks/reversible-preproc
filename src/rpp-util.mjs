'use strict'
import RppBaseError from './prependable-error.mjs'
import fs from 'fs'

export function queryVersion() { return "reversible-preproc 2.0.4" }

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
  _assert(!(obj instanceof Array),
    `obj must not be instance of Array`)
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


export function convertDottedIdentifierStrToArray(str){
  if (!createDottedIdentifierRegex().test(str))
    throw new RppError(`invalid dotted identifier string: ${str}`)
  return str.split('.') 
}

export function forceAssignRHS(obj, keys, rhs){
  _assert(typeof obj === 'object',
    `obj must be type "object" not ${typeof obj}`)
  _assert(!(obj instanceof Array),
    `obj must not be instance of Array`)
  if (typeof keys === 'string')
    keys = convertDottedIdentifierStrToArray(keys)
  if (!keys || ! keys.length) {
    if (!LikelyTrueObject(rhs)) {
      throw new RppError(`cannot assign non-object to top level, ${rhs}`)
    } else {
      Object.assign(obj,rhs)
      return obj
    }
  }
  let parent = obj
  for (let n = 0; n < keys.length - 1; n++) {
    if (!hasOwnKey(parent, keys[n])
      || typeof parent[keys[n]] !== 'object'
      || parent[keys[n]] instanceof Array)
      parent[keys[n]] = {}
    parent = parent[keys[n]]
  }
  if (!LikelyTrueObject(rhs) || !LikelyTrueObject(parent[keys.slice(-1)[0]])) {
    parent[keys.slice(-1)[0]] = rhs
  } else {
    Object.assign(parent[keys.slice(-1)[0]], rhs)
  }
  return obj
}



