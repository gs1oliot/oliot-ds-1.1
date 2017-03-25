CREATE CONSTRAINT ON (user:User) ASSERT user.username IS UNIQUE;

CREATE CONSTRAINT ON (thing:Thing) ASSERT thing.thingname IS UNIQUE;

CREATE CONSTRAINT ON (service:Service) ASSERT service.servicename IS UNIQUE;

CREATE CONSTRAINT ON (group:Group) ASSERT group.groupname IS UNIQUE;

