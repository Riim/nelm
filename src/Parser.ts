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

export interface IBlockDeclaration {
	blockName: string;
}

export type TContent = Array<INode>;

export interface IBlock extends INode {
	nodeType: NodeType.BLOCK;
	declaration: IBlockDeclaration | null;
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
	isHelper: boolean;
	tagName: string | null;
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

let reBlockNameOrNothing = /[a-zA-Z][\-\w]*|/g;
let reTagNameOrNothing = /[a-zA-Z][\-\w]*(?::[a-zA-Z][\-\w]*)?|/g;
let reElementNameOrNothing = /[a-zA-Z][\-\w]*|/g;
let reAttributeNameOrNothing = /[_a-zA-Z][\-\w]*(?::[_a-zA-Z][\-\w]*)?|/g;
let reSuperCallOrNothing = /super(?:\.([a-zA-Z][\-\w]*))?!|/g;

function normalizeMultilineText(text: string): string {
	return text.trim().replace(/\s*(?:\r\n?|\n)/g, '\n').replace(/\n\s+/g, '\n');
}

export default class Parser {
	beml: string;
	at: number;
	chr: string;

	constructor(beml: string) {
		this.beml = beml;
	}

	parse(): IBlock {
		this.at = 0;
		this.chr = this.beml.charAt(0);

		let content: TContent | undefined;

		while (this._skipWhitespaces() == '/') {
			(content || (content = [])).push(this._readComment());
		}

		let decl = this.chr == '#' ? this._readBlockDeclaration() : null;

		return {
			nodeType: NodeType.BLOCK,
			declaration: decl,
			name: decl && decl.blockName,
			content: content ? content.concat(this._readContent(false)) : this._readContent(false)
		};
	}

	_readBlockDeclaration(): IBlockDeclaration {
		let at = this.at;

		this._next('#');

		let blockName = this._readName(reBlockNameOrNothing);

		if (!blockName) {
			throw {
				name: 'SyntaxError',
				message: 'Invalid block declaration',
				at,
				beml: this.beml
			};
		}

		return {
			blockName
		};
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
							beml: this.beml
						};
					}

					return content;
				}
				default: {
					if (this.chr == '/') {
						let next = this.beml.charAt(this.at + 1);

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
						let superCallMatch = (reSuperCallOrNothing.exec(this.beml) as RegExpExecArray);

						if (superCallMatch[0]) {
							this.chr = this.beml.charAt((this.at = reSuperCallOrNothing.lastIndex));

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
				message: 'Expected tag name',
				at,
				beml: this.beml
			};
		}

		let attrs = this.chr == '(' ? this._readAttributes() : null;

		if (attrs) {
			this._skipWhitespaces();
		}

		let content: TContent | null = this.chr == '{' ? this._readContent(true) : null;

		return {
			nodeType: NodeType.ELEMENT,
			isHelper,
			tagName,
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
						beml: this.beml
					};
				}

				if (this._skipWhitespacesAndComments() == '=') {
					this._next();

					let next = this._skipWhitespaces();

					if (next == "'" || next == '"' || next == '`') {
						let str = this._readString();

						list.push({
							name,
							value: str.multiline ? normalizeMultilineText(str.value) : str.value
						});
					} else {
						let value = '';

						for (;;) {
							if (!next) {
								throw {
									name: 'SyntaxError',
									message: 'Invalid attribute',
									at: this.at,
									beml: this.beml
								};
							}

							if (next == '\r' || next == '\n' || next == ',' || next == ')') {
								list.push({ name, value: value.trim() });
								break;
							}

							value += next;

							next = this._next();
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
					beml: this.beml
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
		let superCallMatch = (reSuperCallOrNothing.exec(this.beml) as RegExpExecArray);

		if (superCallMatch[0]) {
			this.chr = this.beml.charAt((this.at = reSuperCallOrNothing.lastIndex));

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
				beml: this.beml
			};
		}

		let str = '';

		for (let next; (next = this._next());) {
			if (next == quoteChar) {
				this._next();

				return {
					value: str,
					multiline: quoteChar == '`'
				};
			}

			if (next == '\\') {
				str += next + this._next();
			} else {
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
	}

	_readComment(): IComment {
		let value = '';
		let multiline: boolean;

		switch (this._next('/')) {
			case '/': {
				for (let next; (next = this._next()) && next != '\r' && next != '\n';) {
					value += next;
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
					message: `Expected "/" instead of "${ this.chr }"`,
					at: this.at,
					beml: this.beml
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
		let name = (reNameOrNothing.exec(this.beml) as RegExpExecArray)[0];

		if (name) {
			this.chr = this.beml.charAt((this.at += name.length));
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
				beml: this.beml
			};
		}

		return (this.chr = this.beml.charAt(++this.at));
	}
}
