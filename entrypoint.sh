#!/bin/sh

echo "Init app with NODE_ENV: $NODE_ENV"

export NODE_ENV=${NODE_ENV:-production}

exec node dist/main
