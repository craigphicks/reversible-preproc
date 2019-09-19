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
