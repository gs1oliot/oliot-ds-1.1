#!/bin/bash



if [ $# -ne 2 ]; then

	echo "Usage: bash ./DS_Client_Test.sh [num of data] [target address]"

	echo "Example :  bash ./DS_Client_Test.sh 1 127.0.0.1"

	exit 1

fi

node ../test_data.js

node add_data.js -n $1 -a $2 
