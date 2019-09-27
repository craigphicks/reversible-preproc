#!/bin/sh
rm -f lib/*
rm -f test/*.js
$(npm bin)/rollup -c || exit 10
chmod +x test/call-test-reversible-preproc.js || exit 20
chmod +x test/test-rppt.js || exit 30
exit 0

