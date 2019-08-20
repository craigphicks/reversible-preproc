'use strict'

import JsepPreprocInterpret from './jsep-preproc-interpret.mjs'
import RppBaseError from './prependable-error.mjs'

var defaultOptions = {
    testMode: false, // cmd start lines only prepended by true or false
    debugOutput: false,
    commentMark: '//',
    reversibleCommentIndicator: '!!',
}


class RppError extends RppBaseError {
    constructor(...params) {
        super(...params)
    }

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
        Object.seal(this)
    }
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
