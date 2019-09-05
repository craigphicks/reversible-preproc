'use strict'

import JsepPreprocInterpret from './jsep-preproc-interpret.mjs'
import RppBaseError from './prependable-error.mjs'
import Mustache from 'mustache'

class RppError extends RppBaseError {
  constructor(...params) {
    super(...params)
  }
}

function assert(cond, msg) {
  if (!cond)
    throw new RppError(msg)
}


var defaultOptions = {
  testMode: false, // cmd start lines only prepended by true or false
  debugOutput: false,
  // 1.x.x obsolete
  commentMark: '//',
  reversibleCommentIndicator: '!!',
  // 2.x.x
  cmdStem: '//--',
  cmdIf: 'if',
  cmdElse: 'else',
  cmdElif: 'elif',
  cmdEndif: 'endif',
  cmdTpl: 'tpl',
  cmdRender: 'render',
  cmdTplRender: 'tplRender', // in a single line
  cmdIfTplRender: 'ifTplRender', // in a single line
  annPlain: 'plain',
  annRendered: 'rendered',
  annEndRendered: 'endRendered',
  annStem: '//!!',
}

function getLineHeadSymbol(line, arrCmd, arrAnn) {
  function testLineHead(line, start, str) {
    return line.substr(start, str.length) === str
  }
  if (testLineHead(line, 0, opt.cmdStem)) {
    //
    let start = opt.cmdStem.length
    for (item of arrCmd) {
      if (testLineHead(line, start, item[0]))
        return [item[1], start + item[0].lenght + 1]
    }
    throw new RppError(`no command found after stem in ${line}`)
  } else if (testLineHead(line, 0, opt.annStem)) {
    //
    let start = opt.annStem.length
    for (item of arrAnn) {
      if (testLineHead(line, start, item[0]))
        return [item[1], start + item[0].lenght + 1]
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

const symCmdIf = Symbol('cmdIf')
const symCmdElse = Symbol('cmdElse')
const symCmdElif = Symbol('cmdElif')
const symCmdEndif = Symbol('cmdEndif')
const symCmdTpl = Symbol('cmdTpl')
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
    if (!this.options.commentMark.length)
      throw new RppError("options.commentMark cannot be zero length")
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
    this.onLinum = -1
    this.on = 1
    this.stack = []
    // 2.x.x 
    this.parseState = {
      linum: 0, // line number of the input file (count starts at 1)
      ifOnLinum: -1, // the input line number of current innermost if block start
      ifOn: false, // currently in an if blocks (possibly multiple)
      ifStack: [], // stack for nested if blocks [ ..., [<startline>,<true/false>],...] 
      renderedOn: false, // currently in an annotated rendered region, (will be cleared, maybe rerendered) 
      tplStringArr: [], // cmd-tpl lines are accumulated until cmd-render is encountered, thenoutput 
    }
    this.cmdsSorted = [
      [options.cmdIf, symCmdIf],
      [options.cmdElse, symCmdElse],
      [options.cmdElif, symCmdElif],
      [options.cmdEndif, symCmdEndif],
      [options.cmdTpl, symCmdTpl],
      [options.cmdRender, symCmdRender],
      [options.cmdTplRender, symCmdTplRender],
      [options.cmdIfTplRender, symCmdIfTplRender],
    ]
    this.annsSorted = [
      [options.annPlain, symAnnPlain],
      [options.annRendered, symAnnRendered],
      [options.annEndRendered, symEndRendered],
    ]
    this.cmdsSorted.sort((a, b) => {
      (a.length > b.length) ? 1 :
        (a.length < b.length) ? -1 : 0
    })
    this.annsSorted.sort((a, b) => {
      (a.length > b.length) ? 1 :
        (a.length < b.length) ? -1 : 0
    })



    Object.seal(this)
  }
  renderMustache(tplArr, view) {
    // return a string of possibly multiple lines

    return Mustache.render(tplArr.join(" "), view)
  }

  _parseLine_aux2(line, state) { // can throw, returns [isCmd, strippedLine / null ]
    // if ps 
    let [sym, offset] = getLineHeadSymbol(line, this.arrCmd, this.arrAnn)
    if (!sym) {
      assert(this.parseState.tplStringArr.length === 0, "this.parseState.tplStringArr.length===0")
      if (this.parseState.renderedOn)
        return [false, null] // strip entire line -> null 
      else
        return [false, line]
    }
    if (this.parseState.tplStringArr.length) {
      // only more tpl string or render cmd are allowed
      if (sym === symCmdTpl) {
        this.parseState.tplString.push(line.substr(offset))
        return [false, line]
      } else if (sym === symCmdRender) {
        let res = renderMustache(this.parseState.tplStringArr, this.definesJson)
        this.parseState.tplStringArr = []
        return [true, [line, res]]
      }
      else
        throw new RppError('expecting symCmdTpl or symCmdRender')
    }
    assert(sym !== symCmdRender, "sym!==symCmdRender")
    if (sym === symAnnRendered) {
      assert(!this.parseState.renderedOn, 'renderedOn is already true')
      this.parseState.renderedOn = true
      return [false, null]
    }
    if (sym === symAnnEndRendered) {
      assert(this.parseState.renderedOn, 'renderedOn is not true')
      this.parseState.renderedOn = false
      return [false, null]
    }
    assert(!this.parseState.renderedOn, 'exepected state renderedOn===false ')
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
      if (!this.stack.length) {
        // too many end scope commnand - like unbalanced parentheses.
        throw new RppError(`unexpected end directive line ${this.linum}, (unbalanced?)`)
      }
      [this.parseState.ifOn, this.parseState.ifOnLinum]
        = this.parseState.ifStack[this.parseState.ifStack.length - 1]
      this.stack.pop()
      return [false, line]
    }
    throw new RppError('unhandled symbol')
    // TODO cases symCmdElif, symCmdElse, symCmdTplRender, symCmdIfTplRender
  }

  // line2(line, callback = null) {
  //   try {
  //     this.parseState.linum++ // first line is line 1

  //     let [isCmd, strippedLine, err] = this._parseLine_aux(line)


  //     let dbg = ""
  //     if (this.debugOutput)
  //       dbg = `[${this.onLinum}, ${this.linum}]`
  //     let [isCmd, strippedLine, err] = this._parseLine_aux(line)
  //     if (isCmd) {
  //       if (this.options.testMode) {
  //         if (isCmd === 'start') {
  //           return [
  //             err,
  //             dbg = (this.on ? 'true,  ' : 'false, ')
  //             + `${strippedLine}`
  //           ]
  //         } else {
  //           return [err, null]
  //         }
  //       } else {
  //         if (callback)
  //           callback(err, (dbg + `${strippedLine}`))
  //         else
  //           return [err, (dbg + `${strippedLine}`)]
  //       }
  //     } else {
  //       if (this.options.testMode) {
  //         if (callback)
  //           callback(err, null)
  //         else
  //           return [err, null]
  //       }
  //       if (!this.on) {
  //         let ret = (dbg
  //           + this.options.commentMark + this.options.reversibleCommentIndicator
  //           + `${strippedLine}`)
  //         if (callback)
  //           callback(err, ret)
  //         else
  //           return [err, ret]
  //       } else {
  //         if (callback)
  //           callback(err, (dbg + `${strippedLine}`))
  //         else
  //           return [err, (dbg + `${strippedLine}`)]
  //       }
  //     }
  //   }
  //   catch (e) {
  //     if (e instanceof Error) {
  //       if (callback)
  //         callback(e, null)
  //       else
  //         return [e, null]
  //     }
  //     else {
  //       if (callback)
  //         callback(new RppError("unknown error: " + e), null)
  //       else
  //         return [new RppError("unknown error: " + e), null]
  //     }
  //   }
  // }

  _parseLine_aux(line) {
    if (line.slice(0, 2) !== this.options.commentMark)
      return [false, line, null]
    let stripTarget = this.options.commentMark + this.options.reversibleCommentIndicator
    // each line is always stripped of any previously inserted preproc comments
    if (line.slice(0, stripTarget.length) === stripTarget) {
      line = line.slice(stripTarget.length)
      return [false, line, null]
    }
    let kind = { start: false, end: false }
    let i0 = line.indexOf('if<<')
    if (i0 == -1) {
      i0 = line.indexOf('<<')
      if (i0 == -1)
        return [false, line, null]
      i0 += 2
      kind.end = true
    } else {
      i0 += 4
      kind.start = true
    }
    let i1 = line.slice(i0).indexOf('>>')
    if (i1 == -1)
      return [false, line, null]
    i1 += i0
    let sub = line.slice(i0, i1)
    if (kind.end) {
      if (!this.stack.length) {
        // too many end scope commnand - like unbalanced parentheses.
        // Let's be strict.
        let err = new RppError(`unexpected end directive line ${this.linum}, (unbalanced?)`)
        return [true, line, err]
      }
      this.on = this.stack[this.stack.length - 1][0]
      this.onLinum = this.stack[this.stack.length - 1][1]
      this.stack.pop()
      return ['end', line, null]
    } else { // kind.start===true
      if (!kind.start) throw new RppError("programming error")
      let [isOn, err] = judgeLineArg(sub, this.definesJson, this.jsepPreprocInterpret)
      this.stack.push([this.on, this.onLinum]) // save the previous state
      this.on = isOn
      this.onLinum = this.linum
      return ['start', line, err]
    }
  }
  line(line, callback = null) {
    try {
      this.linum++ // first line is line 1
      //console.log(
      //    `this.linenum=${this.linum}, this.stack.length=${this.stack.length}, line=${line}`)
      let dbg = ""
      if (this.debugOutput)
        dbg = `[${this.onLinum}, ${this.linum}]`
      let [isCmd, strippedLine, err] = this._parseLine_aux(line)
      if (isCmd) {
        if (this.options.testMode) {
          if (isCmd === 'start') {
            return [
              err,
              dbg = (this.on ? 'true,  ' : 'false, ')
              + `${strippedLine}`
            ]
          } else {
            return [err, null]
          }
        } else {
          if (callback)
            callback(err, (dbg + `${strippedLine}`))
          else
            return [err, (dbg + `${strippedLine}`)]
        }
      } else {
        if (this.options.testMode) {
          if (callback)
            callback(err, null)
          else
            return [err, null]
        }
        if (!this.on) {
          let ret = (dbg
            + this.options.commentMark + this.options.reversibleCommentIndicator
            + `${strippedLine}`)
          if (callback)
            callback(err, ret)
          else
            return [err, ret]
        } else {
          if (callback)
            callback(err, (dbg + `${strippedLine}`))
          else
            return [err, (dbg + `${strippedLine}`)]
        }
      }
    }
    catch (e) {
      if (e instanceof Error) {
        if (callback)
          callback(e, null)
        else
          return [e, null]
      }
      else {
        if (callback)
          callback(new RppError("unknown error: " + e), null)
        else
          return [new RppError("unknown error: " + e), null]
      }
    }
  }
}

export default ReversiblePreproc
