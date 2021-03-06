// load all the things we need
var LocalStrategy = require('passport-local').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;
var TwitterStrategy = require('passport-twitter').Strategy;
var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
var debug = require('debug')('http');

//middlewares
var AfterLogin = require('./../app/middlewares/after_login');

// load up the user access model
var CONFIG = require('./config');
var jwt = require("jsonwebtoken");
var User = require('../app/models/user_access');
var UserDetails = require('../app/models/user_details');
var UserAccessDetails = require('../app/models/user_access_details');
var UserAccessDevices = require('../app/models/user_devices');
var CustomLabels = require('../app/models/custom_labels');
var Activities = require('../app/models/activities');

// load the auth variables
var configAuth = require('./auth'); // use this one for testing

// loading user constants
var CONSTANTS = require('./../app/helpers/constants');
var CheckUserType = require('./../app/helpers/checkUserType');
var ResultResponses = require('./../app/helpers/resultResponses');

module.exports = function (passport) {

    // passport session setup ==================================================
    // =========================================================================
    // required for persistent login sessions
    // passport needs ability to serialize and unserialize users out of session

    // used to serialize the user for the session
    passport.serializeUser(function (user, done) {
        done(null, user.id);
    });

    // used to deserialize the user
    passport.deserializeUser(function (id, done) {
        User.findById(id, function (err, user) {
            done(err, user);
        });
    });

    // =========================================================================
    // LOCAL LOGIN =============================================================
    // =========================================================================
    passport.use('local-login', new LocalStrategy({
            // by default, local strategy uses username and password, we will override with email
            usernameField: 'email',
            passwordField: 'password',
            passReqToCallback: true // allows us to pass in the req from our route (lets us check if a user is logged in or not)
        },
        function (req, email, password, done) {
            var os_type = req.body.os_type;

            if (!os_type) {
                os_type = CONSTANTS.OS_TYPE.UNKNOWN;
            }

            if (email)
                email = email.toLowerCase(); // Use lower-case e-mails to avoid case-sensitive e-mail matching

            // asynchronous
            process.nextTick(function () {
                User.findOne({'email': email}, function (err, user) {

                    var result = {};

                    result = ResultResponses.failed(CONSTANTS.HTTP_CODES.SERVER_ERROR.INTERNAL_SERVER_ERROR,
                        'Some Error Occurred.');

                    // if there are any errors, return the error
                    if (err) {
                        return done(err, req.flash('result', result));
                    }

                    // if no user is found, return the message
                    if (!user || user.deleted_at || !user.validPassword(password)) {

                        result = ResultResponses.failed(CONSTANTS.HTTP_CODES.CLIENT_ERROR.UNAUTHORISED,
                            'Email or password Invalid!!.');

                        return done(null, false, req.flash('result', result));
                    } else if (user && user.validPassword(password)) {
                        // user is found and password is also authenticated

                        if (!user.activated) {

                            result = ResultResponses.failed(CONSTANTS.HTTP_CODES.SUCCESS.NON_AUTHORITATIVE_INFORMATION,
                                'User Not Activated!!.');

                            return done(null, false, req.flash('result', result));
                        }

                        AfterLogin.UserAccessDetails(os_type, user._id);
                        AfterLogin.CreateDefaultLabels(user._id);

                        // log the device type which was used to login
                        AfterLogin.userDeviceUsed(os_type, user._id);

                        var data = {
                            'user': user,
                            'token': 'JWT ' + jwt.sign({member: user}, CONFIG.ENV.SESSION_.SECRET),
                        }

                        result = ResultResponses.success(CONSTANTS.HTTP_CODES.SUCCESS.OK,
                            'Successfully Authenticated!!', data);

                        return done(null, user, req.flash('result', result));
                    }
                });
            });

        }));

    // =========================================================================
    // LOCAL SIGNUP ============================================================
    // =========================================================================
    passport.use('local-signup', new LocalStrategy({
            // by default, local strategy uses username and password, we will override with email
            usernameField: 'email',
            passwordField: 'password',
            passReqToCallback: true // allows us to pass in the req from our route (lets us check if a user is logged in or not)
        },
        function (req, email, password, done) {
            if (email)
                email = email.toLowerCase(); // Use lower-case e-mails to avoid case-sensitive e-mail matching

            // asynchronous
            process.nextTick(function () {
                User.findOne({$or: [{'email': email}, {'contact_number': req.body.contact_number}]},
                    function (err, user) {

                        var result = {};

                        result = ResultResponses.failed(CONSTANTS.HTTP_CODES.SERVER_ERROR.INTERNAL_SERVER_ERROR,
                            'Some Error Occurred.');

                        // if there are any errors, return the error
                        if (err) {
                            console.log('Error in fetching User: passport->local-signup');
                            return done(err, req.flash('result', result));
                        }

                        // check to see if theres already a user with that email
                        if (user) {

                            result = ResultResponses.failed(CONSTANTS.HTTP_CODES.CLIENT_ERROR.CONFLICT,
                                'Email Or Contact Number is already Registered.');

                            return done(null, false, req.flash('result', result));
                        } else {

                            // create the user
                            var newUser = new User();
                            newUser.email = email;
                            newUser.contact_number = req.body.contact_number;
                            newUser.country_code = req.body.country_code;
                            newUser.password = newUser.generateHash(password);

                            if (CheckUserType.checkIfTestEmail(email)) {

                                newUser.activated = true;
                                newUser.activated_at = new Date();
                                newUser.activation_code = null;
                            } else {

                                newUser.activated = false;
                                newUser.activation_code = newUser.generateActivationCode(new Date());
                            }

                            newUser.save(function (err) {
                                if (err) {
                                    console.log('Error in saving new User');
                                    return done(err, req.flash('result', result));
                                }
                            });

                            var userDetails = new UserDetails();
                            userDetails.first_name = req.body.first_name;
                            userDetails.last_name = req.body.last_name;
                            userDetails._user_access_id = newUser._id;

                            userDetails.save(function (err) {
                                if (err) {
                                    console.log('Error in saving new User Details');
                                    return done(err, req.flash('result', result));
                                }
                            });

                            // TODO - send email to the registered user for activation

                            result = ResultResponses.success(CONSTANTS.HTTP_CODES.SUCCESS.OK,
                                'Your Registration is successful.');

                            return done(null, newUser, req.flash('result', result));
                        }
                    });

            });
        })
    );

    // =========================================================================
    // FACEBOOK ================================================================
    // =========================================================================
    passport.use(new FacebookStrategy({

            clientID: configAuth.facebookAuth.clientID,
            clientSecret: configAuth.facebookAuth.clientSecret,
            callbackURL: configAuth.facebookAuth.callbackURL,
            profileFields: ['id', 'name', 'email'],
            passReqToCallback: true // allows us to pass in the req from our route (lets us check if a user is logged in or not)

        },
        function (req, token, refreshToken, profile, done) {

            // asynchronous
            process.nextTick(function () {

                // check if the user is already logged in
                if (!req.user) {

                    User.findOne({'facebook.id': profile.id}, function (err, user) {
                        if (err)
                            return done(err);

                        if (user) {

                            // if there is a user id already but no token (user was linked at one point and then removed)
                            if (!user.facebook.token) {
                                user.facebook.token = token;
                                user.facebook.name = profile.name.givenName + ' ' + profile.name.familyName;
                                user.facebook.email = (profile.emails[0].value || '').toLowerCase();

                                user.save(function (err) {
                                    if (err)
                                        return done(err);

                                    return done(null, user);
                                });
                            }

                            return done(null, user); // user found, return that user
                        } else {
                            // if there is no user, create them
                            var newUser = new User();

                            newUser.facebook.id = profile.id;
                            newUser.facebook.token = token;
                            newUser.facebook.name = profile.name.givenName + ' ' + profile.name.familyName;
                            newUser.facebook.email = (profile.emails[0].value || '').toLowerCase();

                            newUser.save(function (err) {
                                if (err)
                                    return done(err);

                                return done(null, newUser);
                            });
                        }
                    });

                } else {
                    // user already exists and is logged in, we have to link accounts
                    var user = req.user; // pull the user out of the session

                    user.facebook.id = profile.id;
                    user.facebook.token = token;
                    user.facebook.name = profile.name.givenName + ' ' + profile.name.familyName;
                    user.facebook.email = (profile.emails[0].value || '').toLowerCase();

                    user.save(function (err) {
                        if (err)
                            return done(err);

                        return done(null, user);
                    });

                }
            });

        }));

    // =========================================================================
    // TWITTER =================================================================
    // =========================================================================
    passport.use(new TwitterStrategy({

            consumerKey: configAuth.twitterAuth.consumerKey,
            consumerSecret: configAuth.twitterAuth.consumerSecret,
            callbackURL: configAuth.twitterAuth.callbackURL,
            passReqToCallback: true // allows us to pass in the req from our route (lets us check if a user is logged in or not)

        },
        function (req, token, tokenSecret, profile, done) {

            // asynchronous
            process.nextTick(function () {

                // check if the user is already logged in
                if (!req.user) {

                    User.findOne({'twitter.id': profile.id}, function (err, user) {
                        if (err)
                            return done(err);

                        if (user) {
                            // if there is a user id already but no token (user was linked at one point and then removed)
                            if (!user.twitter.token) {
                                user.twitter.token = token;
                                user.twitter.username = profile.username;
                                user.twitter.displayName = profile.displayName;

                                user.save(function (err) {
                                    if (err)
                                        return done(err);

                                    return done(null, user);
                                });
                            }

                            return done(null, user); // user found, return that user
                        } else {
                            // if there is no user, create them
                            var newUser = new User();

                            newUser.twitter.id = profile.id;
                            newUser.twitter.token = token;
                            newUser.twitter.username = profile.username;
                            newUser.twitter.displayName = profile.displayName;

                            newUser.save(function (err) {
                                if (err)
                                    return done(err);

                                return done(null, newUser);
                            });
                        }
                    });

                } else {
                    // user already exists and is logged in, we have to link accounts
                    var user = req.user; // pull the user out of the session

                    user.twitter.id = profile.id;
                    user.twitter.token = token;
                    user.twitter.username = profile.username;
                    user.twitter.displayName = profile.displayName;

                    user.save(function (err) {
                        if (err)
                            return done(err);

                        return done(null, user);
                    });
                }

            });

        }));

    // =========================================================================
    // GOOGLE ==================================================================
    // =========================================================================
    passport.use(new GoogleStrategy({

            clientID: configAuth.googleAuth.clientID,
            clientSecret: configAuth.googleAuth.clientSecret,
            callbackURL: configAuth.googleAuth.callbackURL,
            passReqToCallback: true // allows us to pass in the req from our route (lets us check if a user is logged in or not)

        },
        function (req, token, refreshToken, profile, done) {

            // asynchronous
            process.nextTick(function () {

                // check if the user is already logged in
                if (!req.user) {

                    User.findOne({'google.id': profile.id}, function (err, user) {
                        if (err)
                            return done(err);

                        if (user) {

                            // if there is a user id already but no token (user was linked at one point and then removed)
                            if (!user.google.token) {
                                user.google.token = token;
                                user.google.name = profile.displayName;
                                user.google.email = (profile.emails[0].value || '').toLowerCase(); // pull the first email

                                user.save(function (err) {
                                    if (err)
                                        return done(err);

                                    return done(null, user);
                                });
                            }

                            return done(null, user);
                        } else {
                            var newUser = new User();

                            newUser.google.id = profile.id;
                            newUser.google.token = token;
                            newUser.google.name = profile.displayName;
                            newUser.google.email = (profile.emails[0].value || '').toLowerCase(); // pull the first email

                            newUser.save(function (err) {
                                if (err)
                                    return done(err);

                                return done(null, newUser);
                            });
                        }
                    });

                } else {
                    // user already exists and is logged in, we have to link accounts
                    var user = req.user; // pull the user out of the session

                    user.google.id = profile.id;
                    user.google.token = token;
                    user.google.name = profile.displayName;
                    user.google.email = (profile.emails[0].value || '').toLowerCase(); // pull the first email

                    user.save(function (err) {
                        if (err)
                            return done(err);

                        return done(null, user);
                    });

                }

            });

        }));
};
