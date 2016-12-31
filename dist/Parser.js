"use strict";
var BemlNodeType;
(function (BemlNodeType) {
    BemlNodeType[BemlNodeType["BLOCK"] = 1] = "BLOCK";
    BemlNodeType[BemlNodeType["ELEMENT"] = 2] = "ELEMENT";
    BemlNodeType[BemlNodeType["TEXT"] = 3] = "TEXT";
    BemlNodeType[BemlNodeType["COMMENT"] = 4] = "COMMENT";
})(BemlNodeType = exports.BemlNodeType || (exports.BemlNodeType = {}));
var namePattern = '[a-zA-Z][\\-_0-9a-zA-Z]*';
var reNameOrNothing = RegExp(namePattern + '|', 'g');
var Parser = (function () {
    function Parser(beml) {
        this.beml = beml;
    }
    Parser.prototype.parse = function () {
        debugger;
        this.at = 0;
        this.chr = this.beml.charAt(0);
        var content;
        while (this._skipWhitespaces() == '/') {
            (content || (content = [])).push(this._readComment());
        }
        var decl = this._readBlockDeclaration();
        return {
            nodeType: BemlNodeType.BLOCK,
            at: 0,
            raw: this.beml,
            declaration: decl,
            name: decl.blockName,
            content: content ? content.concat(this._readContent(false)) : this._readContent(false)
        };
    };
    Parser.prototype._readBlockDeclaration = function () {
        var at = this.at;
        this._next('#');
        var blockName = this._readName();
        if (!blockName) {
            throw {
                name: 'SyntaxError',
                message: 'Invalid block declaration',
                at: at,
                beml: this.beml
            };
        }
        return {
            at: at,
            raw: '#' + blockName,
            blockName: blockName
        };
    };
    Parser.prototype._readContent = function (brackets) {
        if (brackets) {
            this._next('{');
        }
        var content = [];
        for (;;) {
            switch (this._skipWhitespaces()) {
                case "'":
                case '"':
                case '`': {
                    content.push(this._readTextNode());
                    break;
                }
                case '/': {
                    content.push(this._readComment());
                    break;
                }
                case '': {
                    if (brackets) {
                        throw {
                            name: 'SyntaxError',
                            message: 'Missing "}" in compound statement',
                            at: this.at,
                            beml: this.beml
                        };
                    }
                    return content;
                }
                default: {
                    if (brackets && this.chr == '}') {
                        this._next();
                        return content;
                    }
                    content.push(this._readElement());
                    break;
                }
            }
        }
    };
    Parser.prototype._readElement = function () {
        var at = this.at;
        var tagName = this._readName();
        if (!tagName) {
            throw {
                name: 'SyntaxError',
                message: 'Expected tag name',
                at: at,
                beml: this.beml
            };
        }
        var elName = this._skipWhitespaces() == '/' ? (this._next(), this._readName()) : null;
        if (elName) {
            this._skipWhitespaces();
        }
        var attrs = this.chr == '(' ? this._readAttributes() : null;
        if (attrs) {
            this._skipWhitespaces();
        }
        var content = this.chr == '{' ? this._readContent(true) : null;
        return {
            nodeType: BemlNodeType.ELEMENT,
            at: at,
            raw: this.beml.slice(at, this.at).trim(),
            name: elName,
            attributes: attrs,
            content: content
        };
    };
    Parser.prototype._readAttributes = function () {
        var at = this.at;
        this._next('(');
        if (this._skipWhitespaces() == ')') {
            this._next();
            return {
                at: at,
                raw: this.beml.slice(at, this.at),
                list: []
            };
        }
        var list = [];
        for (;;) {
            var name_1 = this._readName();
            if (!name_1) {
                throw {
                    name: 'SyntaxError',
                    message: 'Invalid attribute name',
                    at: this.at,
                    beml: this.beml
                };
            }
            this._skipWhitespaces();
            if (this.chr == '=') {
                this._next();
                this._skipWhitespaces();
                var chr = this.chr;
                if (chr == "'" || chr == '"' || chr == '`') {
                    list.push({ name: name_1, value: this._readString() });
                }
                else {
                    var value = '';
                    for (;;) {
                        var next = this._next();
                        if (!next) {
                            throw {
                                name: 'SyntaxError',
                                message: 'Invalid attribute',
                                at: this.at,
                                beml: this.beml
                            };
                        }
                        if (next == '\r' || next == '\n' || next == ',' || next == ')') {
                            list.push({ name: name_1, value: value.trim() });
                            break;
                        }
                        value += next;
                    }
                }
                this._skipWhitespaces();
            }
            else {
                list.push({ name: name_1, value: true });
            }
            if (this.chr == ')') {
                this._next();
                break;
            }
            else if (this.chr == ',') {
                this._next();
                this._skipWhitespaces();
            }
            else {
                throw {
                    name: 'SyntaxError',
                    message: 'Invalid attributes',
                    at: this.at,
                    beml: this.beml
                };
            }
        }
        return {
            at: at,
            raw: this.beml.slice(at, this.at),
            list: list
        };
    };
    Parser.prototype._readTextNode = function () {
        var at = this.at;
        var str = this._readString();
        return {
            nodeType: BemlNodeType.TEXT,
            at: at,
            raw: this.beml.slice(at, this.at),
            value: str
        };
    };
    Parser.prototype._readString = function () {
        var quoteChar = this.chr;
        if (quoteChar != "'" && quoteChar != '"' && quoteChar != '`') {
            throw {
                name: 'SyntaxError',
                message: "Expected \"'\" instead of \"" + this.chr + "\"",
                at: this.at,
                beml: this.beml
            };
        }
        var str = '';
        for (var next = void 0; (next = this._next());) {
            if (next == quoteChar) {
                this._next();
                return quoteChar + str + quoteChar;
            }
            if (next == '\\') {
                str += next + this._next();
            }
            else {
                if (quoteChar != '`' && (next == '\r' || next == '\n')) {
                    break;
                }
                str += next;
            }
        }
        throw {
            name: 'SyntaxError',
            message: 'Invalid string',
            at: this.at,
            beml: this.beml
        };
    };
    Parser.prototype._readComment = function () {
        var at = this.at;
        var value = '';
        var multiline;
        switch (this._next('/')) {
            case '/': {
                for (var next = void 0; (next = this._next()) && next != '\r' && next != '\n';) {
                    value += next;
                }
                multiline = false;
                break;
            }
            case '*': {
                var stop = false;
                do {
                    switch (this._next()) {
                        case '*': {
                            if (this._next() == '/') {
                                this._next();
                                stop = true;
                            }
                            else {
                                value += '*' + this.chr;
                            }
                            break;
                        }
                        case '': {
                            throw {
                                name: 'SyntaxError',
                                message: 'Missing "*/" in compound statement',
                                at: this.at,
                                beml: this.beml
                            };
                        }
                        default: {
                            value += this.chr;
                        }
                    }
                } while (!stop);
                multiline = true;
                break;
            }
            default: {
                throw {
                    name: 'SyntaxError',
                    message: "Expected \"/\" instead of \"" + this.chr + "\"",
                    at: this.at,
                    beml: this.beml
                };
            }
        }
        return {
            nodeType: BemlNodeType.COMMENT,
            at: at,
            raw: this.beml.slice(at, this.at),
            value: value,
            multiline: multiline
        };
    };
    Parser.prototype._readName = function () {
        reNameOrNothing.lastIndex = this.at;
        var name = reNameOrNothing.exec(this.beml)[0];
        if (name) {
            this.chr = this.beml.charAt((this.at += name.length));
            return name;
        }
        return null;
    };
    Parser.prototype._skipWhitespaces = function () {
        var chr = this.chr;
        while (chr && chr <= ' ') {
            chr = this._next();
        }
        return chr;
    };
    Parser.prototype._next = function (current) {
        if (current && current != this.chr) {
            throw {
                name: 'SyntaxError',
                message: "Expected \"" + current + "\" instead of \"" + this.chr + "\"",
                at: this.at,
                beml: this.beml
            };
        }
        return (this.chr = this.beml.charAt(++this.at));
    };
    return Parser;
}());
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Parser;
