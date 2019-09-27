// For maximum control, arrays of globs to include and exclude.

import nodeResolve from "rollup-plugin-node-resolve"
import commonjs from "rollup-plugin-commonjs"


export default [
  // 1
  {
    input: [
      "src/rpp-lib.mjs",
    ],
    output: {
      file: "lib/index.js",
      format: "cjs"
    },
    plugins: [
      nodeResolve({
        preferBuiltins: true
      }),
      commonjs({})
    ]
  },
  // 2
  {
    input: [
      "src/test/test-reversible-preproc.mjs",
      "src/test/test-rppt.mjs",
      "src/test/test-assign-json.mjs",
    ],
    plugins: [
      {
        //				name: "resolveId",
        resolveId(source) {
          console.log("myResolveId: ", source)
          if (source.includes("rpp-lib.mjs")) {
            console.log("should be external: ", source)
            return { id: '../lib/index.js', external: true }
          }
          return null
        }
      }
    ],
    output: {
      dir: "test",
      //file : "test/test-reversible-preproc.js",
      format: "cjs"
    }
  },
  // 3
  {
    input: "src/test/call-test-reversible-preproc.mjs",
    //		plugins: [myResolveId()],
    plugins: [
      {
        resolveId(source) {
          console.log("myResolveId: ", source)
          if (source.includes("/test-reversible-preproc")) {
            return { id: './test-reversible-preproc.js', external: true }
          }
          return null
        }
      }
    ],
    output: {
      file: "test/call-test-reversible-preproc.js",
      format: "cjs"
    }
  }
]

