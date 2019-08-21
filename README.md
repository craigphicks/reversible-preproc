# reversible-preproc 

## 1. Outline

This package is a library providing core functionality for a preprocessor, e.g., it can be used to implement preprocessing in a stream, or a CLI program. (For example, the *npm* package *reversible-preprocess-cli* is a CLI program implemented with this module -- *soon to be published* ).

The *"reversible"* moniker indicates that it is suitable for lightweight switching back and forth between configuations (e.g., in-place).  The deactivated regions are marked with annotated comments (`//!!`) enabling the preprocessor to remove them for a different configuration. Repeated applications of the same `defines` are idempotent.

Regexp is not used.  Neither is all text searched.  Only lines beginning with comment marks (e.g. `//`), are further processed as potential processing command lines.  This makes processing relatively fast. 


## 2. interface

The module exports a class `ReversiblePreproc` 

```
class ReversiblePreproc {
    constructor(defines = {}, options = defaultOptions) {...}
	line(line, callback = null) {...}
}
export default ReversiblePreproc
```


### 2.1 `constructor(defines, options)`

#### 2.1.1 `defines`

 - Normally `defines` is an object providing the property names and values to be referenced/tested by conditional statements embedded in the file/stream to be processed.
 - As a special case the top level may the single single string `"*"`.  The effect is to evaluate 
   all conditionals as true, i.e. nothing is commented out.
 - The top level cannot be an array. Lower levels arrays are allowed.
 - These top level property names are forbidden: `true, false, null, undefined, def, ndef, this`.
 - Values are restricted to strings, numbers, and the special values `true`. `false`, and `null`. 
   
An example `defines`:

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

#### 2.1.2 `options`

- `commentMark`: \<string\> [default `"//"`]
  - only lines beginning with this commentMark will be further examined for preprocessor commands 
  - reversibleCommentIndicator: <string> [default `"!!"`]
 - the preprocessor disable a regions by prepending with `commentMark` followed by  `reversibleCommentIndicator`, e.g., `//!!` 
- `testMode`: \<boolean\>  [default `false`] 
	 - only output preprocess *command start lines*  prepended by `true` or `false`, according to the condtion evaluation.  
 - `debugOutput`: 
	 - prepend lines with the line number of the command condition whose range 
 they are under, if any. (*Unlikely to be much use other than developer testing*)

### 2.2  `line(line, callback = null) `
This function performs stateful line by line processing
#### 2.2.1 Return value
 - When the passed argument `callback` is `null` it return a pair `[err, outputLine]`.  `err` 
 will be null if there is no error to report.  Otherwise `err` will be an instance of `Error`, and the value of `outputline` is undetermined.
 - When `callback` is not `null` it must be a function taking the the 
 two arguments `err` and `outputline` in that order.


#### 2.2.2. Stateful line processing logic

The function to perform stateful preprocessing on each line of input.
From the perspective of the preprocessor, input lines are categorized as follows:

 - command start line
 - command end line
 - non-command line
 
A **command start line** has the form
```
[commentMark][almost arbitrary fill]if<<CONDITIONAL-STATEMENT>>
```
For example, in the context of  the example defines written above:
```
//  if<<configs[select].A>>
```
A **command end line** has the same form but without `if` and the `CONDITIONAL-STATEMENT`.  E.g,
```
//  <<>>
```

The command end line marks the end of the range of the nearest command start line above it 
which is not already matched by a command end line. 

Hence, command start and end line pairs can be nested.  However, they cannot overlap.

The form and action of the `CONDITIONAL-STATEMENT is explained in detail below.

When the `CONDITIONAL-STATEMENT` evaluates to true, the **ordinary lines** in its range will be output without change.  However when it evaluates to false, the ordinary lines in its range will be prepended with the `commentMark` and `reversibleComment` indicator.  

When commands are nested, the inner overrides the outer for the duration of its range.

For example:

*Before processing:*
```
// if<<true>>
Mother duck and her chicks cross the road to get to the water. 
John can 
// if <<false>> 
hardly wait to get home and can't 
// <<>>
stop the car in time.
// <<>>
```

*After processing:*
```
// if<<true>>
Mother duck and her chicks cross the road to get to the water. 
John can 
// if <<false>> 
//!! hardly wait to get home and can't 
// <<>>
stop the car in time.
// <<>>
```

### 2.3 `CONDITIONAL-STATEMENT`

Two forms of conditional statement are enabled:

 - **psuedo javascript** 
	  - doesn't use javascript `eval`
	  - parsed by [*jsep*](https://www.npmjs.com/package/jsep) into abstract parse tree form, then evaluated by a simple interpreter.
 - **actual javascript**
	  - uses javascript `eval`
	  - client defined function is `eval`d with `defines` passed as argument.

The **pseudo javascript** is more brief and readable, but the **actual javascript** is almighty.

#### 2.3.1  Psuedo javascript conditional statement

The 'pseudo javascript' uses the npm module 'jsep' to parse, and then an interpreter 
to execute the parsed data. Example:
```
// if<<DEBUG>1 && configs[select].B>=1>>
```
which would evaluate to false using the above `defines` example.

 - Round parentheses `(` and `)` are allowed for grouping logic.
 - Square brackets `[` and `]` are allowed for property access as an alternative to `.` or where the identifier is a variable and `.` can't be used.
- Allowed binary operators are: `<=` `<`  `>` `>=` `==` `===` `!=` `!==` `&&` `||`
- Allowed unary operators are: `!`
- Predefined keywords are: `true`, `false`, `null`, `undefined`, `def`, `ndef`

Just like Javascript referencing a nonexistent property may or may not result in an exception.  
(As explained above, exceptions will passed back in the result of the `line` function.)

- Two predefined functions are provided:
	 - `def(PROPERTY-EXPRESSION)` 
	 - `ndef(PROPERTY-EXPRESSION)`
    
- `def()` evaluates to wither `true` or `false`, regardless of the property value.  
- `true` is the result when no exception occurs and `PROPERTY-EXPRESSION` does not resolve to `undefined`
- `false` is the result otherwise.
- `def()` never results in an error value being passed back from `line()`.
- `ndef()` simply returned the logical inverse of `def()`, i.e. `!def()`

Example usage:
```
// if<< def(configs[select].C) && configs[select].C===1 >>
```
or
```
// if<< def(configs[2]) >> 
```
which are respectively `true` and `false` given the above `defines` example above.

*Note: The [*jsep*](https://www.npmjs.com/package/jsep) module is not a dependency listed in `package.json` because it has been bundled directly into this module.*


#### 2.3.2 Actual javascript conditional statement

These have the form
```
:JAVASCRIPT-FUNCTION-OF-ONE-ARG
```
where `:` serves to differentiate from a **pseudo javascipt** statement.

`JAVASCRIPT-FUNCTION-OF-ONE-ARG` will be `eval`d with `defines` passed as the arg.
For example, alternates to the **pseudo javascipt** examples provided above:
```
// if<<:(D)=>{ return D.configs[select].C!==undefined && configs[select].C===1 } >>
```
or 
```
// if<<: (D)=>{ return D.configs.length > 2 }
```
