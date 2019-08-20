/* eslint-disable no-unreachable */
/* eslint-disable no-unused-vars */
'use strict'

import  jsep  from 'jsep'
import JpBaseError from './prependable-error.mjs'

// JpBaseError can prepend msg to existing error
// whether the existing error is instanceof Error or not.
// New 'stack' is also prepended.


class JpUserError extends JpBaseError {
	constructor(...args) {
		super(...args)
	}
}
class JpProgError extends JpBaseError {
	constructor(...args) {
		super(...args)
	}
}


class Function {
	constructor(name) {
		this.name = name
	}
}


var t = null
var orig_unary_ops = { '-': t, '!': t, '~': t, '+': t }
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
}

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
}
var use_binary_ops = Reflect.ownKeys(bopTable)

var uopTable = {
	'!': (a) => { !a }
}
var use_unary_ops = ['!']

for (let k of Reflect.ownKeys(orig_binary_ops)) {
	if (!use_binary_ops.includes(k))
		jsep.removeBinaryOp(k)
}

for (let k of Reflect.ownKeys(orig_unary_ops))
	if (!use_unary_ops.includes(k))
		jsep.removeUnaryOp(k)


// var defines = {
//     DEBUG: 6,
//     TEST1: null,
//     foo: { bar: { baz: 'oof' } },
//     oof: { bar: { baz: 'foo' } },
//     arr: ['ZORK', 'BADO', 'TLUK', 'bar', 'baz',],
//     tonum: { zork: 0, bado: 1, tluk: 2 },
//     tonam: ['zork', 'bado', 'tluk'],
//     ZORK: 0,
//     BADO: 1,
//     TLUK: 2,
// }

function assert(cond) {
	if (!cond) throw "error"
}


function isUndefOrNull(x) {
	return x === undefined || x === null
}
function undefNullToFalse(x) {
	return isUndefOrNull(x) ? false : x
}

class ReturnValue {
	constructor(value) {
		this.value = value
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
				}
			}
		} else if (t.type === "ThisExpression") {
			t = {
				type: "Identifier",
				name: "this"
			}
		}



		switch (t.type) {
			case "LogicalExpression":
				{ let xxx = null }
			// eslint-disable-next-line no-fallthrough
			case "BinaryExpression": {
				let retval = null
				let o1 = reduceApt(t.left, defines, depth)
				let o2 = reduceApt(t.right, defines, depth)
				try {
					retval = bopTable[t.operator](o1.value, o2.value)
				} catch (e) {
					throw new JpUserError(`oper=${t.operator},opand1=${o1.value},opand2=${o2.value}`, e)
				}
				return new ReturnValue(retval)
			}
				break
			case "UnaryExpression": {
				let retval = null
				let o1 = reduceApt(t.argument, defines, depth)
				try {
					retval = uopTable[t.operator](o1.value)
				} catch (e) {
					throw new JpUserError(`oper=${t.operator},opand1=${o1.value}`, e)
				}
				return new ReturnValue(retval)
			}
				break
			case "MemberExpression": {
				let lhs = null
				//assert(t.object.type !== 'Literal')
				lhs = reduceApt(t.object, defines, depth)

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
					let rhs = reduceApt(t.property, defines, depth)
					if (lhs.value instanceof Array) {
						if (typeof rhs.value === 'number') {
							return new ReturnValue(lhs.value[rhs.value])
						} else {
							throw new JpUserError(`array key is not a number`)
						}
					} else {
						let tmp = null
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
				let redcallee = reduceApt(t.callee, defines, depth)
				if (!(redcallee.value instanceof Function))
					throw new JpUserError("CallExpression callee invalid identifier")
				if (redcallee.value.name !== 'def' && redcallee.value.name !== 'ndef')
					throw new JpProgError(`CallExpression name ${redcallee.name} unexpected`)
				let allTrue = true
				let allFalse = true
				let allCalced = true
				let n = 0
				for (let arg of t.arguments) {
					// each argument must have been calculated as a series of MemberExpressions

					let oneCalced = false, oneDefined = false
					let redarg
					try {
						redarg = reduceApt(arg, defines, depth)
					} catch (e) {
						oneCalced = true
						oneDefined = false
					}
					if (!oneCalced) {
						oneDefined = (redarg.value !== undefined)
					}
					allTrue = allTrue && oneDefined
					allFalse = allFalse && !oneDefined
					n++
				}
				return new ReturnValue(redcallee.value.name == "def" ? allTrue : allFalse)
			}
				break
			case "Identifier": {
				// def ndef ???
				let notAllowed = ['this']// also block these from input defines
				if (notAllowed.includes(t.name))
					throw new JpUserError(`not an allowed identifier: ${t.name}`)

				let luval = {
					// hard coded predefines go here
					true: true,
					false: false,
					null: null,
					undefined: undefined,
					def: new Function('def'),
					ndef: new Function('ndef'),
				}[t.name]
				if (luval === undefined)
					luval = defines[t.name]
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
		if (e instanceof JpBaseError)
			throw e
		else
			throw new JpProgError('unexpected error', e)
	}
}

function reduceApt(t, defines, depth) {
	//console.log(`${depth}>>>>>>${JSON.stringify(t)}`)
	let res = reduceApt_aux(t, defines, depth + 1)
	return res
}

class JsepPreprocInterpret {
	constructor(jsonDefines) {
		this.jsonDefines = jsonDefines
	}
	// a new expression is parsed and executed for every pre proc line
	// Each line result is  true or false
	execLineScript(lineScript) { // this can throw
		var parseTree = jsep(lineScript)
		return Boolean(reduceApt(parseTree, this.jsonDefines, 0).value)
	}

}


export default JsepPreprocInterpret
