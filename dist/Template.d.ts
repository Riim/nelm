import { INode as IBemlNode } from './Parser';
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
export default class Template {
    parent: Template | null;
    _elementClassesTemplate: Array<string>;
    _currentNode: INode;
    _nodes: Array<INode>;
    _nodeMap: {
        [elName: string]: INode;
    };
    _renderer: IRenderer;
    _elementRendererMap: IElementRendererMap;
    constructor(beml: string, opts?: {
        parent?: Template;
        blockName?: string;
    });
    _handleNode(node: IBemlNode, parentNodeName: string): void;
    extend(beml: string, opts?: {
        blockName?: string;
    }): Template;
    render(): any;
}
