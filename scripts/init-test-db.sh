#!/bin/sh
set -e

# Creates the secondary test database for automated constraint and rollback testing
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE ${POSTGRES_TEST_DB:-karigar_test}'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${POSTGRES_TEST_DB:-karigar_test}')\gexec
EOSQL

