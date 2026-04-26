.PHONY: install up worker build test db-create db-migrate-local db-migrate-remote deploy status

install:
	npm install

up:
	npm run dev

worker:
	npm run worker

build:
	npm run build

test:
	npm run test

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
