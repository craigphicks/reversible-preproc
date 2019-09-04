# reversible-preproc 

## 1. Outline

*Note: Version `2.x.x` is a breaking change from version `1.x.x`.*

This module provides the following preprocessor functionalities:
 
 - block switching condtional expressions 
   - via either `eval` or psuedo javascript enabled through `npmn jsep` and an simple interpreter.
 - substitution and templates 
   - via the dependency `npm mustache` 

The *"reversible"* moniker indicates that it is suitable for lightweight switching back 
and forth between configuations (e.g., in-place).  
This is possible because no information is lost by the preprocess.

Processing speed is a high priority.  This is achieved by gating access to heavy processing 
(esp. `mustache`) with command lines having a fixed prefix, e.g. 

 - `//--if <conditional expression>`
 - `//--tpl <template expression>`
 - `//--render`
 - `//--endif`

The processing is line based, and in typical usage most lines will simply be compared 
with some fixed prefix (which is configurable) and rejected.

Note: This modules only offers core functionality for a preprocessor, e.g., 
it can be used to implement preprocessing in a stream, or a CLI program. 
For example, the `npm` package `reversible-preprocess-cli` is a CLI program implemented 
with this module, and the `npm` package `gulp-reversible-preprocess-cli` 
is for integrating with the build environment oferred by the `npm` package `gulp`

## 2. Example usage


## 2.1.  Inside file to be preprocessed


```
//--if Test
import A from `TestA`
//--else
import A from `A`
//--endif


//--tpl const version_string = {{version}} 
//--render
```

## 2.2.  Calling code line processing


As mention in the *Outine* above, 
other modules are provided to to take care of calling code.
This example is simplifiied and skips details. 

```
...
import ReversiblePreproc from 'reversible-preproc'
import split2 from 'split2'
import through2 from 'through2'
...
...
async function PreProc(rpp, readable, writable) {
    function makeThroughLineFunc(rpp) {
        return (line, enc, next) => {
            let [err, outline] = rpp.line(line)
            next(err, outline+`\n`)
        }
    }
    await events.once(
        readable
            .pipe(split2('\n'))
            .pipe(through2.obj(makeThroughLineFunc(rpp)))
            .pipe(writable),
        'finish')
}
{
    // setup and execution
	defines = { // usually read from file
		version : "1.0.0"
		TestA : true
	}
    ReversiblePreproc rpp(defines)
	const readable = ...
	const writable = ...
	PreProc(rpp,readable,writable)
}
```

## Preprocessing result 

```
//--if Test
import A from `TestA`
//--else
//!!import A from `A`
//--endif


//--tpl const version_string = {{version}}
//--render
//!!rendered
version_string = "1.0.0"
//!!endrendered
```

The conditions statements and templates are not lost
as a result of preprocessing.  It is possible for 
the output to undergo preprocessing again with a different `defines`
without interference from the intermediate results. (Obviosly 
it is possible to design or accidentally create intermediate output
which *would* interfere - but with reasonable care that can be avoided.)

