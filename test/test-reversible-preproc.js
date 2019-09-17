'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var ReversiblePreproc = _interopDefault(require('../lib/index.js'));
var assert = require('assert');
var assert__default = _interopDefault(assert);
var dedent = _interopDefault(require('dedent'));

/* eslint-disable no-unused-vars */
//import { truncateSync } from 'fs'

function* testDataGenerator(depth) {
  function* gen(d, name, val, n) {

    // new style for jsepPreprocInterpret
    let cmd = [
      `//--if ${name}===${val}\n`,
      `//--endif\n`,
    ];

    yield (cmd[0]);
    for (let i = 0; i < n; i++) {
      yield (`${val}\n`);
      if (d) {
        yield* gen(d - 1, name, (val + i + 1) % 2, n);
      }
    }
    yield (`${val}\n`);
    yield (cmd[1]);
  }

  // eslint-disable-next-line no-extra-boolean-cast
  let initialValue = 0;
  yield* gen(depth, 'test', initialValue, 3);
}

function* testDataGenerator2(depth, cmdstrIf) {
  function* gen(d, val, n) {
    let cmd = [
      `//--${cmdstrIf(val)} `,
      `//--endif`,
    ];
    yield (cmd[0]);
    for (let i = 0; i < n; i++) {
      yield (`${val}`);
      if (d) {
        yield* gen(d - 1, (val + i + 1) % 2, n);
      }
    }
    yield (`${val}`);
    yield (cmd[1]);
  }

  // eslint-disable-next-line no-extra-boolean-cast
  let initialValue = 0;
  yield* gen(depth, initialValue, 3);
}


function* lineGen(text) {
  let arr = text.split('\n');
  for (const line of arr.slice(0, -1))
    yield line;
  // only send out last line if it has length > 0
  if (arr.slice(-1)[0].length)
    yield arr.slice(-1)[0];

}


//async function test() {

function test1() {
  //const readable = Readable.from(testDataGenerator(3))
  let rp1 = new ReversiblePreproc({ test: 0 });
  let rp2 = new ReversiblePreproc({});
  let rp3 = new ReversiblePreproc({ test: 0 });
  //  let rp4 = new ReversiblePreproc('*')
  for (const line of testDataGenerator(3)) {
    //process.stdout.write(line)
    let [err1, line1] = rp1.line(line);
    if (err1) throw err1
    assert__default.ok(line1[0] == '0' || line1.substr(0, 2) === '//',
      "line1[0]=='0'||line1.substr(0,2)==='//'");
    let [err2, line2] = rp2.line(line1);
    if (err2) throw err2
    let [err3, line3] = rp3.line(line2);
    if (err3) throw err3
    assert__default.ok(line3 === line1, "reversibility");
    // let [err4, line4] = rp4.line(line3)
    // if (err4) throw err4
    // assert.ok(line4.slice(0, 4) !== '//!!', "line4.slice(0,4)!=='//!!'")
  }
  console.log("test1 passed");
  return true
}
function test2() {
  // test the eval function
  let cmdstrFn = (val) => {
    //return `:(pp)=>{return (pp.foo && pp.foo.bar==${val})}`
    return `ifEval return (defines.foo && defines.foo.bar==${val})`
  };
  //const readable = Readable.from(testDataGenerator2(3, cmdstrFn))
  let rp1 = new ReversiblePreproc({ foo: { bar: 0 } });
  let rp2 = new ReversiblePreproc({});
  let rp3 = new ReversiblePreproc({ foo: { bar: 0 } });
  //let rp4 = new ReversiblePreproc('*')
  //for await (const line of readable) {
  for (const line of testDataGenerator2(3, cmdstrFn)) {
    let [err1, line1] = rp1.line(line);
    if (err1) throw err1
    assert__default.ok(line1[0] == '0' || line1.substr(0, 2) === '//',
      "line1[0]=='0'||line1.substr(0,2)==='//'");
    let [err2, line2] = rp2.line(line1);
    if (err2) throw err2
    let [err3, line3] = rp3.line(line2);
    if (err3) throw err3
    assert__default.ok(line3 === line1, "reversibility");
    // let [err4, line4] = rp4.line(line3)
    // if (err4) throw err4
    // console.log(line4)
    // assert.ok(line4.slice(0, 4) !== '//!!', "line4.slice(0,4)!=='//!!'")
  }
  console.log("test2 passed");
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
  };

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
`;
  //const readable = Readable.from(lineGen(textblock))
  let rp1 = new ReversiblePreproc(ppJson);
  //for await (const line of readable) {    
  for (const line of lineGen(textblock)) {
    //console.log(line)
    let [err1, line1] = rp1.line(line);
    if (err1) throw err1
    //console.log(line1)
    assert__default.ok(line1[0] == '0' || line1.substr(0, 2) === '//',
      "unexpected ouput");
  }
  console.log("test3 passed");
  return true
}

function test4() {
  // test the matchTest algoritm
  let ppJson = {
    choice1: 1,
    foo: { bar: { baz: 1 } },
  };
  let textblock =
    `
//--if choice1.f00
//--if choice1[0]
//--if 'foo'['bar']
`;
  //const readable = Readable.from(lineGen(textblock))
  //for await (const line of readable) {
  let lines = textblock.split('\n');
  for (let linein of lines) {
    let rp1 = new ReversiblePreproc(ppJson);
    //let [err1,line1]=[null,null]
    let outp = rp1.line(linein);
    assert__default.ok(outp && outp instanceof Array && outp.length === 2);
    let err1 = outp[0];
    let lineout = outp[1];
    assert__default.ok(err1 || (lineout && typeof lineout === 'string'));
    if (!(err1 || lineout === '\n' || lineout.includes("--endif")))
      throw new Error(linein, lineout)
    // || err1, "expected error")
  }
  console.log("test4 passed");
  return true
}



function testLineIfDirective(definesJson, lineWithIfDirective, boolErrExpected, boolResultExpected = null) {
  let rp1 = new ReversiblePreproc(definesJson);
  let [err, lineOut] = rp1.line(lineWithIfDirective);

  assert__default.ok(Boolean(boolErrExpected) == Boolean(err), "err status did not match expected");
  if (!boolErrExpected) {
    let [err, lineOut2] = rp1.line("xx");
    if (err) throw "testLineIfDirective: unexpected err [1]"
    let result = null;
    switch (lineOut2.substr(0, 2)) {
      case 'xx': result = true; break
      case '//': result = false; break
      default: throw 'testLineIfDirective: unexpected err [2]'
    }
    assert__default.ok(Boolean(result) == Boolean(boolResultExpected));
  }
}

function testByLine() {
  console.log("start testByLine()");
  testLineIfDirective({ foo: { bar: 0 } }, "//--if def( foo['bar'].baz )", false, false);
  testLineIfDirective({ foo: { bar: 0 } }, "//--if foo.'bar'", true);
  testLineIfDirective({ foo: { bar: 0 } }, "//--if foo['bar'].baz", true);
  testLineIfDirective({}, "//--if null", false, false);
  testLineIfDirective({}, "//--if undefined", false, false);
  testLineIfDirective({}, "//--if true", false, true);
  testLineIfDirective({}, "//--if false", false, false);
  testLineIfDirective({ foo: { bar: 0 } }, "//--if def(foo.bar)", false, true);
  testLineIfDirective({}, "//--if this.rhs", true);
  testLineIfDirective({ foo: { bar: 0 } }, "//--if def(foo['baz'])", false, false);
  console.log("testByLine() success");
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
];

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
    //--addDefEval array ['A','B','C']
    //--tpl {{#array}}{{.}}{{/array}}
    //--render
    `,
    dedent`
    //--addDefEval array ['A','B','C']
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
];

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
];

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
];

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
];

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
];


class TestTplOut {
  constructor() {
    this.lines = [];
  }
  push(line) {
    this.lines.push(line);
  }
}

function testTpl(testData, testnum = -1) {
  for (let item of testData) {
    let rpp = new ReversiblePreproc(item[0]);
    let tto = new TestTplOut;
    let inp = item[1].split('\n');
    for (let linein of inp) {
      let [err, dummy] = rpp.line(linein, tto.push.bind(tto));
      assert__default.ok(dummy === null, "dummy===null");
      if (err)
        throw err
    }
    {
      //let compare = inp.concat(item[2].split('\n'))
      let compare = item[2].split('\n');
      let outarr = [];
      for (let n = 0; n < tto.lines.length; n++) {
        outarr = outarr.concat(tto.lines[n].split('\n'));
        if (tto.lines[n].slice(-1) === '\n')
          outarr = outarr.slice(0, -1);
      }
      assert__default.ok(compare.length === outarr.length, "compare.length===outarr.length");
      for (let n = 0; n < outarr.length; n++) {
        assert__default.ok(outarr[n] === compare[n], `${outarr[n]} === ${compare[n]}`);
      }
    }
  }
  console.log(`testTpl() #${testnum} passed`);
  return true
}

function testAll() {
  try {
    console.log(ReversiblePreproc.queryVersion());
    test1();
    test2();
    test3();
    test4();
    testByLine();
    testTpl(tplTestData1, 1);
    testTpl(tplTestData2, 2);
    testTpl(tplTestData3, 3);
    testTpl(tplTestData4, 4);
    testTpl(tplTestData5, 5);
    testTpl(tplTestData6, 6);
    console.log('testAll PASS');
    return true
  } catch (e) {
    console.log('testAll FAIL');
    return false
  }
}

exports.testAll = testAll;
