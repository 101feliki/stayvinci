#!/bin/sh
# Creates the application's login and database on first start.
# The app logs in as an ordinary user (NOT a superuser): superusers skip row-level
# security, so the app must never run as one. CREATEROLE lets migrations create the
# sv_* roles the API switches into per request.
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<SQL
CREATE ROLE ${APP_DB_USER} LOGIN PASSWORD '${APP_DB_PASSWORD}' NOSUPERUSER NOBYPASSRLS CREATEROLE;
CREATE DATABASE ${APP_DB_NAME} OWNER ${APP_DB_USER};
SQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "${APP_DB_NAME}" <<SQL
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS citext;
SQL
