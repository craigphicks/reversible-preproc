#!/bin/sh
rm -f lib/*
rm -f test/*.js
$(npm bin)/rollup -c || exit 10
chmod +x test/*.js || exit 20
exit 0

