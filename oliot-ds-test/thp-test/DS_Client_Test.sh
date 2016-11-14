#!/bin/bash





if [ $# -ne 4 ]; then

	echo "Usage: bash ./DS_Client_Test.sh [initial num] [iteration num] [increase amount] [target address]"

	echo "Example :  bash ./DS_Client_Test.sh 1000 5 1000 143.248.56.222" 

	exit 1

fi



echo "Testing start.."

echo "Initial number of queries : $1, Iteration number : $2 ms, Increase amount: $3"

echo "Target address : $4"



for (( c=0; c<$2; c++ ))

do

	echo "node DS_Client.js -n $(($1+$3*$c)) -a $4"

	node DS_Client.js -n $(($1+$3*$c)) -a $4

		

done
