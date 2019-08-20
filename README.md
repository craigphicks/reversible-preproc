
# reversible-preproc 

## Outline

This package is a library providing core fiunctionality for a preprocessor, e.g., it can be used to implement preprocessing in a stream, or a CLI program. (The package reversible-preprocess-cli is a CLI program implemented with this module).

The "reversible" moniker indicates that it is suitable for lightweight switching back and forth between configuations.  The deactivated regions are marked with annotated comments (`//!!`) enabling the preprocessor to remove them for a different configuration.


## interface

The module exports a class `ReversiblePreproc` 

```
class ReversiblePreproc {
    constructor(defines = {}, options = defaultOptions) {...}
	line(line, callback = null) {...}
}
export default ReversiblePreproc
```


### `constructor(defines, options)`

#### `defines`

 - Normally an object providing rhe property names and values 
 to be referenced by conditional statements embedded in the file/stream to be processed.
 - As a special case the top level may the single single string `"*"`.  The effect is to evaluate 
   all conditionals as true, i.e. nothing is commented out.
 - The top level cannot be an array. Lower levels arrays are allowed.
 - These top level property names are forbidden: `true, false, null, undefined, def, ndef, this`.
 - Values are restricted to strings, numbers, and the special values `true`. `false`, and `null`. 
   
An example `definesJson`:

```
{
	"DEBUG" : 2,
	"select":1,
	"configs": [{ 
			'A':0,
			'B':1
		},{
			'A':1,
			'B':0,
			'C':1
	}],
}
```

#### `options`

- commentMark: <string> [default `"//"`]
 - only lines beginning with this mark will be further examined for preprocessor commands
 - lines with are commented out by the preprocessor are commented using this string.
- reversibleCommentIndicator: <string> [default `!!`]
 - the preprocessor marks lines commented by prepending with comment mark and this indicator, 
 e.g., `//!!` 
- testMode: <boolean>  [default `false`] 
 - only output preprocess commands lines with conditional statements.  Rach line is 
 prepended by 'true' or 'false', according to the condtional evaluation.
 - debugOutput: prepend lines with the line number of the command condition whose range 
 they are under, if any.


### line(line, callback = null) {...}

#### Return value

 - When the passed argument `callback` is `null` it return a pair `[err, outputLine]`.  `err` 
 will be null if there is no error to report.  
 Otherwise it will be an instance of `Error`, and the value of `outputline` is undetermined.
 - When `callback` is not `null` it must be a function taking the the 
 two arguments `err` and `outputline`.


#### Stateful line processing logic

The function to perform stateful preprocessing on each line of input.
From the perspective of the preprocessor, input lines are categorized as follows:

 - command line
  - command start line
  - command end line
 - ordinary line
 
A command start line has the form
```
[commentMark][whitespace]if<<CONDITIONAL-STATEMENT>>
```
For example, supposing the example defines written above:
```
//  if<<configs[select].A>>
```

Similarly a command end line has the form 
```
//  <<>>
```
The command end line marks the end of the range of the nearest command start line above it 
which is not already matched by a command end line. 

Hence, command start and end line pairs can be nested.  However, they cannot overlap.

The form and action of the `CONDITIONAL-STATEMENT is explained in detail below.

When the `CONDITIONAL-STATEMENT` evaluates to true, the ordinary lines in its range will be output without change.  However when it evaluates to false, the ordinary lines in its range will be prepended with the `commentMark` and `reversibleComment` indicator.  

When commands are nested, the inner overrides hte outer for the duration of its range.

For example:

*Before processing:*
```
// if<<true> 
A mother duck and her chicks cross the road to get to the water. John can 
// if <false> 
hardly wait to get home and can't 
// <<>>
stop the car in time.
// <<>>
```

*After processing:*
```
// if<<true> 
A mother duck and her chicks cross the road to get to the water. John can 
// if <false> 
//!! hardly wait to get home and can't 
// <<>>
stop the car in time.
// <<>>
```

### `CONDITIONAL-STATEMENT`

Two forms of conditional statement are enabled:

 - psuedo javascript 
  - doesn't use javascript `eval`
  - parsed by [*jsep*](https://www.npmjs.com/package/jsep) into abstract parse tree form,
  then evaluated by a simple interpreter.
 - actual javascript
  - uses javascript `eval`
  - client defined function is `eval`d with `defines` passed as argument.

The pseudo javascript is more breif and readable, but the actual javascript is almighty.

#### Psuedo javascript conditional statement

The 'pseudo javascript' uses the npm module 'jsep' to parse, and then an interpreter 
to execute the parsed data. Example:
```
// if<<DEBUG>1 && configs[select].B>=1>>
```
which would evaluate to false using the above `defines` example.

Round parantheses '(' and ')' are allowed for grouping logic.

Square brackets '[' and ']' are allowed for property access as
and alternative to '.' or where the identifier is a variable and 
'.' can't be used.

Allowed binary operators are:
'<=' '<'  '>' '>=' '==' '===' '!=' '!==' '&&' '||'

Allowed unary operators are: '!'

Predefined keywords are: `true`, `false`, `null`, `undefined`, `def`, `ndef`

Just like javascript nonexistant property may or may not result in an exception.  
Exceptions will passed back as the result of the `line` function.

Two predefined functions are provided:
 - `def(PROPERTY)` 
 - `ndef(PROPERTY)`
    
`def()` and `ndef()` return `true` or `false`, regardless of the property value.  
They never result in an error value being passed back from `line()`.
Example usage:

```
// if<< def(configs[select].C) && configs[select].C===1 >>
```
or
```
// if<< def(configs[2]) >> 
```
which are respectively 'true' and 'false' given the above `defines` example above.

Note: The [*jsep*](https://www.npmjs.com/package/jsep) module is not a dependency because 
it has been bundled into this module.


#### Actual javascript conditional statement

These have the form
```
:JAVASCRIPT-FUNCTION-OF-ONE-ARG
```
and `JAVASCRIPT-FUNCTION-OF-ONE-ARG` will be `eval`d with `defines` passed as the arg.
For example:

```
// if<<:(D)={ return D.configs[select].C!==undefined && configs[select].C===1 } >>
```

