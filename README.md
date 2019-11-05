# 'reversible-preproc' Usage Documentation 

Version 2.0.3

*Note: Version `2.x.x` is a breaking change from version `1.x.x`.*

## 1. Outline


![Fig 1. Flowchart](./rpp-flow.svg)




This module enables the following preprocessor functionalities to be applied to a source file:
 - a "defines" object passed as an argument into the processor.
 - template rendering with Mustache syntax, using "defines" object values as arguments
 - condtional expressions evaluated with respect to the "defines" object values.
 - nested if/elif/else/endif functionality, using as arguments the conditional expressions.
   - both ordinary code and process templates code may be enabled/masked within using if related  commands. 
 - ability to modify the "defines" object from the source, adding template and template arguments, allowing reuse.

The mustache template syntax is implemented with the [npm *mustache*](https://www.npmjs.com/package/jsep) module.

The conditional expression are parsed to APT (abstract parse tree) form using the [npm *jsep*](https://www.npmjs.com/package/jsep) module,
then reduced to boolean using a simple in-this-module interpreter.

The *"reversible"* moniker indicates that it is suitable for lightweight switching back 
and forth between configuations (e.g., in-place switching between browser and node versions).  
Specifically, the output of processing *source* with defines object *defA*
is the same as taking the output of processing *source* with defines object *defB* and processing that 
with defines object *defA*, for arbitrary *defA* and *defB* (assuming no errors).  In psuedo-code 

```
proc(source,defA) === proc(proc(source,defB),defA)
```

The interface for passing the source is a function *line(...)* which expects one line of source 
code at time.  The following sibling npm modules provide higher level interfaces:

 - *reversible-preproc-cli* : a CLI for processing whole files
 - *gulp-reversible-preproc* : an interface providing a *gulp* style pipe for the npm *gulp* module. 

Lines which are not not subject to processing will be
simply checked for a command after whitespace and then passed directly to output.
Only certain processing commands invoke regular expression searches.
This is a favorable design in terms of speed.

## 2. Example Preprocessing Directive Usage.

Suppose input *defines* is an object

```
{
  "dev":{
    "A":{
	  "test": true,
	  "source": "Atest"
	}
  },
  "packageJson": {
    "name": "test",
	"version": "0.0.0",
	"description": "TEST"
  }
}
```

and the source being processed is
```
//--if dev.A.test
//--render import A from {{dev.A.source}}
//--else
import A from 'A' 
//--endif

/*--render 
function queryVersion(){
   return 
   '{{packageJson.name}} {{packageJson.version}} - {{packageJson.description}}'
}
--end*/

/*--addDefJson symstrings [
"A",
"B",
"C"
] --end*/

/*--render 
{{#symstrings}}
const sym{{.}} = Symbol("{{.}}")
{{/symstrings}}
--end*/
```


The resulting output would be 

```
//--if dev.A.test
//--render import A from {{dev.A.source}}
//!!rendered
import A from Atest
//!!endRendered
//--else
//!!plain import A from 'A' 
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

/*--addDefJson symstrings [
"A",
"B",
"C"
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
//!!endRendered
```

## 3.  Example Calling Program

As mention in the *Outine* above, 
other npm modules provide a higher level interface.

However, a simple and complete working example 
using the core module 'reverible-preproc'
is shown here:

```
'use strict'
const ReversiblePreproc = require('reversible-preproc')
const split2 = require('split2')
const through2 = require('through2')
const fs = require('fs')
const events = require('events')

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
let rawdata = fs.readFileSync("./defines.demo0.json")
let defJson = JSON.parse(rawdata)
let rpp = new ReversiblePreproc(defJson)
let readable = fs.createReadStream("./in.demo0.js")
//let writable = fs.createWriteStream(argv.outfile)
let writable = process.stdout
PreProc(rpp, readable, writable)

```

Assuming the source is named `example-rpp-usage.js`, the 
program could be setup and executed as follows

```
mkdir reversible-preproc-example
cd reversible-preproc-example
npm install through2 split2 reversible-preproc
node reversible-preproc-example
```

This example source code is available 
[here](git@github.com:craigphicks/reversible-preproc-example.git) 

## 4. Processing Directives Overview

### 4.1 Delimiters commands, and arguments

 - Each line of may  contain at most one directive
but can begin with arbitrary whitespace.

 - Two sets of delimiters exist:
  -- open-only delimiter for single lines (`//--` by default)
  -- open-close delimiter for multi lines (`/*--`, `end--*/` by default)
 - The actual values of hte delimiters are user settable through initial options
 - The command must begin immediately after the opening deliter string without a space inbetween.
 
The open delimiter must be followed immediately by a command with no intervening space.

Following the command are 0, 1, or 2 arguments.

Arguments, when present, each follow a whitespace, and are either 
- a dotted alphanum identifier, and/or
- a value  or contition.

A dotted alphnum identifier contains no whitespace.

A value / condition is always the last argument 
and occupies the remainder of the directive text, up but not including the directive end delimiter, if any.

If the directive is multiine and the first line part of the value / condition is empty, that 
line part is ignored.

### 4.2 Commands

The available commands are 

command     | arguments                 | notes
----        |----                       |----
`if`          | condition                 | condition is parsed with jsep 
`elif`        | condition                 | ditto
`else`        |                           | 
`endif`       |                           | mandatory 
`addDef`      | name string               | adds arbitrary string to internal `defines` object 
`addDefJson`  | name jsonString           | adds JSON.parse(jsonString) to defines
`template`    | mustacheTemplateString    | sets internal template register
`render`      | [mustacheTemplateString]  | if no arg, use internal temmplate register

There are additional commands which rely on `eval`:

command     | args
----        |----
`ifEval`      | condition 
`elifEval`    | condition
`addDefEval`  | name content 

The `*Eval` commands take as an argument 
valid javascript function body, and must explicity return a value. 
The javascript will be executed in a function in which
the processor global `defines` is passed as an argument. In psuedo-code:

```
evalBody(body) {
 body = '"use strict";' + body
 let f = Function('defines',body)
 return f(defines)
}
```

## 5. 'if*' and 'endif' set of commands (not including 'Eval' variants)

### 5.1 Condition syntax and implementation

The `if` and `elif` commands evaluate the condition by
 - first, parsing to abstract parse tree (APT) using the 
 [npm `jsep` module](https://www.npmjs.com/package/jsep).
 - second, evaluating the parse tree with a simple internal interpreter.
 
The condition syntax is basically a subset of javascript, sufficient for the purpose.
 
The implemented grammar is as follows: 

operator type              |   items/description
---                 |---
binary    |  `||`, `&&`, `==`, `!=`, `===`, `!==`, `==`, `!=`, `<=`, `>=`, `>`, `<`
unary      | `!`
grouping | `(`, `)`
dot        | nested property access to implicit internal `defines` , e.g. `a.b.c`
brackets   | nested property access to implicit internal `defines` , e.g. `a[b][c]`
predefined keys |  `true`, `false`, `null`, `undefined`, `def`, `ndef`
predefined functions | `def`, `ndef`
user defined functions | not enabled, use `ifEval`, `elifEval`

Typecasting is similar to that of javascript. 


Note: The `*Eval` variants `ifEval` and `elifEval` were described in detail in a previous section.


### 5.2 Predefined functions 'def' and 'ndef'

Access errors can occur for undefined properties used as keys.
The predefined `def` and `ndef` functions enabled returning `false` instead of errors.

Supposing `a.b` is defined but not `a.b.c`.  Then 
```
// if a.b.c.d
```
will incurr an error but 
```
// if def(a.b.c.d)
```
will return false and 
```
// if ndef(a.b.c.d)
```
will return true.

### 5.3 Command 'endif' vs. the directive delimiter 'end--/*'

To pre-empt confusion:  `endif` is a command ending an if-chain of commands:

> if-command
> [elif-command]*
> [else-command]*
> endif-command 


while `--end*/` is a delimiter to end a directive,
where a directive contains a command.**

The following ugly usage is legal, show just to prove a point.
```
//--if true
  /*--if true --end*/
  console.log("hello world")
  //--else 
  console.log("bye world")
  //--endif
/*--endif --end*/
```
The postprocess result would be

```
//--if true
  /*--if true --end*/
  console.log("hello world")
  //--else 
//!!plain  console.log("bye world")
  //--endif
/*--endif --end*/
```

### 5.4 postprocessing result

With the exception of processor directives, all lines within "false" regions
of an enclosing if-chain are prefixed with an annotation prefix, 
by default `//!!plain`.  The `//!!` and `plain` components of that prefix
are each configurable through initial options.  For example:

Input:
```
//--addDefJson temp {"a":"A", "b":"B"}
//--if false
Nondirective
//--elif false
  //--render Directive {{temp.a}}
//--else
  //--render Directive {{temp.b}}
//--endif
```
Output:
```
//--addDefJson temp {"a":"A", "b":"B"}
//--if false
//!! Nondirective
//--elif false
  //--render {{temp.a}}
//--else
  //--render {{temp.b}}
//!!rendered
B
//!!endrendered
//--endif

```

## 6. 'addDef*' set of commands

The `addDef*` set of commands add a property to the processer internal `defines` object. 
The arguments are 
 - first, an dotted alphanumeric property identifier
 - second, a corresponding property value, corresponding to all the text after the first arg and before the directive end delimiter (if any).

The dotted alphanumeric property identifier
must match the regexp returned by

```
function createIdentifierRegex() {
  const core = "[$A-Z_][0-9A-Z_$]*"
  return RegExp(`^${core}(.${core})*`, 'i')
}
```

It is **not** necessary for any of the nested alphanumerics names to be pre-existing.
The entire chain will be created in order to insert the value.


The value added depends on the command:

command | value description
----    |----
`addDef` | adds a string, including but not limited to mustache templates.
`addDefJson` | adds an ojbect returned by `JSON.stringify(<the value string>)`

The `addDefJson` allows adding an array of strings to be used in 
mustache's template array expansion feature.

### 6.1 'addDefEval' command

Assigns to defines the value returned bythe psuedocode:

```
let result = evalBody(<the value string>)
```
where `evalBody()` is as described above in section 4 "Commands".

## 7. Template command

The template command takes a single argument which is a value string 
with mustache syntax, e.g.,

```
//--template const versionStr = {{packageJson.name}} + '-' + {{packageJson.version}}
```

or 
```
/*--template 
const versionStr 
    = {{packageJson.name}} + '-' + {{packageJson.version}}
end--*/
```
The value is stored in an internal 'template' register which read whenever the `render` command
is called without an argument.

The template register is reset to `null` after each `render` command.


## 8. Render Command

The `render` command renders a mustache template string, using `defines` as view parameter.
The rendering is implemented with the npm `mustache` module.

The `render` command takes an optional value parameter, which 
when present is used as the mustache template string.  

If not present, the contents of the internal 'template' are used as the template.  After render completion, the contents of the internal template register are always cleared.

The output from the `render` command is enclosed linewise between special annotated comments:
Opening line:
```
//!!rendered
```
Ending line
```
//!!endrendered
```
For example

Input:
```
//--addDefJson syms [ "A", "B", "C" ]
/*--render
{{#syms}}
const sym{{.}} = Symbol({{.}})
{{/syms}}
--end*/
```

Output:
```
//--addDefJson syms [ "A", "B", "C" ]
/*--render
{{#syms}}
const sym{{.}} = Symbol({{.}})
{{/syms}}
--end*/
//!!rendered
const symA = Symbol("A")
const symB = Symbol("B")
const symC = Symbol("C")
//!!endRendered
```





