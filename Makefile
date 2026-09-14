# Scoop — simple commands for running the bot on this Mac. Type `make` to list them.
# All the work is in scripts/local.sh.

.PHONY: help setup start stop restart status logs chat test menu reset

help:
	@./scripts/local.sh help

setup:
	@./scripts/local.sh setup

start:
	@./scripts/local.sh start

stop:
	@./scripts/local.sh stop

restart:
	@./scripts/local.sh restart

status:
	@./scripts/local.sh status

logs:
	@./scripts/local.sh logs

chat:
	@./scripts/local.sh chat

test:
	@./scripts/local.sh test

menu:
	@./scripts/local.sh menu

reset:
	@./scripts/local.sh reset
