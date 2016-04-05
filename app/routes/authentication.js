var userAccessController = require('./../controllers/userAccessController');
var AuthenticationTokenAPI = require('./../api/authenticationToken_api');
var userAccessValidator = require('./../controllers/parameterValidators/userAccessValidator');
var JwtStrategy = require('passport-jwt').Strategy;

module.exports = function (authentication, passport, app) {

    authentication.get('/member_info', AuthenticationTokenAPI.getMemberInfo);

    // process the signup form
    authentication.post('/signup', userAccessValidator.signupValidator, passport.authenticate('local-signup', {
        successRedirect: '/authentication/success',
        failureRedirect: '/authentication/failure',
        failureFlash: true
    }));

    // process the login form
    authentication.post('/login', userAccessValidator.loginValidator, passport.authenticate('local-login', {
        successRedirect: '/authentication/success', // redirect to the secure profile section
        failureRedirect: '/authentication/failure', // redirect back to the signup page if there is an error
        failureFlash: true // allow flash messages
    }));

    //registration success
    authentication.get('/success', function (req, res) {

        res.json(req.flash());
    });

    //registration failure
    authentication.get('/failure', function (req, res) {

        res.json(req.flash());
    });

    //get user status
    authentication.get('/user/status', userAccessController.userStatus);

    //GET: check if user exists
    authentication.get('/user/:email', userAccessValidator.checkIfUserExistsValidator,
        userAccessController.checkIfUserExists);

    //GET: check if user_id and reset_password_code is correct
    authentication.get('/reset/:user_id/:reset_code', userAccessValidator.checkResetCodeValidator,
        userAccessController.checkResetCode);

    //GET: change password
    authentication.post('/change/password', userAccessValidator.changePasswordValidator,
        userAccessController.changePassword);

    //User Activation
    authentication.get('/activate/:user_id/:activation_code', userAccessValidator.activateValidator,
        userAccessController.activate);

    //Logout
    authentication.get('/logout', userAccessController.logOut);
}