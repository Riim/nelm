export enum NodeType {
	BLOCK = 1,
	ELEMENT,
	TEXT,
	COMMENT,
	SUPER_CALL
}

export interface INode {
	nodeType: NodeType;
	at: number;
	raw: string;
}

export interface IBlockDeclaration {
	blockName: string;
	at: number;
	raw: string;
}

export type TContent = Array<INode>;

export interface IBlock extends INode {
	nodeType: NodeType.BLOCK;
	declaration: IBlockDeclaration | null;
	name: string | undefined;
	content: TContent;
}

export interface IElementAttribute {
	name: string;
	value: string;
}

export type TElementAttributeList = Array<IElementAttribute>;

export interface IElementAttributes {
	list: TElementAttributeList;
	at: number;
	raw: string;
}

export interface IElement extends INode {
	nodeType: NodeType.ELEMENT;
	tagName: string;
	name: string | null;
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

export interface ISuperCall extends INode {
	nodeType: NodeType.SUPER_CALL;
}

let reBlockNameOrNothing = /[a-zA-Z][\-\w]*|/g;
let reTagNameOrNothing = /[a-zA-Z][\-\w]*(?::[_a-zA-Z][\-\w]*)?|/g;
let reElementNameOrNothing = /[a-zA-Z][\-\w]*|/g;
let reAttributeNameOrNothing = /[_a-zA-Z][\-\w]*(?::[_a-zA-Z][\-\w]*)?|/g;
let superCallStatement = 'super!';

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
			name: decl ? decl.blockName : undefined,
			content: content ? content.concat(this._readContent(false)) : this._readContent(false),
			at: 0,
			raw: this.beml,
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
			blockName,
			at,
			raw: '#' + blockName
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
					if (brackets) {
						if (this.chr == '}') {
							this._next();
							return content;
						}

						let at = this.at;

						if (this.beml.slice(at, at + superCallStatement.length) == superCallStatement) {
							this.chr = this.beml.charAt((this.at = at + superCallStatement.length));

							content.push({
								nodeType: NodeType.SUPER_CALL,
								at: at,
								raw: 'super!'
							});

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
		let tagName = this._readName(reTagNameOrNothing);

		if (!tagName) {
			throw {
				name: 'SyntaxError',
				message: 'Expected tag name',
				at,
				beml: this.beml
			};
		}

		let elName = this._skipWhitespaces() == '/' ? (this._next(), this._readName(reElementNameOrNothing)) : null;

		if (elName) {
			this._skipWhitespaces();
		}

		let attrs = this.chr == '(' ? this._readAttributes() : null;

		if (attrs) {
			this._skipWhitespaces();
		}

		let content: TContent | null = this.chr == '{' ? this._readContent(true) : null;

		return {
			nodeType: NodeType.ELEMENT,
			tagName,
			name: elName,
			attributes: attrs,
			content,
			at,
			raw: this.beml.slice(at, this.at).trim(),
		};
	}

	_readAttributes(): IElementAttributes {
		let at = this.at;

		this._next('(');

		if (this._skipWhitespaces() == ')') {
			this._next();

			return {
				list: [],
				at,
				raw: this.beml.slice(at, this.at)
			};
		}

		let list = [] as TElementAttributeList;

		for (;;) {
			let name = this._readName(reAttributeNameOrNothing);

			if (!name) {
				throw {
					name: 'SyntaxError',
					message: 'Invalid attribute name',
					at: this.at,
					beml: this.beml
				};
			}

			if (this._skipWhitespaces() == '=') {
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

				this._skipWhitespaces();
			} else {
				list.push({ name, value: '' });
			}

			if (this.chr == ')') {
				this._next();
				break;
			} else if (this.chr == ',') {
				this._next();
				this._skipWhitespaces();
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
			list,
			at,
			raw: this.beml.slice(at, this.at)
		};
	}

	_readTextNode(): ITextNode {
		let at = this.at;
		let str = this._readString();

		return {
			nodeType: NodeType.TEXT,
			value: str.multiline ? normalizeMultilineText(str.value) : str.value,
			at,
			raw: this.beml.slice(at, this.at)
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
		let at = this.at;
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
			multiline,
			at,
			raw: this.beml.slice(at, this.at)
		};
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
