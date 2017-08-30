# oliot-ds-1.1
Oliot-ds is an implementation of EPCglobal Discovery Service.

## Features
* Node.js based RESTful Interface for easy access control management
* Fine grained access control model
* Oauth 2.0 compliant authentification
* Two-layered storage architecture

## Install
### Prerequisites
Get [docker](https://docs.docker.com/engine/installation/linux/ubuntu/) and [docker-compose](https://docs.docker.com/compose/install/)
### Before installation
make .env by using .env.template
configure each DB's ID and PW in .env file for your purpose.
### Linux
You can install DS server comprised of authentification(postgreSQL), access control(Neo4J), web app(Node.js), web API(Node.js), web TDT engine(Node.js + Java), back-end DB(mongoDB), cache(redis).
```shell
$ bash deploy_ds.sh
```

## License
See [LICENSE](LICENSE).
