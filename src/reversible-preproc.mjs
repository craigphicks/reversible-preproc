'use strict'

import JsepPreprocInterpret from './jsep-preproc-interpret.mjs'
import RppBaseError from './prependable-error.mjs'
import Mustache from 'mustache'
//import dedent from 'dedent'
//import jsep from 'jsep'
//import { AssertionError } from 'assert';

function queryVersion() { return "reversible-preproc 2.0.3" }

// globally disable all Mustache escaping 
Mustache.escape = function (text) { return text }

class RppError extends RppBaseError {
  constructor(...params) {
    super(...params)
  }
}

// _assert with an underbar 
function _assert(cond, msg) {
  if (!cond)
    throw new RppError(msg ? msg : 'assertion failed')
}


function hasOwnKey(obj, key) {
  return Reflect.getOwnPropertyDescriptor(obj, key) !== undefined
}

// function deepCopyViaJson(obj) {
//   let copy = JSON.stringify(obj)
//   return JSON.parse(copy)
// }

//const identifierRegex = /^[[$A-Z_][0-9A-Z_$]*/i
function createIdentifierRegex() {
  const core = "[$A-Z_][0-9A-Z_$]*"
  return RegExp(`^${core}(.${core})*`, 'i')
}

function matchNextIdentifier(line) {
  let reres = /[^ \t]+/.exec(line)
  if (!reres)
    throw new RppError('no possible identifier found')
  let reValid = createIdentifierRegex()
  if (!reValid.test(reres[0]))
    throw new RppError(`found invalid identifier ${reres[0]}`)
  // parse into array
  let keys = reres[0].split('.')
  return { identifier: reres[0], index: reres.index, keys: keys }
}

function forcePropertyValue(obj, keys, value) {
  _assert(keys && keys.length > 0, 'keys null or empty')
  _assert(typeof obj === 'object',
    `obj must be type "object" not ${typeof obj}`)
  let parent = obj
  for (let n = 0; n < keys.length - 1; n++) {
    if (!hasOwnKey(parent, keys[n]))
      parent[keys[n]] = {}
    else
      _assert(typeof parent[keys[n]] === 'object',
        `expecting typeof to be "object" but was ${typeof parent[keys[n]]}`)
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

var defaultOptions = {
  testMode: false, // cmd start lines only prepended by true or false
  debugOutput: false,
  eol: '\n',
  // 1.x.x obsolete
  //  commentMark: '//',
  //  reversibleCommentIndicator: '!!',
  // 2.x.x
  // cmdStemMulti(StartEnd) used for 
  // 
  cmdStemMultiStart: '/*--',
  cmdStemMultiEnd: '--end*/',
  cmdStem: '//--',
  cmdAddDef: 'addDef',
  cmdAddDefJson: 'addDefJson',
  cmdAddDefEval: 'addDefEval',
  cmdIf: 'if',
  cmdIfEval: 'ifEval',
  cmdElse: 'else',
  cmdElif: 'elif',
  cmdElifEval: 'elifEval',
  cmdEndif: 'endif',
  cmdMacro: 'macro',
  cmdTpl: 'tpl',
  cmdRender: 'render',
  cmdPartials: 'partials',
  // cmdTplRender: 'tplRender', // in a single line
  // cmdIfTplRender: 'ifTplRender', // in a single line
  annPlain: 'plain',
  annRendered: 'rendered',
  annEndRendered: 'endRendered',
  annStem: '//!!',
}

const reservedIdentifiers = [
  'true', 'false', 'null', 'undefined', 'def', 'ndef', 'EOL'
]

//const symMultiIn = Symbol('multiIn')
//const symMultiInEnd = Symbol('multiInEnd')

const symCmdAddDef = Symbol('cmdAddDef')
const symCmdAddDefJson = Symbol('cmdAddDefJson')
const symCmdAddDefEval = Symbol('cmdAddDefEval')
const symCmdIf = Symbol('cmdIf')
const symCmdIfEval = Symbol('cmdIfEval')
const symCmdElse = Symbol('cmdElse')
const symCmdElif = Symbol('cmdElif')
const symCmdElifEval = Symbol('cmdElifEval')
const symCmdEndif = Symbol('cmdEndif')
// const symCmdMacro = Symbol('cmdMacro')
const symCmdTpl = Symbol('cmdTpl')
const symCmdPartials = Symbol('cmdPartials')
const symCmdRender = Symbol('cmdRender')
// const symCmdTplRender = Symbol('cmdTplRender')
// const symCmdIfTplRender = Symbol('cmdIfTplRender')

const symAnnPlain = Symbol('annPlain')
const symAnnRendered = Symbol('annRendered')
const symAnnEndRendered = Symbol('annEndRendered')

// function makeNonCryptoRandomAlphaNumString(length) {
//   function tf(n) {
//     if (n < 26) return 65 + n
//     else if (n < 52) return 97 + n - 26
//     else return 48 + n - 52
//   }
//   var result = ''
//   for (var i = 0; i < length; i++) {
//     let idx = Math.floor(Math.random() * 62)
//     result += String.fromCharCode(tf(idx))
//   }
//   return result
// }

function isSubstrEqual(line, offset, str) {
  return line.substr(offset, str.length) === str
}


function judgeLineArg(str, defines, jsepPreprocInterpret) {
  // if (definesJson === '*') // this overrides and (and prevents calling of) any eval functions
  //   return [true, null]
  if (jsepPreprocInterpret === null) {
    try {
      //
      // str is taken as the body of the function
      // in which "defines" refers to the RversiblePreproc 'defines' object.
      let body = '"use strict"\n' + str
      let f = new Function('defines', body)
      let res = f(defines) ? true : false
      return [res, null]
    }
    catch (e) {
      return [
        false,
        new RppError(
          `failed to eval IfEval condition: `, e)
      ]
    }
  }
  // else if (str[0] === ':') {
  //   // TODO - DELETE THIS case 
  //   // semicolon indicates to start a function to be eval'd
  //   // the form is
  //   // :(<variableName>)=>(<body>) and it be eval'd as a function
  //   // ((<variableName>)=>(<body>))(<preproc jsonDefines>)
  //   // where the preprocess json set up at program start will be passed as
  //   // the argument to the function
  //   try {
  //     var fnstr = `(${str.slice(1)})(${JSON.stringify(defines)})`
  //     return [eval(fnstr), null]
  //   }
  //   catch (e) {
  //     return [
  //       false,
  //       new RppError(`function string ${fnstr} in ${str} could not be eval'd: `, e)
  //     ]
  //   }
  // } 
  else {
    // TODO jsepPreprocInterpret.lineScript(str) called from here.
    try { return [jsepPreprocInterpret.execLineScript(str), null] }
    catch (e) {
      return [
        false,
        new RppError(
          `jsepPreprocInterpret failed on script :: ${str} :: `, e)
      ]
    }
  }
}

function createIfState(params) {
  return {
    else: false,
    onAncestor: params.onAncestor, // set by parameter
    onClauseFound: false, // within the current level of if,elif,...  
    on: params.on, // set by parameter 
    //onLinum: -1,
    ifLinum: -1
  }
}

class ReversiblePreproc {
  constructor(defines = {}, options = defaultOptions) {
    for (let k of Reflect.ownKeys(defaultOptions))
      if (!Reflect.ownKeys(options).includes(k))
        options[k] = defaultOptions[k]
    this.options = options
    {
      if (typeof definesJson === 'object') {
        if (defines instanceof Array)
          throw new RppError("top level defined object cannot be an Array")
        for (let k of Reflect.ownKeys(defines)) {
          if (reservedIdentifiers.includes(k)) {
            throw new RppError(`${k} is a reserved Identifier, cannot use it in top level defines`)
          }
        }
      }
      this.defines = defines
    }
    //this.defines.EOL = options.eol
    this.jsepPreprocInterpret = new JsepPreprocInterpret(defines)
    this.linum = -1
    this.parseState = {
      linum: 0, // line number of the input file (count starts at 1)
      ifState: createIfState({ on: true, onAncestor: true }),
      //      ifOnLinum: -1, // the input line number of current innermost if block start
      //      ifOn: false, // currently in an if blocks (possibly multiple)
      ifStack: [], // stack for nested if blocks [ ..., [<startline>,<true/false>],...] 
      renderedOn: false, // currently in an annotated rendered region, (will be cleared, maybe rerendered) 
      tplStringArr: [], // cmd-tpl lines are accumulated until cmd-render is encountered, thenoutput 
      tplStr: null,
      tplPartials: {},
      multiLineIn: {
        cmdSym: null,
        lines: []
      }
    }
    Object.seal(this.parseState)
    Object.seal(this.parseState.ifState)
    this.cmdsSorted = [
      [options.cmdAddDef, symCmdAddDef],
      [options.cmdAddDefJson, symCmdAddDefJson],
      [options.cmdAddDefEval, symCmdAddDefEval],
      [options.cmdIf, symCmdIf],
      [options.cmdIfEval, symCmdIfEval],
      [options.cmdElif, symCmdElif],
      [options.cmdElifEval, symCmdElifEval],
      [options.cmdElse, symCmdElse],
      [options.cmdEndif, symCmdEndif],
      // [options.cmdMacro, symCmdMacro],
      [options.cmdTpl, symCmdTpl],
      [options.cmdPartials, symCmdPartials],
      [options.cmdRender, symCmdRender],
      // [options.cmdTplRender, symCmdTplRender],
      // [options.cmdIfTplRender, symCmdIfTplRender],
    ]
    this.annsSorted = [
      [options.annPlain, symAnnPlain],
      [options.annRendered, symAnnRendered],
      [options.annEndRendered, symAnnEndRendered],
    ]
    this.cmdsSorted.sort((a, b) => {
      return (a[0].length < b[0].length) ? 1 :
        (a[0].length > b[0].length) ? -1 : 0
    })
    this.annsSorted.sort((a, b) => {
      return (a[0].length < b[0].length) ? 1 :
        (a[0].length > b[0].length) ? -1 : 0
    })
    Object.seal(this)
  }
  // static _parseMacroArgs(margs,defines) {
  //   // each partial prop has sub props :
  //   // value: type string or type array 
  //   // flags: "", "d", or "ad"    
  //   let argDataArr = []
  //   let reres = /[^ \t]/.exec(margs)
  //   if (reres) {
  //     let delim = reres[0][0]
  //     let arr = margs.substr(reres.index+1).split(delim)
  //     let n = 0
  //     for (let arg of arr) {
  //       //let flagres = /^( |d |ad |da )/.exec(arg)
  //       let flags = ''
  //       let flagres = /^[^ /t]*/.exec(arr)
  //       if (flagres) {
  //         _assert(/^[ad]*$/.test(flagres[0]))
  //         _assert(flagres[0].length < arg.length + 1,
  //           `malformed arg ${arg}`)
  //         flags = flagres[0]
  //         arg = arg.slice(flagres[0].length)
  //       }
  //       let value = null
  //       if (flags.includes('d')) {
  //         // the argument is an identifier for defines, retrieve value
  //         // must be at least one whitespace after
  //         let idres = matchNextIdentifier(arg)
  //         value = lookupPropertyValue(defines, idres.keys)
  //       } else {
  //         _assert(['\t', ' '].includes(arg[0]),
  //           'whitespace must follow delimiter')
  //         value = arg.slice(1)
  //       }
  //       let prop = '$' + Number(n).toString()
  //       argDataArr[n] = { name: prop, value: value, flags: flags }
  //       n++
  //     }
  //   }
  //   return argDataArr
  // }

  static queryVersion() { return queryVersion() }

  static _renderMustache_maxIterDefault() { return 1000 }
  static _renderMustache(tpl, defines, partials = {},
    maxIter = ReversiblePreproc._renderMustache_maxIterDefault()) {
    // to allow for multi-level and recursive substitutions, loop until no more change
    let resPrev = null, res = tpl
    let iter = 0
    for (; res !== resPrev && iter < maxIter; iter++) {
      resPrev = res
      res = Mustache.render(res, defines, partials)
    }
    if (iter == ReversiblePreproc._renderMustache_maxIterDefault) {
      throw new RppError('too many Mustache iterations')
    }
    return res
  }

  _eol() { return this.options.eol }
  _makeOutupLineArr(line, res) {
    _assert(typeof res === 'string')
    let pre =
      this.options.annStem + this.options.annRendered
    let post =
      this.options.annStem + this.options.annEndRendered
    // the "post" line needs to be on a new line - enforce that
    // in case the rendered output doesnt
    let lineArr = [line]
      .concat([pre])
      .concat([res]) // line ends within res are responsibility of tpl etc.
      .concat([post])
    return lineArr
  }


  // ignore line if only whitespace, else treat as first elt of array
  _arrLinesToStrSpecial(line, arrLines) {
    let ret = ""
    if (/[^ /t]/.test(line))
      ret = line + this._eol()
    for (let l of arrLines)
      ret += (l[0].substr(l[1], l[2]) + this._eol())
    return this._removeFinalEol(ret)
  }


  _processMultiLineCmd_addDef(sym, lines) {
    // first line must always contains lhs identifier
    //{ identifier: reres[0], index: reres.index, keys: keys }
    let lhsRes = matchNextIdentifier(lines[0])
    //let identifierRegex = createIdentifierRegex()
    // let reRes0 = identifierRegex.exec(lines[0])
    // if (!reRes0)
    //   throw new RppError('lhs not found')
    // let lhs = reRes0[0]

    let rhs = this._arrLinesToStrSpecial(
      lines[0].substr(lhsRes.index + lhsRes.identifier.length + 1),
      lines.slice(1)
    )

    let val = rhs
    switch (sym) {
      case symCmdAddDef:
        val = rhs
        break
      case symCmdAddDefJson:
        val = JSON.parse(rhs)
        break
      case symCmdAddDefEval:
        {
          let body = '"use strict"\n' + rhs
          let f = new Function('defines', body)
          val = f(this.defines)
        }
        break
      default: throw new RppError('programmer error')
    }

    forcePropertyValue(this.defines, lhsRes.keys, val)
    return
  }


  // INPUT: this.parseState.multiLineIn.{cmdSym, lines}
  // OUTPUT: null or array of buffer, each buffer is a line or multi-line string.
  //  In the case of multi-line, all EOL (except the last) must be supplied internally.
  // EOL is not required at end of each buffer, but not disallowed either
  _processMultiLineCmd(sym, lines) {
    switch (sym) {
      case symCmdAddDef:
      case symCmdAddDefJson:
      case symCmdAddDefEval:
        this._processMultiLineCmd_addDef(sym, lines)
        return null
      case symCmdIf:
      case symCmdIfEval:
      case symCmdElif:
      case symCmdElifEval:
        if ([symCmdElif, symCmdElifEval].includes(sym)) {
          _assert(!this.parseState.ifState.else, '"else" is active, "elif" not allowed')
          _assert(this.parseState.ifState.ifLinum >= 0, "can't have 'elif' without 'if' first")
          if (this.parseState.ifState.onClauseFound) {
            // ignore condition because if has already evaluated true 
            this.parseState.ifState.on = false
            //this.parseState.ifState.onLinum = this.parseState.linum
            return null
          }
        }
        {
          // save the previous state only if this not 'elif' type command
          if ([symCmdIf, symCmdIfEval].includes(sym)) {
            // after introducing createIfState(), deep copy is no longer necessary  
            //            this.parseState.ifStack.push(
            //              deepCopyViaJson(this.parseState.ifState)
            //           )
            this.parseState.ifStack.push(this.parseState.ifState)

            // initialize new state
            this.parseState.ifState = createIfState({
              on: false,
              onAncestor: this.parseState.ifState.on
            })
            // this.parseState.ifState.else = false
            // this.parseState.ifState.onClauseFound = false
            // this.parseState.ifState.on = undefined
            // this.parseState.ifState.onLinum = -1
            // this.parseState.ifState.ifLinum = -1

            this.parseState.ifState.ifLinum = this.parseState.linum
          }
          if (this.parseState.ifState.onAncestor
            && !this.parseState.ifState.onClauseFound) {
            let expr = this._arrLinesToStrSpecial(lines[0], lines.slice(1))

            let [isOn, err] = judgeLineArg(
              //lines.join(this._eol()),
              expr,
              this.defines,
              ([symCmdIf, symCmdElif].includes(sym) ? this.jsepPreprocInterpret : null)
            )
            if (err) throw new RppError('judgeLineArg error: ' + err)
            if (isOn) {
              this.parseState.ifState.onClauseFound = true
            }
            this.parseState.ifState.on = isOn
            //this.parseState.ifState.onLinum = this.parseState.linum
          }
          return null
        }
      case symCmdElse:
        {
          _assert(!this.parseState.ifState.else)
          this.parseState.ifState.else = true
          this.parseState.ifState.on = (
            this.parseState.ifState.onAncestor
            && !this.parseState.ifState.onClauseFound)
          //this.parseState.ifState.onLinum = this.parseState.linum
          return null
        }
      case symCmdEndif:
        {
          if (!this.parseState.ifStack.length) {
            // too many end scope commnand - like unbalanced parentheses.
            throw new RppError(`unexpected end directive line ${this.linum}, (unbalanced?)`)
          }
          this.parseState.ifState = this.parseState.ifStack.pop()
          // [this.parseState.ifOn, this.parseState.ifOnLinum]
          //   = this.parseState.ifStack[this.parseState.ifStack.length - 1]
          // this.parseState.ifStack.pop()
          return null
        }
      case symCmdTpl:
        {
          let tpl = this._arrLinesToStrSpecial(lines[0], lines.slice(1))
          if (this.parseState.tplStr)
            this.parseState.tplStr += (this._eol() + tpl)
          else
            this.parseState.tplStr = tpl
          return null
        }
      case symCmdPartials:
        {
          let partials = JSON.parse(lines.join(this._eol()))
          Object.assign(this.parseState.tplPartials, partials)
          return null
        }
      case symCmdRender:
        {
          let tpl = this._arrLinesToStrSpecial(lines[0], lines.slice(1))
          if (/\S+/.test(tpl))
            this.parseState.tplStr = tpl

          _assert(this.parseState.tplStr, "this.parseState.tplStr")
          let res = ReversiblePreproc._renderMustache(
            this.parseState.tplStr,
            this.defines,
            this.parseState.tplPartials
          )
          let lineArr = this._makeOutupLineArr(null, res)
          this.parseState.tplStr = null
          this.parseState.tplPartials = {}
          return lineArr
        }
      default:
        throw new RppError(`symbol ${sym} unknown`)
    }
  }

  // return an array of lines to be output
  _procSingleNonCmdLine(line, wsOff) {
    let maybeStrippedLine = line
    if (wsOff >= 0 && isSubstrEqual(line, wsOff, this.options.annStem)) {
      let annline = line.substr(wsOff + this.options.annStem.length)
      let [sym, length] = [null, 0]
      for (let item of this.annsSorted) {
        if (isSubstrEqual(annline, 0, item[0])) {
          sym = item[1]
          length = item[0].length
        }
      }
      if (!sym)
        throw new RppError('ann command not found')
      switch (sym) {
        case symAnnRendered:
          this.parseState.renderedOn = true
          return null // don't echo - will be regenerated on output if approp
        case symAnnEndRendered:
          _assert(this.parseState.renderedOn, "this.parseState.renderedOn")
          this.parseState.renderedOn = false
          return null // don't echo - will be regenerated on output if approp 
        case symAnnPlain:
          // remove annotation from line and drop down to plain line behavior
          maybeStrippedLine = annline.substr(length + 1)
          break
        default:
          throw new RppError(`unknown symbol ${sym}`)
      }

    }
    // no symbols to check for - handle states and plain lines
    if (this.parseState.renderedOn)
      return null // the line is progmatic, remove it
    //if (this.parseState.ifOnLinum >= 0) 
    if (this.parseState.ifState.ifLinum >= 0) {
      // 'if' command inner region
      if (this.parseState.ifState.on) {
        return [maybeStrippedLine]
      } else {
        return [this.options.annStem
          + this.options.annPlain
          + " " + maybeStrippedLine]
      }
    }
    // no special states
    return [maybeStrippedLine] // in case the if clause was manually deleted while ann present 
  }


  _ensureEol(line) {
    _assert(typeof line === 'string')
    if (line.length < this._eol().length
      || line.slice(-1 * this._eol().length) !== this._eol()) {
      return line + this._eol()
    }
    return line
  }
  _removeFinalEol(line) {
    if (line.length >= 2 && line.slice(-2) === '\r\n')
      return line.slice(0, -2)
    if (line.length >= 1 && line.slice(-1) === '\n')
      return line.slice(0, -1)
    return line
  }

  _whichCmd(line, offset) {
    for (let item of this.cmdsSorted) {
      if (isSubstrEqual(line, offset, item[0]))
        return item
    }
    throw new RppError(`no command found in ${line} offset ${offset}`)
  }

  line(
    line,
    pushOutArg = null,
    callback = (e, x) => { return [e, x] },
    wsOffIn = null
  ) {
    try {
      let tmpOut = []
      let pushOut = (x) => {
        x = this._ensureEol(x)
        if (pushOutArg)
          pushOutArg(x)
        else
          tmpOut.push(x)
      }
      let callback1 = () => {
        switch (tmpOut.length) {
          case 0: return null
          case 1: return tmpOut[0]
          default: return tmpOut
        }
      }
      let wsOff
      if (wsOffIn === null) {
        line = this._removeFinalEol(line) // in case input EOL !== output EOL
        wsOff = line.search(/\S/)
      } else {
        if (line.length)
          _assert(line.slice(0, -1)[0] !== '\n', 'input line ends in newline')
        wsOff = wsOffIn
      }
      this.parseState.linum++ // first line is line 1

      // should we search for line head?
      if (!this.parseState.multiLineIn.cmdSym) {
        if (wsOff >= 0 && isSubstrEqual(line, wsOff, this.options.cmdStemMultiStart)) {
          // begin multiIn
          let cmdline = line.slice(wsOff + this.options.cmdStemMultiStart.length)
          let cmdlineStart = wsOff + this.options.cmdStemMultiStart.length

          let haveEnd = false
          let idxEnd = cmdline.indexOf(this.options.cmdStemMultiEnd)
          if (idxEnd >= 0) {
            cmdline = cmdline.slice(0, idxEnd)
            haveEnd = true
          } else {
            idxEnd = cmdline.length
          }
          let item = this._whichCmd(cmdline, 0) // throws if no cmd found
          this.parseState.multiLineIn.cmdSym = item[1]
          this.parseState.multiLineIn.lines.push(
            line.slice(cmdlineStart + item[0].length + 1, cmdlineStart + idxEnd)
          )
          this.parseState.multiLineIn.endDetected = haveEnd
          // [
          //   line,
          //   cmdlineStart + item[0] + 1,
          //   cmdlineStart + idxEnd
          // ]
          pushOut(line)  // echo the command line
          if (!haveEnd)
            return callback(null, callback1())
        } else if (wsOff >= 0 && isSubstrEqual(line, wsOff, this.options.cmdStem)) {
          let cmdline = line.slice(wsOff + this.options.cmdStem.length)
          let cmdlineStart = wsOff + this.options.cmdStem.length
          let item = this._whichCmd(cmdline, 0) // throws if no cmd found
          this.parseState.multiLineIn.cmdSym = item[1]
          this.parseState.multiLineIn.lines.push(
            line.slice(cmdlineStart + item[0].length + 1)
          )
          // [
          //   line,
          //   cmdlineStart + item[0] + 1,
          //   line.length
          // ]
          this.parseState.multiLineIn.endDetected = true
          pushOut(line)  // echo the command line
        }
      } else { // this.parseState.multiLineIn.cmdSym is not null
        // multiline input continuation
        let idxEnd = line.length
        //let cmdline = line
        let haveEnd = false
        if (wsOff >= 0) {
          let tmp = line.substr(wsOff).indexOf(this.options.cmdStemMultiEnd)
          if (tmp >= 0) {
            idxEnd = wsOff + tmp
            haveEnd = true
          }
        }
        this.parseState.multiLineIn.lines.push([line, 0, idxEnd])
        this.parseState.multiLineIn.endDetected = haveEnd
        pushOut(line)  // echo the command line
        if (!haveEnd)
          return callback(null, callback1())
      }
      if (this.parseState.multiLineIn.endDetected) {
        // process accumulated command lines and return result
        // except when (not if related and if-occluded)
        let lineOutArr
        if ([symCmdIf, symCmdIfEval, symCmdElif, symCmdElifEval,
          symCmdElse, symCmdEndif]
          .includes(this.parseState.multiLineIn.cmdSym)
          || this.parseState.ifState.ifLinum < 0
          || this.parseState.ifState.on) {
          lineOutArr = this._processMultiLineCmd(
            this.parseState.multiLineIn.cmdSym,
            this.parseState.multiLineIn.lines
          )
        }
        this.parseState.multiLineIn.cmdSym = null
        this.parseState.multiLineIn.lines = []
        this.parseState.multiLineIn.endDetected = false

        _assert(pushOut)
        {
          if (lineOutArr)
            for (let lineOut of lineOutArr)
              if (lineOut)
                pushOut(lineOut)
          return callback(null, callback1())
        }
      } // if (this.parseStart.multiLineIn.endDetected)

      // all thats left now are other-than-commands
      {
        let lineOutArr = this._procSingleNonCmdLine(line, wsOff)
        if (lineOutArr)
          for (let lineOut of lineOutArr)
            pushOut(lineOut)
        return callback(null, callback1())
      }
    } // try
    catch (e) {
      if (e instanceof Error) {
        return callback(e, null)
      } else {
        return callback(new RppError("unknown error: " + e), null)
      }
    }
  } // line

} // class ReversiblePreproc

export default ReversiblePreproc
