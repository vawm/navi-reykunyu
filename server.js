/**
 * Reykunyu - Weptseng fte ralpiveng aylì'ut leNa'vi
 */

var fs = require('fs');

var express = require('express');
var session = require('express-session');
var sqliteSession = require('connect-sqlite3')(session);

var user = require('./user');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
passport.use(new LocalStrategy(
	function (username, password, done) {
		const foundUser = user.findUser(username, password);
		if (foundUser) {
			return done(null, foundUser);
		} else {
			return done(null, false);
		}
	}
));

var app = express();
var http = require('http').Server(app);

var config = JSON.parse(fs.readFileSync('config.json'));

var reykunyu = require('./reykunyu');

var tslamyu;
try {
	tslamyu = require('../navi-tslamyu/tslamyu');
} catch (e) {
	console.log('Warning: navi-tslamyu not found, continuing without parsing support');
}

const di = require('discord-interactions');
const discord = require('./discord');

const ejs = require('ejs');

app.use(require('body-parser').urlencoded({ extended: true }));
app.use(session({
	store: new sqliteSession(),
	secret: config["secret"],
	resave: true,
	saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser(function (user, cb) {
	cb(null, user.id);
});

passport.deserializeUser(function (id, cb) {
	if (user.users.hasOwnProperty(id)) {
		cb(null, user.users[id]);
	} else {
		cb('User not found');
	}
});

app.use(express.static('fraporu'));

app.set('views', __dirname + '/fraporu');
app.set('view engine', 'ejs');

app.get('/', function(req, res) {
	res.render('txin', { user: req.user, query: req.query['q'] });
});

app.get('/all', function(req, res) {
	res.sendFile(__dirname + '/fraporu/fralì\'u.html');
});

app.get('/login', function(req, res) {
	res.sendFile(__dirname + '/fraporu/login.html');
});

app.post('/login', passport.authenticate('local', {
	'successRedirect': '/',
	'failureRedirect': '/login'
}/*, function(err, user, info) {
	console.log(err, user, info);
}*/));

app.get('/logout', function(req, res) {
	req.logout();
	res.redirect('/');
});

app.get('/add', function(req, res) {
	if (!req.user) {
		res.status(403);
		res.send('403 Forbidden');
		return;
	}
	res.render('leykatem', {
		'user': req.user,
		'post_url': '/add',
		'word': {
			"na'vi": '',
			"translations": [{'en': ''}]
		}
	});
});

app.post('/add', function(req, res) {

	if (!req.user) {
		res.status(403);
		res.send('403 Forbidden');
		return;
	}

	let data;
	try {
		data = JSON.parse(req.body["data"]);
	} catch (e) {
		res.status(400);
		res.send('400 Bad Request');
		return;
	}
	let word = data["na'vi"];
	let type = data["type"];
	let existing = reykunyu.hasWord(word, type);
	if (existing) {
		res.status(400);
		res.json({'message': 'Word / type combination already exists'});
		return;
	}
	reykunyu.insertWord(data);
	let history = JSON.parse(fs.readFileSync(__dirname + "/history.json"));
	history.push({
		'user': req.user['username'],
		'date': new Date(),
		'word': word,
		'type': type,
		'data': data
	});
	fs.writeFileSync(__dirname + "/history.json", JSON.stringify(history));
	reykunyu.saveDictionary();
	res.send();
});

app.get('/edit', function(req, res) {
	if (!req.user) {
		res.status(403);
		res.send('403 Forbidden');
		return;
	}
	const word = req.query["word"];
	const type = req.query["type"];
	if (!word || !type) {
		res.status(400);
		res.send('400 Bad Request');
		return;
	}
	const wordData = reykunyu.getWord(word, type);
	res.render('leykatem', {
		'user': req.user,
		'post_url': '/edit',
		'word': wordData
	});
});

app.post('/edit', function(req, res) {

	if (!req.user) {
		res.status(403);
		res.send('403 Forbidden');
		return;
	}
	let word, type, data;
	try {
		word = req.body["word"];
		type = req.body["type"];
		data = JSON.parse(req.body["data"]);
	} catch (e) {
		res.status(400);
		res.send('400 Bad Request');
		return;
	}

	let old = reykunyu.getWord(word, type);
	reykunyu.removeWord(word, type);
	reykunyu.insertWord(data);
	let history = JSON.parse(fs.readFileSync(__dirname + "/history.json"));
	history.push({
		'user': req.user['username'],
		'date': new Date(),
		'word': word,
		'type': type,
		'old': old,
		'data': data
	});
	fs.writeFileSync(__dirname + "/history.json", JSON.stringify(history));
	reykunyu.saveDictionary();
	res.send();
});

app.get('/history', function(req, res) {
	if (!req.user) {
		res.status(403);
		res.send('403 Forbidden');
		return;
	}
	let historyData = JSON.parse(fs.readFileSync(__dirname + "/history.json"));
	historyData.slice(Math.max(1, historyData.length - 20));  // 20 last elements
	historyData.reverse();
	res.render('history', { user: req.user, history: historyData });
});

app.get('/untranslated', function(req, res) {
	if (!req.user) {
		res.status(403);
		res.send('403 Forbidden');
		return;
	}
	console.log('blap');
	let untranslated = reykunyu.getUntranslated('de');
	res.render('untranslated', { user: req.user, untranslated: untranslated });
});

app.get('/api/fwew', function(req, res) {
	res.json(reykunyu.getResponsesFor(req.query["tìpawm"]));
});

app.get('/api/mok', function(req, res) {
	res.json(reykunyu.getSuggestionsFor(req.query["tìpawm"], req.query["language"]));
});

app.get('/api/search', function(req, res) {
	res.json(reykunyu.getReverseResponsesFor(req.query["query"], req.query["language"]));
});

app.get('/api/suggest', function(req, res) {
	res.json(reykunyu.getReverseSuggestionsFor(req.query["query"], req.query["language"]));
});

app.get('/api/frau', function(req, res) {
	res.json(reykunyu.getAll());
});

app.get('/api/list/all', function(req, res) {
	res.json(reykunyu.getAll());
});

app.get('/api/list/verbs', function(req, res) {
	res.json(reykunyu.getVerbs());
});

app.get('/api/list/transitivity', function(req, res) {
	res.json(reykunyu.getTransitivityList());
});

app.get('/api/sound', function(req, res) {
	const file = __dirname + '/fam/' + req.query["word"] + "-" + req.query["type"] + '.mp3';
	if (fs.existsSync(file)) {
		res.sendFile(file);
	} else {
		res.sendStatus(404);
	}
});

app.get('/api/parse', function(req, res) {
	let parseOutput = tslamyu.doParse(reykunyu.getResponsesFor(req.query["tìpawm"]));
	let output = {};
	output['lexingErrors'] = parseOutput['lexingErrors'];
	if (parseOutput['results']) {
		output['results'] = [];
		for (let i = 0; i < parseOutput['results'].length; i++) {
			output['results'].push({
				'parseTree': parseOutput['results'][i],
				'translation': parseOutput['results'][i].translate(),
				'errors': parseOutput['results'][i].getErrors(),
				'penalty': parseOutput['results'][i].getPenalty()
			});
		}
	}
	res.json(output);
});

app.get('/api/random', function(req, res) {
	res.json(reykunyu.getRandomWords(req.query["holpxay"]));
});

app.use('/ayrel', express.static('ayrel'));

app.post('/api/discord/interactions', di.verifyKeyMiddleware('7cf7cb6385a26d7257e359bbf47d56b6824fda941dffa0bc629347c34c56d1d5'), function(req, res) {
	const message = req.body;

	if (message.type === di.InteractionType.COMMAND) {
		// message['data']['name'] should be 'run' (TODO check that)
		const query = message['data']['options'][0]['value'];
		console.log(query);
		res.json({
			"type": di.InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
			"data": {
				"content": discord.makeMessage(reykunyu.getResponsesFor(query), reykunyu.getSuggestionsFor(query))
			}
		});
	}
});

http.listen(config["port"], function() {
	console.log('listening on *:' + config["port"]);
});

