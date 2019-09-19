# reversible-preproc 

## 1. Outline

*Note: Version `2.x.x` is a breaking change from version `1.x.x`.*

This module enables the following preprocessor functionalities:
 - a "defines" object passed as an argument into the processor.
 - template rendering with Mustache syntax, using "defines" object values as arguments
 - condtional expressions evaluated with respect to the "defines" object values.
 - nested if/elif/else/endif functionality, using as arguments the conditional expressions.
   - both ordinary code and process templates code may be enabled/masked within an if family of commands. 

The Mustache syntax is implemented with the npm *mustache* module.

The conditional expression are parsed to APT (abstract parse tree) form using the npm *jsep* module,
then reduced to boolean using a simple in-this-module interpreter.

The *"reversible"* moniker indicates that it is suitable for lightweight switching back 
and forth between configuations (e.g., in-place).  The output of processing *source* with defines object *defA*
is the same as taking the output of processing *source* with defines object *defB* and processing that 
with defines object *defA*, for arbitrary *defA* and *defB*.  In psuedo-code 

```
proc(source,defA) === proc(proc(source,defB),defA)
```

The interface for passing the source is a function *line(...)* which expects one line of source 
code at time.  The following sibling npm modules provide higher level interfaces:

 - *reversible-preproc-cli* : a CLI for processing whole files
 - *gulp-reversible-preproc* : an interface providing a *gulp* style pipe for the npm *gulp* module. 

If the majority of source lines are not subject to processing, then most lines 
are simply checked for a command after whitespace and then passed directly to output.
Processing does not subject all text to regular expression searches - such searches only happen
on lines with certain specific processing commands.


## 2. Example source command usage

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

### 2.2.  Calling code line processing

As mention in the *Outine* above, 
other npm modules provide a higher level interface.

However, a simple and complete working example 
using only the core module 'reverible-preproc'
is as follows:

```
mkdir temp-rpp
cd temp-rpp
npm install reversible-preproc
```

Create a test program `test-rpp.js`

```test-rpp.js

```


Execute the program
```
node test-rpp.js 
```

