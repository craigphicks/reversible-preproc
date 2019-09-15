#!/bin/sh
rm -f lib/*
rm -f test/*
$(npm bin)/rollup -c
chmod +x test/call-test-reversible-preproc.js
exit 0

