.PHONY: install up worker worker-clean build test test-integration test-all api-toy-check api-parallel-probe db-create db-migrate-local db-migrate-remote deploy status

install:
	npm install

up:
	npm run dev

worker:
	set -a; [ ! -f .env ] || . ./.env; set +a; npm run worker

worker-clean:
	lsof -tiTCP:8787 -sTCP:LISTEN | xargs -r kill
	pkill -f "wrangler dev worker.js --local --port 8787" || true
	pkill -f "workerd.*localhost:8787" || true

build:
	npm run build

test:
	npm run test

test-integration:
	npm run test:integration

test-all:
	npm run test:all

api-toy-check:
	python3 scripts/openai_toy_check.py

api-parallel-probe:
	python3 scripts/openai_parallel_meal_probe.py

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
