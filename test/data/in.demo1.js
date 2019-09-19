/* 
This file is intended as sample input for "reversible-preproc".
The contents are not intended for execution.
*/

/*
The "reversible-preproc" program passes in a "defines" object variable 
containing properties which may be accessed by be proprocessor commands.
The defines object variable is passed in by the calling program,
but can also be modifed by preprocessor commands.
*/

//--if dev.A.test
import A from {{dev.A.source}}  
//--else
import A from 'A' 
//--endif

/* version function example */

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

/* if/eilf/else/endif work as expected */

//--if true
expected
//--elif true
unexpected
//--else
unexpected
//--endif

//--if false
unexpected
//--elif true
expected
//--else
unexpected
//--endif

//--if false
unexpected
//--elif false
unexpected
//--else
expected
//--endif


/* if/eilf/else/endif can be embedded 
 */

//--if true 
expected
    //--if false
    unexpected
    //--elif true
    expected
    //--else
    unexpected
    //--endif
//--else
    //--if false
    unexpected
    //--elif true
    unexpected
    //--else
    unexpected
    //--endif
//--endif

/*
every command can be used with a single line or multi line stem.

The single line format in psuedo regex is 
^[:space:]*<single-line-stem><command> <args>$

where the default single-line stem is "//--". 

The multi line format in psuedo regex is 

^[:space:]*<multi-line-stem><command> <args>*
<args>*
...
<args>* <multi-line-end>[:space:]$

where the default single-line stem is "/*--",
the default multi-line-end is "--end" OOOPS
and 

*/

//--if false
unexpected
/*--elif 
   a
   && a.b
   && a.b==2
   && a.b===2
   && a.b>1
   && a.b<=3
--end*/
expected
/*--elif true ---end*/
unexpected
//--elif true
unexpected
/*--else --end*/
unexpected
/*--endif --end*/



