all:
	npm install

clean:
	rm -rf node_modules/*

jshint:
	@echo "***jshint***"
	@./node_modules/.bin/jshint lib/ test/


test:
	@echo "***tests***"
	test/run_tests.sh ${RUNTESTFLAGS}

coverage:
	@echo "***coverage***"
	RUNTESTFLAGS=--with-coverage make test


test-all: test jshint

.PHONY: test coverage
