'use strict';

app.service('authenticationService', ['$http', '$q', 'UserPersistenceService', 'deviceDetector', 'detectUtils', 'OS_TYPE', 'HTTP_CODES', 'API_TYPE', 'envService',
    function ($http, $q, UserPersistenceService, deviceDetector, detectUtils, OS_TYPE, HTTP_CODES, API_TYPE, envService) {

        var API_URL = envService.read('API_URL');
        var _user = null;

        function checkDeviceType() {

            if (detectUtils.isAndroid()) {
                return OS_TYPE.ANDROID;
            } else if (detectUtils.isIOS()) {
                return OS_TYPE.IOS;
            } else if (detectUtils.isMobile() || deviceDetector.isDesktop()) {
                return OS_TYPE.WEB_BROWSER;
            }
            return OS_TYPE.UNKNOWN;
        }

        return {
            //------------------------------change password-------------------------------------------------------
            'changePassword': function (new_password, change_password) {

                var defer = $q.defer();
                $http.post(API_URL + API_TYPE._MEMBERSHIP_.CHANGE_PASSWORD, new_password, change_password)
                    .then(function (response) {
                        defer.resolve(response.data.result);
                    }, function (response) {
                        defer.resolve(response.data.result);
                    });
                return defer.promise;
            },
            //-----------------------------reset password --------------------------------------------------------
            'resetPassword': function (user_id, reset_code) {

                var defer = $q.defer();
                $http.get(API_URL + API_TYPE._MEMBERSHIP_.RESET_PASSWORD + user_id + '/' + reset_code)
                    .then(function (response) {
                        defer.resolve(response.data.result);
                    }, function (response) {
                        defer.resolve(response.data.result);
                    });
                return defer.promise;
            },
            //----------------------- for registration of users --------------------------------------------------
            'registration': function (user) {

                var defer = $q.defer();
                $http.post(API_URL + API_TYPE._MEMBERSHIP_.SIGN_UP, user)
                    .then(function (response) {
                        defer.resolve(response.data.result[0]);
                    }, function (response) {
                        defer.resolve(response.data.result[0]);
                    });
                return defer.promise;
            },
            //---------------------------------for login of users ------------------------------------------------
            'login': function (user) {
                // give user object the device type
                user.os_type = checkDeviceType();

                var defer = $q.defer();
                $http.post(API_URL + API_TYPE._MEMBERSHIP_.LOG_IN, user)
                    .then(function (response) {
                        // set cookies for user
                        if (response.data.result[0].statusCode == HTTP_CODES.SUCCESS.OK) {
                            _user = response.data.result[0].data.email;
                            UserPersistenceService.setCookieData(_user, user.remember_me);
                        }
                        defer.resolve(response.data.result[0]);
                    }, function (response) {
                        //user = false;
                        UserPersistenceService.clearCookieData();
                        defer.resolve(response.data.result[0]);
                    });
                return defer.promise;
            },
            //-------------------------------check if user is logged in or not------------------------------------
            'isLoggedIn': function () {

                var isLoggedIn = UserPersistenceService.getCookieData();
                if (isLoggedIn) {
                    return true;
                } else {
                    return false;
                }
            },
            // ----------------------------------get current user status------------------------------------------
            'getUserStatus': function () {
                $http.get(API_URL + API_TYPE._MEMBERSHIP_.USER_STATUS)
                    // handle success
                    .success(function (data) {
                        if (data.status) {
                            UserPersistenceService.setCookieData(_user);
                        } else {
                            //user = false;
                            UserPersistenceService.clearCookieData();
                        }
                    })
                    // handle error
                    .error(function (data) {
                        //user = false;
                        UserPersistenceService.clearCookieData();
                    });
            },
            //---------------------------------------user Activation----------------------------------------------
            'forgotPassword': function (email) {

                var defer = $q.defer();
                $http.get(API_URL + API_TYPE._MEMBERSHIP_.CHECK_IF_USER_EXISTS + email)
                    .then(function (response) {
                        console.log(response);
                        defer.resolve(response.data.result);
                    }, function (response) {
                        defer.resolve(response.data.result);
                    });
                return defer.promise;
            },
            //---------------------------------------user Activation----------------------------------------------
            'userActivation': function (user_id, activation_code) {

                var defer = $q.defer();
                $http.get(API_URL + API_TYPE._MEMBERSHIP_.USER_ACTIVATION + user_id + '/' + activation_code)
                    .then(function (response) {
                        defer.resolve(response.data.result);
                    }, function (response) {
                        defer.resolve(response.data.result);
                    });
                return defer.promise;
            },
            //-------------------------------------logout the user------------------------------------------------
            'logout': function () {

                var deferred = $q.defer();
                $http.get(API_URL + API_TYPE._MEMBERSHIP_.LOG_OUT)
                    .success(function (data) {
                        //user = false;
                        UserPersistenceService.clearCookieData();
                        deferred.resolve();
                    })
                    .error(function (data) {
                        //user = false;
                        UserPersistenceService.clearCookieData();
                        deferred.reject();
                    });

                // return promise object
                return deferred.promise;
            },
            // -
        }
    }]);