# oliot-ds-1.1
Oliot-ds is an implementation of EPCglobal Discovery Service.

## Features
* Node.js based RESTful Interface for easy service records management
* Access control to share accesibitity to service records with others
* Oauth 2.0 compliant authentification 

## Install
### Prerequisites
Get [docker](https://docs.docker.com/engine/installation/linux/ubuntu/) and [docker-compose](https://docs.docker.com/compose/install/)
### Before installation
configure each DB's ID and PW in .env file for your purpose.
### Linux
You can install DS server comprised of authentification(postgreSQL), access control(Neo4J), web app(Node.js), web API(Node.js), web TDT engine(Node.js + Java), back-end DB(mongoDB), cache(redis).
```shell
$ bash deploy_ds.sh
```

## License
See [LICENSE](LICENSE).
