// For maximum control, arrays of globs to include and exclude.

import nodeResolve from "rollup-plugin-node-resolve"
import commonjs from "rollup-plugin-commonjs"


export default [
	{
		input: [
			"src/rpp-core.mjs",
			"src/rpp-transform.mjs",
		],
		output: {
			dir: "lib",
			format: "cjs"
		},
		plugins:[
			nodeResolve({
				preferBuiltins:true
			}),
			commonjs({})
		]
	},
	{
		input:"src/test/test-reversible-preproc.mjs",
		//		plugins: [myResolveId()],
		plugins:[
			{
//				name: "resolveId",
				resolveId( source ){
					console.log("myResolveId: ",source)
					if (source.includes("/reversible-preproc")){
						return {id: '../lib/rpp-core.js', external: true}
					}
					return null
				}
			}
		],
		output: {
			file : "test/test-reversible-preproc.js",
			format: "cjs"
		}
	},
	{
		input:"src/test/call-test-reversible-preproc.mjs",
		//		plugins: [myResolveId()],
		plugins:[
			{
				resolveId( source ){
					console.log("myResolveId: ",source)
					if (source.includes("/test-reversible-preproc")){
						return {id: './test-reversible-preproc.js', external: true}
					}
					return null
				}
			}
		],
		output: {
			file : "test/call-test-reversible-preproc.js",
			format: "cjs"
		}
	}
]

