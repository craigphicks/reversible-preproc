#!/bin/bash

node test/call-test-reversible-preproc.js || exit 10
node test/test-rppt.js || exit 20
node test/test-force-assign-rhs.js || exit 30
echo "ALL TESTS PASSED"
exit 0
