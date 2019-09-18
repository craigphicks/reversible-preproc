/* 
This is an example file only for the purpose of testing 
reversible-preproc
It is not meant to be run as a program
*/

//--if dev.testA
import A from 'TestA' 
//--else
import A from 'A' 
//--endif

/* testing if  */
//--if true
expected
  //--if true
  expected
  //--elif true
  unexpected
  //--elif false
  unexpected
  //--else
  unexpected
  //--endifd
//--elif true
unexpected
  //--if true
  unexpected
  //--elif true
  unexpected
  //--elif false
  unexpected
  //--else
  unexpected
  //--endifd
//--elif false
unexpected
  //--if true
  unexpected
  //--elif true
  unexpected
  //--elif false
  unexpected
  //--else
  unexpected
  //--endifd
//--else
unexpected
  //--if true
  unexpected
  //--elif true
  unexpected
  //--elif false
  unexpected
  //--else
  unexpected
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
// comment
unexpected
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
// comment
unexpected
/*--else 
--end*/
// comment
unexpected
/*--endif
--end*/

//--render import B from {{dev.Bsource}}

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
