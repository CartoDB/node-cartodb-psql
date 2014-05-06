#!/bin/sh

# To make output dates deterministic
export TZ='Europe/Rome'


# This is where postgresql connection parameters are read from
TESTENV=config/environments/test.js

# Extract postgres configuration
PGHOST=`node -e "console.log(require('${TESTENV}').db_host || '')"`
echo "PGHOST: $PGHOST"
PGPORT=`node -e "console.log(require('${TESTENV}').db_port || '')"`
echo "PGPORT: $PGPORT"

TESTUSERID=1

TEST_DB=`node -e "console.log(require('${TESTENV}').db_base_name || '')"`
if test -z "$TEST_DB"; then
  echo "Missing db_base_name from ${TESTENV}" >&2
  exit 1
fi
TEST_DB=`echo ${TEST_DB} | sed "s/<%= user_id %>/${TESTUSERID}/"`

cleanup() {
    dropdb ${TEST_DB} 2> /dev/null # error expected if doesn't exist
}
trap 'cleanup' 0 1 2 3 6 9 15

die() {
	msg=$1
	echo "${msg}" >&2
	cleanup
	exit 1
}

export PGHOST PGPORT

cleanup
createdb -Ttemplate_postgis -EUTF8 ${TEST_DB} || die "Could not create test database"

mocha -t 5000 -u tdd $@
exit $?
