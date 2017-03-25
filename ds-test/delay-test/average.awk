BEGIN{

	total = 0;

	num = 0;

}

{

	if( $1>=0 ) {

		total += $1

		++num

	}

}

END {

	printf("Success: %d, Fail: %d\n", num, n-num);

	printf("Total delay: %f ms\n", total);

	printf("Average delay: %f ms\n", total/num); 

}
