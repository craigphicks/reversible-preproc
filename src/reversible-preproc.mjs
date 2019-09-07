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
  cmdStemMultiEnd: '--*/',
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

function getLineHeadSymbol(line, opt, arrCmd, arrAnn) {
  function testLineHead(line, start, str) {
    return line.substr(start, str.length) === str
  }
  let wsOff = line.search(/\S/)
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


const reservedIdentifiers = [
  'true', 'false', 'null', 'undefined', 'def', 'ndef'
]

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
      tplPartials: {},
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

  static _parseMacroCall(mcall) {
    var fnNameRegex = /^[[$A-Z_][0-9A-Z_$]*/i
    mcall = mcall.trim()
    let macroName = mcall.match(fnNameRegex)[0]
    let rem = mcall.substr(macroName.length).trim()
    let sepchar = rem[0]
    let args = rem.slice(1).split(sepchar)
    let partials = {}
    let n = 0
    for (let arg of args) {
      partials[Number(n).toString()] = arg.trim()
      n++
    }
    return [macroName, partials]
  }

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

        // let pre = this.options.annStem + this.options.annRendered
        // let post = this.options.annStem + this.options.annEndRendered
        // let res = Mustache.render(
        //     this.parseState.tplStringArr.join(" "),
        //     this.definesJson,
        //     //          this.parseState.tplPartials
        //   )
        // if (Reflect.ownKeys(this.parseState.tplPartials).length > 0) {
        //   res = Mustache.render(
        //     res, this.definesJson,
        //     this.parseState.tplPartials
        //   )
        // }
        // this.parseState.tplStringArr = []
        // this.parseState.tplPartials = {}
        // let lineArr = [line]
        //   .concat([pre])
        //   .concat(res.split('\n'))
        //   .concat([post])
        // return [true, lineArr]
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

  _ensureEol(line){
    _assert(typeof line ==='string')
    if (line.length < this._eol().length 
    || line.slice(-1*this._eol().length)!==this._eol()){
      return line+this._eol()
    }
    return line
  }
  _removeAnyEol(line){
    if (line.length>=2 && line.slice(-2)==='\r\n')
      return line.slice(0,-2)
    if (line.length>=1 && line.slice(-1)==='\n')
      return line.slice(0,-1)
    return line
  }
  line(line, pushOut = null, callback = (e, x) => { return [e, x] }) {
    try {
      line = this._removeAnyEol(line) // in case input EOL !== output EOL
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
        for (let item of strippedLine){
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
