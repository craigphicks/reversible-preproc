#!/bin/bash

node test/call-test-reversible-preproc.js || exit 10
node test/test-rppt.js || exit 20
barfoo="3" node test/test-assign-json.js || exit 30
echo "ALL TESTS PASSED"
exit 0
