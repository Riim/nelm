"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var escape_html_1 = require("@riim/escape-html");
var self_closing_tags_1 = require("@riim/self-closing-tags");
var escape_string_1 = require("escape-string");
var nelm_parser_1 = require("nelm-parser");
var join = Array.prototype.join;
exports.ELEMENT_NAME_DELIMITER = '__';
var Template = /** @class */ (function () {
    function Template(nelm, opts) {
        var parent = (this.parent = (opts && opts.parent) || null);
        this.nelm = typeof nelm == 'string' ? new nelm_parser_1.Parser(nelm).parse() : nelm;
        var blockName = (opts && opts.blockName) || this.nelm.name;
        if (this.parent) {
            this._elementBlockNamesTemplate = [
                blockName ? blockName + exports.ELEMENT_NAME_DELIMITER : ''
            ].concat(this.parent._elementBlockNamesTemplate);
        }
        else if (blockName) {
            if (Array.isArray(blockName)) {
                this.setBlockName(blockName);
            }
            else {
                this._elementBlockNamesTemplate = [blockName + exports.ELEMENT_NAME_DELIMITER, ''];
            }
        }
        else {
            this._elementBlockNamesTemplate = ['', ''];
        }
        this._tagNameMap = { __proto__: parent && parent._tagNameMap };
        this._attributeListMap = { __proto__: parent && parent._attributeListMap };
        this._attributeCountMap = { __proto__: parent && parent._attributeCountMap };
    }
    Template.prototype.extend = function (nelm, opts) {
        return new Template(nelm, { __proto__: opts || null, parent: this });
    };
    Template.prototype.setBlockName = function (blockName) {
        if (Array.isArray(blockName)) {
            (this._elementBlockNamesTemplate = blockName.map(function (blockName) { return blockName + exports.ELEMENT_NAME_DELIMITER; })).push('');
        }
        else {
            this._elementBlockNamesTemplate[0] = blockName + exports.ELEMENT_NAME_DELIMITER;
        }
        return this;
    };
    Template.prototype.render = function () {
        var _this = this;
        return (this._renderer || this._compileRenderers())
            .call(this._elementRendererMap)
            .replace(/<<([^>]+)>>/g, function (match, names) {
            return _this._renderElementClasses(names.split(','));
        });
    };
    Template.prototype._compileRenderers = function () {
        var parent = this.parent;
        this._elements = [
            (this._currentElement = { name: null, superCall: false, source: null, innerSource: [] })
        ];
        var elMap = (this._elementMap = {});
        if (parent) {
            this._renderer = parent._renderer || parent._compileRenderers();
        }
        var elementRendererMap = (this._elementRendererMap = {
            __proto__: parent && parent._elementRendererMap
        });
        var content = this.nelm.content;
        var contentLength = content.length;
        if (contentLength) {
            for (var i = 0; i < contentLength; i++) {
                this._compileNode(content[i]);
            }
            Object.keys(elMap).forEach(function (name) {
                var el = elMap[name];
                this[name] = Function("return " + el.source.join(' + ') + ";");
                if (el.superCall) {
                    var inner_1 = Function('$super', "return " + (el.innerSource.join(' + ') || "''") + ";");
                    var parentElementRendererMap_1 = parent && parent._elementRendererMap;
                    this[name + '@content'] = function () {
                        return inner_1.call(this, parentElementRendererMap_1);
                    };
                }
                else {
                    this[name + '@content'] = Function("return " + (el.innerSource.join(' + ') || "''") + ";");
                }
            }, elementRendererMap);
            if (!parent) {
                return (this._renderer = Function("return " + (this._currentElement.innerSource.join(' + ') || "''") + ";"));
            }
        }
        else if (!parent) {
            return (this._renderer = function () { return ''; });
        }
        return this._renderer;
    };
    Template.prototype._compileNode = function (node, parentElName) {
        switch (node.nodeType) {
            case nelm_parser_1.NodeType.ELEMENT: {
                var parent_1 = this.parent;
                var els = this._elements;
                var el = node;
                var tagName = el.tagName;
                var isHelper = el.isHelper;
                var elNames = el.names;
                var elName = elNames && elNames[0];
                var elAttrs = el.attributes;
                var content = el.content;
                if (elNames) {
                    if (elName) {
                        if (tagName) {
                            this._tagNameMap[elName] = tagName;
                        }
                        else {
                            // Не надо добавлять в конец ` || 'div'`,
                            // тк. ниже tagName используется как имя хелпера.
                            tagName = parent_1 && parent_1._tagNameMap[elName];
                        }
                        var renderedAttrs = void 0;
                        if (elAttrs && (elAttrs.list.length || elAttrs.superCall)) {
                            var attrListMap = this._attributeListMap ||
                                (this._attributeListMap = {
                                    __proto__: (parent_1 && parent_1._attributeListMap) || null
                                });
                            var attrCountMap = this._attributeCountMap ||
                                (this._attributeCountMap = {
                                    __proto__: (parent_1 && parent_1._attributeCountMap) || null
                                });
                            var elAttrsSuperCall = elAttrs.superCall;
                            var attrList = void 0;
                            var attrCount = void 0;
                            if (elAttrsSuperCall) {
                                if (!parent_1) {
                                    throw new TypeError('Parent template is required when using super');
                                }
                                attrList = attrListMap[elName] = {
                                    __proto__: parent_1._attributeListMap[elAttrsSuperCall.elementName || elName] || null
                                };
                                attrCount = attrCountMap[elName] =
                                    parent_1._attributeCountMap[elAttrsSuperCall.elementName || elName] || 0;
                            }
                            else {
                                attrList = attrListMap[elName] = { __proto__: null };
                                attrCount = attrCountMap[elName] = 0;
                            }
                            for (var _i = 0, _a = elAttrs.list; _i < _a.length; _i++) {
                                var attr = _a[_i];
                                var name_1 = attr.name;
                                var value = attr.value;
                                var index = attrList[name_1];
                                if (index === undefined) {
                                    attrList[attrCount] = " " + name_1 + "=\"" + (value &&
                                        escape_html_1.escapeHTML(escape_string_1.escapeString(value))) + "\"";
                                    attrList[name_1] = attrCount;
                                    attrCountMap[elName] = ++attrCount;
                                }
                                else {
                                    attrList[index] = " " + name_1 + "=\"" + (value &&
                                        escape_html_1.escapeHTML(escape_string_1.escapeString(value))) + "\"";
                                }
                            }
                            if (!isHelper) {
                                attrList = {
                                    __proto__: attrList,
                                    length: attrCount
                                };
                                if (attrList['class'] !== undefined) {
                                    attrList[attrList['class']] =
                                        " class=\"<<" + elNames.join(',') + ">> " +
                                            attrList[attrList['class']].slice(' class="'.length);
                                    renderedAttrs = join.call(attrList, '');
                                }
                                else {
                                    renderedAttrs =
                                        " class=\"<<" + elNames.join(',') + ">>\"" +
                                            join.call(attrList, '');
                                }
                            }
                        }
                        else if (!isHelper) {
                            renderedAttrs = " class=\"<<" + elNames.join(',') + ">>\"";
                        }
                        var currentEl = {
                            name: elName,
                            superCall: false,
                            source: isHelper
                                ? ["this['" + elName + "@content']()"]
                                : [
                                    "'<" + (tagName || 'div') + renderedAttrs + ">'",
                                    content && content.length
                                        ? "this['" + elName + "@content']() + '</" + (tagName || 'div') + ">'"
                                        : !content && tagName && self_closing_tags_1.map.has(tagName)
                                            ? "''"
                                            : "'</" + (tagName || 'div') + ">'"
                                ],
                            innerSource: []
                        };
                        els.push((this._currentElement = currentEl));
                        this._elementMap[elName] = currentEl;
                    }
                    else if (!isHelper) {
                        if (elAttrs && elAttrs.list.length) {
                            var hasClassAttr = false;
                            var attrs = '';
                            for (var _b = 0, _c = elAttrs.list; _b < _c.length; _b++) {
                                var attr = _c[_b];
                                var value = attr.value;
                                if (attr.name == 'class') {
                                    hasClassAttr = true;
                                    attrs += " class=\"<<" + elNames.join(',').slice(1) + ">>" + (value
                                        ? ' ' + value
                                        : '') + "\"";
                                }
                                else {
                                    attrs += " " + attr.name + "=\"" + (value &&
                                        escape_html_1.escapeHTML(escape_string_1.escapeString(value))) + "\"";
                                }
                            }
                            this._currentElement.innerSource.push("'<" + (tagName || 'div') + (hasClassAttr
                                ? attrs
                                : " class=\"<<" + elNames.join(',').slice(1) + ">>\"" + attrs) + ">'");
                        }
                        else {
                            this._currentElement.innerSource.push("'<" + (tagName || 'div') + " class=\"<<" + elNames.join(',').slice(1) + ">>\">'");
                        }
                    }
                }
                else if (!isHelper) {
                    this._currentElement.innerSource.push("'<" + (tagName || 'div') + (elAttrs
                        ? elAttrs.list
                            .map(function (attr) {
                            return " " + attr.name + "=\"" + (attr.value &&
                                escape_html_1.escapeHTML(escape_string_1.escapeString(attr.value))) + "\"";
                        })
                            .join('')
                        : '') + ">'");
                }
                if (isHelper) {
                    if (!tagName) {
                        throw new TypeError('"tagName" is required');
                    }
                    var helper = Template.helpers[tagName];
                    if (!helper) {
                        throw new TypeError("Helper \"" + tagName + "\" is not defined");
                    }
                    var content_1 = helper(el);
                    if (content_1) {
                        for (var _d = 0, content_2 = content_1; _d < content_2.length; _d++) {
                            var contentNode = content_2[_d];
                            this._compileNode(contentNode, elName || parentElName);
                        }
                    }
                }
                else if (content) {
                    for (var _e = 0, content_3 = content; _e < content_3.length; _e++) {
                        var contentNode = content_3[_e];
                        this._compileNode(contentNode, elName || parentElName);
                    }
                }
                if (elName) {
                    els.pop();
                    this._currentElement = els[els.length - 1];
                    this._currentElement.innerSource.push("this['" + elName + "']()");
                }
                else if (!isHelper && (content || !tagName || !self_closing_tags_1.map.has(tagName))) {
                    this._currentElement.innerSource.push("'</" + (tagName || 'div') + ">'");
                }
                break;
            }
            case nelm_parser_1.NodeType.TEXT: {
                this._currentElement.innerSource.push("'" + escape_string_1.escapeString(node.value) + "'");
                break;
            }
            case nelm_parser_1.NodeType.SUPER_CALL: {
                this._currentElement.innerSource.push("$super['" + (node.elementName ||
                    parentElName) + "@content'].call(this)");
                this._currentElement.superCall = true;
                break;
            }
        }
    };
    Template.prototype._renderElementClasses = function (elNames) {
        var elClasses = '';
        for (var i = 0, l = elNames.length; i < l; i++) {
            elClasses += this._elementBlockNamesTemplate.join(elNames[i] + ' ');
        }
        return elClasses.slice(0, -1);
    };
    Template.helpers = {
        section: function (el) { return el.content; }
    };
    return Template;
}());
exports.Template = Template;
