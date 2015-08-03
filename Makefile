all:
	npm install

clean:
	rm -rf node_modules/*

jshint:
	@echo "***jshint***"
	@./node_modules/.bin/jshint lib/ test/

TEST_SUITE := $(shell find test/{integration,unit} -name "*.js")

test:
	@echo "***tests***"
	test/run_tests.sh ${RUNTESTFLAGS} $(TEST_SUITE)

test-all: jshint test

.PHONY: test
