'use strict'

import JsepPreprocInterpret from './jsep-preproc-interpret.mjs'
import RppBaseError from './prependable-error.mjs'
import Mustache from 'mustache'
//import dedent from 'dedent'
//import jsep from 'jsep'
//import { AssertionError } from 'assert';

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
    throw new RppError(msg)
}


function hasOwnKey(obj, key) {
  return Reflect.getOwnPropertyDescriptor(obj, key) !== undefined
}



//const identifierRegex = /^[[$A-Z_][0-9A-Z_$]*/i
function createIdentifierRegex() {
  const core = "[$A-Z_][0-9A-Z_$]*"
  return RegExp(`^${core}(.${core})*`, 'i')
}

function matchNextIdentifier(line) {
  let reres = /[^ /t]+/.exec(line)
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
  if (!hasOwnKey(obj, keys[0]))
    obj[keys[0]] = null
  let parent = obj
  for (let n = 1; n < keys.length - 1; n++) {
    if (!hasOwnKey(parent[keys[n - 1]], keys[n]))
      parent[keys[n - 1]][keys[n]] = null
    parent = parent[keys[n - 1]]
  }
  parent[keys.slice(-1)] = value
}
function lookupPropertyValue(obj, keys) {
  _assert(keys && keys.length > 0, 'keys null or empty')
  _assert(hasOwnKey(obj, keys[0], `key ${keys[0]} not present`))
  let parent = obj
  for (let n = 1; n < keys.length - 1; n++) {
    _assert(hasOwnKey(parent[keys[n - 1]], keys[n]))
    parent = parent[keys[n - 1]]
  }
  return parent[keys.slice(-1)]
}


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
  cmdElse: 'else',
  cmdElif: 'elif',
  cmdEndif: 'endif',
  cmdMacro: 'macro',
  cmdTpl: 'tpl',
  cmdRender: 'render',
  cmdPartials: 'partials',
  cmdTplRender: 'tplRender', // in a single line
  cmdIfTplRender: 'ifTplRender', // in a single line
  annPlain: 'plain',
  annRendered: 'rendered',
  annEndRendered: 'endRendered',
  annStem: '//!!',
}

const reservedIdentifiers = [
  'true', 'false', 'null', 'undefined', 'def', 'ndef'
]

const symMultiIn = Symbol('multiIn')
const symMultiInEnd = Symbol('multiInEnd')

const symCmdAddDef = Symbol('cmdAddDef')
const symCmdAddDefJson = Symbol('cmdAddDefJson')
const symCmdAddDefEval = Symbol('cmdAddDefEval')
const symCmdIf = Symbol('cmdIf')
const symCmdElse = Symbol('cmdElse')
const symCmdElif = Symbol('cmdElif')
const symCmdEndif = Symbol('cmdEndif')
const symCmdMacro = Symbol('cmdMacro')
const symCmdTpl = Symbol('cmdTpl')
const symCmdPartials = Symbol('cmdPartials')
const symCmdRender = Symbol('cmdRender')
const symCmdTplRender = Symbol('cmdTplRender')
const symCmdIfTplRender = Symbol('cmdIfTplRender')

const symAnnPlain = Symbol('annPlain')
const symAnnRendered = Symbol('annRendered')
const symAnnEndRendered = Symbol('annEndRendered')

function makeNonCryptoRandomAlphaNumString(length) {
  function tf(n) {
    if (n <= 26) return 65 + n
    else if (n <= 52) return 97 + n
    else return 48 + n
  }
  var result = ''
  for (var i = 0; i < length; i++) {
    let idx = Math.floor(Math.random() * 62)
    result += String.fromCharCode(tf(idx))
  }
  return result
}

function isSubstrEqual(line, offset, str) {
  return line.substr(offset, str.length) === str
}

function getLineHeadSymbol(line, opt, arrCmd, arrAnn, multiLineIn) {
  function testLineHead(line, start, str) {
    //return line.substr(start, str.length) === str
    return isSubstrEqual(line, start, str)
  }
  // input is a single line no EOL
  let wsOff = line.search(/\S/)
  if (!multiLineIn.cmdSym) {
    // scan first for multiline cmd start
    if (testLineHead(line, wsOff, opt.cmdStemMultiStart)) {
      let start = wsOff + opt.cmdStem.length
      // check if cmdStemMultiEnd exists in same line
      let substr = line.slice(start)
      let idxEnd = line.substr(start).indexOf(opt.cmdStemMultiEnd)
      if (idxEnd >= 0) {
        substr.line.slice(start, idxEnd)
      } else {
        // end should come on a later line
      }
      for (let item of arrCmd) {
        if (testLineHead(substr, 0, item[0]))
          if (idxEnd > 0) {
            // same as single line cmd
            return [item[1], start + item[0].length + 1]
          } else {
            multiLineIn.cmdSym = item[1]
            multiLineIn.lines.push([line, start + item[0].length + 1])
            return [symMultiIn, null]
          }
      }
      throw new RppError(`no known command found after stem in ${line}`)
    } // if testLineHead(line, wsOff, opt.cmdStemMultiStart)
  } else { // multiLineIn.cmdSym !== null
    // do not check for line head command, only check for end.
    let idxEnd = line.indexOf(opt.cmdStemMultiEnd)
    // first add any data before end
    multiLineIn.lines.push([line, 0, idxEnd]) // if 3rd el isn't present assume whole line
    return [symMultiInEnd, null]
  }
  if (wsOff == -1)
    return [null, null] // empty line 
  if (testLineHead(line, wsOff, opt.cmdStem)) {
    //
    let start = wsOff + opt.cmdStem.length
    for (let item of arrCmd) {
      if (testLineHead(line, start, item[0]))
        return [item[1], start + item[0].length + 1]
    }
    throw new RppError(`no command found after stem in ${line}`)
  } else if (testLineHead(line, wsOff, opt.annStem)) {
    //
    let start = wsOff + opt.annStem.length
    for (let item of arrAnn) {
      if (testLineHead(line, start, item[0]))
        return [item[1], start + item[0].length + 1]
    }
    throw new RppError(`no annotation found after stem in ${line}`)
  } else
    return [null, null] // not command or annotated line
}



function judgeLineArg(str, definesJson, jsepPreprocInterpret) {
  if (definesJson === '*') // this overrides and (and prevents calling of) any eval functions
    return [true, null]
  if (str[0] === ':') { // semicolon indicates to start a function to be eval'd
    // the form is
    // :(<variableName>)=>(<body>) and it be eval'd as a function
    // ((<variableName>)=>(<body>))(<preproc jsonDefines>)
    // where the preprocess json set up at program start will be passed as
    // the argument to the function
    try {
      var fnstr = `(${str.slice(1)})(${JSON.stringify(definesJson)})`
      return [eval(fnstr), null]
    }
    catch (e) {
      return [
        false,
        new RppError(`function string ${fnstr} in ${str} could not be eval'd: `, e)
      ]
    }
  } else {
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




class ReversiblePreproc {
  constructor(definesJson = {}, options = defaultOptions) {
    for (let k of Reflect.ownKeys(defaultOptions))
      if (!Reflect.ownKeys(options).includes(k))
        options[k] = defaultOptions[k]
    this.options = options
    // if (!this.options.commentMark.length)
    //   throw new RppError("options.commentMark cannot be zero length")
    {
      if (typeof definesJson === 'object') {
        if (definesJson instanceof Array)
          throw new RppError("top level defined object cannot be an Array")
        for (let k of Reflect.ownKeys(definesJson)) {
          if (reservedIdentifiers.includes(k)) {
            throw new RppError(`${k} is a reserved Identifier, cannot use it in top level defines`)
          }
        }
      }
      this.definesJson = definesJson
    }
    this.jsepPreprocInterpret = new JsepPreprocInterpret(definesJson)
    this.linum = -1
    //    this.onLinum = -1
    //    this.on = 1
    //    this.stack = []
    // 2.x.x 
    this.parseState = {
      linum: 0, // line number of the input file (count starts at 1)
      ifOnLinum: -1, // the input line number of current innermost if block start
      ifOn: false, // currently in an if blocks (possibly multiple)
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
    this.cmdsSorted = [
      [options.cmdAddDef, symCmdAddDef],
      [options.cmdAddDefJson, symCmdAddDefJson],
      [options.cmdAddDefEval, symCmdAddDefEval],
      [options.cmdIf, symCmdIf],
      [options.cmdElse, symCmdElse],
      [options.cmdElif, symCmdElif],
      [options.cmdEndif, symCmdEndif],
      [options.cmdMacro, symCmdMacro],
      [options.cmdTpl, symCmdTpl],
      [options.cmdPartials, symCmdPartials],
      [options.cmdRender, symCmdRender],
      [options.cmdTplRender, symCmdTplRender],
      [options.cmdIfTplRender, symCmdIfTplRender],
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
  static _parseMacroArgs(margs) {
    // each partial prop has sub props :
    // value: type string or type array 
    // flags: "", "d", or "ad"    
    let argDataArr = []
    let reres = /[^ /t]/.exec(margs)
    if (reres) {
      let delim = reres[0][0]
      let arr = margs.split(delim)
      let n = 0
      for (let arg of arr) {
        let flagres = /^(d|ad|da){0,1}/.exec(arg)
        let flags = ''
        let value = null
        if (flagres) {
          _assert(flagres[0].length < arg.length + 2, `malformed arg ${arg}`)
          _assert([' ', '/t'].includes(arg[flagres[0].length]),
            `whitespace required after flags in arg ${arg}`)
          flags = flagres[0]
          arg = arg.slice(flagres[0].length)
        }
        if (flagres && flagres[0].includes('d')) {
          // the argument is an identifier for defines, retrieve value
          // must be at least one whitespace after
          let idres = matchNextIdentifier(arg)
          value = lookupPropertyValue(this.definesJson, idres.keys)
        } else {
          _assert(['\t', ' '].includes(arg[0]),
            'whitespace must follow delimiter')
          value = arg.slice(1)
        }
        let prop = '$' + Number(n).toString()
        argDataArr[n] = { name: prop, value: value, flags: flags }
        n++
      }
    }
    return partials
  }

  // static _parseMacroCall(mcall) {
  //   mcall = mcall.trim()
  //   let macroName = mcall.match(identifierRegex)[0]
  //   let rem = mcall.substr(macroName.length).trim()
  //   let sepchar = rem[0]
  //   let args = rem.slice(1).split(sepchar)
  //   let partials = {}
  //   let n = 0
  //   for (let arg of args) {
  //     partials[Number(n).toString()] = arg.trim()
  //     n++
  //   }
  //   return [macroName, partials]
  // }

  static _renderMustache(tpl, defines, partials = {}) {
    // to allow for multi-level and recursive substitutions, loop until no more change
    let resPrev = null, res = tpl
    while (res !== resPrev) {
      resPrev = res
      res = Mustache.render(res, defines, partials)
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
      ret += (l + this._eol())
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
        val = (() => { return eval(rhs) })()
        break
      default: throw new RppError('programmer error')
    }

    forcePropertyValue(this.definesJson, lhsRes.keys, val)

    // let members = lhs.split('.')
    // if (!Reflect.ownKeys(this.definesJson).includes(members[0]))
    //   this.definesJson[members[0]] = null
    // let parent = this.definesJson
    // for (let i = 0; i < members.length - 1; i++) {
    //   let m = members[i]
    //   let n = members[i + 1]
    //   if (!Reflect.ownKeys(parent[n]).includes(m))
    //     parent[n][m] = null
    //   parent = parent[n]
    // }
    // parent[members.slice(-1)] = val
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
        {
          let [isOn, err] = judgeLineArg(
            lines.join(this._eol()),
            this.definesJson,
            this.jsepPreprocInterpret)
          if (err) throw new RppError('judgeLineArg error: ' + err)
          // save the previous state 
          this.parseState.ifStack.push([this.parseState.ifOn, this.parseState.ifOnLinum])
          this.parseState.ifOn = isOn
          this.parseState.ifOnLinum = this.parseState.linum
          return null
        }
      case symCmdEndif:
        {
          if (!this.parseState.ifStack.length) {
            // too many end scope commnand - like unbalanced parentheses.
            throw new RppError(`unexpected end directive line ${this.linum}, (unbalanced?)`)
          }
          [this.parseState.ifOn, this.parseState.ifOnLinum]
            = this.parseState.ifStack[this.parseState.ifStack.length - 1]
          this.parseState.ifStack.pop()
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
          _assert(this.parseState.tplStr, "this.parseState.tplStr")
          let res = ReversiblePreproc._renderMustache(
            this.parseState.tplStr,
            this.definesJson,
            this.parseState.tplPartials
          )
          let lineArr = this._makeOutupLineArr(null, res)
          this.parseState.tplStr = null
          this.parseState.tplPartials = {}
          return lineArr
        }
      case symCmdMacro:
        {
          let lhsRes = matchNextIdentifier(lines[0])


          // let identRegexp = createIdentifierRegex()
          // let reRes0 = identRegexp.exec(lines[0])
          // if (!reRes0)
          //   throw new RppError('macro identifier not found')
          // let lhs = reRes0[0] // expecting it to be top level - TODO allow dots

          let rhs = this._arrLinesToStrSpecial(
            lines[0].substr(lhsRes.index + lhsRes.identifier.length),
            lines.slice(1)
          )
          let partialsData = ReversiblePreproc._parseMacroArgs(rhs)
          //let tpl = this.definesJson['macro'][lhs]
          let tpl = lookupPropertyValue(this.definesJson, lhsRes.keys)
          _assert(tpl !== undefined,
            `property "${lhsRes.identifier}" not present in defines`)
          _assert(typeof tpl === 'string',
            `value of property ${lhsRes.identifier} not of type string`)

          // for each of the partialsData, check for flag 'a',
          // and if found found substitute array format {{#X}}{{.}}{{/X}}
          // where X is a temporary variable name which doesn't conflict
          let tmpTpl = tpl
          for (let d of partialsData) {
            if (d.flags.indexOf('a') >= 0) {
              _assert(d.value instanceof Array)
              // let randId = '$' + makeNonCryptoRandomAlphaNumString(6)
              // let obj = { [randId]: '' }
              // let arrTpl = `{{#${randId}}}{{.}}{{/${randId}}}`
              // sub {{.}} <- {{<$[n]}}
              let tmpTpl = ReversiblePreproc._renderMustache(
                tmpTpl, {}, {[d.name]:'{{.}}'})
              // then add array markers
              tmpTpl = `{{#.}}${tmpTpl}{{/.}}`
              tmpTpl = ReversiblePreproc._renderMustache(
                tmpTpl, d.value)
            }
          }
          let res = ReversiblePreproc._renderMustache(
            tmpTpl, this.definesJson, partials)
          let lineArr = this._makeOutupLineArr(null, res)
          return lineArr
        }
      case symCmdElse:
      case symCmdElif:
      case symCmdTplRender:
      case symCmdIfTplRender:
        throw new RppError(`known symbol ${sym} not implemented`)
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
    if (this.parseState.ifOnLinum >= 0) {
      // 'if' command inner region
      if (this.parseState.ifOn) {
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

  _parseLine_aux2(line) { // can throw, returns [isCmd, strippedLine / null ]
    // if ps 
    let [sym, offset] = getLineHeadSymbol(line, this.options, this.cmdsSorted, this.annsSorted)
    // if it is symAnnPlain, then we sym, offset, and line before proceeding (don't return)
    if (sym === symAnnPlain) {
      line = line.substr(offset)
      sym = null
      offset = 0
    }
    if (!sym) {
      _assert(this.parseState.tplStringArr.length === 0, "this.parseState.tplStringArr.length===0")
      if (this.parseState.renderedOn)
        return [false, null] // strip entire line -> null 
      else if (this.parseState.ifOnLinum !== -1) {
        if (this.parseState.ifOn)
          return [false, line]
        else
          return [false, this.options.annStem + this.options.annPlain + " " + line]
      } else
        return [false, line]
    }
    if (sym === symCmdAddDef
      || sym === symCmdAddDefJson
      || sym === symCmdAddDefEval) {
      let subs = line.substr(offset)
      let lhs = subs.trimLeft().split(/\s+/g, 1)
      _assert(lhs && lhs instanceof Array && lhs.length,
        `lhs ${lhs} parse error - 1`)
      lhs = lhs[0]
      _assert(lhs.length,
        `lhs ${lhs} parse error - 2`)
      let members = lhs.split('.')
      if (!Reflect.ownKeys(this.definesJson).includes(members[0]))
        this.definesJson[members[0]] = null
      let parent = this.definesJson
      for (let i = 0; i < members.length - 1; i++) {
        let m = members[i]
        let n = members[i + 1]
        if (!Reflect.ownKeys(parent[n]).includes(m))
          parent[n][m] = null
        parent = parent[n]
      }
      let tpl = subs.substring(lhs.length).trimLeft()
      let val = tpl
      switch (sym) {
        case symCmdAddDefJson:
          val = JSON.parse(tpl)
          break
        case symCmdAddDefEval:
          val = (() => { return eval(tpl) })()
          break
      }
      parent[members.slice(-1)] = val
      return [false, line]
    }
    if (sym === symCmdMacro) {
      let [macroName, partials] =
        ReversiblePreproc._parseMacroCall(line.substr(offset))
      _assert(hasOwnKey(this.definesJson, macroName))
      let tpl = this.definesJson[macroName]
      _assert(typeof tpl === 'string')
      let res = ReversiblePreproc._renderMustache(
        tpl, this.definesJson, partials)
      let lineArr = this._makeOutupLineArr(line, res)
      return [true, lineArr]
    } // if (sym === symCmdMacro)
    if (sym === symCmdTpl) {
      this.parseState.tplStringArr.push(line.substr(offset))
      return [false, line]
    }
    if (sym === symCmdPartials) {
      //let evaled = eval(line.substr(offset))
      let partials = JSON.parse(line.substr(offset))
      Object.assign(this.parseState.tplPartials, partials)
      return [false, line]
    }
    if (this.parseState.tplStringArr.length) {
      // only more tpl string or render cmd are allowed
      if (sym === symCmdRender) {
        let res = ReversiblePreproc._renderMustache(
          this.parseState.tplStringArr.join("\n"),
          this.definesJson,
          this.parseState.tplPartials
        )
        let lineArr = this._makeOutupLineArr(line, res)
        this.parseState.tplStringArr = []
        this.parseState.tplPartials = {}
        return [true, lineArr]
      }
      else
        throw new RppError(`found ${sym.toString()}, expecting symCmdTpl or symCmdRender`)
    }
    _assert(sym !== symCmdRender, `${sym.toString()}!==symCmdRender`)
    if (sym === symAnnRendered) {
      _assert(!this.parseState.renderedOn, 'renderedOn is already true')
      this.parseState.renderedOn = true
      return [false, null]
    }
    if (sym === symAnnEndRendered) {
      _assert(this.parseState.renderedOn, 'renderedOn is not true')
      this.parseState.renderedOn = false
      return [false, null]
    }
    _assert(!this.parseState.renderedOn, 'exepected state renderedOn===false ')
    if (sym === symAnnPlain) {
      // strip and return line w/out annotation
      return [false, line.substr(offset)]
    }
    if (sym === symCmdIf) {
      let sub = line.substr(offset)
      let [isOn, err] = judgeLineArg(sub, this.definesJson, this.jsepPreprocInterpret)
      if (err) throw new RppError('judgeLineArg return error')
      // save the previous state 
      this.parseState.ifStack.push([this.parseState.ifOn, this.parseState.ifOnLinum])
      this.parseState.ifOn = isOn
      this.parseState.ifOnLinum = this.parseState.linum
      return [false, line]
    }
    if (sym === symCmdEndif) {
      if (!this.parseState.ifStack.length) {
        // too many end scope commnand - like unbalanced parentheses.
        throw new RppError(`unexpected end directive line ${this.linum}, (unbalanced?)`)
      }
      [this.parseState.ifOn, this.parseState.ifOnLinum]
        = this.parseState.ifStack[this.parseState.ifStack.length - 1]
      this.parseState.ifStack.pop()
      return [false, line]
    }
    throw new RppError(`unhandled symbol ${sym.toString()}`)
    // TODO cases symCmdElif, symCmdElse, symCmdTplRender, symCmdIfTplRender
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

  line(line, pushOutArg = null, callback = (e, x) => { return [e, x] }) {
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
      line = this._removeFinalEol(line) // in case input EOL !== output EOL
      this.parseState.linum++ // first line is line 1
      let wsOff = line.search(/\S/)

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
        let lineOutArr = this._processMultiLineCmd(
          this.parseState.multiLineIn.cmdSym,
          this.parseState.multiLineIn.lines
        )
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

  lineX(line, pushOut = null, callback = (e, x) => { return [e, x] }) {
    try {
      line = this._removeFinalEol(line) // in case input EOL !== output EOL
      this.parseState.linum++ // first line is line 1
      let callbackLineout = null
      let [multi, strippedLine] = this._parseLine_aux2(line)

      if (!multi) {
        let lineOut = this._ensureEol(strippedLine)
        if (pushOut)
          pushOut(lineOut)
        else
          callbackLineout = lineOut // back compat only, for v1.x.x tests 
      }
      else {
        if (!pushOut)
          throw RppError
            // eslint-disable-next-line no-unexpected-multiline
            ('pushOut must be defined to enable multiple line output (i.e. templates)')
        for (let item of strippedLine) {
          let lineOut = this._ensureEol(item)
          pushOut(lineOut)
        }
      }
      return callback(null, callbackLineout)
    }
    catch (e) {
      if (e instanceof Error) {
        return callback(e, null)
      } else {
        return callback(new RppError("unknown error: " + e), null)
      }
    }
  }
} // class ReversiblePreproc

export default ReversiblePreproc
