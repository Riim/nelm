import escapeString from 'escape-string';
import {
	NodeType as BemlNodeType,
	INode as IBemlNode,
	IElement as IBemlElement,
	ITextNode as IBemlTextNode,
	ISuperCall as IBemlSuperCall,
	default as Parser
} from './Parser';
import selfClosingTags from './selfClosingTags';
import renderAttributes from './renderAttributes';

export interface INode {
	elementName: string | null;
	source: Array<string> | null;
	innerSource: Array<string>;
	hasSuperCall: boolean;
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

		let rootNode = { elementName: null, source: null, innerSource: [], hasSuperCall: false };

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

				if (node.hasSuperCall) {
					let inner = Function('$super', `return ${ node.innerSource.join(' + ') };`) as IElementRenderer;
					let parentElementRendererMap = parent && parent._elementRendererMap;
					this[name + '@content'] = function() { return inner.call(this, parentElementRendererMap); };
				} else {
					this[name + '@content'] = Function(`return ${ node.innerSource.join(' + ') };`) as IElementRenderer;
				}
			}
		}, (this._elementRendererMap = Object.create(parent && parent._elementRendererMap) as IElementRendererMap));
	}

	_handleNode(node: IBemlNode, parentNodeName: string) {
		switch (node.nodeType) {
			case BemlNodeType.ELEMENT: {
				let nodes = this._nodes;
				let el = node as IBemlElement;
				let tagName = el.tagName;
				let elName = el.name;
				let content = el.content;

				if (elName) {
					let currentNode = {
						elementName: elName,
						source: [
							`'<${ tagName }${ renderAttributes(this._elementClassesTemplate, el) }>'`,
							content && content.length ?
								`this['${ elName }@content']() + '</${ tagName }>'` :
								(tagName in selfClosingTags ? "''" : `'</${ tagName }>'`)
						],
						innerSource: [],
						hasSuperCall: false
					} as INode;

					nodes.push((this._currentNode = currentNode));
					this._nodeMap[elName] = currentNode;
				} else {
					this._currentNode.innerSource.push(
						`'<${ tagName }${ renderAttributes(this._elementClassesTemplate, el) }>'`
					);
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
				this._currentNode.hasSuperCall = true;
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
