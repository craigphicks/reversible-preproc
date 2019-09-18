/* 
This is an example file only for the purpose of testing 
reversible-preproc
It is not meant to be run as a program
*/

//--if dev.testA
import A from 'TestA' 
//--else
//!!plain import A from 'A' 
//--endif

/* testing if  */
//--if true
expected
  //--if true
  expected
  //--elif true
//!!plain   unexpected
  //--elif false
//!!plain   unexpected
  //--else
//!!plain   unexpected
  //--endifd
//--elif true
//!!plain unexpected
  //--if true
//!!plain   unexpected
  //--elif true
//!!plain   unexpected
  //--elif false
//!!plain   unexpected
  //--else
//!!plain   unexpected
  //--endifd
//--elif false
//!!plain unexpected
  //--if true
//!!plain   unexpected
  //--elif true
//!!plain   unexpected
  //--elif false
//!!plain   unexpected
  //--else
//!!plain   unexpected
  //--endifd
//--else
//!!plain unexpected
  //--if true
//!!plain   unexpected
  //--elif true
//!!plain   unexpected
  //--elif false
//!!plain   unexpected
  //--else
//!!plain   unexpected
  //--endifd
//--endif

/* if multi line
/*--if 
   a
   && a.b
   && a.b==2
   && a.b===2
   && a.b>1
   && a.b<=3
--end*/
expected
//--endif


//--if false
//!!plain // comment
//!!plain unexpected
/*--elif 
   a
   && a.b
   && a.b==2
   && a.b===2
   && a.b>1
   && a.b<=3
--end*/
// comment
expected
/*--elif 
   a
   && a.b
   && a.b==2
   && a.b===2
   && a.b>1
   && a.b<=3
--end*/
//!!plain // comment
//!!plain unexpected
/*--else 
--end*/
//!!plain // comment
//!!plain unexpected
/*--endif
--end*/

//--render import B from {{dev.Bsource}}
//!!rendered
import B from testB
//!!endRendered

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
