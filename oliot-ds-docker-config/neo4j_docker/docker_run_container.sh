docker run -d --name=ds_acl_neo4j  --publish=7474:7474 --publish=7687:7687 --publish=7473:7473 --volume=$HOME/oliot-ds-1.1/oliot-ds-docker-config/neo4j_docker/data:/data --env=NEO4J_AUTH=neo4j/password neo4j:3.0

