-- Runs once, when the postgres data volume is first created (see docker-compose.yml).
-- The integration tests use their own database on the same server so they can be
-- dropped and recreated without touching development data in `cookfeed`.
CREATE DATABASE cookfeed_test;
