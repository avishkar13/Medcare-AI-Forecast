#!/bin/sh
set -eu

echo "> Applying database migrations..."
prisma migrate deploy

if [ "${RUN_SEED:-false}" = "true" ]; then
  echo "> Checking whether the database is empty..."

  if PRODUCT_COUNT=$(node dist/prisma/count-products.js); then
    if [ "$PRODUCT_COUNT" = "0" ]; then
      echo "> Empty database detected, seeding..."
      node dist/prisma/seed.js
      echo "> Seed complete."
    else
      echo "> Database already holds $PRODUCT_COUNT products, skipping seed."
    fi
  else
    echo "! Could not determine whether the database is seeded." >&2
    echo "! Refusing to seed, because seeding wipes every table first." >&2
    echo "! Set RUN_SEED=false to silence this, or seed manually once the database is reachable." >&2
  fi
fi

echo "> Starting server..."
exec "$@"
