#!/bin/sh

# To make output dates deterministic
export TZ='Europe/Rome'


cd $(dirname $0)
BASEDIR=$(pwd)
cd -

# This is where postgresql connection parameters are read from
TESTENV="${BASEDIR}/../config/environments/test.js"

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
createdb -EUTF8 ${TEST_DB} || die "Could not create test database"

# public user role
PUBLICUSER=`node -e "console.log(require('${TESTENV}').db_pubuser || 'xxx')"`
PUBLICPASS=`node -e "console.log(require('${TESTENV}').db_pubuser_pass || 'xxx')"`
echo "DROP USER IF EXISTS ${PUBLICUSER};" | psql -v ON_ERROR_STOP=1 ${TEST_DB} || exit 1
echo "CREATE USER ${PUBLICUSER} WITH PASSWORD '${PUBLICPASS}';" | psql -v ON_ERROR_STOP=1 ${TEST_DB} || exit 1

# db owner role
TESTUSER=`node -e "console.log(require('${TESTENV}').db_user || '')"`
if test -z "$TESTUSER"; then
  echo "Missing db_user from ${TESTENV}" >&2
  exit 1
fi
TESTUSER=`echo ${TESTUSER} | sed "s/<%= user_id %>/${TESTUSERID}/"`
TESTPASS=`node -e "console.log(require('${TESTENV}').db_user_pass || '')"`
TESTPASS=`echo ${TESTPASS} | sed "s/<%= user_id %>/${TESTUSERID}/"`
echo "DROP USER IF EXISTS ${TESTUSER};" | psql -v ON_ERROR_STOP=1 ${TEST_DB} || exit 1
echo "CREATE USER ${TESTUSER} WITH PASSWORD '${TESTPASS}';" | psql -v ON_ERROR_STOP=1 ${TEST_DB} || exit 1

mocha -t 5000 -u tdd $@
exit $?
