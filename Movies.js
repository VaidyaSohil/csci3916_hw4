var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var bcrypt = require('bcrypt-nodejs');
//TODO: Review https://mongoosejs.com/docs/validation.html

mongoose.Promise = global.Promise;

mongoose.connect(process.env.DB, { useNewUrlParser: true } );
mongoose.set('useCreateIndex', true);

// Movie schema
var MovieSchema = new Schema({
    title: { type: String, required: true, unique: true },
    yearReleased: {type: Date, required: true},
    genre: {
        type: String, required: true, enum: ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mystery", "Thriller", "Western"]
    },
    actors: {type: [String], required: true, validate: [(val)=> val.length==3, '{PATH} array must be of size 3']},
    image: {type: String, default: "https://encrypted-tbn0.gstatic.com/images?q=tbn%3AANd9GcR6y2jmbjIhDlZONr-LIXPEGoQvyt5oxfvrB8xcRAeRUY-t7-99&usqp=CAU"}
});


// return the model
module.exports = mongoose.model('Movie', MovieSchema);