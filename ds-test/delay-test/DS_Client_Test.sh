#!/bin/bash



if [ $# -ne 4 ]; then

	echo "Usage: bash ./DS_Client_Test.sh [initial num] [num of iteration] [increasing amount] [target address]"

	echo "Example :  bash ./DS_Client_Test.sh 10 10 10 127.0.0.1"

	exit 1

fi

node ../test_data.js

for (( i=1; i<=$2; i++ )) 

do

rm ./result


num=$(($1+($i-1)*$3))



echo "sending $num DS queries..."


for (( j=1; j<=num; j++ ))

do

	node DS_Client.js -n $j | awk -f parsing.awk >> result

done


echo "---Results---"

awk -v n=$num -f average.awk result

echo ""

done
