.PHONY: install up worker build test test-integration test-all db-create db-migrate-local db-migrate-remote deploy status

install:
	npm install

up:
	npm run dev

worker:
	set -a; [ ! -f .env ] || . ./.env; set +a; npm run worker

build:
	npm run build

test:
	npm run test

test-integration:
	npm run test:integration

test-all:
	npm run test:all

db-create:
	npm run db:create

db-migrate-local:
	npm run db:migrate:local

db-migrate-remote:
	npm run db:migrate:remote

deploy:
	npm run deploy

status:
	npm run status
