var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var authJwtController = require('./auth_jwt');
var User = require('./Users');
var Review = require('./Reviews');
var Movie = require('./Movies');
var jwt = require('jsonwebtoken');
var mongoose = require('mongoose');
const crypto = require("crypto");
var rp = require('request-promise');
var cors = require('cors');

var app = express();
module.exports = app; // for testing
app.use(cors())
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());

var router = express.Router();

//Google Analytics section
const GA_TRACKING_ID = process.env.GA_KEY;

function trackDimension(category, action, label, value, dimension, metric) {

    var options = { method: 'GET',
        url: 'https://www.google-analytics.com/collect',
        qs:
            {   // API Version.
                v: '1',
                // Tracking ID / Property ID.
                tid: GA_TRACKING_ID,
                // Random Client Identifier. Ideally, this should be a UUID that
                // is associated with particular user, device, or browser instance.
                cid: crypto.randomBytes(16).toString("hex"),
                // Event hit type.
                t: 'event',
                // Event category.
                ec: category,
                // Event action.
                ea: action,
                // Event label.
                el: label,
                // Event value.
                ev: value,
                // Custom Dimension
                cd1: dimension,
                // Custom Metric
                cm1: metric
            },
        headers:
            {  'Cache-Control': 'no-cache' } };

    return rp(options);
}

router.route('/postjwt')
    .post(authJwtController.isAuthenticated, function (req, res) {
            console.log(req.body);
            res = res.status(200);
            if (req.get('Content-Type')) {
                console.log("Content-Type: " + req.get('Content-Type'));
                res = res.type(req.get('Content-Type'));
            }
            res.send(req.body);
        }
    );

router.route('/users/:userId')
    .get(authJwtController.isAuthenticated, function (req, res) {
        var id = req.params.userId;
        User.findById(id, function(err, user) {
            if (err) res.send(err);

            var userJson = JSON.stringify(user);
            // return that user
            res.json(user);
        });
    });

router.route('/users')
    .get(authJwtController.isAuthenticated, function (req, res) {
        User.find(function (err, users) {
            if (err) res.send(err);
            // return the users
            res.json(users);
        });
    });

router.post('/signup', function(req, res) {
    if (!req.body.username || !req.body.password) {
        res.json({success: false, message: 'Please pass username and password.'});
    }
    else {
        var user = new User();
        user.name = req.body.name;
        user.username = req.body.username;
        user.password = req.body.password;
        // save the user
        user.save(function(err) {
            if (err) {
                // duplicate entry
                if (err.code == 11000)
                    return res.json({ success: false, message: 'A user with that username already exists. '});
                else
                    return res.send(err);
            }

            res.json({ success: true, message: 'User created!' });
        });
    }
});

router.post('/signin', function(req, res) {
    if (!req.body.username || !req.body.password) {
        res.json({success: false, message: 'Please pass username and password.'});
    }else {
        var userNew = new User();
        userNew.name = req.body.name;
        userNew.username = req.body.username;
        userNew.password = req.body.password;

        User.findOne({username: userNew.username}).select('name username password').exec(function (err, user) {
            if (err) res.send(err);

            user.comparePassword(userNew.password, function (isMatch) {
                if (isMatch) {
                    var userToken = {id: user._id, username: user.username};
                    var token = jwt.sign(userToken, process.env.SECRET_KEY);
                    res.json({success: true, token: 'JWT ' + token});
                } else {
                    res.status(401).send({success: false, message: 'Authentication failed.'});
                }
            });


        });
    }
});


router.route('/movies/:movieId')
    .get(authJwtController.isAuthenticated, function (req, res) {
        if (!req.body) {
            res.status(403).json({ success: false, message: "Empty query." });
        }else{
            if (req.query.reviews === "true") {
                var id = req.params.movieId;
                Movie.aggregate()
                    .match({_id: mongoose.Types.ObjectId(id)})
                    .lookup({from: 'reviews', localField: '_id', foreignField: 'movie_id', as: 'reviews'})
                    .exec(function (err, movie) {
                        if (err) return res.send(err);
                        if (movie && movie.length > 0) {
                            return res.status(200).json({ success: true, result: movie });
                        }else{
                            return res.status(400).json({ success: false, message: "Movie not found." });
                        }
                        trackDimension(movie.genre, '/movies/:movieId?reviews=true', 'GET Movie', '1', movie.title, "1")
                            .then(function (response) {
                                console.log(response.body);
                            })
                    });
            }else{
                var id = req.params.movieId;
                Movie.findById(id).select("title year genre actors").exec(function(err, movie) {
                    if (err) res.send(err);
                    if (movie) {
                        return res.status(200).json({ success: true, result: movie });
                    }else{
                        return res.status(400).json({ success: false, message: "Movie not found." });
                    }
                    trackDimension(movie.genre, '/movies/:movieId', 'GET Movie', '1', movie.title, "1")
                        .then(function (response) {
                            console.log(response.body);
                        })
                });
            }
        }
    })


router.route('/movies')
    .get(authJwtController.isAuthenticated, function (req, res) {
        if (req.query.reviews === "true") {
            Movie.aggregate()
                .match(req.body)
                .lookup({from: 'reviews', localField: '_id', foreignField: 'movie_id', as: 'reviews'})
                .exec(function (err, movie) {
                    if (err) return res.send(err);
                    if (movie && movie.length > 0) {
                        return res.status(200).json({ success: true, result: movie });
                    }else{
                        return res.status(400).json({ success: false, message: "Movie not found." });
                    }
                    trackDimension("ALL", '/movies/?reviews=true', 'GET Movies', '1', "ALL MOVIES", "1")
                        .then(function (response) {
                            console.log(response.body);
                        })
                });
        }else{
            Movie.find(function (err, movies) {
                if (err) res.send(err);
                // return the users
                res.json(movies).status(200).end();
            });
            trackDimension("ALL", '/movies', 'GET Movies', '1', "ALL MOVIES", '1')
                .then(function (response) {
                    console.log(response.body);
                })
        }
    })
    .post(authJwtController.isAuthenticated, function(req, res) {
        if (!req.body.title || req.body.title === "" || !req.body.yearReleased || req.body.yearReleased === "" || !req.body.genre || req.body.genre === "" || !req.body.actors || req.body.actors === "") {
            res.json({success: false, message: 'Please pass title, yearReleased, genre, and actors.'}).status(400);
        }
        else {
            var movie = new Movie();
            movie.title = req.body.title;
            movie.yearReleased = req.body.yearReleased;
            movie.genre = req.body.genre;
            movie.actors = req.body.actors;
            // save the user
            if (Movie.findOne({title: movie.title}) != null) {
                movie.save(function (err) {
                    if (err) {
                        if (err.code == 11000)
                            res.json({success: false, message: 'That movie already exists. '});
                        else
                            return res.send(err);
                    }else res.json({success: true, message: 'Movie Successfully UPLOADED'});
                });
            }
        }
    })
    .put(authJwtController.isAuthenticated, function (req, res) {
        if(!req.body.title && (req.body.yearReleased || req.body.genre || req.body.actors || req.body.updateTitle)) {
            return res.json({success: false, message: "Please pass title and update field."});
        }else{
            Movie.findOne({title: req.body.title}, function (err, result) {
                if (err) {
                    return res.send(err);
                }
                else{
                    if(result == null){
                        return res.json({success: false, message: "Please pass update field."});
                    }
                    else{
                        if(req.body.updateTitle) result.title = req.body.updateTitle;
                        if(req.body.actors) result.actors = req.body.actors;
                        if(req.body.genre) result.genre = req.body.genre;
                        if(req.body.yearReleased) result.yearReleased = req.body.yearReleased;

                        Movie.update({title: req.body.title}, result, function (err, raw) {
                            if(err){
                                return res.send(err);
                            }
                            return res.json({success: true, message: "Movie Successfully UPDATED"});
                        });
                    }
                }
            })
        }
    })
    .delete(function(req, res) {
            if (!req.body.username || !req.body.password) {
                res.json({success: false, message: 'Please pass username and password.'});
            } else {
                var userNew = new User();
                userNew.name = req.body.name;
                userNew.username = req.body.username;
                userNew.password = req.body.password;

                User.findOne({username: userNew.username}).select('name username password').exec(function (err, user) {
                    if (err) res.send(err);

                    user.comparePassword(userNew.password, function (isMatch) {
                        if (isMatch) {
                            var userToken = {id: user._id, username: user.username};
                            var token = jwt.sign(userToken, process.env.SECRET_KEY);
                            if(!req.body.title){
                                res.json({success: false, message: 'Please pass the title of movie to delete.'});
                            }else{
                                Movie.deleteOne({title: req.body.title}, function (err, raw) {
                                    if(err){
                                        res.send(err);
                                    }
                                    res.send({success: true, message: "Movie Successfully DELETED.", token: 'JWT ' + token,});
                                });
                            }

                        } else {
                            res.status(401).send({success: false, message: 'Authentication failed.'});
                        }
                    });


                });
            }
        }
    )


//Reviews

router.route('/reviews')
    .post(authJwtController.isAuthenticated, function(req, res) {
        if (!req.body || !req.body.movieId || !req.body.quote || !req.body.rating)
            return res.json({success: false, message: 'Please pass MovieId, quote, and rating'}).status(400);
        Movie.findById(req.body.movieId, function(err, movie) {
            if (err) return res.status(400).json(err);
            if (!movie || movie.length <= 0)
                return res.status(400).json({ success: false, message: "Movie not found" });
            var review = new Review();
            review.quote = req.body.quote;
            review.rating = req.body.rating;
            review.movie_id = movie._id;
            console.log(req.headers.authorization.substring(4));
            jwt.verify(req.headers.authorization.substring(4), process.env.SECRET_KEY, function(err, dec) {
                if (err) return res.status(403).json(err);
                review.user_id = dec.id;
                review.username = dec.username;
                review.save(function(err) {
                    if (err) {
                        if (err.code === 11000) {
                            return res.status(403).json({
                                success: false, message: 'You have already posted a review.'
                            });
                        }
                        else {
                            return res.status(403).send(err);
                        }
                    }
                    res.status(200).send({ success: true, message: "Added review." });
                    trackDimension(movie.genre, '/reviews', 'POST Reviews', '1', movie.title, '1')
                        .then(function (response) {
                            console.log(response.body);
                        })
                });
            });
        });
    })

// router.all('*', function(req, res) {
//     res.status(405).send({success: false, msg: 'Method Not Allowed'});
// });

app.use('/', router);
app.listen(process.env.PORT || 8080);