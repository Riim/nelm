"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var NodeType;
(function (NodeType) {
    NodeType[NodeType["BLOCK"] = 1] = "BLOCK";
    NodeType[NodeType["ELEMENT"] = 2] = "ELEMENT";
    NodeType[NodeType["TEXT"] = 3] = "TEXT";
    NodeType[NodeType["COMMENT"] = 4] = "COMMENT";
    NodeType[NodeType["SUPER_CALL"] = 5] = "SUPER_CALL";
})(NodeType = exports.NodeType || (exports.NodeType = {}));
var escapee = {
    __proto__: null,
    '/': '/',
    '\\': '\\',
    b: '\b',
    f: '\f',
    n: '\n',
    r: '\r',
    t: '\t'
};
var reBlockNameOrNothing = /[a-zA-Z][\-\w]*|/g;
var reTagNameOrNothing = /[a-zA-Z][\-\w]*(?::[a-zA-Z][\-\w]*)?|/g;
var reElementNameOrNothing = /[a-zA-Z][\-\w]*|/g;
var reAttributeNameOrNothing = /[_a-zA-Z][\-\w]*(?::[_a-zA-Z][\-\w]*)?|/g;
var reSuperCallOrNothing = /super(?:\.([a-zA-Z][\-\w]*))?!|/g;
function normalizeMultilineText(text) {
    return text.trim().replace(/\s*(?:\r\n?|\n)/g, '\n').replace(/\n\s+/g, '\n');
}
var Parser = (function () {
    function Parser(nelm) {
        this.nelm = nelm;
    }
    Parser.prototype.parse = function () {
        this.at = 0;
        this.chr = this.nelm.charAt(0);
        var content;
        while (this._skipWhitespaces() == '/') {
            (content || (content = [])).push(this._readComment());
        }
        var blockName = this.chr == '#' ? this._readBlockName() : null;
        return {
            nodeType: NodeType.BLOCK,
            name: blockName,
            content: content ? content.concat(this._readContent(false)) : this._readContent(false)
        };
    };
    Parser.prototype._readBlockName = function () {
        this._next('#');
        var blockName = this._readName(reBlockNameOrNothing);
        if (!blockName) {
            throw {
                name: 'SyntaxError',
                message: 'Invalid block declaration',
                at: this.at,
                nelm: this.nelm
            };
        }
        return blockName;
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
                case '': {
                    if (brackets) {
                        throw {
                            name: 'SyntaxError',
                            message: 'Missing "}" in compound statement',
                            at: this.at,
                            nelm: this.nelm
                        };
                    }
                    return content;
                }
                default: {
                    if (this.chr == '/') {
                        var next = this.nelm.charAt(this.at + 1);
                        if (next == '/' || next == '*') {
                            content.push(this._readComment());
                            break;
                        }
                    }
                    if (brackets) {
                        if (this.chr == '}') {
                            this._next();
                            return content;
                        }
                        reSuperCallOrNothing.lastIndex = this.at;
                        var superCallMatch = reSuperCallOrNothing.exec(this.nelm);
                        if (superCallMatch[0]) {
                            this.chr = this.nelm.charAt((this.at = reSuperCallOrNothing.lastIndex));
                            content.push({
                                nodeType: NodeType.SUPER_CALL,
                                elementName: superCallMatch[1] || null
                            });
                            break;
                        }
                    }
                    content.push(this._readElement());
                    break;
                }
            }
        }
    };
    Parser.prototype._readElement = function () {
        var at = this.at;
        var isHelper = this.chr == '@';
        if (isHelper) {
            this._next();
        }
        var tagName = this._readName(reTagNameOrNothing);
        var elNames = (tagName ? this._skipWhitespaces() : this.chr) == '/' ?
            (this._next(), this._skipWhitespaces(), this._readElementNames()) :
            null;
        if (!tagName && !elNames) {
            throw {
                name: 'SyntaxError',
                message: 'Expected element',
                at: at,
                nelm: this.nelm
            };
        }
        var attrs = this.chr == '(' ? this._readAttributes() : null;
        if (attrs) {
            this._skipWhitespaces();
        }
        var content = this.chr == '{' ? this._readContent(true) : null;
        return {
            nodeType: NodeType.ELEMENT,
            tagName: tagName,
            isHelper: isHelper,
            names: elNames,
            attributes: attrs,
            content: content
        };
    };
    Parser.prototype._readAttributes = function () {
        this._next('(');
        if (this._skipWhitespacesAndComments() == ')') {
            this._next();
            return {
                superCall: null,
                list: []
            };
        }
        var superCall;
        var list = [];
        for (;;) {
            if (!superCall && this.chr == 's' && (superCall = this._readSuperCall())) {
                this._skipWhitespacesAndComments();
            }
            else {
                var name_1 = this._readName(reAttributeNameOrNothing);
                if (!name_1) {
                    throw {
                        name: 'SyntaxError',
                        message: 'Invalid attribute name',
                        at: this.at,
                        nelm: this.nelm
                    };
                }
                if (this._skipWhitespacesAndComments() == '=') {
                    this._next();
                    var chr = this._skipWhitespaces();
                    if (chr == "'" || chr == '"' || chr == '`') {
                        var str = this._readString();
                        list.push({
                            name: name_1,
                            value: str.multiline ? normalizeMultilineText(str.value) : str.value
                        });
                    }
                    else {
                        var value = '';
                        for (;;) {
                            if (!chr) {
                                throw {
                                    name: 'SyntaxError',
                                    message: 'Invalid attribute',
                                    at: this.at,
                                    nelm: this.nelm
                                };
                            }
                            if (chr == '\r' || chr == '\n' || chr == ',' || chr == ')') {
                                list.push({ name: name_1, value: value.trim() });
                                break;
                            }
                            value += chr;
                            chr = this._next();
                        }
                    }
                    this._skipWhitespacesAndComments();
                }
                else {
                    list.push({ name: name_1, value: '' });
                }
            }
            if (this.chr == ')') {
                this._next();
                break;
            }
            else if (this.chr == ',') {
                this._next();
                this._skipWhitespacesAndComments();
            }
            else {
                throw {
                    name: 'SyntaxError',
                    message: 'Invalid attributes',
                    at: this.at,
                    nelm: this.nelm
                };
            }
        }
        return {
            superCall: superCall || null,
            list: list
        };
    };
    Parser.prototype._skipWhitespacesAndComments = function () {
        var chr = this.chr;
        for (;;) {
            if (chr && chr <= ' ') {
                chr = this._next();
            }
            else if (chr == '/') {
                this._readComment();
                chr = this.chr;
            }
            else {
                break;
            }
        }
        return chr;
    };
    Parser.prototype._readSuperCall = function () {
        reSuperCallOrNothing.lastIndex = this.at;
        var superCallMatch = reSuperCallOrNothing.exec(this.nelm);
        if (superCallMatch[0]) {
            this.chr = this.nelm.charAt((this.at = reSuperCallOrNothing.lastIndex));
            return {
                nodeType: NodeType.SUPER_CALL,
                elementName: superCallMatch[1] || null
            };
        }
        return null;
    };
    Parser.prototype._readTextNode = function () {
        var str = this._readString();
        return {
            nodeType: NodeType.TEXT,
            value: str.multiline ? normalizeMultilineText(str.value) : str.value
        };
    };
    Parser.prototype._readString = function () {
        var quoteChar = this.chr;
        if (quoteChar != "'" && quoteChar != '"' && quoteChar != '`') {
            throw {
                name: 'SyntaxError',
                message: "Expected \"'\" instead of \"" + this.chr + "\"",
                at: this.at,
                nelm: this.nelm
            };
        }
        var str = '';
        for (var chr = this._next(); chr;) {
            if (chr == quoteChar) {
                this._next();
                return {
                    value: str,
                    multiline: quoteChar == '`'
                };
            }
            if (chr == '\\') {
                chr = this._next();
                if (chr == 'x' || chr == 'u') {
                    var at = this.at;
                    var hexadecimal = chr == 'x';
                    var code = parseInt(this.nelm.slice(at + 1, at + (hexadecimal ? 3 : 5)), 16);
                    if (!isFinite(code)) {
                        throw {
                            name: 'SyntaxError',
                            message: "Malformed " + (hexadecimal ? 'hexadecimal' : 'unicode') + " escape sequence",
                            at: at - 1,
                            nelm: this.nelm
                        };
                    }
                    str += String.fromCharCode(code);
                    chr = this.chr = this.nelm.charAt((this.at = at + (hexadecimal ? 3 : 5)));
                }
                else if (chr in escapee) {
                    str += escapee[chr];
                    chr = this._next();
                }
                else {
                    break;
                }
            }
            else {
                if (quoteChar != '`' && (chr == '\r' || chr == '\n')) {
                    break;
                }
                str += chr;
                chr = this._next();
            }
        }
        throw {
            name: 'SyntaxError',
            message: 'Invalid string',
            at: this.at,
            nelm: this.nelm
        };
    };
    Parser.prototype._readComment = function () {
        var value = '';
        var multiline;
        switch (this._next('/')) {
            case '/': {
                for (var chr = void 0; (chr = this._next()) && chr != '\r' && chr != '\n';) {
                    value += chr;
                }
                multiline = false;
                break;
            }
            case '*': {
                var stop_1 = false;
                do {
                    switch (this._next()) {
                        case '*': {
                            if (this._next() == '/') {
                                this._next();
                                stop_1 = true;
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
                                nelm: this.nelm
                            };
                        }
                        default: {
                            value += this.chr;
                        }
                    }
                } while (!stop_1);
                multiline = true;
                break;
            }
            default: {
                throw {
                    name: 'SyntaxError',
                    message: "Expected \"/\" instead of \"" + this.chr + "\"",
                    at: this.at,
                    nelm: this.nelm
                };
            }
        }
        return {
            nodeType: NodeType.COMMENT,
            value: value,
            multiline: multiline
        };
    };
    Parser.prototype._readElementNames = function () {
        var names = this.chr == ',' ? (this._next(), this._skipWhitespaces(), [null]) : null;
        for (var name_2; (name_2 = this._readName(reElementNameOrNothing));) {
            (names || (names = [])).push(name_2);
            if (this._skipWhitespaces() != ',') {
                break;
            }
            this._next();
            this._skipWhitespaces();
        }
        return names;
    };
    Parser.prototype._readName = function (reNameOrNothing) {
        reNameOrNothing.lastIndex = this.at;
        var name = reNameOrNothing.exec(this.nelm)[0];
        if (name) {
            this.chr = this.nelm.charAt((this.at = reNameOrNothing.lastIndex));
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
                nelm: this.nelm
            };
        }
        return (this.chr = this.nelm.charAt(++this.at));
    };
    return Parser;
}());
exports.default = Parser;
