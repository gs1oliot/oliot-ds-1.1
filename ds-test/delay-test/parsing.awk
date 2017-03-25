#!/usr/bin/awk -f

BEGIN { success = 0 }

/^success/ {

	#print $0 $1 $2 $3 $4 $5

	success = 1

	next

}

/^time/ {

	response = $2
	if( success == 1)
		printf("%s\n", response);
	else
		printf("\n");

}
