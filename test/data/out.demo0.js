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
