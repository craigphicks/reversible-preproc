'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var jsep = _interopDefault(require('jsep'));
var Mustache = _interopDefault(require('mustache'));
var assert = require('assert');
var assert__default = _interopDefault(assert);
var dedent = _interopDefault(require('dedent'));
var fs = require('fs');
var readline = _interopDefault(require('readline'));
require('resolve');

class PrependableError extends Error {
    constructor(m, e = null) {
        let prev_stack = null;
        let msg = m;
        if (e instanceof Error) {
            msg += ", " + e.message;
            prev_stack = e.stack;
        } else {
            if (e && JSON.stringify(e) !== undefined) {
                msg += ", " + JSON.stringify(e);
            }
        }
        super(msg);
        if (prev_stack)
            this.stack += '\n' + prev_stack;
        this.name = this.constructor.name;
    }
}

/* eslint-disable no-unreachable */

// JpBaseError can prepend msg to existing error
// whether the existing error is instanceof Error or not.
// New 'stack' is also prepended.


class JpUserError extends PrependableError {
	constructor(...args) {
		super(...args);
	}
}
class JpProgError extends PrependableError {
	constructor(...args) {
		super(...args);
	}
}


class Function$1 {
	constructor(name) {
		this.name = name;
	}
}


var t = null;
var orig_unary_ops = { '-': t, '!': t, '~': t, '+': t };
// // Also use a map for the binary operations but set their values to their
// // binary precedence for quick reference:
// // see [Order of operations](http://en.wikipedia.org/wiki/Order_of_operations#Programming_language)
var orig_binary_ops = {
	'||': 1, '&&': 2, '|': 3, '^': 4, '&': 5,
	'==': 6, '!=': 6, '===': 6, '!==': 6,
	'<': 7, '>': 7, '<=': 7, '>=': 7,
	'<<': 8, '>>': 8, '>>>': 8,
	'+': 9, '-': 9,
	'*': 10, '/': 10, '%': 10
};

//var use_binary_ops = '||,&&,===,!==,<,>,<=,>='.split(',')

var bopTable = {
	'||': (a, b) => { return a || b },
	'&&': (a, b) => { return a && b },
	'===': (a, b) => { return a === b },
	'!==': (a, b) => { return a !== b },
	'==': (a, b) => { return a == b },
	'!=': (a, b) => { return a != b },
	'<': (a, b) => { return a < b },
	'>': (a, b) => { return a > b },
	'<=': (a, b) => { return a <= b },
	'>=': (a, b) => { return a >= b },
};
var use_binary_ops = Reflect.ownKeys(bopTable);

var uopTable = {
	'!': (a) => { }
};
var use_unary_ops = ['!'];

for (let k of Reflect.ownKeys(orig_binary_ops)) {
	if (!use_binary_ops.includes(k))
		jsep.removeBinaryOp(k);
}

for (let k of Reflect.ownKeys(orig_unary_ops))
	if (!use_unary_ops.includes(k))
		jsep.removeUnaryOp(k);


function isUndefOrNull(x) {
	return x === undefined || x === null
}

class ReturnValue {
	constructor(value) {
		this.value = value;
	}
}

function reduceApt_aux(t, defines, depth) {
	try {

		// Quick Fix - remap type "Literal" && raw in [ 'null', 'true', 'false'] 
		// to type "Identifier" with raw->name
		// Also do "this" for good luck
		if (t.type === "Literal") {
			if (['null', 'true', 'false'].includes(t.raw)) {
				t = {
					type: "Identifier",
					name: t.raw
				};
			}
		} else if (t.type === "ThisExpression") {
			t = {
				type: "Identifier",
				name: "this"
			};
		}



		switch (t.type) {
			case "LogicalExpression":
				{ let xxx = null; }
			// eslint-disable-next-line no-fallthrough
			case "BinaryExpression": {
				let retval = null;
				let o1 = reduceApt(t.left, defines, depth);
				let o2 = reduceApt(t.right, defines, depth);
				try {
					retval = bopTable[t.operator](o1.value, o2.value);
				} catch (e) {
					throw new JpUserError(`oper=${t.operator},opand1=${o1.value},opand2=${o2.value}`, e)
				}
				return new ReturnValue(retval)
			}
				break
			case "UnaryExpression": {
				let retval = null;
				let o1 = reduceApt(t.argument, defines, depth);
				try {
					retval = uopTable[t.operator](o1.value);
				} catch (e) {
					throw new JpUserError(`oper=${t.operator},opand1=${o1.value}`, e)
				}
				return new ReturnValue(retval)
			}
				break
			case "MemberExpression": {
				let lhs = null;
				//assert(t.object.type !== 'Literal')
				lhs = reduceApt(t.object, defines, depth);

				if (isUndefOrNull(lhs))
					throw new JpProgError("isUndefOrNull(lsh)")
				if (isUndefOrNull(lhs.value))
					throw new JpUserError("l.h.s. of MemberExpression is false-ish") // an expected error
				if (!(lhs.value instanceof Array)
					&& typeof lhs.value !== 'object')
					throw new JpUserError("l.h.s. of MemberExpression neither Array nor object") // expected

				if (!t.computed) {
					// dot notation
					return new ReturnValue(lhs.value[t.property.name])
				} else {
					let rhs = reduceApt(t.property, defines, depth);
					if (lhs.value instanceof Array) {
						if (typeof rhs.value === 'number') {
							return new ReturnValue(lhs.value[rhs.value])
						} else {
							throw new JpUserError(`array key is not a number`)
						}
					} else {
						let tmp = null;
						if (typeof rhs.value === 'string') {
							return new ReturnValue(lhs.value[rhs.value])
						} else {
							throw new JpUserError('object key is not a string')
						}

					}
				}
			}
				break
			case "CallExpression": {
				let redcallee = reduceApt(t.callee, defines, depth);
				if (!(redcallee.value instanceof Function$1))
					throw new JpUserError("CallExpression callee invalid identifier")
				if (redcallee.value.name !== 'def' && redcallee.value.name !== 'ndef')
					throw new JpProgError(`CallExpression name ${redcallee.name} unexpected`)
				let allTrue = true;
				let allFalse = true;
				let allCalced = true;
				let n = 0;
				for (let arg of t.arguments) {
					// each argument must have been calculated as a series of MemberExpressions

					let oneCalced = false, oneDefined = false;
					let redarg;
					try {
						redarg = reduceApt(arg, defines, depth);
					} catch (e) {
						oneCalced = true;
						oneDefined = false;
					}
					if (!oneCalced) {
						oneDefined = (redarg.value !== undefined);
					}
					allTrue = allTrue && oneDefined;
					allFalse = allFalse && !oneDefined;
					n++;
				}
				return new ReturnValue(redcallee.value.name == "def" ? allTrue : allFalse)
			}
				break
			case "Identifier": {
				// def ndef ???
				let notAllowed = ['this'];// also block these from input defines
				if (notAllowed.includes(t.name))
					throw new JpUserError(`not an allowed identifier: ${t.name}`)

				let luval = {
					// hard coded predefines go here
					true: true,
					false: false,
					null: null,
					undefined: undefined,
					def: new Function$1('def'),
					ndef: new Function$1('ndef'),
				}[t.name];
				if (luval === undefined)
					luval = defines[t.name];
				return new ReturnValue(luval)
			}
				break
			case "Literal":
				return new ReturnValue(t.value)
				break
			case "Compound": {
				throw new JpUserError(`Compound elements not allowed ${t.value}`)
			}
			default:
				throw new JpUserError(`Expression type not allowed: ${t.type}`)
		}
	}
	catch (e) {
		if (e instanceof PrependableError)
			throw e
		else
			throw new JpProgError('unexpected error', e)
	}
}

function reduceApt(t, defines, depth) {
	//console.log(`${depth}>>>>>>${JSON.stringify(t)}`)
	let res = reduceApt_aux(t, defines, depth + 1);
	return res
}

class JsepPreprocInterpret {
	constructor(jsonDefines) {
		this.jsonDefines = jsonDefines;
	}
	// a new expression is parsed and executed for every pre proc line
	// Each line result is  true or false
	execLineScript(lineScript) { // this can throw
		var parseTree = jsep(lineScript);
		return Boolean(reduceApt(parseTree, this.jsonDefines, 0).value)
	}

}

//import dedent from 'dedent'
//import jsep from 'jsep'
//import { AssertionError } from 'assert';

function queryVersion() { return "reversible-preproc 2.0.3" }

// globally disable all Mustache escaping 
Mustache.escape = function (text) { return text };

class RppError extends PrependableError {
  constructor(...params) {
    super(...params);
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
  const core = "[$A-Z_][0-9A-Z_$]*";
  return RegExp(`^${core}(.${core})*`, 'i')
}

function matchNextIdentifier(line) {
  let reres = /[^ \t]+/.exec(line);
  if (!reres)
    throw new RppError('no possible identifier found')
  let reValid = createIdentifierRegex();
  if (!reValid.test(reres[0]))
    throw new RppError(`found invalid identifier ${reres[0]}`)
  // parse into array
  let keys = reres[0].split('.');
  return { identifier: reres[0], index: reres.index, keys: keys }
}

function forcePropertyValue(obj, keys, value) {
  _assert(keys && keys.length > 0, 'keys null or empty');
  _assert(typeof obj === 'object',
    `obj must be type "object" not ${typeof obj}`);
  let parent = obj;
  for (let n = 0; n < keys.length - 1; n++) {
    if (!hasOwnKey(parent, keys[n]))
      parent[keys[n]] = {};
    else
      _assert(typeof parent[keys[n]] === 'object',
        `expecting typeof to be "object" but was ${typeof parent[keys[n]]}`);
    parent = parent[keys[n]];
  }
  parent[keys.slice(-1)] = value;
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
};

const reservedIdentifiers = [
  'true', 'false', 'null', 'undefined', 'def', 'ndef', 'EOL'
];

//const symMultiIn = Symbol('multiIn')
//const symMultiInEnd = Symbol('multiInEnd')

const symCmdAddDef = Symbol('cmdAddDef');
const symCmdAddDefJson = Symbol('cmdAddDefJson');
const symCmdAddDefEval = Symbol('cmdAddDefEval');
const symCmdIf = Symbol('cmdIf');
const symCmdIfEval = Symbol('cmdIfEval');
const symCmdElse = Symbol('cmdElse');
const symCmdElif = Symbol('cmdElif');
const symCmdElifEval = Symbol('cmdElifEval');
const symCmdEndif = Symbol('cmdEndif');
// const symCmdMacro = Symbol('cmdMacro')
const symCmdTpl = Symbol('cmdTpl');
const symCmdPartials = Symbol('cmdPartials');
const symCmdRender = Symbol('cmdRender');
// const symCmdTplRender = Symbol('cmdTplRender')
// const symCmdIfTplRender = Symbol('cmdIfTplRender')

const symAnnPlain = Symbol('annPlain');
const symAnnRendered = Symbol('annRendered');
const symAnnEndRendered = Symbol('annEndRendered');

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
      let body = '"use strict"\n' + str;
      let f = new Function('defines', body);
      let res = f(defines) ? true : false;
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

class RppCore {
  constructor(defines = {}, options = defaultOptions) {
    for (let k of Reflect.ownKeys(defaultOptions))
      if (!Reflect.ownKeys(options).includes(k))
        options[k] = defaultOptions[k];
    this.options = options;
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
      this.defines = defines;
    }
    //this.defines.EOL = options.eol
    this.jsepPreprocInterpret = new JsepPreprocInterpret(defines);
    this.linum = -1;
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
    };
    Object.seal(this.parseState);
    Object.seal(this.parseState.ifState);
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
    ];
    this.annsSorted = [
      [options.annPlain, symAnnPlain],
      [options.annRendered, symAnnRendered],
      [options.annEndRendered, symAnnEndRendered],
    ];
    this.cmdsSorted.sort((a, b) => {
      return (a[0].length < b[0].length) ? 1 :
        (a[0].length > b[0].length) ? -1 : 0
    });
    this.annsSorted.sort((a, b) => {
      return (a[0].length < b[0].length) ? 1 :
        (a[0].length > b[0].length) ? -1 : 0
    });
    Object.seal(this);
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
    maxIter = RppCore._renderMustache_maxIterDefault()) {
    // to allow for multi-level and recursive substitutions, loop until no more change
    let resPrev = null, res = tpl;
    let iter = 0;
    for (; res !== resPrev && iter < maxIter; iter++) {
      resPrev = res;
      res = Mustache.render(res, defines, partials);
    }
    if (iter == RppCore._renderMustache_maxIterDefault) {
      throw new RppError('too many Mustache iterations')
    }
    return res
  }

  _eol() { return this.options.eol }
  _makeOutupLineArr(line, res) {
    _assert(typeof res === 'string');
    let pre =
      this.options.annStem + this.options.annRendered;
    let post =
      this.options.annStem + this.options.annEndRendered;
    // the "post" line needs to be on a new line - enforce that
    // in case the rendered output doesnt
    let lineArr = [line]
      .concat([pre])
      .concat([res]) // line ends within res are responsibility of tpl etc.
      .concat([post]);
    return lineArr
  }


  // ignore line if only whitespace, else treat as first elt of array
  _arrLinesToStrSpecial(line, arrLines) {
    let ret = "";
    if (/[^ /t]/.test(line))
      ret = line + this._eol();
    for (let l of arrLines)
      ret += (l[0].substr(l[1], l[2]) + this._eol());
    return this._removeFinalEol(ret)
  }


  _processMultiLineCmd_addDef(sym, lines) {
    // first line must always contains lhs identifier
    //{ identifier: reres[0], index: reres.index, keys: keys }
    let lhsRes = matchNextIdentifier(lines[0]);
    //let identifierRegex = createIdentifierRegex()
    // let reRes0 = identifierRegex.exec(lines[0])
    // if (!reRes0)
    //   throw new RppError('lhs not found')
    // let lhs = reRes0[0]

    let rhs = this._arrLinesToStrSpecial(
      lines[0].substr(lhsRes.index + lhsRes.identifier.length + 1),
      lines.slice(1)
    );

    let val = rhs;
    switch (sym) {
      case symCmdAddDef:
        val = rhs;
        break
      case symCmdAddDefJson:
        val = JSON.parse(rhs);
        break
      case symCmdAddDefEval:
        {
          let body = '"use strict"\n' + rhs;
          let f = new Function('defines', body);
          val = f(this.defines);
        }
        break
      default: throw new RppError('programmer error')
    }

    forcePropertyValue(this.defines, lhsRes.keys, val);
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
        this._processMultiLineCmd_addDef(sym, lines);
        return null
      case symCmdIf:
      case symCmdIfEval:
      case symCmdElif:
      case symCmdElifEval:
        if ([symCmdElif, symCmdElifEval].includes(sym)) {
          _assert(!this.parseState.ifState.else, '"else" is active, "elif" not allowed');
          _assert(this.parseState.ifState.ifLinum >= 0, "can't have 'elif' without 'if' first");
          if (this.parseState.ifState.onClauseFound) {
            // ignore condition because if has already evaluated true 
            this.parseState.ifState.on = false;
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
            this.parseState.ifStack.push(this.parseState.ifState);

            // initialize new state
            this.parseState.ifState = createIfState({
              on: false,
              onAncestor: this.parseState.ifState.on
            });
            // this.parseState.ifState.else = false
            // this.parseState.ifState.onClauseFound = false
            // this.parseState.ifState.on = undefined
            // this.parseState.ifState.onLinum = -1
            // this.parseState.ifState.ifLinum = -1

            this.parseState.ifState.ifLinum = this.parseState.linum;
          }
          if (this.parseState.ifState.onAncestor
            && !this.parseState.ifState.onClauseFound) {
            let expr = this._arrLinesToStrSpecial(lines[0], lines.slice(1));

            let [isOn, err] = judgeLineArg(
              //lines.join(this._eol()),
              expr,
              this.defines,
              ([symCmdIf, symCmdElif].includes(sym) ? this.jsepPreprocInterpret : null)
            );
            if (err) throw new RppError('judgeLineArg error: ' + err)
            if (isOn) {
              this.parseState.ifState.onClauseFound = true;
            }
            this.parseState.ifState.on = isOn;
            //this.parseState.ifState.onLinum = this.parseState.linum
          }
          return null
        }
      case symCmdElse:
        {
          _assert(!this.parseState.ifState.else);
          this.parseState.ifState.else = true;
          this.parseState.ifState.on = (
            this.parseState.ifState.onAncestor
            && !this.parseState.ifState.onClauseFound);
          //this.parseState.ifState.onLinum = this.parseState.linum
          return null
        }
      case symCmdEndif:
        {
          if (!this.parseState.ifStack.length) {
            // too many end scope commnand - like unbalanced parentheses.
            throw new RppError(`unexpected end directive line ${this.linum}, (unbalanced?)`)
          }
          this.parseState.ifState = this.parseState.ifStack.pop();
          // [this.parseState.ifOn, this.parseState.ifOnLinum]
          //   = this.parseState.ifStack[this.parseState.ifStack.length - 1]
          // this.parseState.ifStack.pop()
          return null
        }
      case symCmdTpl:
        {
          let tpl = this._arrLinesToStrSpecial(lines[0], lines.slice(1));
          if (this.parseState.tplStr)
            this.parseState.tplStr += (this._eol() + tpl);
          else
            this.parseState.tplStr = tpl;
          return null
        }
      case symCmdPartials:
        {
          let partials = JSON.parse(lines.join(this._eol()));
          Object.assign(this.parseState.tplPartials, partials);
          return null
        }
      case symCmdRender:
        {
          let tpl = this._arrLinesToStrSpecial(lines[0], lines.slice(1));
          if (/\S+/.test(tpl))
            this.parseState.tplStr = tpl;

          _assert(this.parseState.tplStr, "this.parseState.tplStr");
          let res = RppCore._renderMustache(
            this.parseState.tplStr,
            this.defines,
            this.parseState.tplPartials
          );
          let lineArr = this._makeOutupLineArr(null, res);
          this.parseState.tplStr = null;
          this.parseState.tplPartials = {};
          return lineArr
        }
      default:
        throw new RppError(`symbol ${sym} unknown`)
    }
  }

  // return an array of lines to be output
  _procSingleNonCmdLine(line, wsOff) {
    let maybeStrippedLine = line;
    if (wsOff >= 0 && isSubstrEqual(line, wsOff, this.options.annStem)) {
      let annline = line.substr(wsOff + this.options.annStem.length);
      let [sym, length] = [null, 0];
      for (let item of this.annsSorted) {
        if (isSubstrEqual(annline, 0, item[0])) {
          sym = item[1];
          length = item[0].length;
        }
      }
      if (!sym)
        throw new RppError('ann command not found')
      switch (sym) {
        case symAnnRendered:
          this.parseState.renderedOn = true;
          return null // don't echo - will be regenerated on output if approp
        case symAnnEndRendered:
          _assert(this.parseState.renderedOn, "this.parseState.renderedOn");
          this.parseState.renderedOn = false;
          return null // don't echo - will be regenerated on output if approp 
        case symAnnPlain:
          // remove annotation from line and drop down to plain line behavior
          maybeStrippedLine = annline.substr(length + 1);
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
    _assert(typeof line === 'string');
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
      let tmpOut = [];
      let pushOut = (x) => {
        x = this._ensureEol(x);
        if (pushOutArg)
          pushOutArg(x);
        else
          tmpOut.push(x);
      };
      let callback1 = () => {
        switch (tmpOut.length) {
          case 0: return null
          case 1: return tmpOut[0]
          default: return tmpOut
        }
      };
      let wsOff;
      if (wsOffIn === null) {
        line = this._removeFinalEol(line); // in case input EOL !== output EOL
        wsOff = line.search(/\S/);
      } else {
        if (line.length)
          _assert(line.slice(0, -1)[0] !== '\n', 'input line ends in newline');
        wsOff = wsOffIn;
      }
      this.parseState.linum++; // first line is line 1

      // should we search for line head?
      if (!this.parseState.multiLineIn.cmdSym) {
        if (wsOff >= 0 && isSubstrEqual(line, wsOff, this.options.cmdStemMultiStart)) {
          // begin multiIn
          let cmdline = line.slice(wsOff + this.options.cmdStemMultiStart.length);
          let cmdlineStart = wsOff + this.options.cmdStemMultiStart.length;

          let haveEnd = false;
          let idxEnd = cmdline.indexOf(this.options.cmdStemMultiEnd);
          if (idxEnd >= 0) {
            cmdline = cmdline.slice(0, idxEnd);
            haveEnd = true;
          } else {
            idxEnd = cmdline.length;
          }
          let item = this._whichCmd(cmdline, 0); // throws if no cmd found
          this.parseState.multiLineIn.cmdSym = item[1];
          this.parseState.multiLineIn.lines.push(
            line.slice(cmdlineStart + item[0].length + 1, cmdlineStart + idxEnd)
          );
          this.parseState.multiLineIn.endDetected = haveEnd;
          // [
          //   line,
          //   cmdlineStart + item[0] + 1,
          //   cmdlineStart + idxEnd
          // ]
          pushOut(line);  // echo the command line
          if (!haveEnd)
            return callback(null, callback1())
        } else if (wsOff >= 0 && isSubstrEqual(line, wsOff, this.options.cmdStem)) {
          let cmdline = line.slice(wsOff + this.options.cmdStem.length);
          let cmdlineStart = wsOff + this.options.cmdStem.length;
          let item = this._whichCmd(cmdline, 0); // throws if no cmd found
          this.parseState.multiLineIn.cmdSym = item[1];
          this.parseState.multiLineIn.lines.push(
            line.slice(cmdlineStart + item[0].length + 1)
          );
          // [
          //   line,
          //   cmdlineStart + item[0] + 1,
          //   line.length
          // ]
          this.parseState.multiLineIn.endDetected = true;
          pushOut(line);  // echo the command line
        }
      } else { // this.parseState.multiLineIn.cmdSym is not null
        // multiline input continuation
        let idxEnd = line.length;
        //let cmdline = line
        let haveEnd = false;
        if (wsOff >= 0) {
          let tmp = line.substr(wsOff).indexOf(this.options.cmdStemMultiEnd);
          if (tmp >= 0) {
            idxEnd = wsOff + tmp;
            haveEnd = true;
          }
        }
        this.parseState.multiLineIn.lines.push([line, 0, idxEnd]);
        this.parseState.multiLineIn.endDetected = haveEnd;
        pushOut(line);  // echo the command line
        if (!haveEnd)
          return callback(null, callback1())
      }
      if (this.parseState.multiLineIn.endDetected) {
        // process accumulated command lines and return result
        // except when (not if related and if-occluded)
        let lineOutArr;
        if ([symCmdIf, symCmdIfEval, symCmdElif, symCmdElifEval,
          symCmdElse, symCmdEndif]
          .includes(this.parseState.multiLineIn.cmdSym)
          || this.parseState.ifState.ifLinum < 0
          || this.parseState.ifState.on) {
          lineOutArr = this._processMultiLineCmd(
            this.parseState.multiLineIn.cmdSym,
            this.parseState.multiLineIn.lines
          );
        }
        this.parseState.multiLineIn.cmdSym = null;
        this.parseState.multiLineIn.lines = [];
        this.parseState.multiLineIn.endDetected = false;

        _assert(pushOut);
        {
          if (lineOutArr)
            for (let lineOut of lineOutArr)
              if (lineOut)
                pushOut(lineOut);
          return callback(null, callback1())
        }
      } // if (this.parseStart.multiLineIn.endDetected)

      // all thats left now are other-than-commands
      {
        let lineOutArr = this._procSingleNonCmdLine(line, wsOff);
        if (lineOutArr)
          for (let lineOut of lineOutArr)
            pushOut(lineOut);
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

} // class RppCore

// // the following alias class should eventually be deleted
// export default class ReversiblePreproc extends RppCore {
//   constructor(...args) { super(...args) }
// }

/* eslint-disable no-unused-vars */


function* lineGen(text) {
  let arr = text.split('\n');
  for (const line of arr.slice(0, -1))
    yield line;
  // only send out last line if it has length > 0
  if (arr.slice(-1)[0].length)
    yield arr.slice(-1)[0];

}

function test3() {
  // test the matchTest algoritm
  let ppJson = {
    choice1: 1,
    choice2: 2,
    choice3: 3,
    choice4: {
      x: 1, y: 2
    },
    def1: {},
    def2: null,
    def3: 0,
    def4: undefined,
    BAR: 'bar',
    foo: { bar: { baz: 1 } }
  };

  // eslint-disable-next-line no-unexpected-multiline
  let textblock =
    `//--if choice1===1 && choice3===3
0
//--endif
//--if choice1===2 && choice3==3
1
//--endif
//--if !(choice1===2) && choice3==3
0
//--endif
//--if choice2===2&&choice3===3
0
//--endif
//--if choice4
0
//--endif
//--if choice4.y==2
0
//--endif
//--if def1
0
//--endif
//--if def2||def3||def4
1
//--endif
//--if foo.bar===foo[BAR]
0
//--endif
//--if (choice4.x<2&&choice4.x>0)
0
//--endif
`;
  //const readable = Readable.from(lineGen(textblock))
  let rp1 = new RppCore(ppJson);
  //for await (const line of readable) {    
  for (const line of lineGen(textblock)) {
    //console.log(line)
    let [err1, line1] = rp1.line(line);
    if (err1) throw err1
    //console.log(line1)
    assert__default.ok(line1[0] == '0' || line1.substr(0, 2) === '//',
      "unexpected ouput");
  }
  console.log("test3 passed");
  return true
}

function test4() {
  // test the matchTest algoritm
  let ppJson = {
    choice1: 1,
    foo: { bar: { baz: 1 } },
  };
  let textblock =
    `
//--if choice1.f00
//--if choice1[0]
//--if 'foo'['bar']
`;
  //const readable = Readable.from(lineGen(textblock))
  //for await (const line of readable) {
  let lines = textblock.split('\n');
  for (let linein of lines) {
    let rp1 = new RppCore(ppJson);
    //let [err1,line1]=[null,null]
    let outp = rp1.line(linein);
    assert__default.ok(outp && outp instanceof Array && outp.length === 2);
    let err1 = outp[0];
    let lineout = outp[1];
    assert__default.ok(err1 || (lineout && typeof lineout === 'string'));
    if (!(err1 || lineout === '\n' || lineout.includes("--endif")))
      throw new Error(linein, lineout)
    // || err1, "expected error")
  }
  console.log("test4 passed");
  return true
}



function testLineIfDirective(definesJson, lineWithIfDirective, boolErrExpected, boolResultExpected = null) {
  let rp1 = new RppCore(definesJson);
  let [err, lineOut] = rp1.line(lineWithIfDirective);

  assert__default.ok(Boolean(boolErrExpected) == Boolean(err), "err status did not match expected");
  if (!boolErrExpected) {
    let [err, lineOut2] = rp1.line("xx");
    if (err) throw "testLineIfDirective: unexpected err [1]"
    let result = null;
    switch (lineOut2.substr(0, 2)) {
      case 'xx': result = true; break
      case '//': result = false; break
      default: throw 'testLineIfDirective: unexpected err [2]'
    }
    assert__default.ok(Boolean(result) == Boolean(boolResultExpected));
  }
}

function testByLine() {
  console.log("start testByLine()");
  testLineIfDirective({ foo: { bar: 0 } }, "//--if def( foo['bar'].baz )", false, false);
  testLineIfDirective({ foo: { bar: 0 } }, "//--if foo.'bar'", true);
  testLineIfDirective({ foo: { bar: 0 } }, "//--if foo['bar'].baz", true);
  testLineIfDirective({}, "//--if null", false, false);
  testLineIfDirective({}, "//--if undefined", false, false);
  testLineIfDirective({}, "//--if true", false, true);
  testLineIfDirective({}, "//--if false", false, false);
  testLineIfDirective({ foo: { bar: 0 } }, "//--if def(foo.bar)", false, true);
  testLineIfDirective({}, "//--if this.rhs", true);
  testLineIfDirective({ foo: { bar: 0 } }, "//--if def(foo['baz'])", false, false);
  console.log("testByLine() success");
  return true
}
//testByLine()


const tplTestData1 = [
  [
    { version: "1.0.0" },
    dedent`
    //--tpl const versionString = "{{version}}"
    //--render
    `,
    dedent`
    //--tpl const versionString = "{{version}}"
    //--render
    //!!rendered
    const versionString = "1.0.0"
    //!!endRendered
    `
  ],
  [
    { ASSERT: 'if (!({{> arg}})) throw "{{> arg}}"' },
    dedent`
    //--tpl {{ASSERT}}
    //--partials {"arg":"0<1"}
    //--render
    `,
    dedent`
    //--tpl {{ASSERT}}
    //--partials {"arg":"0<1"}
    //--render
    //!!rendered
    if (!(0<1)) throw "0<1"
    //!!endRendered
    `
  ],
  [
    {},
    dedent`
    //--addDef ASSERT if (!({{> arg}})) throw "{{> arg}}"
    //--tpl {{ASSERT}}
    //--partials {"arg":"0<1"}
    //--render
    `,
    dedent`
    //--addDef ASSERT if (!({{> arg}})) throw "{{> arg}}"
    //--tpl {{ASSERT}}
    //--partials {"arg":"0<1"}
    //--render
    //!!rendered
    if (!(0<1)) throw "0<1"
    //!!endRendered
    `
  ],
];

const tplTestData2 = [
  [
    {},
    dedent`
    //--addDefJson array ["A","B","C"]
    //--tpl {{#array}}{{.}}{{/array}}
    //--render
    `,
    dedent`
    //--addDefJson array ["A","B","C"]
    //--tpl {{#array}}{{.}}{{/array}}
    //--render
    //!!rendered
    ABC
    //!!endRendered
    `
  ],
  [
    {},
    dedent`
    //--addDefEval array return ['A','B','C']
    //--tpl {{#array}}{{.}}{{/array}}
    //--render
    `,
    dedent`
    //--addDefEval array return ['A','B','C']
    //--tpl {{#array}}{{.}}{{/array}}
    //--render
    //!!rendered
    ABC
    //!!endRendered
    `
  ],
  [
    {},
    dedent`
    //--addDefJson array ["A","B","C"]
    //--tpl {{#array}}{{.}}{{/array}}
    //--render
    `,
    dedent`
    //--addDefJson array ["A","B","C"]
    //--tpl {{#array}}{{.}}{{/array}}
    //--render
    //!!rendered
    ABC
    //!!endRendered
    `
  ],
  [
    {},
    dedent`
    //--addDefJson array ["A","B","C"]
    //--tpl {{#array}}
    //--tpl const sym{{.}} = Symbol("{{.}}")
    //--tpl {{/array}}
    //--render
    `,
    dedent`
    //--addDefJson array ["A","B","C"]
    //--tpl {{#array}}
    //--tpl const sym{{.}} = Symbol("{{.}}")
    //--tpl {{/array}}
    //--render
    //!!rendered
    const symA = Symbol("A")
    const symB = Symbol("B")
    const symC = Symbol("C")
    //!!endRendered
    `
  ],
  [
    {},
    dedent`
    //--addDefJson array ["A","B","C"]
    /*--tpl 
    {{#array}}
    const sym{{.}} = Symbol("{{.}}")
    {{/array}}
    --end*/
    //--render
    `,
    dedent`
    //--addDefJson array ["A","B","C"]
    /*--tpl 
    {{#array}}
    const sym{{.}} = Symbol("{{.}}")
    {{/array}}
    --end*/
    //--render
    //!!rendered
    const symA = Symbol("A")
    const symB = Symbol("B")
    const symC = Symbol("C")
    //!!endRendered
    `
  ],
  [
    {},
    dedent`
    //--addDefJson array ["A","B","C"]
    /*--render
    {{#array}}
    const sym{{.}} = Symbol("{{.}}")
    {{/array}}
    --end*/
    `,
    dedent`
    //--addDefJson array ["A","B","C"]
    /*--render
    {{#array}}
    const sym{{.}} = Symbol("{{.}}")
    {{/array}}
    --end*/
    //!!rendered
    const symA = Symbol("A")
    const symB = Symbol("B")
    const symC = Symbol("C")
    //!!endRendered
    `
  ],
];

const tplTestData3 = [
  [
    {},
    dedent`
    /*--addDef x.y.z.test
    A
    B
    C
    --end*/
    //--tpl {{x.y.z.test}}
    //--render  
    `,
    dedent`
    /*--addDef x.y.z.test
    A
    B
    C
    --end*/
    //--tpl {{x.y.z.test}}
    //--render
    //!!rendered
    A
    B
    C
    //!!endRendered
    `
  ],
];

const tplTestData4 = [
  [
    { debug: true, debugLevel: 3 },
    dedent`
    //--if debug && debugLevel>=3
    xxx
    //--endif
    yyy
    `,
    dedent`
    //--if debug && debugLevel>=3
    xxx
    //--endif
    yyy
    `
  ], [
    { debug: true, debugLevel: 2 },
    dedent`
    //--if debug && debugLevel>=3
    xxx
    //--endif
    yyy
    `,
    dedent`
    //--if debug && debugLevel>=3
    //!!plain xxx
    //--endif
    yyy
    `
  ], [
    { debug: true, debugLevel: 3 },
    dedent`
    //--if debug && debugLevel>=3
    //!!plain xxx
    //--endif
    yyy
    `,
    dedent`
    //--if debug && debugLevel>=3
    xxx
    //--endif
    yyy
    `
  ],
];

const tplTestData5 = [
  [
    { debug: true, debugLevel: 3 },
    dedent`
    //--ifEval return defines.debug && defines.debugLevel>=3
    xxx
    //--endif
    yyy
    `,
    dedent`
    //--ifEval return defines.debug && defines.debugLevel>=3
    xxx
    //--endif
    yyy
    `
  ], [
    { debug: true, debugLevel: 2 },
    dedent`
    //--ifEval return defines.debug && defines.debugLevel>=3
    xxx
    //--endif
    yyy
    `,
    dedent`
    //--ifEval return defines.debug && defines.debugLevel>=3
    //!!plain xxx
    //--endif
    yyy
    `
  ], [
    { debug: true, debugLevel: 3 },
    dedent`
    //--ifEval return defines.debug && defines.debugLevel>=3
    //!!plain xxx
    //--endif
    yyy
    `,
    dedent`
    //--ifEval return defines.debug && defines.debugLevel>=3
    xxx
    //--endif
    yyy
    `
  ],
];

const tplTestData6 = [
  [
    { debug: true, debugLevel: 3 },
    dedent`
    //--ifEval return defines.debug && defines.debugLevel>=3
    xxx
    //--else
    yyy
    //--endif
    `,
    dedent`
    //--ifEval return defines.debug && defines.debugLevel>=3
    xxx
    //--else
    //!!plain yyy
    //--endif
    `
  ],
  [
    { debug: true, debugLevel: 2 },
    dedent`
    //--ifEval return defines.debug && defines.debugLevel>=3
    xxx
    //--else
    yyy
    //--endif
    `,
    dedent`
    //--ifEval return defines.debug && defines.debugLevel>=3
    //!!plain xxx
    //--else
    yyy
    //--endif
    `
  ],
  [
    { debug: true, debugLevel: 2 },
    dedent`
    //--if debug && debugLevel>=3
    xxx
    //--elif debug && debugLevel===2
    yyy
    //--else
    zzz
    //--endif
    `,
    dedent`
    //--if debug && debugLevel>=3
    //!!plain xxx
    //--elif debug && debugLevel===2
    yyy
    //--else
    //!!plain zzz
    //--endif
    `
  ],
];

const tplTestData7 = [
  [
    Object.assign(
      JSON.parse('{"a":{"b":2}, "dev":{"testA":true,"Bsource":"testB"}}'),
      { packageJson: { name: 'test', version: '0.0.0', description: 'TEST' } }
    ),
    dedent`
    /* 
    This is an example file only for the purpose of testing 
    reversible-preproc-cli
    It is not meant to be run as a program
    */
    //--if dev.testA
    import A from 'TestA' 
    //--else
    import A from 'A' 
    //--endif
    //--render import B from {{dev.Bsource}}
    
    /* nonesense follows */
    //--if def(a.z)
    console.log('a.z defined')
    //--elif a.b===1
    console.log('a.b is 1')
    //--else
      //--render console.log('a.b is {{a.b}}')
    //--endif
    
    //--if ndef(packageJson)
    
    /* 'packageJson' can be added to 'defines' externally as input to 
       reversible-preprocess-cli (recommended).  However it is also possible to load it 
       during execution via 'eval' as shown here:
    */ 
    /*--addDefEval packageJson
    import fs = from 'fs';
    let raw = fs.readFileSync('fake-package.json');
    return JSON.parse(raw);
    --end*/
    
    //--endif
    
    /*--render 
    function queryVersion(){
       return 
       '{{packageJson.name}} {{packageJson.version}} - {{packageJson.description}}'
    }
    --end*/
    
    /* macro style for symbol definition
    /*--addDefJson symstrings [
    "A",
    "B",
    "C",
    "D",
    "E",
    "F" 
    ] --end*/
    /*--render 
    {{#symstrings}}
    const sym{{.}} = Symbol("{{.}}")
    {{/symstrings}}
    --end*/
        `,
    dedent`
    /* 
    This is an example file only for the purpose of testing 
    reversible-preproc-cli
    It is not meant to be run as a program
    */
    //--if dev.testA
    import A from 'TestA' 
    //--else
    //!!plain import A from 'A' 
    //--endif
    //--render import B from {{dev.Bsource}}
    //!!rendered
    import B from testB
    //!!endRendered

    /* nonesense follows */
    //--if def(a.z)
    //!!plain console.log('a.z defined')
    //--elif a.b===1
    //!!plain console.log('a.b is 1')
    //--else
      //--render console.log('a.b is {{a.b}}')
    //!!rendered
    console.log('a.b is 2')
    //!!endRendered
    //--endif

    //--if ndef(packageJson)
    //!!plain 
    //!!plain /* 'packageJson' can be added to 'defines' externally as input to 
    //!!plain    reversible-preprocess-cli (recommended).  However it is also possible to load it 
    //!!plain    during execution via 'eval' as shown here:
    //!!plain */ 
    /*--addDefEval packageJson
    import fs = from 'fs';
    let raw = fs.readFileSync('fake-package.json');
    return JSON.parse(raw);
    --end*/
    //!!plain 
    //--endif
    
    /*--render 
    function queryVersion(){
       return 
       '{{packageJson.name}} {{packageJson.version}} - {{packageJson.description}}'
    }
    --end*/
    //!!rendered
    function queryVersion(){
       return 
       'test 0.0.0 - TEST'
    }
    //!!endRendered

    /* macro style for symbol definition
    /*--addDefJson symstrings [
    "A",
    "B",
    "C",
    "D",
    "E",
    "F" 
    ] --end*/
    /*--render 
    {{#symstrings}}
    const sym{{.}} = Symbol("{{.}}")
    {{/symstrings}}
    --end*/
    //!!rendered
    const symA = Symbol("A")
    const symB = Symbol("B")
    const symC = Symbol("C")
    const symD = Symbol("D")
    const symE = Symbol("E")
    const symF = Symbol("F")
    //!!endRendered
    `
  ],
];


class TestTplOut {
  constructor() {
    this.lines = [];
  }
  push(line) {
    //if (line) process.stdout.write(line)
    this.lines.push(line);
  }
}

function testTpl(testData, testnum = -1) {
  for (let item of testData) {
    let rpp = new RppCore(item[0]);
    let tto = new TestTplOut;
    let inp = item[1].split('\n');
    for (let linein of inp) {
      let [err, dummy] = rpp.line(linein, tto.push.bind(tto));
      assert__default.ok(dummy === null, "dummy===null");
      if (err)
        throw err
    }
    {
      //let compare = inp.concat(item[2].split('\n'))
      let compare = item[2].split('\n');
      let outarr = [];
      for (let n = 0; n < tto.lines.length; n++) {
        outarr = outarr.concat(tto.lines[n].split('\n'));
        if (tto.lines[n].slice(-1) === '\n')
          outarr = outarr.slice(0, -1);
      }
      assert__default.ok(compare.length === outarr.length, "compare.length===outarr.length");
      for (let n = 0; n < outarr.length; n++) {
        assert__default.ok(outarr[n] === compare[n], `${outarr[n]} === ${compare[n]}`);
      }
      //process.stdout.write("========================================" + '\n')
    }
  }
  console.log(`testTpl() #${testnum} passed`);
  return true
}


class CompareLines {
  constructor(writeFn) {
    this.buf = [
      { lines: [], last: 0 },
      { lines: [], last: 0 },
    ];
    if (writeFn) {
      this.writeStream = fs.createWriteStream(writeFn);
    }
  }
  async flushWriteStream() {
    // these is no flush, so instead we write a zero length string and use callback
    // to call resolve
    if (!this.writeStream)
      return
    await new Promise((resolve) => {
      this.writeStream.write("", () => {
        //console.log(args[2])
        resolve();
      });
    });
  }

  // making push `async` doesn't work because push is executed in rpp.line, 
  // which is a synchronous function.
  /*async*/ push(line, n) {
    if (n == 0 && this.writeStream) {
      this.writeStream.write(line, () => {
        process.stdout.write(line);
      });
    }

    if (n == 0) {
      let lns = line.split(/\r?\n/);
      assert__default.ok(lns.length > 1, 'TEST CODE: expected # of split lines > 1');
      for (let ln of lns.slice(0, -1)) {
        this.buf[0].lines.push(ln);
        this.buf[0].last++;
      }
      return
    }
    // from here is case n===1
    this.buf[1].lines.push(line);
    this.buf[1].last++;
    assert__default.ok(this.buf[0].last >= this.buf[1].last, 'buf[1].last should be <= buf[0].last');
    let idx0 = this.buf[0].lines.length - 1 - (this.buf[0].last - this.buf[1].last);
    assert__default.ok(idx0 >= 0);
    // the expected (buf[1]) lines are without EOL marker.
    //let reres0 = /\r{0,1}\n$/.exec(this.buf[0].lines[idx0])
    //assert.ok(reres0, "no eol at end of output line")
    let strOut = this.buf[0].lines[idx0];
    let strExp = this.buf[1].lines.slice(-1)[0];
    //    if (this.buf[1].lines.slice(-1)
    //      !== this.buf[0].lines[idx0].slice(0, reres0.index)) {
    if (strOut !== strExp) {
      this.showCompareLast(10);
      throw dedent`
      FAIL lines not equal at line # ${this.buf[1].last}
      expected:
      ${this.buf[1].lines.slice(-1)}
      actual:
      ${this.buf[0].lines[idx0]}
      `
    }
  }
  showCompareLast(cnt) {
    if (cnt > this.buf[1].lines.length)
      cnt = this.buf[1].lines.length;

    let idx0 = this.buf[1].lines.length - 1
      - (this.buf[1].last - this.buf[0].last);

    console.log('========== previous lines context =============');
    for (let line of this.buf[1].lines.slice(-cnt, -1))
      console.log(line);
    console.log('=========== output line   ===============');
    console.log(this.buf[0].lines[idx0]);
    console.log('============ expected line ==============');
    console.log(this.buf[1].lines.slice(-1)[0]);
    console.log('============               ==============');
  }
}

async function testRppExpectedFile(
  inFilename, definesFilename, evalDefines, expFilename = null, writeFn = null) {
  async function* getline(rl) {
    for await (const line of rl) {
      yield (line);
    }
    //console.log('leaving getline')
  }
  try {

    let defines = {};
    if (evalDefines) {
      let text = fs.ReadFileSync(definesFilename);
      let body = dedent`
    'use strict'
    return ${text}
    `;
      defines = (Function(body))();
    } else if (definesFilename) {
      let text = fs.readFileSync(definesFilename);
      defines = JSON.parse(text);
    }
    let rpp = new RppCore(defines);

    //  return new Promise((resolve, reject) => {
    const instream = readline.createInterface({
      input: fs.createReadStream(inFilename),
    });
    let expstream = null;
    if (expFilename) {
      expstream = readline.createInterface({
        input: fs.createReadStream(expFilename),
      });
    }
    let ingen = getline(instream);
    let expgen;
    if (expstream)
      expgen = getline(expstream);

    //let inline, expline
    //let expDone = false
    let cl = new CompareLines(writeFn);
    let push0 = (line) => { cl.push(line, 0); };
    let push1 = (line) => { cl.push(line, 1); };

    while (true) {
      let inline = await ingen.next();
      if (inline.done)
        break
      //console.log(`in :: ${inline.value}`)
      //let buf0Last = cl.buf[0].last

      let [err, _ignore] = rpp.line(inline.value, push0);
      // let err = await new Promise((resolve, reject) => {
      //   rpp.line(inline.value, push0, (e) => {
      //     resolve(e)
      //   })
      // })
      // if necessary flush lines to cl writeFile
      await cl.flushWriteStream();

      if (err)
        throw err
      if (!expgen)
        continue
      while (cl.buf[0].last > cl.buf[1].last) {
        let expline;
        expline = await expgen.next();
        if (expline.done) {
          console.log('exp:: DONE (early)');
          cl.showCompareLast(10);
          //expDone = false
          throw 'exp:: DONE (early)'
        } else {
          cl.push(expline.value, 1); // throws if not line eq
        }
      } // while
    }
    if (expgen) {
      let expline = await expgen.next();
      if (!expline.done) {
        console.log('in done but exp not done');
        cl.showCompareLast(10);
        throw 'in done but exp not done'
      }
    }
    console.log(
      dedent`
    SUCCESS
    sourcefile: ${inFilename}
    defines file: ${definesFilename}
    `);
    if (expFilename)
      console.log(`expect filename: ${expFilename}`);
    if (writeFn)
      console.log(`write filename: ${writeFn}`);

    return true
  } catch (e) {
    console.log(e);
    console.log(
      dedent`
    FAILURE
    sourcefile: ${inFilename}
    defines file: ${definesFilename}
    `);
    if (expFilename)
      console.log(`expect filename: ${expFilename}`);
    if (writeFn)
      console.log(`write filename: ${writeFn}`);
    throw e
  }
}

const testRppExpected_data = [
  [
    './test/data/in.demo0.js',
    './test/data/defines.demo0.json', false,
    './test/data/exp.demo0.js',
  ],
  // [
  //   './test/data/in.1.js',
  //   './test/data/defines.1.json', false,
  //   null,
  //   './test/data/out.1.1.js',
  // ],
  [
    './test/data/in.tm1.js',
    './test/data/defines.tm1.json', false,
    './test/data/exp.tm1.tm1.js',
  ],
];

async function testRppExpected() {

  for (let args of testRppExpected_data) {
    await testRppExpectedFile(...args);
  }

  // await testRppExpectedFile(
  //   './test/data/in.1.js',
  //   './test/data/defines.1.json', false,
  //   null,
  //   './test/data/out.1.1.json',
  // )
  // await testRppExpectedFile(
  //   './test/data/in.1.js',
  //   './test/data/defines.1.json', false,
  //   './test/data/exp.1.1.json',
  //   //'./test/data/out.1.1.json',
  // )
}

function testAll() {
  try {
    console.log(RppCore.queryVersion());
    // xxx test1()
    // xxx test2()
     test3();
     test4();
     testByLine();
    testTpl(tplTestData1, 1);
    testTpl(tplTestData2, 2);
    testTpl(tplTestData3, 3);
    testTpl(tplTestData4, 4);
    testTpl(tplTestData5, 5);
    testTpl(tplTestData6, 6);
    testTpl(tplTestData7, 7);
    console.log('testAll PASS');
    return true
  } catch (e) {
    console.log(e);
    console.log('testAll FAIL');
    return false
  }
}

exports.testAll = testAll;
exports.testRppExpected = testRppExpected;
