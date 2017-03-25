#!/bin/bash





if [ $# -ne 4 ]; then

	echo "Usage: bash ./DS_Client_Test.sh [initial num] [iteration num] [increase amount] [target address]"

	echo "Example :  bash ./DS_Client_Test.sh 100 6 200 127.0.0.1" 

	exit 1

fi

node ../test_data.js

echo "Testing start.."

echo "Initial number of queries : $1, Iteration number : $2 ms, Increase amount: $3"

echo "Target address : $4"



for (( c=0; c<$2; c++ ))

do

	echo "node DS_Client.js -n $(($1+$3*$c)) -a $4"

	node DS_Client.js -n $(($1+$3*$c)) -a $4

	echo ""		

done
