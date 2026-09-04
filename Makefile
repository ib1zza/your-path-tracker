.PHONY: help install dev build preview lint lint-fix format format-check typecheck test check clean

YARN ?= yarn

help:
	@echo "Targets:"
	@echo "  install       Install dependencies (yarn)"
	@echo "  dev           Start Vite dev server"
	@echo "  build         Typecheck and production bundle"
	@echo "  preview       Preview production build"
	@echo "  lint          Run oxlint"
	@echo "  lint-fix      Run oxlint with --fix"
	@echo "  format        Format with Prettier"
	@echo "  format-check  Check Prettier formatting"
	@echo "  typecheck     TypeScript project build (no bundle)"
	@echo "  test          Run unit tests"
	@echo "  check         lint + format-check + test + build"
	@echo "  clean         Remove dist and Vite/TS caches"

install:
	$(YARN) install

dev:
	$(YARN) dev

build:
	$(YARN) build

preview:
	$(YARN) preview

lint:
	$(YARN) lint

lint-fix:
	$(YARN) lint:fix

format:
	$(YARN) format

format-check:
	$(YARN) format:check

typecheck:
	$(YARN) typecheck

test:
	$(YARN) test

check:
	$(YARN) check

clean:
	$(YARN) clean
