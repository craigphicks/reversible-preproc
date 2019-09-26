/* eslint-disable no-unused-vars */
/* eslint-disable no-constant-condition */
'use strict'
//import ReversiblePreproc from '../reversible-preproc.mjs'
import { RppCore } from '../rpp-core.mjs'
//import { Readable } from 'stream'
import assert, { AssertionError } from 'assert'
import dedent from 'dedent'
import * as fs from 'fs'
import readline from 'readline'
import resolve from 'resolve'

// import split2 from 'split2'
// import through2 from 'through2'

function* testDataGenerator(depth) {
  function* gen(d, name, val, n) {

    // new style for jsepPreprocInterpret
    let cmd = [
      `//--if ${name}===${val}\n`,
      `//--endif\n`,
    ]

    yield (cmd[0])
    for (let i = 0; i < n; i++) {
      yield (`${val}\n`)
      if (d) {
        yield* gen(d - 1, name, (val + i + 1) % 2, n)
      }
    }
    yield (`${val}\n`)
    yield (cmd[1])
  }

  // eslint-disable-next-line no-extra-boolean-cast
  let initialValue = 0
  yield* gen(depth, 'test', initialValue, 3, true)
}

function* testDataGenerator2(depth, cmdstrIf) {
  function* gen(d, val, n) {
    let cmd = [
      `//--${cmdstrIf(val)} `,
      `//--endif`,
    ]
    yield (cmd[0])
    for (let i = 0; i < n; i++) {
      yield (`${val}`)
      if (d) {
        yield* gen(d - 1, (val + i + 1) % 2, n)
      }
    }
    yield (`${val}`)
    yield (cmd[1])
  }

  // eslint-disable-next-line no-extra-boolean-cast
  let initialValue = 0
  yield* gen(depth, initialValue, 3)
}


function* lineGen(text) {
  let arr = text.split('\n')
  for (const line of arr.slice(0, -1))
    yield line
  // only send out last line if it has length > 0
  if (arr.slice(-1)[0].length)
    yield arr.slice(-1)[0]

}


//async function test() {

function test1() {
  //const readable = Readable.from(testDataGenerator(3))
  let rp1 = new RppCore({ test: 0 })
  let rp2 = new RppCore({})
  let rp3 = new RppCore({ test: 0 })
  //  let rp4 = new RppCore('*')
  for (const line of testDataGenerator(3)) {
    process.stdout.write(line)
    let [err1, line1] = rp1.line(line)
    if (err1) throw err1
    assert.ok(line1[0] == '0' || line1.substr(0, 2) === '//',
      "line1[0]=='0'||line1.substr(0,2)==='//'")
    let [err2, line2] = rp2.line(line1)
    if (err2) throw err2
    let [err3, line3] = rp3.line(line2)
    if (err3) throw err3
    assert.ok(line3 === line1, "reversibility")
    // let [err4, line4] = rp4.line(line3)
    // if (err4) throw err4
    // assert.ok(line4.slice(0, 4) !== '//!!', "line4.slice(0,4)!=='//!!'")
  }
  console.log("test1 passed")
  return true
}
function test2() {
  // test the eval function
  let cmdstrFn = (val) => {
    //return `:(pp)=>{return (pp.foo && pp.foo.bar==${val})}`
    return `ifEval return (defines.foo && defines.foo.bar==${val})`
  }
  //const readable = Readable.from(testDataGenerator2(3, cmdstrFn))
  let rp1 = new RppCore({ foo: { bar: 0 } })
  let rp2 = new RppCore({})
  let rp3 = new RppCore({ foo: { bar: 0 } })
  //let rp4 = new RppCore('*')
  //for await (const line of readable) {
  for (const line of testDataGenerator2(3, cmdstrFn)) {
    let [err1, line1] = rp1.line(line)
    if (err1) throw err1
    assert.ok(line1[0] == '0' || line1.substr(0, 2) === '//',
      "line1[0]=='0'||line1.substr(0,2)==='//'")
    let [err2, line2] = rp2.line(line1)
    if (err2) throw err2
    let [err3, line3] = rp3.line(line2)
    if (err3) throw err3
    assert.ok(line3 === line1, "reversibility")
    // let [err4, line4] = rp4.line(line3)
    // if (err4) throw err4
    // console.log(line4)
    // assert.ok(line4.slice(0, 4) !== '//!!', "line4.slice(0,4)!=='//!!'")
  }
  console.log("test2 passed")
  return true
}

function test3() {
  // test the matchTest algoritm
  let ppJson = {
    choice1: 1,
    choice2: 2,
    choice3: 3,
    choice4: {
      x: 1, y: 2
    },
    def1: {},
    def2: null,
    def3: 0,
    def4: undefined,
    BAR: 'bar',
    foo: { bar: { baz: 1 } }
  }

  // eslint-disable-next-line no-unexpected-multiline
  let textblock =
    `//--if choice1===1 && choice3===3
0
//--endif
//--if choice1===2 && choice3==3
1
//--endif
//--if !(choice1===2) && choice3==3
0
//--endif
//--if choice2===2&&choice3===3
0
//--endif
//--if choice4
0
//--endif
//--if choice4.y==2
0
//--endif
//--if def1
0
//--endif
//--if def2||def3||def4
1
//--endif
//--if foo.bar===foo[BAR]
0
//--endif
//--if (choice4.x<2&&choice4.x>0)
0
//--endif
`
  //const readable = Readable.from(lineGen(textblock))
  let rp1 = new RppCore(ppJson)
  //for await (const line of readable) {    
  for (const line of lineGen(textblock)) {
    //console.log(line)
    let [err1, line1] = rp1.line(line)
    if (err1) throw err1
    //console.log(line1)
    assert.ok(line1[0] == '0' || line1.substr(0, 2) === '//',
      "unexpected ouput")
  }
  console.log("test3 passed")
  return true
}

function test4() {
  // test the matchTest algoritm
  let ppJson = {
    choice1: 1,
    foo: { bar: { baz: 1 } },
  }
  let textblock =
    `
//--if choice1.f00
//--if choice1[0]
//--if 'foo'['bar']
`
  //const readable = Readable.from(lineGen(textblock))
  //for await (const line of readable) {
  let lines = textblock.split('\n')
  for (let linein of lines) {
    let rp1 = new RppCore(ppJson)
    //let [err1,line1]=[null,null]
    let outp = rp1.line(linein)
    assert.ok(outp && outp instanceof Array && outp.length === 2)
    let err1 = outp[0]
    let lineout = outp[1]
    assert.ok(err1 || (lineout && typeof lineout === 'string'))
    if (!(err1 || lineout === '\n' || lineout.includes("--endif")))
      throw new Error(linein, lineout)
    // || err1, "expected error")
  }
  console.log("test4 passed")
  return true
}



function testLineIfDirective(definesJson, lineWithIfDirective, boolErrExpected, boolResultExpected = null) {
  let rp1 = new RppCore(definesJson)
  let [err, lineOut] = rp1.line(lineWithIfDirective)

  assert.ok(Boolean(boolErrExpected) == Boolean(err), "err status did not match expected")
  if (!boolErrExpected) {
    let [err, lineOut2] = rp1.line("xx")
    if (err) throw "testLineIfDirective: unexpected err [1]"
    let result = null
    switch (lineOut2.substr(0, 2)) {
      case 'xx': result = true; break
      case '//': result = false; break
      default: throw 'testLineIfDirective: unexpected err [2]'
    }
    assert.ok(Boolean(result) == Boolean(boolResultExpected))
  }
}

function testByLine() {
  console.log("start testByLine()")
  testLineIfDirective({ foo: { bar: 0 } }, "//--if def( foo['bar'].baz )", false, false)
  testLineIfDirective({ foo: { bar: 0 } }, "//--if foo.'bar'", true)
  testLineIfDirective({ foo: { bar: 0 } }, "//--if foo['bar'].baz", true)
  testLineIfDirective({}, "//--if null", false, false)
  testLineIfDirective({}, "//--if undefined", false, false)
  testLineIfDirective({}, "//--if true", false, true)
  testLineIfDirective({}, "//--if false", false, false)
  testLineIfDirective({ foo: { bar: 0 } }, "//--if def(foo.bar)", false, true)
  testLineIfDirective({}, "//--if this.rhs", true)
  testLineIfDirective({ foo: { bar: 0 } }, "//--if def(foo['baz'])", false, false)
  console.log("testByLine() success")
  return true
}
//testByLine()


const tplTestData1 = [
  [
    { version: "1.0.0" },
    dedent`
    //--tpl const versionString = "{{version}}"
    //--render
    `,
    dedent`
    //--tpl const versionString = "{{version}}"
    //--render
    //!!rendered
    const versionString = "1.0.0"
    //!!endRendered
    `
  ],
  [
    { ASSERT: 'if (!({{> arg}})) throw "{{> arg}}"' },
    dedent`
    //--tpl {{ASSERT}}
    //--partials {"arg":"0<1"}
    //--render
    `,
    dedent`
    //--tpl {{ASSERT}}
    //--partials {"arg":"0<1"}
    //--render
    //!!rendered
    if (!(0<1)) throw "0<1"
    //!!endRendered
    `
  ],
  [
    {},
    dedent`
    //--addDef ASSERT if (!({{> arg}})) throw "{{> arg}}"
    //--tpl {{ASSERT}}
    //--partials {"arg":"0<1"}
    //--render
    `,
    dedent`
    //--addDef ASSERT if (!({{> arg}})) throw "{{> arg}}"
    //--tpl {{ASSERT}}
    //--partials {"arg":"0<1"}
    //--render
    //!!rendered
    if (!(0<1)) throw "0<1"
    //!!endRendered
    `
  ],
]

const tplTestData2 = [
  [
    {},
    dedent`
    //--addDefJson array ["A","B","C"]
    //--tpl {{#array}}{{.}}{{/array}}
    //--render
    `,
    dedent`
    //--addDefJson array ["A","B","C"]
    //--tpl {{#array}}{{.}}{{/array}}
    //--render
    //!!rendered
    ABC
    //!!endRendered
    `
  ],
  [
    {},
    dedent`
    //--addDefEval array return ['A','B','C']
    //--tpl {{#array}}{{.}}{{/array}}
    //--render
    `,
    dedent`
    //--addDefEval array return ['A','B','C']
    //--tpl {{#array}}{{.}}{{/array}}
    //--render
    //!!rendered
    ABC
    //!!endRendered
    `
  ],
  [
    {},
    dedent`
    //--addDefJson array ["A","B","C"]
    //--tpl {{#array}}{{.}}{{/array}}
    //--render
    `,
    dedent`
    //--addDefJson array ["A","B","C"]
    //--tpl {{#array}}{{.}}{{/array}}
    //--render
    //!!rendered
    ABC
    //!!endRendered
    `
  ],
  [
    {},
    dedent`
    //--addDefJson array ["A","B","C"]
    //--tpl {{#array}}
    //--tpl const sym{{.}} = Symbol("{{.}}")
    //--tpl {{/array}}
    //--render
    `,
    dedent`
    //--addDefJson array ["A","B","C"]
    //--tpl {{#array}}
    //--tpl const sym{{.}} = Symbol("{{.}}")
    //--tpl {{/array}}
    //--render
    //!!rendered
    const symA = Symbol("A")
    const symB = Symbol("B")
    const symC = Symbol("C")
    //!!endRendered
    `
  ],
  [
    {},
    dedent`
    //--addDefJson array ["A","B","C"]
    /*--tpl 
    {{#array}}
    const sym{{.}} = Symbol("{{.}}")
    {{/array}}
    --end*/
    //--render
    `,
    dedent`
    //--addDefJson array ["A","B","C"]
    /*--tpl 
    {{#array}}
    const sym{{.}} = Symbol("{{.}}")
    {{/array}}
    --end*/
    //--render
    //!!rendered
    const symA = Symbol("A")
    const symB = Symbol("B")
    const symC = Symbol("C")
    //!!endRendered
    `
  ],
  [
    {},
    dedent`
    //--addDefJson array ["A","B","C"]
    /*--render
    {{#array}}
    const sym{{.}} = Symbol("{{.}}")
    {{/array}}
    --end*/
    `,
    dedent`
    //--addDefJson array ["A","B","C"]
    /*--render
    {{#array}}
    const sym{{.}} = Symbol("{{.}}")
    {{/array}}
    --end*/
    //!!rendered
    const symA = Symbol("A")
    const symB = Symbol("B")
    const symC = Symbol("C")
    //!!endRendered
    `
  ],
]

const tplTestData3 = [
  [
    {},
    dedent`
    /*--addDef x.y.z.test
    A
    B
    C
    --end*/
    //--tpl {{x.y.z.test}}
    //--render  
    `,
    dedent`
    /*--addDef x.y.z.test
    A
    B
    C
    --end*/
    //--tpl {{x.y.z.test}}
    //--render
    //!!rendered
    A
    B
    C
    //!!endRendered
    `
  ],
]

const tplTestData4 = [
  [
    { debug: true, debugLevel: 3 },
    dedent`
    //--if debug && debugLevel>=3
    xxx
    //--endif
    yyy
    `,
    dedent`
    //--if debug && debugLevel>=3
    xxx
    //--endif
    yyy
    `
  ], [
    { debug: true, debugLevel: 2 },
    dedent`
    //--if debug && debugLevel>=3
    xxx
    //--endif
    yyy
    `,
    dedent`
    //--if debug && debugLevel>=3
    //!!plain xxx
    //--endif
    yyy
    `
  ], [
    { debug: true, debugLevel: 3 },
    dedent`
    //--if debug && debugLevel>=3
    //!!plain xxx
    //--endif
    yyy
    `,
    dedent`
    //--if debug && debugLevel>=3
    xxx
    //--endif
    yyy
    `
  ],
]

const tplTestData5 = [
  [
    { debug: true, debugLevel: 3 },
    dedent`
    //--ifEval return defines.debug && defines.debugLevel>=3
    xxx
    //--endif
    yyy
    `,
    dedent`
    //--ifEval return defines.debug && defines.debugLevel>=3
    xxx
    //--endif
    yyy
    `
  ], [
    { debug: true, debugLevel: 2 },
    dedent`
    //--ifEval return defines.debug && defines.debugLevel>=3
    xxx
    //--endif
    yyy
    `,
    dedent`
    //--ifEval return defines.debug && defines.debugLevel>=3
    //!!plain xxx
    //--endif
    yyy
    `
  ], [
    { debug: true, debugLevel: 3 },
    dedent`
    //--ifEval return defines.debug && defines.debugLevel>=3
    //!!plain xxx
    //--endif
    yyy
    `,
    dedent`
    //--ifEval return defines.debug && defines.debugLevel>=3
    xxx
    //--endif
    yyy
    `
  ],
]

const tplTestData6 = [
  [
    { debug: true, debugLevel: 3 },
    dedent`
    //--ifEval return defines.debug && defines.debugLevel>=3
    xxx
    //--else
    yyy
    //--endif
    `,
    dedent`
    //--ifEval return defines.debug && defines.debugLevel>=3
    xxx
    //--else
    //!!plain yyy
    //--endif
    `
  ],
  [
    { debug: true, debugLevel: 2 },
    dedent`
    //--ifEval return defines.debug && defines.debugLevel>=3
    xxx
    //--else
    yyy
    //--endif
    `,
    dedent`
    //--ifEval return defines.debug && defines.debugLevel>=3
    //!!plain xxx
    //--else
    yyy
    //--endif
    `
  ],
  [
    { debug: true, debugLevel: 2 },
    dedent`
    //--if debug && debugLevel>=3
    xxx
    //--elif debug && debugLevel===2
    yyy
    //--else
    zzz
    //--endif
    `,
    dedent`
    //--if debug && debugLevel>=3
    //!!plain xxx
    //--elif debug && debugLevel===2
    yyy
    //--else
    //!!plain zzz
    //--endif
    `
  ],
]

const tplTestData7 = [
  [
    Object.assign(
      JSON.parse('{"a":{"b":2}, "dev":{"testA":true,"Bsource":"testB"}}'),
      { packageJson: { name: 'test', version: '0.0.0', description: 'TEST' } }
    ),
    dedent`
    /* 
    This is an example file only for the purpose of testing 
    reversible-preproc-cli
    It is not meant to be run as a program
    */
    //--if dev.testA
    import A from 'TestA' 
    //--else
    import A from 'A' 
    //--endif
    //--render import B from {{dev.Bsource}}
    
    /* nonesense follows */
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
        `,
    dedent`
    /* 
    This is an example file only for the purpose of testing 
    reversible-preproc-cli
    It is not meant to be run as a program
    */
    //--if dev.testA
    import A from 'TestA' 
    //--else
    //!!plain import A from 'A' 
    //--endif
    //--render import B from {{dev.Bsource}}
    //!!rendered
    import B from testB
    //!!endRendered

    /* nonesense follows */
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
    `
  ],
]


class TestTplOut {
  constructor() {
    this.lines = []
  }
  push(line) {
    //if (line) process.stdout.write(line)
    this.lines.push(line)
  }
}

function testTpl(testData, testnum = -1) {
  for (let item of testData) {
    let rpp = new RppCore(item[0])
    let tto = new TestTplOut
    let inp = item[1].split('\n')
    for (let linein of inp) {
      let [err, dummy] = rpp.line(linein, tto.push.bind(tto))
      assert.ok(dummy === null, "dummy===null")
      if (err)
        throw err
    }
    if (true) {
      //let compare = inp.concat(item[2].split('\n'))
      let compare = item[2].split('\n')
      let outarr = []
      for (let n = 0; n < tto.lines.length; n++) {
        outarr = outarr.concat(tto.lines[n].split('\n'))
        if (tto.lines[n].slice(-1) === '\n')
          outarr = outarr.slice(0, -1)
      }
      assert.ok(compare.length === outarr.length, "compare.length===outarr.length")
      for (let n = 0; n < outarr.length; n++) {
        assert.ok(outarr[n] === compare[n], `${outarr[n]} === ${compare[n]}`)
      }
      //process.stdout.write("========================================" + '\n')
    } else {
      //process.stdout.write(tto.lines.join(''))
      process.stdout.write("========================================" + '\n')
    }
  }
  console.log(`testTpl() #${testnum} passed`)
  return true
}


class CompareLines {
  constructor(writeFn) {
    this.buf = [
      { lines: [], last: 0 },
      { lines: [], last: 0 },
    ]
    if (writeFn) {
      this.writeStream = fs.createWriteStream(writeFn)
    }
  }
  async flushWriteStream() {
    // these is no flush, so instead we write a zero length string and use callback
    // to call resolve
    if (!this.writeStream)
      return
    await new Promise((resolve) => {
      this.writeStream.write("", () => {
        //console.log(args[2])
        resolve()
      })
    })
  }

  // making push `async` doesn't work because push is executed in rpp.line, 
  // which is a synchronous function.
  /*async*/ push(line, n) {
    if (n == 0 && this.writeStream) {
      this.writeStream.write(line, () => {
        process.stdout.write(line)
      })
    }

    if (n == 0) {
      let lns = line.split(/\r?\n/)
      assert.ok(lns.length > 1, 'TEST CODE: expected # of split lines > 1')
      for (let ln of lns.slice(0, -1)) {
        this.buf[0].lines.push(ln)
        this.buf[0].last++
      }
      return
    }
    // from here is case n===1
    this.buf[1].lines.push(line)
    this.buf[1].last++
    assert.ok(this.buf[0].last >= this.buf[1].last, 'buf[1].last should be <= buf[0].last')
    let idx0 = this.buf[0].lines.length - 1 - (this.buf[0].last - this.buf[1].last)
    assert.ok(idx0 >= 0)
    // the expected (buf[1]) lines are without EOL marker.
    //let reres0 = /\r{0,1}\n$/.exec(this.buf[0].lines[idx0])
    //assert.ok(reres0, "no eol at end of output line")
    let strOut = this.buf[0].lines[idx0]
    let strExp = this.buf[1].lines.slice(-1)[0]
    //    if (this.buf[1].lines.slice(-1)
    //      !== this.buf[0].lines[idx0].slice(0, reres0.index)) {
    if (strOut !== strExp) {
      this.showCompareLast(10)
      throw dedent`
      FAIL lines not equal at line # ${this.buf[1].last}
      expected:
      ${this.buf[1].lines.slice(-1)}
      actual:
      ${this.buf[0].lines[idx0]}
      `
    }
  }
  showCompareLast(cnt) {
    if (cnt > this.buf[1].lines.length)
      cnt = this.buf[1].lines.length

    let idx0 = this.buf[1].lines.length - 1
      - (this.buf[1].last - this.buf[0].last)

    console.log('========== previous lines context =============')
    for (let line of this.buf[1].lines.slice(-cnt, -1))
      console.log(line)
    console.log('=========== output line   ===============')
    console.log(this.buf[0].lines[idx0])
    console.log('============ expected line ==============')
    console.log(this.buf[1].lines.slice(-1)[0])
    console.log('============               ==============')
  }
}

async function testRppExpectedFile(
  inFilename, definesFilename, evalDefines, expFilename = null, writeFn = null) {
  async function* getline(rl) {
    for await (const line of rl) {
      yield (line)
    }
    //console.log('leaving getline')
  }
  try {

    let defines = {}
    if (evalDefines) {
      let text = fs.ReadFileSync(definesFilename)
      let body = dedent`
    'use strict'
    return ${text}
    `
      defines = (Function(body))()
    } else if (definesFilename) {
      let text = fs.readFileSync(definesFilename)
      defines = JSON.parse(text)
    }
    let rpp = new RppCore(defines)

    //  return new Promise((resolve, reject) => {
    const instream = readline.createInterface({
      input: fs.createReadStream(inFilename),
    })
    let expstream = null
    if (expFilename) {
      expstream = readline.createInterface({
        input: fs.createReadStream(expFilename),
      })
    }
    let ingen = getline(instream)
    let expgen
    if (expstream)
      expgen = getline(expstream)

    //let inline, expline
    //let expDone = false
    let cl = new CompareLines(writeFn)
    let push0 = (line) => { cl.push(line, 0) }
    let push1 = (line) => { cl.push(line, 1) }

    while (true) {
      let inline = await ingen.next()
      if (inline.done)
        break
      //console.log(`in :: ${inline.value}`)
      //let buf0Last = cl.buf[0].last

      let [err, _ignore] = rpp.line(inline.value, push0)
      // let err = await new Promise((resolve, reject) => {
      //   rpp.line(inline.value, push0, (e) => {
      //     resolve(e)
      //   })
      // })
      // if necessary flush lines to cl writeFile
      await cl.flushWriteStream()

      if (err)
        throw err
      if (!expgen)
        continue
      while (cl.buf[0].last > cl.buf[1].last) {
        let expline
        expline = await expgen.next()
        if (expline.done) {
          console.log('exp:: DONE (early)')
          cl.showCompareLast(10)
          //expDone = false
          throw 'exp:: DONE (early)'
        } else {
          cl.push(expline.value, 1) // throws if not line eq
        }
      } // while
    }
    if (expgen) {
      let expline = await expgen.next()
      if (!expline.done) {
        console.log('in done but exp not done')
        cl.showCompareLast(10)
        throw 'in done but exp not done'
      }
    }
    console.log(
      dedent`
    SUCCESS
    sourcefile: ${inFilename}
    defines file: ${definesFilename}
    `)
    if (expFilename)
      console.log(`expect filename: ${expFilename}`)
    if (writeFn)
      console.log(`write filename: ${writeFn}`)

    return true
  } catch (e) {
    console.log(e)
    console.log(
      dedent`
    FAILURE
    sourcefile: ${inFilename}
    defines file: ${definesFilename}
    `)
    if (expFilename)
      console.log(`expect filename: ${expFilename}`)
    if (writeFn)
      console.log(`write filename: ${writeFn}`)
    throw e
  }
}

const testRppExpected_data = [
  [
    './test/data/in.demo0.js',
    './test/data/defines.demo0.json', false,
    './test/data/exp.demo0.js',
  ],
  // [
  //   './test/data/in.1.js',
  //   './test/data/defines.1.json', false,
  //   null,
  //   './test/data/out.1.1.js',
  // ],
  [
    './test/data/in.tm1.js',
    './test/data/defines.tm1.json', false,
    './test/data/exp.tm1.tm1.js',
  ],
]

export async function testRppExpected() {

  for (let args of testRppExpected_data) {
    await testRppExpectedFile(...args)
  }

  // await testRppExpectedFile(
  //   './test/data/in.1.js',
  //   './test/data/defines.1.json', false,
  //   null,
  //   './test/data/out.1.1.json',
  // )
  // await testRppExpectedFile(
  //   './test/data/in.1.js',
  //   './test/data/defines.1.json', false,
  //   './test/data/exp.1.1.json',
  //   //'./test/data/out.1.1.json',
  // )
}

export function testAll() {
  try {
    console.log(RppCore.queryVersion())
    // xxx test1()
    // xxx test2()
     test3()
     test4()
     testByLine()
    testTpl(tplTestData1, 1)
    testTpl(tplTestData2, 2)
    testTpl(tplTestData3, 3)
    testTpl(tplTestData4, 4)
    testTpl(tplTestData5, 5)
    testTpl(tplTestData6, 6)
    testTpl(tplTestData7, 7)
    console.log('testAll PASS')
    return true
  } catch (e) {
    console.log(e)
    console.log('testAll FAIL')
    return false
  }
}


