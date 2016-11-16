/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/


var doubleSlashWinRegExp = /\\+/g;
var doubleSlashNixRegExp = /\/+/g;
var currentDirectoryWinMiddleRegExp = /\\(\.\\)+/;
var currentDirectoryWinEndRegExp = /\\\.$/;
var parentDirectoryWinMiddleRegExp = /\\+[^\\]+\\+\.\.\\/;
var parentDirectoryWinEndRegExp1 = /([A-Z]:\\)\\*[^\\]+\\+\.\.$/i;
var parentDirectoryWinEndRegExp2 = /\\+[^\\]+\\+\.\.$/;
var currentDirectoryNixMiddleRegExp = /\/+(\.\/)+/;
var currentDirectoryNixEndRegExp1 = /^\/+\.$/;
var currentDirectoryNixEndRegExp2 = /\/+\.$/;
var parentDirectoryNixMiddleRegExp = /(^|\/[^\/]+)\/+\.\.\/+/;
var parentDirectoryNixEndRegExp1 = /^\/[^\/]+\/+\.\.$/;
var parentDirectoryNixEndRegExp2 = /\/+[^\/]+\/+\.\.$/;
var parentDirectoryNixEndRegExp3 = /^\/+\.\.$/;

// RegExp magic :)

function normalize(path) {
	while(currentDirectoryWinMiddleRegExp.test(path))
		path = path.replace(currentDirectoryWinMiddleRegExp, "\\");
	path = path.replace(currentDirectoryWinEndRegExp, "");
	while(parentDirectoryWinMiddleRegExp.test(path))
		path = path.replace(parentDirectoryWinMiddleRegExp, "\\");
	path = path.replace(parentDirectoryWinEndRegExp1, "$1");
	path = path.replace(parentDirectoryWinEndRegExp2, "");

	while(currentDirectoryNixMiddleRegExp.test(path))
		path = path.replace(currentDirectoryNixMiddleRegExp, "/");
	path = path.replace(currentDirectoryNixEndRegExp1, "/");
	path = path.replace(currentDirectoryNixEndRegExp2, "");
	while(parentDirectoryNixMiddleRegExp.test(path))
		path = path.replace(parentDirectoryNixMiddleRegExp, "/");
	path = path.replace(parentDirectoryNixEndRegExp1, "/");
	path = path.replace(parentDirectoryNixEndRegExp2, "");
	path = path.replace(parentDirectoryNixEndRegExp3, "/");

	return path.replace(doubleSlashWinRegExp, "\\").replace(doubleSlashNixRegExp, "/");
};

var absoluteWinRegExp = /^[A-Z]:([\\\/]|$)/i;
var absoluteNixRegExp = /^\//i;

function join(path, request) {
	if(!request) return normalize(path);
	if(absoluteWinRegExp.test(request)) return normalize(request.replace(/\//g, "\\"));
	if(absoluteNixRegExp.test(request)) return normalize(request);
	if(path == "/") return normalize(path + request);
	if(absoluteWinRegExp.test(path)) return normalize(path.replace(/\//g, "\\") + "\\" + request.replace(/\//g, "\\"));
	if(absoluteNixRegExp.test(path)) return normalize(path + "/" + request);
	return normalize(path + "/" + request);
};


function MemoryFileSystem(data) {
	this.data = data || {};
}

module.exports = new MemoryFileSystem();

function isDir(item) {
	if(typeof item !== "object") return false;
	return item[""] === true;
}

function isFile(item) {
	if(typeof item !== "object") return false;
	return !item[""];
}

function pathToArray(path) {
	path = normalize(path);
	var nix = /^\//.test(path);
	if(!nix) {
		if(!/^[A-Za-z]:/.test(path)) {
			throw new Error(-1, path);
		}
		path = path.replace(/[\\\/]+/g, "\\"); // multi slashs
		path = path.split(/[\\\/]/);
		path[0] = path[0].toUpperCase();
	} else {
		path = path.replace(/\/+/g, "/"); // multi slashs
		path = path.substr(1).split("/");
	}
	if(!path[path.length-1]) path.pop();
	return path;
}

function trueFn() { return true; }
function falseFn() { return false; }

MemoryFileSystem.prototype.meta = function(_path) {
	var path = pathToArray(_path);
	var current = this.data;
	for(var i = 0; i < path.length - 1; i++) {
		if(!isDir(current[path[i]]))
			return;
		current = current[path[i]];
	}
	return current[path[i]];
}

MemoryFileSystem.prototype.existsSync = function(_path) {
	return !!this.meta(_path);
}

MemoryFileSystem.prototype.statSync = function(_path) {
	var current = this.meta(_path);
	if(_path === "/" || isDir(current)) {
		return {
			isFile: falseFn,
			isDirectory: trueFn,
			isBlockDevice: falseFn,
			isCharacterDevice: falseFn,
			isSymbolicLink: falseFn,
			isFIFO: falseFn,
			isSocket: falseFn
		};
	} else if(isFile(current)) {
		return {
			isFile: trueFn,
			isDirectory: falseFn,
			isBlockDevice: falseFn,
			isCharacterDevice: falseFn,
			isSymbolicLink: falseFn,
			isFIFO: falseFn,
			isSocket: falseFn
		};
	} else {
		throw new Error(-2, _path);
	}
};

MemoryFileSystem.prototype.readFileSync = function(_path, encoding) {
	var path = pathToArray(_path);
	var current = this.data;
	for(var i = 0; i < path.length - 1; i++) {
		if(!isDir(current[path[i]]))
			throw new Error(-2, _path);
		current = current[path[i]];
	}
	if(!isFile(current[path[i]])) {
		if(isDir(current[path[i]]))
			throw new Error(-3, _path);
		else
			throw new Error(-2, _path);
	}
	current = current[path[i]];
	return encoding ? current.toString(encoding) : current;
};

MemoryFileSystem.prototype.readdirSync = function(_path) {
	if(_path === "/") return Object.keys(this.data).filter(Boolean);
	var path = pathToArray(_path);
	var current = this.data;
	for(var i = 0; i < path.length - 1; i++) {
		if(!isDir(current[path[i]]))
			throw new Error(-2, _path);
		current = current[path[i]];
	}
	if(!isDir(current[path[i]])) {
		if(isFile(current[path[i]]))
			throw new Error(-4, _path);
		else
			throw new Error(-2, _path);
	}
	return Object.keys(current[path[i]]).filter(Boolean);
};

MemoryFileSystem.prototype.mkdirpSync = function(_path) {
	var path = pathToArray(_path);
	if(path.length === 0) return;
	var current = this.data;
	for(var i = 0; i < path.length; i++) {
		if(isFile(current[path[i]]))
			throw new Error(-4, _path);
		else if(!isDir(current[path[i]]))
			current[path[i]] = {"":true};
		current = current[path[i]];
	}
	return;
};

MemoryFileSystem.prototype.mkdirSync = function(_path) {
	var path = pathToArray(_path);
	if(path.length === 0) return;
	var current = this.data;
	for(var i = 0; i < path.length - 1; i++) {
		if(!isDir(current[path[i]]))
			throw new Error(-2, _path);
		current = current[path[i]];
	}
	if(isDir(current[path[i]]))
		throw new Error(-5, _path);
	else if(isFile(current[path[i]]))
		throw new Error(-4, _path);
	current[path[i]] = {"":true};
	return;
};

MemoryFileSystem.prototype._remove = function(_path, name, testFn) {
	var path = pathToArray(_path);
	if(path.length === 0) {
		throw new Error(-6, _path);
	}
	var current = this.data;
	for(var i = 0; i < path.length - 1; i++) {
		if(!isDir(current[path[i]]))
			throw new Error(-2, _path);
		current = current[path[i]];
	}
	if(!testFn(current[path[i]]))
		throw new Error(-2, _path);
	delete current[path[i]];
	return;
};

MemoryFileSystem.prototype.rmdirSync = function(_path) {
	return this._remove(_path, "Directory", isDir);
};

MemoryFileSystem.prototype.unlinkSync = function(_path) {
	return this._remove(_path, "File", isFile);
};

MemoryFileSystem.prototype.readlinkSync = function(_path) {
	throw new Error(-7, _path);
};

MemoryFileSystem.prototype.writeFileSync = function(_path, content, encoding) {
	if(!content && !encoding) console.log(_path,"No content");
	var path = pathToArray(_path);
	if(path.length === 0) {
		throw new Error(-3, _path);
	}
	var current = this.data;
	for(var i = 0; i < path.length - 1; i++) {
		if(!isDir(current[path[i]]))
			throw new Error(-2, _path);
		current = current[path[i]];
	}
	if(isDir(current[path[i]]))
		throw new Error(-3, _path);
	current[path[i]] = encoding || typeof content === "string" ? new Buffer(content, encoding) : content;
	return;
};

MemoryFileSystem.prototype.join = join
MemoryFileSystem.prototype.pathToArray = pathToArray;
MemoryFileSystem.prototype.normalize = normalize;

// async functions

["stat", "readdir", "mkdirp", "rmdir", "unlink", "readlink"].forEach(function(fn) {
	MemoryFileSystem.prototype[fn] = function(path, callback) {
		try {
			var result = this[fn + "Sync"](path);
		} catch(e) {
			setImmediate(function() {
				callback(e);
			});

			return;
		}
		setImmediate(function() {
			callback(null, result);
		});
	};
});

MemoryFileSystem.prototype["lstatSync"] = MemoryFileSystem.prototype["statSync"];

["mkdir", "readFile"].forEach(function(fn) {
	MemoryFileSystem.prototype[fn] = function(path, optArg, callback) {
		if(!callback) {
			callback = optArg;
			optArg = undefined;
		}
		try {
			var result = this[fn + "Sync"](path, optArg);
		} catch(e) {
			setImmediate(function() {
				callback(e);
			});

			return;
		}
		setImmediate(function() {
			callback(null, result);
		});
	};
});

MemoryFileSystem.prototype.exists = function(path, callback) {
	return callback(this.existsSync(path));
}

MemoryFileSystem.prototype.writeFile = function (path, content, encoding, callback) {
	if(!callback) {
		callback = encoding;
		encoding = undefined;
	}
	try {
		this.writeFileSync(path, content, encoding);
	} catch(e) {
		return callback(e);
	}
	return callback();
};

