# azure-graphapi2

Node.js package for making Azure Active Directory Graph API calls

v0.1.1

## Installation

```
npm install azure-graphapi-2 --save
```

## Usage

```javascript
var GraphAPI = require('azure-graphapi');

var graph = new GraphAPI(tenant, clientId, clientSecret);
// The tenant, clientId, and clientSecret are usually in a configuration file.

graph.get('users/a8272675-dc21-4ff4-bc8d-8647830fa7db', function(err, user) {
    if (!err) {
        console.dir(user);
    }
}
```

## Details

This package provides an HTTPS interface to the [Azure Active Directory Graph API](https://msdn.microsoft.com/en-us/library/azure/hh974476.aspx). You will need the tenant (i.e., domain) of your Azure AD instance as well as an application within that AD instance that has permissions to access your directory. This application is identified by a `clientId` and authenticated using a `clientSecret`. The `clientSecret` is also called the application key.

The typical verbs are supported (GET, POST, PUT, PATCH, and DELETE). The `getObjects` method is useful for reading a large number of objects. Azure AD limits each response to 100 objects. The `getObject` method follows the `odata.nextLink` and accumulates all objects of a specific object type.

## Interface

This section describes the constructor returned by this module and the available instance methodss.

### Constructor

#### GraphAPI(tenant, clientId, clientSecret, [apiVersion])

Creates a new `GraphAPI` instance. If the `apiVersion` is not specified, it defaults to version 1.6.

```javascript
var GraphAPI = require('azure-graphapi');

var graph = new GraphAPI(tenant, clientId, clientSecret);
```

### Methods

Each of these methods takes `ref` parameter with optional replacement `args`. These are passed to [strformat](https://github.com/fhellwig/strformat) to create the actual URI reference. This allows for the following constructs:

```javascript
var person = {
    userId: 'a8272675-dc21-4ff4-bc8d-8647830fa7db'
};

graph.get('users/{0}', person.userId, function(err, user) {
    if (!err) {
        console.dir(user);
    }
}
```

The following REST-style URI reference is also available:

```javascript
var person = {
    userId: 'a8272675-dc21-4ff4-bc8d-8647830fa7db'
};

graph.get('users/{userId}', person, function(err, user) {
    if (!err) {
        console.dir(user);
    }
}
```

Get by filter (return Array):

```javascript

graph.getByFilter('users/', 'customerId','a8272675-dc21-4ff4-bc8d-8647830fa7db', function(err, users) {
    if (!err) {
        console.dir(users);
    }
}
```

In all cases, do *not* prefix the `ref` with a forward slash and do *not* add the API version as this is added automatically based on the API version specified in the constructor.

#### graph.get(ref [,args...], callback)

Performs an HTTPS GET request. The callback signature is `callback(err, response)`.

#### graph.post(ref [,args...], data, contentType, callback)

Performs an HTTPS POST request. The callback signature is `callback(err, response)`.

#### graph.put(ref [,args...], data, contentType, callback)

Performs an HTTPS PUT request. The callback signature is `callback(err, response)`.

#### graph.patch(ref [,args...], data, contentType, callback)

Performs an HTTPS PATCH request. The callback signature is `callback(err, response)`.

#### graph.delete(ref [,args...], callback)

Performs an HTTPS DELETE request. The callback signature is `callback(err)`.

#### graph.getObjects(ref [,args...], objectType, callback)

Performs an HTTPS GET request and accumulates all objects having the specified `objectType` (e.g., "User"). The callback signature is `callback(err, objects)`. This method follows the `odata.nextLink` property in the response and continues until no more batches of objects are available.

## Notes

1. The HTTPS request logic parses out the `error_description` and `odata.error` messages from JSON responses to unsuccessful requests. These become part of the error message in the `err` object provided to the callback method.
2. If the `contentType` is null and the request data is a string, it is assumed to be form data and is sent as `application/x-www-form-urlencoded`.
3. If the `contentType` is null and the request data is a JavaScript object, it is send as `application/json`.
4. The callback is passed only one argument (err) if the response status code is 204 (No Content). This is important when using libraries such as the [async utilities](https://github.com/caolan/async).
5. If the response has a `value` property, it is that value that is passed to the callback function and not the entire response object.
