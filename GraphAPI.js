/**
 * Azure Active Directory (AAD) Graph API
 *
 * Provides an HTTPS interface to the AAD Graph API. This module requests an
 * access token for the application specified in the constructor and then uses
 * that token to make the API calls. If a call fails due to a 401 error, a new
 * new access token is obtained and the request is retried.
 *
 * @author Frank Hellwig
 * @module GraphAPI
 * @version 0.0.8
 */

var http = require('http'),
    https = require('https'),
    querystring = require('querystring'),
    strformat = require('strformat'),
    slice = Array.prototype.slice,
    AAD_LOGIN_HOSTNAME = 'login.windows.net',
    GRAPH_API_HOSTNAME = 'graph.windows.net',
    DEFAULT_API_VERSION = '1.6';

//-----------------------------------------------------------------------------
// PUBLIC
//-----------------------------------------------------------------------------

/**
 * Constructor
 */
function GraphAPI(tenant, clientId, clientSecret, apiVersion) {
    if (!(this instanceof arguments.callee)) {
        throw new Error("Constructor called as a function");
    }
    this.tenant = tenant;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.apiVersion = apiVersion || DEFAULT_API_VERSION;
    this.accessToken = null;
}

/**
 * HTTPS GET
 *
 * get(ref, callback)
 */
GraphAPI.prototype.get = function() {
    var ref = strformat.apply(null, slice.call(arguments, 0, -1)),
        callback = slice.call(arguments, -1)[0];
    this._request('GET', ref, null, null, wrap(callback));
};

/**
 * HTTPS GET
 *
 * getByFilter(ref, property(string), value, callback)
 */
GraphAPI.prototype.getByFilter = function() {
    var ref = strformat.apply(null, slice.call(arguments, 0)),
        property = strformat.apply(null, slice.call(arguments, 1)),
        value = strformat.apply(null, slice.call(arguments, 2)),
        callback = slice.call(arguments, 3)[0];
    ref += '/';
    ref +='?';
    ref +='$filter';
    ref +='=';
    ref += property;
    ref +=' ';
    ref +='eq';
    ref +=' ';
    ref +="'" + value + "'";
    console.log(ref);
    this._request('GET', encodeURI(ref), null, null, wrap(callback));
};

/**
 * HTTPS GET with odata.nextList recursive call
 *
 * getObjects(ref, objectType, callback)
 */
GraphAPI.prototype.getObjects = function() {
    var ref = strformat.apply(null, slice.call(arguments, 0, -2)),
        objectType = slice.call(arguments, -2, -1)[0],
        callback = slice.call(arguments, -1)[0];
    this._getObjects(ref, [], objectType, callback);
};

/**
 * HTTPS POST
 *
 * post(ref, data, contentType, callback)
 */
GraphAPI.prototype.post = function() {
    var ref = strformat.apply(null, slice.call(arguments, 0, -3)),
        data = slice.call(arguments, -3, -2)[0],
        contentType = slice.call(arguments, -2, -1)[0],
        callback = slice.call(arguments, -1)[0];
    this._request('POST', ref, data, contentType, wrap(callback));
};

/**
 * HTTPS PUT
 *
 * put(ref, data, contentType, callback)
 */
GraphAPI.prototype.put = function() {
    var ref = strformat.apply(null, slice.call(arguments, 0, -3)),
        data = slice.call(arguments, -3, -2)[0],
        contentType = slice.call(arguments, -2, -1)[0],
        callback = slice.call(arguments, -1)[0];
    this._request('PUT', ref, data, contentType, wrap(callback));
};

/**
 * HTTPS PATCH
 *
 * patch(ref, data, contentType, callback)
 */
GraphAPI.prototype.patch = function() {
    var ref = strformat.apply(null, slice.call(arguments, 0, -3)),
        data = slice.call(arguments, -3, -2)[0],
        contentType = slice.call(arguments, -2, -1)[0],
        callback = slice.call(arguments, -1)[0];
    this._request('PATCH', ref, data, contentType, wrap(callback));
};

/**
 * HTTPS DELETE
 *
 * get(ref, callback)
 */
GraphAPI.prototype.delete = function() {
    var ref = strformat.apply(null, slice.call(arguments, 0, -1)),
        callback = slice.call(arguments, -1)[0];
    this._request('DELETE', ref, null, null, wrap(callback));
};

//-----------------------------------------------------------------------------
// PRIVATE
//-----------------------------------------------------------------------------

// Only return the value and the correct number of arguments.
function wrap(callback) {
    return function(err, response) {
        if (err) {
            callback(err);
        } else if (typeof response === 'undefined') {
            // Handle 204 responses by not adding a second argument.
            callback(null);
        } else if (response.value) {
            callback(null, response.value);
        } else {
            callback(null, response);
        }
    }
}

// Recursive method that follows the odata.nextLink.
GraphAPI.prototype._getObjects = function(ref, objects, objectType, callback) {
    var self = this;
    self._request('GET', ref, null, null, function(err, response) {
        if (err) return callback(err);
        var value = response.value;
        for (var i = 0, n = value.length; i < n; i++) {
            if (value[i].objectType === objectType) {
                objects.push(value[i]);
            }
        }
        var nextLink = response['odata.nextLink'];
        if (nextLink) {
            self._getObjects(nextLink, objects, objectType, callback);
        } else {
            callback(null, objects);
        }
    });
};

// If there is an access token, perform the request. If not, get an
// access token and then perform the request.
GraphAPI.prototype._request = function(method, ref, data, contentType, callback) {
    var self = this;
    if (self.accessToken) {
        self._requestWithRetry(method, ref, data, contentType, false, callback);
    } else {
        self._requestAccessToken(function(err, token) {
            if (err) {
                callback(err);
            } else {
                self.accessToken = token;
                self._requestWithRetry(method, ref, data, contentType, false, callback);
            }
        });
    }
};

// Performs the HTTPS request and tries again on a 401 error
// by getting another access token and repeating the request.
GraphAPI.prototype._requestWithRetry = function(method, ref, data, contentType, secondAttempt, callback) {
    var self = this;
    var path = ['/'];
    path.push(self.tenant);
    path.push('/');
    path.push(ref);
    if (ref.indexOf('?') < 0) {
        path.push('?');
    } else {
        path.push('&');
    }
    path.push('api-version=');
    path.push(self.apiVersion);
    var options = {
        hostname: GRAPH_API_HOSTNAME,
        path: path.join(''),
        method: method,
        headers: {
            'Authorization': 'Bearer ' + self.accessToken
        }
    };
    if (data) {
        if (Buffer.isBuffer(data)) {
            options.headers['Content-Type'] = contentType;
        } else if (!contentType) {
            if (typeof data === 'string') {
                options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
                options.headers['Content-Length'] = data.length;
            } else if (data !== null && typeof data === 'object') {
                data = JSON.stringify(data);
                options.headers['Content-Type'] = 'application/json';
                options.headers['Content-Length'] = data.length;
            }
        }
    }
    httpsRequest(options, data, function(err, response) {
        if (err) {
            if (err.statusCode === 401 && !secondAttempt) {
                self._requestAccessToken(function(err, token) {
                    if (err) {
                        callback(err);
                    } else {
                        self.accessToken = token;
                        self._requestWithRetry(method, ref, data, contentType, true, callback);
                    }
                });
            } else {
                callback(err);
            }
        } else {
            callback(null, response);
        }
    });
};

// Gets an access token using the client id and secret.
GraphAPI.prototype._requestAccessToken = function(callback) {
    var query = {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'client_credentials',
        resource: 'https://' + GRAPH_API_HOSTNAME
    };
    var content = querystring.stringify(query);
    var options = {
        hostname: AAD_LOGIN_HOSTNAME,
        path: '/' + this.tenant + '/oauth2/token',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': content.length
        }
    };
    httpsRequest(options, content, function(err, response) {
        if (err) {
            callback(err);
        } else {
            callback(null, response.access_token);
        }
    });
};

// Our own wrapper around the https.request method.
function httpsRequest(options, content, callback) {
    options.headers = options.headers || {};
    options.headers['Accept'] = 'application/json';
    if (!callback) {
        callback = content;
        content = null;
    }
    var req = https.request(options, function(res) {
        res.setEncoding('utf8');
        var buf = [];
        res.on('data', function(data) {
            buf.push(data);
        });
        res.on('end', function() {
            var data = buf.join('');
            if (data.length > 0) {
                data = JSON.parse(data);
            } else {
                data = null;
            }
            if (res.statusCode === 204) {
                callback(null); // no data
            } else if (res.statusCode >= 200 && res.statusCode <= 299) {
                callback(null, data); // success
            } else {
                if (data && data.error_description) {
                    data = data.error_description.split(/[\r\n]/)[0];
                } else if (data && data['odata.error']) {
                    data = data['odata.error'].message.value;
                } else {
                    data = null;
                }
                var err = new Error(errmsg(res.statusCode, data));
                err.statusCode = res.statusCode;
                callback(err);
            }
        });
    });
    req.on('error', function(err) {
        callback(err);
    });
    
    if (typeof content === 'string') {
        req.write(content);
    } else {
        req.write(JSON.stringify(content));
    }
    
    req.end();
}

// Creates an exception error message.
function errmsg(status, message) {
    message = message || '[no additional details]';
    return strformat('Graph API Error: {0} ({1}) {2}',
        status, http.STATUS_CODES[status], message);
}

//-----------------------------------------------------------------------------
// EXPORTS
//-----------------------------------------------------------------------------

module.exports = GraphAPI; // export the constructor
