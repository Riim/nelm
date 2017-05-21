export enum NodeType {
	BLOCK = 1,
	ELEMENT,
	TEXT,
	COMMENT,
	SUPER_CALL
}

export interface INode {
	nodeType: NodeType;
}

export type TContent = Array<INode>;

export interface IBlock extends INode {
	nodeType: NodeType.BLOCK;
	name: string | null;
	content: TContent;
}

export interface ISuperCall extends INode {
	nodeType: NodeType.SUPER_CALL;
	elementName: string | null;
}

export interface IElementAttribute {
	name: string;
	value: string;
}

export type TElementAttributeList = Array<IElementAttribute>;

export interface IElementAttributes {
	superCall: ISuperCall | null;
	list: TElementAttributeList;
}

export interface IElement extends INode {
	nodeType: NodeType.ELEMENT;
	tagName: string | null;
	isHelper: boolean;
	names: Array<string | null> | null;
	attributes: IElementAttributes | null;
	content: TContent | null;
}

export interface ITextNode extends INode {
	nodeType: NodeType.TEXT;
	value: string;
}

export interface IComment extends INode {
	nodeType: NodeType.COMMENT;
	value: string;
	multiline: boolean;
}

let escapee = {
	__proto__: null,

	'/': '/',
	'\\': '\\',
	b: '\b',
	f: '\f',
	n: '\n',
	r: '\r',
	t: '\t'
};

let reBlockNameOrNothing = /[a-zA-Z][\-\w]*|/g;
let reTagNameOrNothing = /[a-zA-Z][\-\w]*(?::[a-zA-Z][\-\w]*)?|/g;
let reElementNameOrNothing = /[a-zA-Z][\-\w]*|/g;
let reAttributeNameOrNothing = /[_a-zA-Z][\-\w]*(?::[_a-zA-Z][\-\w]*)?|/g;
let reSuperCallOrNothing = /super(?:\.([a-zA-Z][\-\w]*))?!|/g;

function normalizeMultilineText(text: string): string {
	return text.trim().replace(/\s*(?:\r\n?|\n)/g, '\n').replace(/\n\s+/g, '\n');
}

export default class Parser {
	nelm: string;
	at: number;
	chr: string;

	constructor(nelm: string) {
		this.nelm = nelm;
	}

	parse(): IBlock {
		this.at = 0;
		this.chr = this.nelm.charAt(0);

		let content: TContent | undefined;

		while (this._skipWhitespaces() == '/') {
			(content || (content = [])).push(this._readComment());
		}

		let blockName = this.chr == '#' ? this._readBlockName() : null;

		return {
			nodeType: NodeType.BLOCK,
			name: blockName,
			content: content ? content.concat(this._readContent(false)) : this._readContent(false)
		};
	}

	_readBlockName(): string {
		this._next('#');

		let blockName = this._readName(reBlockNameOrNothing);

		if (!blockName) {
			throw {
				name: 'SyntaxError',
				message: 'Invalid block declaration',
				at: this.at,
				nelm: this.nelm
			};
		}

		return blockName;
	}

	_readContent(brackets: boolean): TContent {
		if (brackets) {
			this._next('{');
		}

		let content = [] as TContent;

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
						let next = this.nelm.charAt(this.at + 1);

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
						let superCallMatch = (reSuperCallOrNothing.exec(this.nelm) as RegExpExecArray);

						if (superCallMatch[0]) {
							this.chr = this.nelm.charAt((this.at = reSuperCallOrNothing.lastIndex));

							content.push({
								nodeType: NodeType.SUPER_CALL,
								elementName: superCallMatch[1] || null
							} as ISuperCall);

							break;
						}
					}

					content.push(this._readElement());

					break;
				}
			}
		}
	}

	_readElement(): IElement {
		let at = this.at;
		let isHelper = this.chr == '@';

		if (isHelper) {
			this._next();
		}

		let tagName = this._readName(reTagNameOrNothing);

		let elNames = (tagName ? this._skipWhitespaces() : this.chr) == '/' ?
			(this._next(), this._skipWhitespaces(), this._readElementNames()) :
			null;

		if (!tagName && !elNames) {
			throw {
				name: 'SyntaxError',
				message: 'Expected element',
				at,
				nelm: this.nelm
			};
		}

		let attrs = this.chr == '(' ? this._readAttributes() : null;

		if (attrs) {
			this._skipWhitespaces();
		}

		let content: TContent | null = this.chr == '{' ? this._readContent(true) : null;

		return {
			nodeType: NodeType.ELEMENT,
			tagName,
			isHelper,
			names: elNames,
			attributes: attrs,
			content
		};
	}

	_readAttributes(): IElementAttributes {
		this._next('(');

		if (this._skipWhitespacesAndComments() == ')') {
			this._next();

			return {
				superCall: null,
				list: []
			};
		}

		let superCall: ISuperCall | null | undefined;
		let list = [] as TElementAttributeList;

		for (;;) {
			if (!superCall && this.chr == 's' && (superCall = this._readSuperCall())) {
				this._skipWhitespacesAndComments();
			} else {
				let name = this._readName(reAttributeNameOrNothing);

				if (!name) {
					throw {
						name: 'SyntaxError',
						message: 'Invalid attribute name',
						at: this.at,
						nelm: this.nelm
					};
				}

				if (this._skipWhitespacesAndComments() == '=') {
					this._next();

					let chr = this._skipWhitespaces();

					if (chr == "'" || chr == '"' || chr == '`') {
						let str = this._readString();

						list.push({
							name,
							value: str.multiline ? normalizeMultilineText(str.value) : str.value
						});
					} else {
						let value = '';

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
								list.push({ name, value: value.trim() });
								break;
							}

							value += chr;

							chr = this._next();
						}
					}

					this._skipWhitespacesAndComments();
				} else {
					list.push({ name, value: '' });
				}
			}

			if (this.chr == ')') {
				this._next();
				break;
			} else if (this.chr == ',') {
				this._next();
				this._skipWhitespacesAndComments();
			} else {
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
			list
		};
	}

	_skipWhitespacesAndComments(): string {
		let chr = this.chr;

		for (;;) {
			if (chr && chr <= ' ') {
				chr = this._next();
			} else if (chr == '/') {
				this._readComment();
				chr = this.chr;
			} else {
				break;
			}
		}

		return chr;
	}

	_readSuperCall(): ISuperCall | null {
		reSuperCallOrNothing.lastIndex = this.at;
		let superCallMatch = (reSuperCallOrNothing.exec(this.nelm) as RegExpExecArray);

		if (superCallMatch[0]) {
			this.chr = this.nelm.charAt((this.at = reSuperCallOrNothing.lastIndex));

			return {
				nodeType: NodeType.SUPER_CALL,
				elementName: superCallMatch[1] || null
			};
		}

		return null;
	}

	_readTextNode(): ITextNode {
		let str = this._readString();

		return {
			nodeType: NodeType.TEXT,
			value: str.multiline ? normalizeMultilineText(str.value) : str.value
		};
	}

	_readString(): { value: string, multiline: boolean } {
		let quoteChar = this.chr;

		if (quoteChar != "'" && quoteChar != '"' && quoteChar != '`') {
			throw {
				name: 'SyntaxError',
				message: `Expected "'" instead of "${ this.chr }"`,
				at: this.at,
				nelm: this.nelm
			};
		}

		let str = '';

		for (let chr = this._next(); chr;) {
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
					let at = this.at;

					let hexadecimal = chr == 'x';
					let code = parseInt(this.nelm.slice(at + 1, at + (hexadecimal ? 3 : 5)), 16);

					if (!isFinite(code)) {
						throw {
							name: 'SyntaxError',
							message: `Malformed ${ hexadecimal ? 'hexadecimal' : 'unicode' } escape sequence`,
							at: at - 1,
							nelm: this.nelm
						}
					}

					str += String.fromCharCode(code);
					chr = this.chr = this.nelm.charAt((this.at = at + (hexadecimal ? 3 : 5)));
				} else if (chr in escapee) {
					str += escapee[chr];
					chr = this._next();
				} else {
					break;
				}
			} else {
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
	}

	_readComment(): IComment {
		let value = '';
		let multiline: boolean;

		switch (this._next('/')) {
			case '/': {
				for (let chr; (chr = this._next()) && chr != '\r' && chr != '\n';) {
					value += chr;
				}

				multiline = false;

				break;
			}
			case '*': {
				let stop = false;

				do {
					switch (this._next()) {
						case '*': {
							if (this._next() == '/') {
								this._next();
								stop = true;
							} else {
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
				} while (!stop);

				multiline = true;

				break;
			}
			default: {
				throw {
					name: 'SyntaxError',
					message: `Expected "/" instead of "${ this.chr }"`,
					at: this.at,
					nelm: this.nelm
				}
			}
		}

		return {
			nodeType: NodeType.COMMENT,
			value,
			multiline
		};
	}

	_readElementNames(): Array<string | null> | null {
		let names = this.chr == ',' ? (this._next(), this._skipWhitespaces(), [null] as Array<string | null>) : null;

		for (let name; (name = this._readName(reElementNameOrNothing));) {
			(names || (names = [] as Array<string | null>)).push(name);

			if (this._skipWhitespaces() != ',') {
				break;
			}

			this._next();
			this._skipWhitespaces();
		}

		return names;
	}

	_readName(reNameOrNothing: RegExp): string | null {
		reNameOrNothing.lastIndex = this.at;
		let name = (reNameOrNothing.exec(this.nelm) as RegExpExecArray)[0];

		if (name) {
			this.chr = this.nelm.charAt((this.at = reNameOrNothing.lastIndex));
			return name;
		}

		return null;
	}

	_skipWhitespaces(): string {
		let chr = this.chr;

		while (chr && chr <= ' ') {
			chr = this._next();
		}

		return chr;
	}

	_next(current?: string): string {
		if (current && current != this.chr) {
			throw {
				name: 'SyntaxError',
				message: `Expected "${ current }" instead of "${ this.chr }"`,
				at: this.at,
				nelm: this.nelm
			};
		}

		return (this.chr = this.nelm.charAt(++this.at));
	}
}
