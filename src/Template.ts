import escapeString from 'escape-string';
import escapeHTML from '@riim/escape-html';
import {
	NodeType as BemlNodeType,
	INode as IBemlNode,
	IElement as IBemlElement,
	ITextNode as IBemlTextNode,
	ISuperCall as IBemlSuperCall,
	default as Parser
} from './Parser';
import selfClosingTags from './selfClosingTags';

let hasOwn = Object.prototype.hasOwnProperty;
let join = Array.prototype.join;

export interface INode {
	elementName: string | null;
	source: Array<string> | null;
	innerSource: Array<string>;
	containsSuperCall: boolean;
}

export interface IRenderer {
	(this: IElementRendererMap): string;
}

export interface IElementRenderer {
	(this: IElementRendererMap, $super?: IElementRendererMap): string;
}

export interface IElementRendererMap {
	[nodeName: string]: IElementRenderer;
}

let elDelimiter = '__';

export default class Template {
	parent: Template | null;

	_elementClassesTemplate: Array<string>;

	_currentNode: INode;
	_nodes: Array<INode>;
	_nodeMap: { [elName: string]: INode };

	_renderer: IRenderer;
	_elementRendererMap: IElementRendererMap;

	_attributeListMap: { [elName: string]: Object };
	_attributeCountMap: { [elName: string]: number };

	constructor(beml: string, opts?: { parent?: Template, blockName?: string }) {
		let block = new Parser(beml).parse();
		let blockName = opts && opts.blockName || block.name;

		if (!blockName) {
			throw new TypeError('blockName is required');
		}

		let parent = this.parent = opts && opts.parent || null;

		this._elementClassesTemplate = parent ?
			[blockName + elDelimiter].concat(parent._elementClassesTemplate) :
			[blockName + elDelimiter, ''];

		let rootNode = { elementName: null, source: null, innerSource: [], containsSuperCall: false };

		this._currentNode = rootNode;
		this._nodes = [rootNode];
		let nodeMap = this._nodeMap = { '#root': rootNode } as { [elName: string]: INode };

		for (let node of block.content) {
			this._handleNode(node, '#root');
		}

		this._renderer = parent ?
			parent._renderer :
			Function(`return ${ this._currentNode.innerSource.join(' + ') };`) as IRenderer;

		Object.keys(nodeMap).forEach(function(this: IElementRendererMap, name: string) {
			let node = nodeMap[name];

			if (node.source) {
				this[name] = Function(`return ${ (node.source as Array<string>).join(' + ') };`) as IElementRenderer;

				if (node.containsSuperCall) {
					let inner = Function('$super', `return ${ node.innerSource.join(' + ') || "''" };`) as
						IElementRenderer;
					let parentElementRendererMap = parent && parent._elementRendererMap;
					this[name + '@content'] = function() { return inner.call(this, parentElementRendererMap); };
				} else {
					this[name + '@content'] = Function(`return ${ node.innerSource.join(' + ') || "''" };`) as
						IElementRenderer;
				}
			}
		}, (this._elementRendererMap = Object.create(parent && parent._elementRendererMap) as IElementRendererMap));
	}

	_handleNode(node: IBemlNode, parentNodeName: string) {
		switch (node.nodeType) {
			case BemlNodeType.ELEMENT: {
				let parent = this.parent;
				let nodes = this._nodes;
				let el = node as IBemlElement;
				let tagName = el.tagName;
				let elName = el.name;
				let elAttrs = el.attributes;
				let content = el.content;

				if (elName) {
					let attrListMap = this._attributeListMap ||
						(this._attributeListMap = Object.create(parent && parent._attributeListMap || null) as any);
					let attrCountMap = this._attributeCountMap ||
						(this._attributeCountMap = Object.create(parent && parent._attributeCountMap || null) as any);
					let renderredAttrs: string;

					if (elAttrs && (elAttrs.list.length || elAttrs.superCall)) {
						let superCall = elAttrs.superCall;
						let attrList: Object;
						let attrCount: number;

						if (superCall) {
							if (!parent) {
								throw new TypeError(`Required parent template for "${ superCall.raw }"`);
							}

							attrList = attrListMap[elName] =
								Object.create(parent._attributeListMap[superCall.elementName || elName] || null);
							attrCount = attrCountMap[elName] =
								parent._attributeCountMap[superCall.elementName || elName] || 0;
						} else {
							attrList = attrListMap[elName] = {};
							attrCount = attrCountMap[elName] = 0;
						}

						for (let attr of elAttrs.list) {
							let name = attr.name;
							let value = attr.value;
							let index = attrList[name];

							if (index === undefined) {
								attrList[attrCount] = ` ${ name }="${ value && escapeHTML(escapeString(value)) }"`;
								attrList[name] = attrCount++;
								attrCountMap[elName] = attrCount;
							} else {
								attrList[index] = ` ${ name }="${ value && escapeHTML(escapeString(value)) }"`;
								attrList[name] = index;
							}
						}

						if (elName.charAt(0) != '_') {
							let hasAttrClass = hasOwn.call(attrList, 'class');

							attrList = { __proto__: attrList, length: attrCount + +!hasAttrClass };

							if (hasAttrClass) {
								attrList[attrList['class']] = ' class="' +
									this._elementClassesTemplate.join(elName + ' ') +
									attrList[attrList['class']].slice(8);
							} else {
								attrList[attrCount] = ` class="${
									this._elementClassesTemplate.join(elName + ' ').slice(0, -1)
								}"`;
							}
						} else {
							attrList = { __proto__: attrList, length: attrCount };
						}

						renderredAttrs = join.call(attrList, '');
					} else {
						renderredAttrs = elName.charAt(0) != '_' ?
							` class="${ this._elementClassesTemplate.join(elName + ' ').slice(0, -1) }"` :
							'';
					}

					let currentNode = {
						elementName: elName,
						source: [
							`'<${ tagName }${ renderredAttrs }>'`,
							content && content.length ?
								`this['${ elName }@content']() + '</${ tagName }>'` :
								(!content && tagName in selfClosingTags ? "''" : `'</${ tagName }>'`)
						],
						innerSource: [],
						containsSuperCall: false
					};

					nodes.push((this._currentNode = currentNode));
					this._nodeMap[elName] = currentNode;
				} else {
					this._currentNode.innerSource.push(`'<${ tagName }${
						elAttrs ?
							elAttrs.list.map(
								attr => ` ${ attr.name }="${ attr.value && escapeHTML(escapeString(attr.value)) }"`
							).join('') :
							''
					}>'`);
				}

				if (content) {
					for (let contentNode of content) {
						this._handleNode(contentNode, elName || parentNodeName);
					}
				}

				if (elName) {
					nodes.pop();
					this._currentNode = nodes[nodes.length - 1];
					this._currentNode.innerSource.push(`this['${ elName }']()`);
				} else if (content || !(tagName in selfClosingTags)) {
					this._currentNode.innerSource.push(`'</${ tagName }>'`);
				}

				break;
			}
			case BemlNodeType.TEXT: {
				this._currentNode.innerSource.push(`'${ escapeString((node as IBemlTextNode).value) }'`);
				break;
			}
			case BemlNodeType.SUPER_CALL: {
				this._currentNode.innerSource.push(
					`$super['${ (node as IBemlSuperCall).elementName || parentNodeName }@content'].call(this)`
				);
				this._currentNode.containsSuperCall = true;
				break;
			}
		}
	}

	extend(beml: string, opts?: { blockName?: string }): Template {
		return new Template(beml, { __proto__: opts || null, parent: this } as any);
	}

	render() {
		return this._renderer.call(this._elementRendererMap);
	}
}
