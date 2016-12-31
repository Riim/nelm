export enum BemlNodeType {
	BLOCK = 1,
	ELEMENT,
	TEXT,
	COMMENT
}

export interface IBemlNode {
	nodeType: BemlNodeType;
	at: number;
	raw: string;
}

export interface IBemlBlockDeclaration {
	at: number;
	raw: string;
	blockName: string;
}

export type TBemlContent = Array<IBemlNode>;

export interface IBemlBlock extends IBemlNode {
	nodeType: BemlNodeType.BLOCK;
	declaration: IBemlBlockDeclaration;
	name: string;
	content: TBemlContent;
}

export interface IBemlElementAttribute {
	name: string;
	value: string | true;
}

export type TBemlElementAttributeList = Array<IBemlElementAttribute>;

export interface IBemlElementAttributes {
	at: number;
	raw: string;
	list: TBemlElementAttributeList;
}

export interface IBemlElement extends IBemlNode {
	nodeType: BemlNodeType.ELEMENT;
	name: string | null;
	attributes: IBemlElementAttributes | null;
	content: TBemlContent | null;
}

export interface IBemlTextNode extends IBemlNode {
	nodeType: BemlNodeType.TEXT;
	value: string;
}

export interface IBemlComment extends IBemlNode {
	nodeType: BemlNodeType.COMMENT;
	value: string;
	multiline: boolean;
}

let namePattern = '[a-zA-Z][\\-_0-9a-zA-Z]*';

let reNameOrNothing = RegExp(namePattern + '|', 'g');

export default class Parser {
	beml: string;
	at: number;
	chr: string;

	constructor(beml: string) {
		this.beml = beml;
	}

	parse(): IBemlBlock {debugger;
		this.at = 0;
		this.chr = this.beml.charAt(0);

		let content: TBemlContent | undefined;

		while (this._skipWhitespaces() == '/') {
			(content || (content = [])).push(this._readComment());
		}

		let decl = this._readBlockDeclaration();

		return {
			nodeType: BemlNodeType.BLOCK,
			at: 0,
			raw: this.beml,
			declaration: decl,
			name: decl.blockName,
			content: content ? content.concat(this._readContent(false)) : this._readContent(false)
		};
	}

	_readBlockDeclaration(): IBemlBlockDeclaration {
		let at = this.at;

		this._next('#');

		let blockName = this._readName();

		if (!blockName) {
			throw {
				name: 'SyntaxError',
				message: 'Invalid block declaration',
				at,
				beml: this.beml
			};
		}

		return {
			at,
			raw: '#' + blockName,
			blockName
		};
	}

	_readContent(brackets: boolean): TBemlContent {
		if (brackets) {
			this._next('{');
		}

		let content = [] as TBemlContent;

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
	}

	_readElement(): IBemlElement {
		let at = this.at;
		let tagName = this._readName();

		if (!tagName) {
			throw {
				name: 'SyntaxError',
				message: 'Expected tag name',
				at,
				beml: this.beml
			};
		}

		let elName = this._skipWhitespaces() == '/' ? (this._next(), this._readName()) : null;

		if (elName) {
			this._skipWhitespaces();
		}

		let attrs = this.chr == '(' ? this._readAttributes() : null;

		if (attrs) {
			this._skipWhitespaces();
		}

		let content: TBemlContent | null = this.chr == '{' ? this._readContent(true) : null;

		return {
			nodeType: BemlNodeType.ELEMENT,
			at,
			raw: this.beml.slice(at, this.at).trim(),
			name: elName,
			attributes: attrs,
			content
		};
	}

	_readAttributes(): IBemlElementAttributes {
		let at = this.at;

		this._next('(');

		if (this._skipWhitespaces() == ')') {
			this._next();

			return {
				at,
				raw: this.beml.slice(at, this.at),
				list: []
			};
		}

		let list = [] as TBemlElementAttributeList;

		for (;;) {
			let name = this._readName();

			if (!name) {
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

				let chr = this.chr;

				if (chr == "'" || chr == '"' || chr == '`') {
					list.push({ name, value: this._readString() });
				} else {
					let value = '';

					for (;;) {
						let next = this._next();

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
					}
				}

				this._skipWhitespaces();
			} else {
				list.push({ name, value: true });
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
			at,
			raw: this.beml.slice(at, this.at),
			list
		};
	}

	_readTextNode(): IBemlTextNode {
		let at = this.at;
		let str = this._readString();

		return {
			nodeType: BemlNodeType.TEXT,
			at,
			raw: this.beml.slice(at, this.at),
			value: str
		};
	}

	_readString(): string {
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
				return quoteChar + str + quoteChar;
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

	_readComment(): IBemlComment {
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
			nodeType: BemlNodeType.COMMENT,
			at,
			raw: this.beml.slice(at, this.at),
			value,
			multiline
		};
	}

	_readName(): string | null {
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
